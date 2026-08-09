# Advisor Onboarding Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可恢复、可降级、可人工确认的顾问画像初始化服务，并将画像 V1 与首条任务接入现有 OneKOS 闭环。

**Architecture:** 新增独立的 `advisor-onboarding` 领域模块负责输入校验、状态和候选标签约束；`OneKosService` 负责调用模型、Repository 和幂等写入；Simulation/Feishu Repository 统一实现初始化会话、顾问、标签和任务接口。前端沿用当前原生 ES Module 单页结构，不引入新框架。

**Tech Stack:** Node.js 24、原生 ES Modules、`node:test`、飞书 Bitable OpenAPI、OpenAI-compatible JSON API、原生 HTML/CSS/JavaScript。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `src/advisor-onboarding.mjs` | 纯领域逻辑：输入标准化、会话状态、规则候选、模型候选校验、确认结果 |
| `src/onekos-service.mjs` | 初始化流程编排、模型降级、幂等跨表写入 |
| `src/onekos-repository.mjs` | Simulation 与 Feishu 的会话、顾问、标签、任务读写 |
| `src/api-router.mjs` | 顾问与初始化 HTTP API |
| `src/runtime-config.mjs` | 第八张飞书表 ID |
| `public/api-client.js` | 浏览器初始化 API 客户端 |
| `public/app-v2.js` | 顾问选择、资料采集、候选确认和完成跳转 |
| `public/styles-v2.css` | 初始化页面响应式样式 |
| `src/feishu-poc.mjs`、`scripts/export-feishu-data.mjs` | 第八张表的数据与导入文件 |
| `docs/开发手册.md` | 持续记录功能、接口、数据、验证命令和每次修改 |

### Task 1: 建立开发手册与初始化领域模型

**Files:**
- Create: `docs/开发手册.md`
- Create: `src/advisor-onboarding.mjs`
- Create: `tests/advisor-onboarding.test.mjs`

- [ ] **Step 1: 创建开发手册初始结构**

写入项目目标、分支、运行方式、架构索引、功能状态、接口表、数据表、测试命令和变更日志。将“每次功能修改必须同步更新本文件”写入维护规则。

- [ ] **Step 2: 写输入校验与规则候选的失败测试**

测试公开 API：

```js
import { normalizeOnboardingInput, createOnboardingSession, generateRuleCandidates } from '../src/advisor-onboarding.mjs';

test('基础资料与三组偏好形成可生成的初始化会话', () => {
  const input = normalizeOnboardingInput({
    advisorId: 'adv-new-001', displayName: '顾问小林', city: '成都', store: '成都模拟门店',
    experienceYears: 3, targetAudience: '城市通勤家庭', specialties: ['补能路线'],
    preferences: { openingStyle: '先结论后解释', evidencePreference: '实车场景证明', tone: '专业克制' },
  });
  const session = createOnboardingSession(input, { sessionId: 'ONB-001', now: '2026-08-09T00:00:00.000Z' });
  assert.equal(input.advisorId, 'ADV-NEW-001');
  assert.equal(session.status, 'draft');
});

test('无历史样本时规则候选降低置信度并保留输入证据', () => {
  const candidates = generateRuleCandidates(validInput);
  assert.ok(candidates.length >= 5);
  assert.ok(candidates.every((tag) => tag.confidence < 85 && tag.evidence));
});
```

- [ ] **Step 3: 运行测试并确认 RED**

Run: `node --test tests/advisor-onboarding.test.mjs`

Expected: FAIL，原因是 `src/advisor-onboarding.mjs` 或导出函数不存在。

- [ ] **Step 4: 实现最小领域函数**

实现：

