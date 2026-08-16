import { createHash } from 'node:crypto';

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const DEFAULT_ATTACHMENT_HOST_SUFFIXES = [
  'feishu.cn', 'feishucdn.com', 'larksuite.com', 'larksuitecdn.com', 'byteimg.com', 'bytecdn.cn',
];

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function required(value, label) {
  const text = String(value || '').trim();
  if (!text) throw requestError(`${label}不能为空`);
  return text;
}

function shortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20).toUpperCase();
}

function publicQuestion(question) {
  if (!question) return null;
  return {
    id: question.id,
    type: question.type,
    title: question.title,
    placeholder: question.placeholder || '',
    minLength: question.minLength || 0,
    options: (question.options || []).map(({ value, label }) => ({ value, label })),
  };
}

function stateReply(state, { reply, nextAction, data = null } = {}) {
  return {
    ok: true,
    reply,
    state: {
      conversationKey: state.conversationKey,
      stage: state.stage,
      advisorId: state.advisorId || '',
      quizSessionId: state.quizSessionId || '',
      currentQuestionId: state.currentQuestionId || '',
      taskId: state.taskId || '',
      contentId: state.contentId || '',
      editingJobId: state.editingJobId || '',
      asyncStatus: state.asyncStatus || '',
      updatedAt: state.updatedAt,
    },
    nextAction,
    data,
  };
}

function materialSummary(materials) {
  return materials.shootingRequirements.map((item) => ({
    slotId: item.slotId,
    type: item.type,
    required: Boolean(item.required),
    visualDescription: item.visualDescription || item.description || '',
    scriptText: item.scriptText || '',
    shootingSteps: item.shootingSteps || item.instructions || '',
    minDurationSec: Number(item.minDurationSec) || 0,
    orientation: item.orientation || '',
    status: item.status || '',
  }));
}

export class AilyOrchestrator {
  constructor({ service, repository, fetchImpl = globalThis.fetch, mode = 'simulation', attachmentHostSuffixes = DEFAULT_ATTACHMENT_HOST_SUFFIXES } = {}) {
    this.service = service;
    this.repository = repository;
    this.fetch = fetchImpl;
    this.mode = mode;
    this.attachmentHostSuffixes = attachmentHostSuffixes;
  }

  sessionId(conversationKey) {
    return `AILY-STATE-${shortHash(conversationKey)}`;
  }

  async load(conversationKey, { requiredState = true } = {}) {
    const key = required(conversationKey, 'conversationKey');
    const saved = await this.repository.getOnboardingSession(this.sessionId(key));
    if (!saved) {
      if (requiredState) throw requestError('Aily 会话尚未初始化，请先调用 onboarding/start 或 session/select-advisor', 404);
      return null;
    }
    return { ...saved.input, conversationKey: key };
  }

  async save(state) {
    const now = new Date().toISOString();
    const next = { ...state, updatedAt: now };
    await this.repository.saveOnboardingSession({
      sessionId: this.sessionId(next.conversationKey),
      advisorId: next.advisorId || 'UNBOUND',
      status: next.stage || 'idle',
      input: next,
      candidates: [],
      acceptedTags: [],
      writeProgress: {},
      generator: 'aily-orchestrator',
      warnings: [],
      lastError: next.lastError || '',
      createdAt: next.createdAt || now,
      updatedAt: now,
      simulation: this.mode === 'simulation',
    });
    return next;
  }

