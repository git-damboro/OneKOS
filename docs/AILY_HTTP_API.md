# OneKOS Aily HTTP 编排 API

## 用途

这组接口供 Aily HTTP 技能调用。Aily 负责理解顾问意图和选择工具；OneKOS 后端负责状态、业务校验、模型调用、飞书写回、素材检查和剪辑。

所有接口返回 `reply`、`state`、`nextAction` 和 `data`。Aily 应优先把 `reply` 转述给顾问，并根据 `nextAction` 决定下一次调用。

生产地址：`https://onekos-production.up.railway.app`

## 会话键

每次调用都必须传：

```json
{
  "conversationKey": "{{aily_session_id}}:{{sender_open_id}}"
}
```

群聊中不能只使用群 ID，否则多位顾问会串状态。若 Aily 暂时无法提供 `sender_open_id`，必须先让顾问明确选择顾问 ID。

## 鉴权

Railway 配置 `AILY_API_KEY` 后，请求头使用：

```text
Authorization: Bearer <AILY_API_KEY>
Content-Type: application/json
```

不要把飞书应用密钥或模型 API Key 当作 Aily 调用密钥。

## 接口顺序

1. `POST /api/aily/onboarding/start`：创建顾问问卷。
2. `POST /api/aily/onboarding/answer`：逐题回答；持续调用直到 `nextAction=confirm_profile`。
3. `POST /api/aily/onboarding/confirm`：确认画像。
4. `POST /api/aily/tasks/list`：查询推荐和已接受任务。
5. `POST /api/aily/tasks/decide`：接受或拒绝任务。
6. `POST /api/aily/content/generate`：异步启动内容生成，HTTP 202。
7. `POST /api/aily/content/status`：轮询生成结果并取得拍摄要求。
8. `POST /api/aily/materials/import`：把 Aily 消息附件的飞书下载地址导入指定素材槽位，HTTP 202。
9. `POST /api/aily/production/status`：检查素材或剪辑状态。
10. `POST /api/aily/editing/start`：素材齐全后异步启动剪辑，HTTP 202。

已有顾问可跳过问卷，先调用 `POST /api/aily/session/select-advisor`。

## 典型请求

### 选择已有顾问

```json
{
  "conversationKey": "session_123:ou_456",
  "ailySessionId": "session_123",
  "senderOpenId": "ou_456",
  "advisorId": "ADV-017"
}
```

### 创建顾问问卷

```json
{
  "conversationKey": "session_123:ou_456",
  "ailySessionId": "session_123",
  "senderOpenId": "ou_456",
  "displayName": "林明辉",
  "city": "福州",
  "store": "福州门店"
}
```

### 回答当前问题

```json
{
  "conversationKey": "session_123:ou_456",
  "questionId": "Q-PROFESSIONAL",
  "value": "real-route"
}
```

选择题必须提交返回选项中的 `value`，不能提交展示文案；文本题直接提交顾问原话。

### 接受任务

```json
{
  "conversationKey": "session_123:ou_456",
  "taskId": "TASK-001",
  "decision": "accept"
}
```

### 生成内容

```json
{
  "conversationKey": "session_123:ou_456"
}
```

接口立即返回 `wait_content_generation`。Aily 应隔数秒调用 `/api/aily/content/status`，不要在同一请求内等待模型。

### 导入 Aily 附件

```json
{
  "conversationKey": "session_123:ou_456",
  "slotId": "CONTENT-TASK-001-SLOT-001",
  "downloadUrl": "<Aily 消息附件 preview_url 或受保护下载地址>",
  "fileName": "opening.mp4",
  "mimeType": "video/mp4",
  "durationSec": 12,
  "width": 1080,
  "height": 1920
}
```

下载地址只允许受信任的飞书文件域名，单文件最大 100MB。上传接收后会后台执行 FFprobe、语音识别和关键帧视觉分析；顾问可以立即继续上传下一段。

## Aily 行为规则

- `ask_question`：只问返回的一个问题，并展示可选项。
- `confirm_profile`：展示候选标签后征求顾问确认。
- `choose_task`：展示任务 ID、主题、推荐理由和当前状态。
- `wait_content_generation`、`wait_material_check`、`wait_editing`：告知正在后台处理，稍后查询，不重复发起任务。
- `upload_material`：按槽位逐条告诉顾问“拍什么＋说什么”，收到附件时让顾问确认对应槽位。
- `preview_video`：返回预览地址，但不声称已发布抖音。
- A 级线索、价格权益、最终发布仍必须人工确认。