```js
const DIMENSIONS = new Set(['专业能力', '地域场景', '目标用户', '表达结构', '表达语气', '证据偏好', '内容形式', '转化能力', '禁用表达']);
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

function requiredText(value, label) {
  const text = String(value || '').trim();
  if (!text) {
    const error = new Error(`${label}不能为空`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

export function normalizeOnboardingInput(raw = {}) {
  const preferences = raw.preferences || {};
  return {
    advisorId: requiredText(raw.advisorId, '顾问ID').toUpperCase(),
    displayName: requiredText(raw.displayName, '展示名称'),
    city: requiredText(raw.city, '城市'),
    store: requiredText(raw.store, '门店'),
    experienceYears: clamp(raw.experienceYears),
    targetAudience: requiredText(raw.targetAudience, '目标用户'),
    specialties: (Array.isArray(raw.specialties) ? raw.specialties : String(raw.specialties || '').split(/[，,]/)).map((item) => item.trim()).filter(Boolean),
    preferences: {
      openingStyle: requiredText(preferences.openingStyle, '开场偏好'),
      evidencePreference: requiredText(preferences.evidencePreference, '证据偏好'),
      tone: requiredText(preferences.tone, '表达语气'),
    },
    historyContents: (raw.historyContents || []).map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5),
    voiceTranscript: String(raw.voiceTranscript || '').trim().slice(0, 4000),
    forbiddenExpressions: (raw.forbiddenExpressions || []).map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20),
  };
}

export function createOnboardingSession(input, { sessionId, now }) {
  return { sessionId, advisorId: input.advisorId, status: 'draft', input, candidates: [], acceptedTags: [], writeProgress: {}, createdAt: now, updatedAt: now };
}

export function generateRuleCandidates(input) {
  const richEvidence = input.historyContents.length > 0 || Boolean(input.voiceTranscript);
  const confidence = richEvidence ? 84 : 68;
  const rows = [
    ['专业能力', input.specialties[0], `顾问填写擅长问题：${input.specialties[0]}`],
    ['地域场景', `${input.city}本地场景`, `服务城市：${input.city}`],
    ['目标用户', input.targetAudience, `顾问填写目标用户：${input.targetAudience}`],
    ['表达结构', input.preferences.openingStyle, `偏好选择：${input.preferences.openingStyle}`],
    ['证据偏好', input.preferences.evidencePreference, `偏好选择：${input.preferences.evidencePreference}`],
    ['表达语气', input.preferences.tone, `偏好选择：${input.preferences.tone}`],
  ];
  return rows.map(([dimension, label, evidence], index) => ({ tagId: `TAG-${input.advisorId}-${String(index + 1).padStart(2, '0')}`, dimension, label, weight: 60 + index * 3, confidence, source: richEvidence ? '资料＋样本' : '资料＋偏好冷启动', evidence, status: '候选' }));
}

export function normalizeModelCandidates(raw, input) {
  const rows = Array.isArray(raw) ? raw : raw?.tags;
  if (!Array.isArray(rows)) throw new Error('模型候选标签必须是数组');
  const seen = new Set();
  return rows.filter((item) => DIMENSIONS.has(item.dimension) && String(item.evidence || '').trim()).filter((item) => {
    const key = `${item.dimension}:${String(item.label || '').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item, index) => ({ tagId: `TAG-${input.advisorId}-${String(index + 1).padStart(2, '0')}`, dimension: item.dimension, label: requiredText(item.label, '标签'), weight: clamp(item.weight), confidence: clamp(item.confidence), source: '模型分析授权资料', evidence: String(item.evidence).trim(), status: '候选' }));
}

