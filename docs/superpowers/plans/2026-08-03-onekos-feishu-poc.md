# OneKOS 飞书 PoC 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一套可导入飞书多维表格、可配置为 Aily Agent、可复制为飞书云文档，并与现有本地 MVP 形成同一条业务证据链的周三版 PoC。

**Architecture:** 多维表格保存顾问、画像证据、品牌知识、内容任务、内容成果、评论线索与反馈事件；Aily 通过结构化指令完成校准、路由、内容生成、质检和线索识别；机器人卡片只承载顾问选择、素材确认和高意向线索接管。外部抖音和 CRM 数据在 PoC 中明确标注为模拟输入，飞书内的数据处理和状态写回采用可真实配置的字段与流程。

**Tech Stack:** Node.js ES modules、Node test runner、HTML/CSS/JavaScript、CSV、多维表格工作流、飞书 Aily、飞书机器人卡片、Markdown/DOCX。

---

### Task 1: 修复当前新版 UI 契约基线

**Files:**
- Modify: `tests/ui-contract.test.mjs`

- [ ] 将旧版七页面名称替换为当前 `app-v2.js` 实际使用的页面名称。
- [ ] 将入口脚本断言从 `app.js` 更新为 `app-v2.js`，样式断言更新为 `styles-v2.css`。
- [ ] 运行 `npm test`，预期 15 项测试全部通过。
- [ ] 提交 `test: align UI contract with current MVP`。

### Task 2: 建立飞书 PoC 数据模型与状态流

**Files:**
- Create: `tests/feishu-poc.test.mjs`
- Create: `src/feishu-poc.mjs`

- [ ] 先写失败测试，覆盖七张表、稳定主键、表间引用、模拟数据声明和线索证据字段。
- [ ] 运行 `node --test tests/feishu-poc.test.mjs`，确认因模块缺失而失败。
- [ ] 实现 `createFeishuPocDataset()`，返回顾问档案、画像标签、品牌知识、内容任务、内容成果、评论线索和反馈事件。
- [ ] 先写失败测试，覆盖“待校准→待选题→待生成→待质检→可发布→高意向接管→反馈学习”的状态转换。
- [ ] 实现 `applyFeishuWorkflowEvent()` 和非法转换保护。
- [ ] 运行单测和全量测试，预期全部通过。
- [ ] 提交 `feat: add Feishu PoC data model and workflow state`。

### Task 3: 生成多维表格可导入数据包

**Files:**
- Create: `scripts/export-feishu-data.mjs`
- Create: `feishu/bitable/01-顾问档案.csv`
- Create: `feishu/bitable/02-画像标签.csv`
- Create: `feishu/bitable/03-品牌知识.csv`
- Create: `feishu/bitable/04-内容任务.csv`
- Create: `feishu/bitable/05-内容成果.csv`
- Create: `feishu/bitable/06-评论线索.csv`
- Create: `feishu/bitable/07-反馈事件.csv`
- Create: `feishu/bitable/字段与视图配置.md`

- [ ] 先补充失败测试，检查导出器生成七份 UTF-8 CSV、表头与模型字段一致、所有数据含模拟标记。
- [ ] 实现确定性 CSV 导出器并生成文件。
- [ ] 编写字段类型、关联字段、推荐视图、权限和数据保留说明。
- [ ] 运行 `node --test tests/feishu-poc.test.mjs`，预期通过。
- [ ] 提交 `feat: add Bitable import package`。

### Task 4: 交付 Aily Agent 和机器人卡片配置

**Files:**
- Create: `feishu/aily/OneKOS-Agent系统提示词.md`
- Create: `feishu/aily/工作流配置清单.md`
- Create: `feishu/cards/今日任务卡片.json`
- Create: `feishu/cards/高意向线索卡片.json`
- Create: `tests/feishu-assets.test.mjs`

- [ ] 先写失败测试，检查提示词包含事实核、人设证据、四重质检、低置信度保留空值、人工接管和 JSON 输出契约。
- [ ] 编写可直接粘贴到 Aily 的系统提示词和五个技能输入输出定义。
- [ ] 编写四条工作流的触发器、读取字段、分支、写回字段、失败处理和人工边界。
- [ ] 创建两张卡片模板，按钮只允许选题确认、素材确认、顾问纠偏和线索接管，不自动对外触达。
- [ ] 运行单测和 JSON 解析检查，预期通过。
- [ ] 提交 `feat: add Aily and Feishu card configuration`。

### Task 5: 生成周三 OnePage 与落地手册

**Files:**
- Create: `docs/OneKOS-复赛OnePage.md`
- Create: `docs/OneKOS-飞书落地操作手册.md`
- Create: `docs/OneKOS-复赛OnePage.docx`

- [ ] 编写可直接复制到飞书云文档的 OnePage，覆盖信息卡、痛点、Before/After、架构、销售流程、Demo、量化价值和下一步。
- [ ] 编写 45—60 分钟可执行的飞书搭建手册，逐表、逐字段、逐工作流说明配置顺序。
- [ ] 用 DOCX 生成脚本输出可编辑 Word 版本。
- [ ] 渲染 DOCX 为页面图片，检查标题、表格、分页和中文字体。
- [ ] 提交 `docs: add semifinal OnePage and Feishu setup guide`。

### Task 6: 在本地 MVP 增加飞书落地证据

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `public/index.html`
- Modify: `public/app-v2.js`
- Modify: `public/styles-v2.css`

- [ ] 先写失败测试，要求导航包含“飞书落地中心”，并展示 Aily、多维表格、机器人卡片和真实/模拟边界。
- [ ] 新增飞书落地页，展示七表、五技能、四工作流、写回状态和搭建包入口。
- [ ] 保持当前七步业务链路不变，不重构既有页面。
- [ ] 运行全量测试，预期全部通过。
- [ ] 提交 `feat: expose Feishu implementation center in demo`。

### Task 7: 验证、合并与交付

**Files:**
- Modify: `README.md`

- [ ] 更新 README，增加飞书落地包路径、导入顺序和模拟边界。
- [ ] 运行 `npm test`，记录通过数量。
- [ ] 启动本地服务器并检查 `/`、`/src/feishu-poc.mjs` 返回 200。
- [ ] 核对 CSV 可读、JSON 可解析、DOCX 可打开和所有交付文件存在。
- [ ] 将 `feat/feishu-poc` 合并回 `main`，不覆盖用户已有改动。
- [ ] 输出交付文件入口、尚需用户在飞书后台完成的最后配置和周三演示路径。

