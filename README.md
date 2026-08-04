# 千面·OneKOS MVP

OneKOS 是面向一线销售顾问的个性化 KOS 内容增长操作系统。本仓库已打通“动态画像 → 一题千解 → 内容包 → 四重质检 → 模拟发布 → 评论转线索 → 人工确认学习”的完整演示链路。

## 一键启动

Windows 可双击 `启动演示.bat`，也可执行：

```powershell
npm start
```

打开 `http://127.0.0.1:4173/`。首次不配置任何密钥也可运行完整模拟演示。

## 三种运行模式

| 模式 | 飞书 Base | 内容生成 | 页面标识 |
|---|---|---|---|
| `simulation` | 仓库内模拟数据 | 本地确定性生成器 | `SIMULATION` |
| `hybrid` | 真实飞书 Bitable API | 本地确定性生成器 | `HYBRID` |
| `live` | 真实飞书 Bitable API | 外部 OpenAI-compatible API | `LIVE` |

系统不会静默伪装接入状态。后端和页面都会返回当前模式、连接情况与回退原因。

## 接入飞书和外部模型

1. 复制 `.env.example` 为 `.env`。
2. 填写企业自建应用的 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 和目标 Base 的 `FEISHU_BASE_APP_TOKEN`。
3. 确认应用拥有多维表格记录读写权限，并已被添加为目标 Base 协作者。
4. 如需模型生成，填写 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`。
5. 重启 `npm start`，打开“飞书落地中心”确认运行状态。

真实密钥只保存在本机 `.env`，该文件已被 Git 忽略。浏览器和 API 状态中不会返回 App Secret 或模型 API Key。

## Aily 的定位

当前飞行社内置 Aily/OpenClaw 智能体没有开放 OpenAPI channel，因此 Web 服务不直接调用 Aily。架构采用双入口：

- 飞书内：Aily＋OneKOS 多维表格桥接技能，供顾问在飞书中交互；
- Web 演示：OneKOS 服务＋外部兼容模型 API；
- 两个入口共享同一套多维表格、业务主键、质检规则和人工门禁。

## 演示页面

| 页面 | 核心价值 |
|---|---|
| AI 内容工作台 | 顾问只做补素材、轻改、确认、接管四类动作 |
| 动态顾问画像 | 标签带权重、置信度、来源和证据，可纠偏、可确认后学习 |
| 机会雷达与选题 | 品牌任务、用户问题、画像匹配和矩阵空白共同路由 1—3 个任务 |
| 内容创作室 | 交付开场、脚本、分镜、素材、标题、评论预案和转化动作 |
| 矩阵调度与质检 | 事实、合规、人设、矩阵四重质检和回声室探测 |
| 评论运营中心 | 使用模拟抖音评论展示风向识别、回复建议和选题反哺 |
| 线索与策略学习 | 抽取城市、家庭、车型、购车时间和试驾意愿，高意向人工接管 |
| 飞书落地中心 | 展示 Base、Aily、OneKOS 服务和工作流的真实连接状态 |

## API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 运行模式与连接配置状态 |
| GET | `/api/demo/state` | 顾问、任务、标签、品牌事实和当前成果 |
| POST | `/api/content/generate` | 生成、四重质检并按内容 ID 幂等写回 |
| POST | `/api/comments/analyze` | 抽取评论字段，写回线索与待确认反馈事件 |
| POST | `/api/feedback/:eventId/confirm` | 顾问人工确认后更新画像权重 |

## 验证

```powershell
npm test
npm run smoke
npm run check
```

默认测试和 smoke 全部使用 mock 或本地模拟数据，不访问外网、不写入真实飞书。

## 安全边界

- 抖音评论、点赞、收藏、分享和 CRM 数据当前均为模拟；
- 模型不能直接写 Base，所有写回必须经过 OneKOS 服务校验；
- 缺失品牌事实必须留白或标记“顾问拍摄后补充”，不得推算；
- 不自动发布、不自动私信、不自动加微、不自动预约试驾；
- 高意向线索和画像学习必须由顾问人工确认。

完整演示步骤见 `docs/DEMO_RUNBOOK.md`，飞书表结构与搭建方式见 `docs/OneKOS-飞书落地操作手册.md`。