export function confirmCandidateTags(session, acceptedTags, now) {
  const acceptedById = new Map(acceptedTags.map((item) => [item.tagId, item]));
  const tags = session.candidates.filter((item) => acceptedById.has(item.tagId)).map((item) => {
    const edit = acceptedById.get(item.tagId);
    return { ...item, label: String(edit.label || item.label).trim(), weight: clamp(edit.weight ?? item.weight), status: edit.locked ? '锁定' : '生效', profileVersion: 1, updatedAt: now };
  });
  if (!tags.length) throw new Error('至少确认一个画像标签');
  return { tags, profileVersion: 1, task: { taskId: `TASK-${session.advisorId}-001`, advisorId: session.advisorId, profileEvidence: tags.map((item) => item.tagId), status: '待生成' } };
}
```

维度白名单固定为：专业能力、地域场景、目标用户、表达结构、表达语气、证据偏好、内容形式、转化能力、禁用表达。

- [ ] **Step 5: 运行领域测试并确认 GREEN**

Run: `node --test tests/advisor-onboarding.test.mjs`

Expected: PASS。

- [ ] **Step 6: 更新开发手册并提交**

记录领域模型、输入限制和状态机。

```powershell
git add docs/开发手册.md src/advisor-onboarding.mjs tests/advisor-onboarding.test.mjs
git commit -m "feat: add advisor onboarding domain model"
```

### Task 2: 扩展初始化会话与顾问 Repository

**Files:**
- Modify: `src/onekos-repository.mjs`
- Create: `tests/onekos-repository.test.mjs`
- Modify: `docs/开发手册.md`

- [ ] **Step 1: 写 Simulation Repository 失败测试**

覆盖 `listAdvisors`、`saveAdvisor`、`saveOnboardingSession`、`getOnboardingSession`、`saveContentTask`，并验证相同业务键第二次写入返回 `updated` 且没有重复记录。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node --test tests/onekos-repository.test.mjs`

Expected: FAIL，原因是方法不存在。

- [ ] **Step 3: 实现 Simulation Repository**

在种子数据增加 `onboardingSessions: []`，复用现有 `upsert`；所有返回值使用 `structuredClone`，避免调用方修改内部状态。

- [ ] **Step 4: 为 Feishu Repository 写字段映射失败测试**

使用内存 Fake Client 验证：

```js
await repository.saveOnboardingSession({ sessionId: 'ONB-001', advisorId: 'ADV-NEW-001', status: 'generated' });
assert.equal(fake.upserts[0].tableId, 'tbl-onboarding');
assert.equal(fake.upserts[0].field, '会话ID');
```

- [ ] **Step 5: 实现 Feishu Repository 字段映射**

会话复杂字段以 JSON 字符串保存；顾问和标签增加画像版本、身份来源、初始化状态、来源引用等字段。确认接口继续使用稳定业务键 upsert。

- [ ] **Step 6: 运行 Repository 与既有测试**

Run: `node --test tests/onekos-repository.test.mjs tests/feishu-client.test.mjs tests/onekos-service.test.mjs`

Expected: PASS。

- [ ] **Step 7: 更新开发手册并提交**

```powershell
git add src/onekos-repository.mjs tests/onekos-repository.test.mjs docs/开发手册.md
git commit -m "feat: persist advisor onboarding sessions"
```

### Task 3: 实现初始化服务编排、模型降级与幂等确认

**Files:**
- Modify: `src/onekos-service.mjs`
- Modify: `tests/onekos-service.test.mjs`
- Modify: `docs/开发手册.md`

- [ ] **Step 1: 写创建、生成、恢复、确认的失败测试**

目标接口：

```js
await service.listAdvisors();
await service.createAdvisorIdentity(input);
await service.createOnboardingSession(input);
await service.getOnboardingSession(sessionId);
await service.generateOnboardingCandidates(sessionId);
await service.confirmOnboardingSession(sessionId, { acceptedTags, idempotencyKey });
```

测试必须验证：模型成功使用 `external-llm`；模型抛错时回退为 `local-rule-fallback`；重复确认返回同一画像版本与任务；未生成候选直接确认返回 409。

- [ ] **Step 2: 运行服务测试并确认 RED**

Run: `node --test tests/onekos-service.test.mjs`

Expected: FAIL，原因是初始化服务方法不存在。

- [ ] **Step 3: 实现模型 Prompt 与降级**

模型只收到最小资料，Prompt 要求固定 JSON 数组，并禁止敏感属性与品牌事实推断。任何模型网络错误、非法 JSON 或候选校验失败均记录 warning 并调用规则候选。

