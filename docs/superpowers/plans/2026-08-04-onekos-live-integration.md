# OneKOS 一体化 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** 在保留现有演示界面的前提下，把 OneKOS 的顾问画像、内容任务、内容生成、四重质检、评论转线索和反馈学习串成可运行闭环，并支持飞书多维表格与外部 OpenAI 兼容模型。

**Architecture:** 浏览器只调用本地 OneKOS 服务；服务端统一编排飞书 Base、外部模型和本地可解释规则。系统显式区分 `live`、`hybrid`、`simulation` 三种模式，模型只返回结构化候选结果，所有质检、权限判断和写回均由服务端完成。

**Tech Stack:** Node.js ESM、原生 `node:http`、原生 `fetch`、`node:test`、现有 HTML/CSS/JavaScript 前端、飞书 Bitable OpenAPI、OpenAI-compatible Chat Completions API。

---

## Task 1：运行配置与模式判定

**Files:**
- Create: `src/runtime-config.mjs`
- Create: `tests/runtime-config.test.mjs`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] 先写配置测试，覆盖完整配置为 `live`、只配置飞书为 `hybrid`、无配置为 `simulation`、密钥不出现在公开状态中。
- [ ] 运行 `node --test tests/runtime-config.test.mjs`，确认测试先失败。
- [ ] 实现环境变量读取、布尔值解析、模式判定与脱敏后的公开状态。
- [ ] 再次运行测试并确认通过。

## Task 2：飞书多维表格客户端

**Files:**
- Create: `src/feishu-client.mjs`
- Create: `tests/feishu-client.test.mjs`

- [ ] 先写 mock-fetch 测试，覆盖 tenant token 缓存、分页读取、按业务键查找、新建与更新两条 upsert 路径、错误体透传。
- [ ] 运行 `node --test tests/feishu-client.test.mjs`，确认测试先失败。
- [ ] 实现最小 `FeishuBitableClient`，所有请求均带超时，最多读取 500 条演示数据。
- [ ] 再次运行测试并确认通过。

## Task 3：外部兼容模型客户端

**Files:**
- Create: `src/llm-client.mjs`
- Create: `tests/llm-client.test.mjs`

- [ ] 先写测试，覆盖标准 JSON、Markdown 代码块 JSON、无效 JSON、HTTP 错误和超时。
- [ ] 运行 `node --test tests/llm-client.test.mjs`，确认测试先失败。
- [ ] 实现 OpenAI-compatible `/chat/completions` 调用和严格结构化解析，不向浏览器返回 API Key。
- [ ] 再次运行测试并确认通过。

## Task 4：数据仓储与 OneKOS 业务服务

**Files:**
- Create: `src/onekos-repository.mjs`
- Create: `src/onekos-service.mjs`
- Create: `tests/onekos-service.test.mjs`
- Reuse: `src/feishu-poc.mjs`
- Reuse: `src/engine-v2.mjs`

- [ ] 先写服务测试，覆盖 ADV-017 上下文读取、TASK-001 内容生成、业务键幂等写回、评论转 A 级线索、反馈事件待人工确认。
- [ ] 运行 `node --test tests/onekos-service.test.mjs`，确认测试先失败。
- [ ] 实现 Base 中文字段映射、模拟仓储、飞书仓储和服务编排。
- [ ] 内容生成先读取有效品牌事实；缺事实必须留待顾问补充，不能让模型补造。
- [ ] 高意向线索只生成建议和待接管状态，不自动私信、加微或预约。
- [ ] 再次运行测试并确认通过。

## Task 5：四重质检与回声室探测

**Files:**
- Create: `src/live-engine.mjs`
- Create: `tests/live-engine.test.mjs`

- [ ] 先写测试，覆盖事实引用校验、禁用绝对化承诺、人设标签引用、矩阵近重复、反馈确认后权重更新。
- [ ] 运行 `node --test tests/live-engine.test.mjs`，确认测试先失败。
- [ ] 实现确定性规则评分和可解释问题列表；矩阵近重复使用分词/Jaccard 与结构特征组合。
- [ ] 再次运行测试并确认通过。

## Task 6：HTTP API 与静态服务器整合

**Files:**
- Create: `src/api-router.mjs`
- Modify: `server.mjs`
- Create: `tests/api-router.test.mjs`
- Modify: `tests/server.test.mjs`

- [ ] 先写接口测试，覆盖 `GET /api/health`、`GET /api/demo/state`、`POST /api/content/generate`、`POST /api/comments/analyze`、`POST /api/feedback/:eventId/confirm` 和错误响应。
- [ ] 运行对应测试，确认先失败。
- [ ] 实现 JSON body 限制、统一错误结构、请求 ID 和模式/警告透传。
- [ ] 将 API 路由接入现有静态服务器，不破坏路径穿越防护和静态资源行为。
- [ ] 再次运行测试并确认通过。

## Task 7：前端接入与演示状态可视化

**Files:**
- Create: `public/api-client.js`
- Modify: `public/app-v2.js`
- Modify: `public/index.html`
- Modify: `public/styles-v2.css`
- Modify: `tests/ui-contract.test.mjs`

- [ ] 先扩展 UI 契约测试，要求显示运行模式、飞书/模型连接状态、生成/评论/学习阶段和错误提示。
- [ ] 运行 `node --test tests/ui-contract.test.mjs`，确认新增断言先失败。
- [ ] 增加 API 客户端的超时、取消和错误处理。
- [ ] 在现有“飞书落地中心”和主链路中接入真实 API；API 不可用时明确显示模拟回退，不静默伪装。
- [ ] 再次运行 UI 契约和既有交互测试并确认通过。

## Task 8：启动脚本、说明与完整验证

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/DEMO_RUNBOOK.md`

- [ ] 增加 `npm run check` 和可选的 live smoke 命令，默认测试不得访问外网。
- [ ] 写清 `.env` 配置、三种运行模式、飞书权限、外部模型配置、Aily 内部入口定位和 3—5 分钟演示路径。
- [ ] 运行 `npm test`、`npm run check`，再启动服务验证 `/api/health` 与首页。
- [ ] 检查 `git diff --check`、`git status --short`，确认未提交密钥且未覆盖用户原有改动。
- [ ] 提交本轮实现并给出可复制的启动与演示命令。