  baseState(input) {
    const conversationKey = required(input.conversationKey, 'conversationKey');
    return {
      conversationKey,
      ailySessionId: String(input.ailySessionId || ''),
      senderOpenId: String(input.senderOpenId || ''),
      stage: 'idle',
      advisorId: '', quizSessionId: '', currentQuestionId: '', taskId: '', contentId: '', editingJobId: '',
      asyncStatus: '', lastError: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  async selectAdvisor(input) {
    const advisorId = required(input.advisorId, '顾问ID').toUpperCase();
    await this.service.getAdvisorProfile(advisorId);
    const previous = await this.load(input.conversationKey, { requiredState: false });
    const state = await this.save({ ...(previous || this.baseState(input)), advisorId, stage: 'advisor_selected', lastError: '' });
    return stateReply(state, {
      reply: `已选择顾问 ${advisorId}。你可以继续查询任务、接受任务或查看正在制作的内容。`,
      nextAction: 'list_tasks',
    });
  }

  async startOnboarding(input) {
    const conversationKey = required(input.conversationKey, 'conversationKey');
    const advisorId = String(input.advisorId || `ADV-AILY-${shortHash(input.senderOpenId || conversationKey).slice(0, 12)}`).toUpperCase();
    const quiz = await this.service.createQuizSession({
      advisorId,
      displayName: required(input.displayName, '顾问名称'),
      city: required(input.city, '城市'),
      store: required(input.store, '门店'),
      identitySource: input.senderOpenId ? 'feishu' : 'demo',
    });
    const state = await this.save({
      ...this.baseState(input), advisorId, quizSessionId: quiz.session.sessionId,
      currentQuestionId: quiz.question?.id || '', stage: 'onboarding_question',
    });
    return stateReply(state, {
      reply: quiz.question?.title || '问卷已创建，请继续回答。',
      nextAction: 'ask_question',
      data: { question: publicQuestion(quiz.question) },
    });
  }

  async answerOnboarding(input) {
    let state = await this.load(input.conversationKey);
    if (!state.quizSessionId) throw requestError('当前会话没有进行中的顾问问卷', 409);
    const result = await this.service.submitQuizAnswer(state.quizSessionId, {
      questionId: input.questionId || state.currentQuestionId,
      value: input.value,
    });
    if (result.question) {
      state = await this.save({ ...state, currentQuestionId: result.question.id, stage: 'onboarding_question', lastError: '' });
      return stateReply(state, {
        reply: result.question.title,
        nextAction: 'ask_question',
        data: { question: publicQuestion(result.question) },
      });
    }
    const completed = await this.service.completeQuizSession(state.quizSessionId);
    state = await this.save({ ...state, currentQuestionId: '', stage: 'onboarding_confirm', lastError: '' });
    return stateReply(state, {
      reply: '问卷已完成。请确认这些候选画像标签；确认后系统会创建顾问画像和首条内容任务。',
      nextAction: 'confirm_profile',
      data: { candidates: completed.session.candidates, warnings: completed.session.warnings || [] },
    });
  }

  async confirmOnboarding(input) {
    let state = await this.load(input.conversationKey);
    if (!state.quizSessionId) throw requestError('当前会话没有可确认的顾问问卷', 409);
    const quiz = await this.service.getQuizSession(state.quizSessionId);
    const acceptedTags = Array.isArray(input.acceptedTags) && input.acceptedTags.length
      ? input.acceptedTags
      : quiz.session.candidates;
    const result = await this.service.confirmOnboardingSession(state.quizSessionId, {
      acceptedTags,
      idempotencyKey: input.idempotencyKey || `aily-${this.sessionId(state.conversationKey)}`,
    });
    state = await this.save({ ...state, advisorId: result.advisor.advisorId, taskId: result.task?.taskId || '', stage: 'advisor_ready', lastError: '' });
    return stateReply(state, {
      reply: `顾问 ${result.advisor.displayName || result.advisor.advisorId} 的画像已创建，可以开始查询内容任务。`,
      nextAction: 'list_tasks',
      data: { advisor: result.advisor, tags: result.tags, firstTask: result.task },
    });
  }

  async listTasks(input) {
    let state = await this.load(input.conversationKey);
    const advisorId = String(input.advisorId || state.advisorId || '').toUpperCase();
    if (!advisorId) throw requestError('请先选择或创建顾问', 409);
    const opportunities = await this.service.getOpportunities({ advisorId, limit: Number(input.limit) || 3 });
    const workspace = await this.service.getAdvisorWorkspace(advisorId);
    state = await this.save({ ...state, advisorId, stage: 'task_selection', lastError: '' });
    return stateReply(state, {
      reply: opportunities.recommendations.length
        ? `已找到 ${opportunities.recommendations.length} 个推荐任务，请选择任务并接受或拒绝。`
        : '当前没有新的推荐任务；可以查看已经接受的任务。',
      nextAction: opportunities.recommendations.length ? 'choose_task' : 'inspect_accepted_task',
      data: { recommendations: opportunities.recommendations, acceptedTasks: workspace.acceptedTasks },
    });
  }

  async decideTask(input) {
    let state = await this.load(input.conversationKey);
    const advisorId = String(input.advisorId || state.advisorId || '').toUpperCase();
    const taskId = required(input.taskId, '任务ID');
    const decision = required(input.decision, '任务决策');
    const result = await this.service.decideOpportunity(taskId, { advisorId, decision, reason: input.reason || '' });
    const accepted = decision === 'accept';
    state = await this.save({ ...state, advisorId, taskId: accepted ? taskId : '', stage: accepted ? 'task_accepted' : 'task_selection', lastError: '' });
    return stateReply(state, {
      reply: accepted ? `已接受任务 ${taskId}，可以开始生成可拍摄内容包。` : `已拒绝任务 ${taskId}，拒绝原因已记录。`,
      nextAction: accepted ? 'generate_content' : 'list_tasks',
      data: result,
    });
  }

  async startContentGeneration(input) {
    let state = await this.load(input.conversationKey);
    const advisorId = String(input.advisorId || state.advisorId || '').toUpperCase();
    const taskId = String(input.taskId || state.taskId || '');
    if (!advisorId || !taskId) throw requestError('请先选择顾问并接受一个任务', 409);
    if (state.asyncStatus === 'content_running') {
      return stateReply(state, { reply: '内容正在生成，请稍后查询状态。', nextAction: 'wait_content_generation' });
    }
    state = await this.save({ ...state, advisorId, taskId, stage: 'content_generating', asyncStatus: 'content_running', lastError: '' });
    setImmediate(async () => {
      try {
        const result = await this.service.generateContent({ advisorId, taskId, testMode: input.testMode || '' });
        const latest = await this.load(input.conversationKey);
        await this.save({ ...latest, contentId: result.content.contentId, stage: 'waiting_upload', asyncStatus: 'content_completed', lastError: '' });
      } catch (error) {
        const latest = await this.load(input.conversationKey).catch(() => state);
        await this.save({ ...latest, stage: 'content_failed', asyncStatus: 'content_failed', lastError: error.message || '内容生成失败' }).catch(() => {});
      }
    });
    return stateReply(state, {
      reply: '内容生成任务已启动。模型生成、四重质检和飞书写回在后台执行，请稍后查询状态。',
      nextAction: 'wait_content_generation',
    });
  }

  async getContentStatus(input) {
    let state = await this.load(input.conversationKey);
    if (state.asyncStatus === 'content_failed') {
      return stateReply(state, { reply: `内容生成失败：${state.lastError}`, nextAction: 'retry_content_generation' });
    }
    if (!state.contentId) {
      return stateReply(state, { reply: '内容仍在生成中，请稍后再查询。', nextAction: 'wait_content_generation' });
    }
    const contentPackage = await this.service.getContentPackage(state.contentId);
    state = await this.save({ ...state, stage: contentPackage.status === 'ready_for_edit' ? 'ready_for_edit' : 'waiting_upload', lastError: '' });
    return stateReply(state, {
      reply: contentPackage.status === 'ready_for_edit'
        ? '拍摄素材已齐全，可以创建剪辑任务。'
        : `内容包已生成，需要补充 ${contentPackage.comparison.missing.length} 段必填素材。`,
      nextAction: contentPackage.status === 'ready_for_edit' ? 'start_editing' : 'upload_material',
      data: {
        content: contentPackage.content,
        quality: contentPackage.quality,
        materials: materialSummary(contentPackage),
        comparison: contentPackage.comparison,
        editingJob: contentPackage.editingJob,
      },
    });
  }

  async getProductionStatus(input) {
    let state = await this.load(input.conversationKey);
    if (!state.contentId) return this.getContentStatus(input);
    const materials = await this.service.getContentMaterials(state.contentId);
    const editingJob = materials.editingJob;
    const completed = editingJob && ['待顾问预览', '已完成'].includes(editingJob.status);
    const stage = completed ? 'preview_ready' : materials.status === 'ready_for_edit' ? 'ready_for_edit' : materials.status;
    state = await this.save({ ...state, editingJobId: editingJob?.editingJobId || state.editingJobId || '', stage, lastError: '' });
    return stateReply(state, {
      reply: completed
        ? '预览视频已经生成，可以查看或下载。'
        : materials.status === 'ready_for_edit'
          ? '全部必填素材已通过检查，可以开始剪辑。'
          : `当前已通过 ${materials.comparison.matched.length}/${materials.comparison.requiredCount} 段必填素材。`,
      nextAction: completed ? 'preview_video' : materials.status === 'ready_for_edit' ? 'start_editing' : 'upload_material',
      data: {
        materials: materialSummary(materials), comparison: materials.comparison, editingJob,
        previewPath: completed ? `/api/editing/jobs/${encodeURIComponent(editingJob.editingJobId)}/preview` : '',
      },
    });
  }

  async startEditing(input) {
    let state = await this.load(input.conversationKey);
    if (!state.contentId) throw requestError('当前会话还没有可剪辑的内容', 409);
    const materials = await this.service.getContentMaterials(state.contentId);
    if (!materials.comparison.complete || !materials.editingJob) throw requestError('必填素材尚未全部通过检查，不能开始剪辑', 409);
    const job = await this.service.startEditingJob(materials.editingJob.editingJobId);
    state = await this.save({ ...state, editingJobId: job.editingJobId, stage: 'editing', asyncStatus: 'editing_running', lastError: '' });
    return stateReply(state, { reply: '剪辑任务已启动，请稍后查询制作状态。', nextAction: 'wait_editing', data: { editingJob: job } });
  }

  attachmentHostAllowed(hostname) {
    const normalized = hostname.toLowerCase();
    return this.attachmentHostSuffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
  }

  async importAttachment(input) {
    let state = await this.load(input.conversationKey);
    const contentId = String(input.contentId || state.contentId || '');
    const slotId = required(input.slotId, '素材槽位ID');
    const advisorId = String(input.advisorId || state.advisorId || '').toUpperCase();
    const downloadUrl = new URL(required(input.downloadUrl, '附件下载地址'));
    if (downloadUrl.protocol !== 'https:' || !this.attachmentHostAllowed(downloadUrl.hostname)) {
      throw requestError('附件下载地址必须来自受信任的飞书文件域名', 400);
    }
    const response = await this.fetch(downloadUrl, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw requestError(`读取飞书附件失败：HTTP ${response.status}`, 502);
    const declaredSize = Number(response.headers.get('content-length')) || 0;
    if (declaredSize > MAX_ATTACHMENT_BYTES) throw requestError('单个素材不能超过 100MB', 413);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > MAX_ATTACHMENT_BYTES) throw requestError(bytes.byteLength ? '单个素材不能超过 100MB' : '附件内容为空', bytes.byteLength ? 413 : 400);
    const upload = {
      contentId, slotId, advisorId,
      fileName: input.fileName || downloadUrl.pathname.split('/').pop() || `${slotId}.mp4`,
      mimeType: input.mimeType || response.headers.get('content-type') || 'application/octet-stream',
      bytes,
      durationSec: Number(input.durationSec) || 0,
      width: Number(input.width) || 0,
      height: Number(input.height) || 0,
    };
    const staged = await this.service.stageAdvisorAssetUpload(upload);
    setImmediate(() => this.service.checkAdvisorAsset(upload).catch(async (error) => {
      await this.service.failAdvisorAssetCheck({ contentId, slotId, message: error.message }).catch(() => {});
    }));
    state = await this.save({ ...state, contentId, stage: 'material_checking', lastError: '' });
    return stateReply(state, {
      reply: `素材 ${upload.fileName} 已接收，正在后台检查；可以继续上传下一段素材。`,
      nextAction: 'wait_material_check',
      data: { uploadedAsset: staged.uploadedAsset, comparison: staged.comparison },
    });
  }

  capabilities() {
    return {
      service: 'OneKOS Aily Orchestration API', version: '1.0',
      conversationKey: '推荐使用 aily_session_id + sender_open_id；群聊中不可只用群 ID。',
      endpoints: [
        'POST /api/aily/session/select-advisor', 'POST /api/aily/onboarding/start', 'POST /api/aily/onboarding/answer',
        'POST /api/aily/onboarding/confirm', 'POST /api/aily/tasks/list', 'POST /api/aily/tasks/decide',
        'POST /api/aily/content/generate', 'POST /api/aily/content/status', 'POST /api/aily/materials/import',
        'POST /api/aily/production/status', 'POST /api/aily/editing/start',
      ],
    };
  }
}