- [ ] **Step 4: 实现确认写入顺序**

按 `confirming → 顾问 → 标签 → 首条任务 → confirmed` 执行。每一步更新会话 `writeProgress`；失败时写 `write_failed` 和 `lastError`，重试仅补缺失步骤。

- [ ] **Step 5: 运行服务测试并确认 GREEN**

Run: `node --test tests/onekos-service.test.mjs tests/advisor-onboarding.test.mjs tests/onekos-repository.test.mjs`

Expected: PASS。

- [ ] **Step 6: 更新开发手册并提交**

```powershell
git add src/onekos-service.mjs tests/onekos-service.test.mjs docs/开发手册.md
git commit -m "feat: orchestrate advisor onboarding lifecycle"
```

### Task 4: 提供顾问与初始化 HTTP API

**Files:**
- Modify: `src/api-router.mjs`
- Modify: `public/api-client.js`
- Modify: `tests/api-router.test.mjs`
- Modify: `docs/开发手册.md`

- [ ] **Step 1: 写六个 API 的失败测试**

覆盖：

```text
GET  /api/advisors
POST /api/advisors
POST /api/onboarding/sessions
GET  /api/onboarding/sessions/:sessionId
POST /api/onboarding/sessions/:sessionId/generate
POST /api/onboarding/sessions/:sessionId/confirm
```

同时验证 URL 编码、统一错误、确认幂等键和 404 会话。

- [ ] **Step 2: 运行 API 测试并确认 RED**

Run: `node --test tests/api-router.test.mjs`

Expected: 新路由返回 `API_NOT_FOUND`。

- [ ] **Step 3: 实现 Router 与浏览器 Client**

确认请求从 `Idempotency-Key` header 或 body 读取幂等键；GET 不读取请求体；所有响应继续附带公开 runtime 状态。

- [ ] **Step 4: 运行 API 与服务器测试**

Run: `node --test tests/api-router.test.mjs tests/server.test.mjs`

Expected: PASS。

- [ ] **Step 5: 更新开发手册并提交**

记录完整请求/响应示例。

```powershell
git add src/api-router.mjs public/api-client.js tests/api-router.test.mjs docs/开发手册.md
git commit -m "feat: expose advisor onboarding api"
```

### Task 5: 实现 Web 初始化交互

**Files:**
- Modify: `public/app-v2.js`
- Modify: `public/styles-v2.css`
- Modify: `tests/ui-contract.test.mjs`
- Modify: `docs/开发手册.md`

- [ ] **Step 1: 写 UI 契约失败测试**

断言页面源码包含顾问选择、创建模拟顾问、初始化恢复、三组偏好、历史内容、语音转写、禁用表达、候选修改、删除、降权、锁定、确认和进入机会雷达动作。

- [ ] **Step 2: 运行 UI 测试并确认 RED**

Run: `node --test tests/ui-contract.test.mjs`

Expected: FAIL，缺少初始化动作和 API 调用。

- [ ] **Step 3: 实现三阶段 UI**

状态字段包含：

```js
onboarding: {
  advisors: [], selectedAdvisorId: null, session: null,
  candidates: [], busy: false, error: null,
}
```

初始化页只保留一个主操作；刷新后根据 `sessionId` 恢复；候选修改仅允许 `label`、`weight`、`locked`；确认成功后更新当前顾问与任务，并跳转机会雷达。

- [ ] **Step 4: 实现响应式 CSS**

桌面三列资料表单、平板两列、手机单列；候选证据不可截断；错误与降级状态有文本说明，不只依赖颜色。

- [ ] **Step 5: 运行 UI 测试并确认 GREEN**

Run: `node --test tests/ui-contract.test.mjs`

Expected: PASS。

- [ ] **Step 6: 更新开发手册并提交**

```powershell
git add public/app-v2.js public/styles-v2.css tests/ui-contract.test.mjs docs/开发手册.md
git commit -m "feat: add advisor onboarding experience"
```

### Task 6: 增加飞书第八张表、导入资产与配置

**Files:**
- Modify: `src/feishu-poc.mjs`
- Modify: `src/runtime-config.mjs`
- Modify: `.env.example`
- Modify: `scripts/export-feishu-data.mjs`
- Create: `feishu/bitable/08-画像初始化会话.csv`
- Modify: `feishu/bitable/字段与视图配置.md`
- Modify: `tests/feishu-poc.test.mjs`
- Modify: `tests/feishu-export.test.mjs`
- Modify: `tests/runtime-config.test.mjs`
- Modify: `docs/开发手册.md`

- [ ] **Step 1: 把七表断言改成八表并确认 RED**

新增断言：初始化会话必须能追溯到顾问，包含状态、输入快照、候选标签、写入进度和最近错误列。

- [ ] **Step 2: 运行飞书资产测试并确认 RED**

Run: `node --test tests/feishu-poc.test.mjs tests/feishu-export.test.mjs tests/runtime-config.test.mjs`

Expected: FAIL，仍只有七张表。

- [ ] **Step 3: 实现第八张表与配置覆盖**

`FEISHU_ONBOARDING_SESSIONS_TABLE_ID` 可覆盖默认表 ID；未配置飞书时不影响 simulation。导出文件编号固定为 `08-画像初始化会话.csv`。

- [ ] **Step 4: 生成并核对导入资产**

Run: `node scripts/export-feishu-data.mjs`

Expected: 生成八个带 UTF-8 BOM 的 CSV，且现有七表内容不丢失。

- [ ] **Step 5: 运行飞书资产测试并确认 GREEN**

Run: `node --test tests/feishu-poc.test.mjs tests/feishu-export.test.mjs tests/runtime-config.test.mjs`

Expected: PASS。

- [ ] **Step 6: 更新开发手册并提交**

```powershell
git add .env.example src/feishu-poc.mjs src/runtime-config.mjs scripts/export-feishu-data.mjs feishu/bitable tests/feishu-poc.test.mjs tests/feishu-export.test.mjs tests/runtime-config.test.mjs docs/开发手册.md
git commit -m "feat: add onboarding session bitable assets"
```

### Task 7: 完整链路、手册与交付验证

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `README.md`
- Modify: `docs/DEMO_RUNBOOK.md`
- Modify: `docs/开发手册.md`
- Test: all `tests/*.test.mjs`

- [ ] **Step 1: 扩展 smoke 并确认 RED**

Smoke 从新顾问开始：创建身份、创建会话、生成候选、确认画像、读取首条任务、生成内容、质检、评论转线索、人工确认学习。

Run: `npm run smoke`

Expected: FAIL，直到完整链路接通。

- [ ] **Step 2: 完成最小链路修正并确认 GREEN**

Run: `npm run smoke`

Expected: 输出 `onboarding → profile v1 → task → content → quality → lead → human-confirmed learning`。

- [ ] **Step 3: 更新用户文档和开发手册**

README 与演示手册增加初始化步骤、simulation/live 差异、规则降级、飞书第八张表和测试方式。开发手册记录全部提交、已实现能力、已知限制和真实 Base 验收步骤。

- [ ] **Step 4: 运行全量验证**

```powershell
npm run check
git diff --check
git status --short
```

Expected: 所有测试和 smoke 通过；`git diff --check` 无输出；仅包含本任务待提交文件。

- [ ] **Step 5: 本地提交，不合并、不推送**

```powershell
git add scripts/smoke.mjs README.md docs/DEMO_RUNBOOK.md docs/开发手册.md
git commit -m "docs: complete advisor onboarding runbook"
```

- [ ] **Step 6: 用户验收门禁**

启动本地服务，提供功能分支、提交列表、测试证据和访问地址。等待用户确认后，才允许合并 `main`；再次确认后才允许推送远端。
