const clone = (value) => structuredClone(value);

const SIMULATION_DATA = {
  advisors: [{
    advisorId: 'ADV-017', displayName: '顾问 017', city: '成都', store: '成都区域模拟门店',
    experienceYears: 4, targetAudience: '城市通勤与多成员家庭', profileMaturity: 78,
    workflowStatus: '已校准', authorizationStatus: '仅使用生成的模拟资料', simulation: true,
  }],
  profileTags: [
    { tagId: 'TAG-001', advisorId: 'ADV-017', dimension: '地域经验', label: '成都本地补能', status: '生效', confidence: 94, weight: 91, source: '模拟历史内容＋顾问确认', evidence: '历史内容持续覆盖成都通勤与补能，顾问已确认。', simulation: true },
    { tagId: 'TAG-002', advisorId: 'ADV-017', dimension: '表达方式', label: '先结论后解释', status: '生效', confidence: 89, weight: 86, source: '模拟语音转写＋编辑行为', evidence: '最近轻改均保留结论式开场。', simulation: true },
    { tagId: 'TAG-003', advisorId: 'ADV-017', dimension: '证据偏好', label: '实车场景证明', status: '生效', confidence: 87, weight: 83, source: '模拟发布表现', evidence: '路线计时和乘坐实测内容表现更好。', simulation: true },
    { tagId: 'TAG-004', advisorId: 'ADV-017', dimension: '目标用户', label: '多成员家庭决策', status: '待继续验证', confidence: 82, weight: 76, source: '模拟评论与线索结果', evidence: '评论中多次出现老人、儿童座椅和第三排需求。', simulation: true },
  ],
  brandKnowledge: [{
    knowledgeId: 'KB-L60-001', model: '乐道 L60', field: '车身尺寸与轴距', value: '4828×1930×1616mm，轴距 2950mm',
    version: '官方用户手册当前版本', source: '乐道 L60 官方用户手册',
    sourceUrl: 'https://cdn-up-public.onvo.cn/www-alps-cn/user-instructions/L60/index.html',
    checkedAt: '2026-08-03', validUntil: '2026-12-31', status: '有效', simulation: true,
  }],
  contentTasks: [{
    taskId: 'TASK-001', advisorId: 'ADV-017', taskDate: '2026-08-03', targetModel: '乐道 L60',
    userQuestion: '没有家充、每天通勤 42 公里，一周补能几次更现实？',
    topic: '成都工作日晚高峰补能路线全程计时', routeScore: 96,
    matrixGap: '工作日晚高峰真实等待时间', profileEvidence: ['TAG-001', 'TAG-002', 'TAG-003'],
    status: '待生成', simulation: true,
  }],
  contentResults: [{
    contentId: 'CONTENT-SEED-L90', taskId: 'TASK-SEED-L90', title: '六口之家第三排上下车体验',
    hook: '带老人和孩子一起实测', script: '记录上下车动作与乘坐空间。',
    factRefs: [], profileRefs: ['TAG-003'], status: '演示样例', simulation: true,
  }],
  commentLeads: [],
  feedbackEvents: [],
  onboardingSessions: [],
  shootingRequirements: [],
  advisorAssets: [],
  editingJobs: [],
};

export class SimulationOneKosRepository {
  constructor(seed = SIMULATION_DATA) {
    this.data = { ...clone(SIMULATION_DATA), ...clone(seed) };
    this.sequence = 1;
    this.files = new Map();
  }

  snapshot() { return clone(this.data); }
  async listAdvisors() { return clone(this.data.advisors); }
  async getAdvisor(advisorId) { return clone(this.data.advisors.find((item) => item.advisorId === advisorId) || null); }
  async getProfileTags(advisorId) { return clone(this.data.profileTags.filter((item) => item.advisorId === advisorId)); }
  async getTask(taskId) { return clone(this.data.contentTasks.find((item) => item.taskId === taskId) || null); }
  async getContentResult(contentId) { return clone(this.data.contentResults.find((item) => item.contentId === contentId) || null); }
  async listContentTasks(advisorId) { return clone(this.data.contentTasks.filter((item) => !advisorId || item.advisorId === advisorId)); }
  async listCommentLeads(advisorId) { return clone(this.data.commentLeads.filter((item) => !advisorId || item.advisorId === advisorId)); }
  async getValidKnowledge(model, today) { return clone(this.data.brandKnowledge.filter((item) => item.model === model && item.status === '有效' && (!item.validUntil || item.validUntil >= today))); }
  async listContentResults() { return clone(this.data.contentResults); }
  async getFeedbackEvent(eventId) { return clone(this.data.feedbackEvents.find((item) => item.eventId === eventId) || null); }
  async getOnboardingSession(sessionId) { return clone(this.data.onboardingSessions.find((item) => item.sessionId === sessionId) || null); }
  async listShootingRequirements(contentId) { return clone(this.data.shootingRequirements.filter((item) => item.contentId === contentId)); }
  async listAdvisorAssets(contentId) { return clone(this.data.advisorAssets.filter((item) => item.contentId === contentId)); }
  async getEditingJob(editingJobId) { return clone(this.data.editingJobs.find((item) => item.editingJobId === editingJobId) || null); }
  async uploadAdvisorAssetFile({ fileName, mimeType, bytes }) {
    const fileToken = `sim-${Date.now()}-${fileName}`;
    this.files.set(fileToken, { bytes: new Uint8Array(bytes), mimeType });
    return { fileToken, simulation: true };
  }
  async downloadAdvisorAssetFile(fileToken) {
    const file = this.files.get(fileToken);
    if (!file) throw new Error(`模拟素材不存在：${fileToken}`);
    return { ...file, bytes: new Uint8Array(file.bytes) };
  }
  async uploadRenderedVideoFile({ fileName, mimeType, bytes }) {
    const fileToken = `sim-render-${Date.now()}-${fileName}`;
    this.files.set(fileToken, { bytes: new Uint8Array(bytes), mimeType });
    return { fileToken, simulation: true };
  }

  async upsert(collection, key, value, record) {
    const index = this.data[collection].findIndex((item) => item[key] === value);
    if (index >= 0) {
      this.data[collection][index] = { ...this.data[collection][index], ...clone(record) };
      return { action: 'updated', recordId: this.data[collection][index].recordId || `sim-${collection}-${index + 1}`, record: clone(this.data[collection][index]) };
    }
    const next = { ...clone(record), recordId: `sim-${collection}-${this.sequence++}` };
    this.data[collection].push(next);
    return { action: 'created', recordId: next.recordId, record: clone(next) };
  }

  saveContentPackage(content) { return this.upsert('contentResults', 'contentId', content.contentId, content); }
  async saveShootingRequirements(requirements) {
    const writes = [];
    for (const requirement of requirements) writes.push(await this.upsert('shootingRequirements', 'slotId', requirement.slotId, requirement));
    return writes;
  }
  async retireShootingRequirements(contentId, activeSlotIds) {
    const active = new Set(activeSlotIds);
    const retired = [];
    for (const requirement of this.data.shootingRequirements) {
      if (requirement.contentId === contentId && !active.has(requirement.slotId)) {
        requirement.required = false;
        requirement.status = '可选未上传';
        retired.push(clone(requirement));
      }
    }
    return retired;
  }
  async saveAdvisorAssets(assets) {
    const writes = [];
    for (const asset of assets) writes.push(await this.upsert('advisorAssets', 'assetId', asset.assetId, asset));
    return writes;
  }
  saveEditingJob(job) { return this.upsert('editingJobs', 'editingJobId', job.editingJobId, job); }
  saveCommentLead(lead) { return this.upsert('commentLeads', 'leadId', lead.leadId, lead); }
  saveFeedbackEvent(event) { return this.upsert('feedbackEvents', 'eventId', event.eventId, event); }
  saveProfileTag(tag) { return this.upsert('profileTags', 'tagId', tag.tagId, tag); }
  saveAdvisor(advisor) { return this.upsert('advisors', 'advisorId', advisor.advisorId, advisor); }
  saveOnboardingSession(session) { return this.upsert('onboardingSessions', 'sessionId', session.sessionId, session); }
  saveContentTask(task) { return this.upsert('contentTasks', 'taskId', task.taskId, task); }
}

function yes(value) { return value === true || value === '是'; }
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function split(value) {
  if (Array.isArray(value)) return value;
  return value ? String(value).split(/[｜|\n]/).map((item) => item.trim()).filter(Boolean) : [];
}
function lines(value) { return Array.isArray(value) ? value.join('\n') : value || ''; }
function json(value) { return JSON.stringify(value ?? null); }
function parseJson(value, fallback) {
  if (!value) return clone(fallback);
  try { return JSON.parse(value); } catch { return clone(fallback); }
}

function onboardingSnapshot(session) {
  if (session.mode !== 'quiz') return session.input;
  return {
    input: session.input || {},
    mode: 'quiz',
    identity: session.identity || {},
    questionIds: session.questionIds || [],
    adaptiveQuestionIds: session.adaptiveQuestionIds || [],
    answers: session.answers || {},
    currentQuestionId: session.currentQuestionId || null,
  };
}

function restoreOnboardingSnapshot(snapshot) {
  if (snapshot?.mode !== 'quiz') return { input: snapshot || {} };
  return {
    input: snapshot.input || {},
    mode: 'quiz',
    identity: snapshot.identity || {},
    questionIds: Array.isArray(snapshot.questionIds) ? snapshot.questionIds : [],
    adaptiveQuestionIds: Array.isArray(snapshot.adaptiveQuestionIds) ? snapshot.adaptiveQuestionIds : [],
    answers: snapshot.answers && typeof snapshot.answers === 'object' ? snapshot.answers : {},
    currentQuestionId: snapshot.currentQuestionId || null,
  };
}

function mapAdvisor(record) {
  const f = record.fields;
  return {
    recordId: record.record_id,
    advisorId: f.顾问ID,
    displayName: f.展示名称,
    city: f.城市,
    store: f.门店,
    experienceYears: number(f.从业年限),
    targetAudience: f.目标用户,
    profileMaturity: number(f.画像成熟度),
    workflowStatus: f.流程状态,
    initializationStatus: f.初始化状态,
    profileVersion: f.当前画像版本,
    identitySource: f.身份来源,
    externalUserId: f.外部用户标识,
    authorizationStatus: f.授权状态,
    initializedAt: f.首次初始化时间,
    simulation: yes(f.模拟数据),
  };
}

function mapContentTask(record) {
  const f = record.fields;
  return {
    recordId: record.record_id, taskId: f.任务ID, advisorId: f.顾问ID, targetModel: f.目标车型,
    userQuestion: f.用户问题, topic: f.内容角度, routeScore: number(f.路由匹配分), matrixGap: f.矩阵空白,
    profileEvidence: split(f.画像证据ID), taskDate: f.任务日期, status: f.状态,
    routedAt: f.路由时间 || '', decision: f.顾问决策 || '', rejectionReason: f.拒绝原因 || '', decidedAt: f.决策时间 || '', simulation: yes(f.模拟数据),
  };
}

function mapContentResult(record) {
  const f = record.fields;
  const factScore = number(f.事实质检分);
  const complianceScore = number(f.合规质检分);
  const personaScore = number(f.人设质检分);
  const matrixScore = number(f.矩阵质检分);
  return {
    recordId: record.record_id,
    contentId: f.内容ID,
    taskId: f.任务ID,
    title: f.标题,
    hook: f.开场,
    script: f.口播脚本,
    storyboard: split(f.分镜),
    materials: split(f.素材清单),
    factRefs: split(f.事实引用ID),
    profileRefs: split(f.画像引用ID),
    status: f.状态,
    quality: {
      fact: { score: factScore },
      compliance: { score: complianceScore },
      persona: { score: personaScore },
      matrix: { score: matrixScore, similarity: 0, risk: matrixScore >= 70 ? '低' : '高' },
      passed: [factScore, complianceScore, personaScore, matrixScore].every((score) => score >= 70),
      issues: [],
    },
    simulation: yes(f.模拟数据),
    generator: 'persisted-content',
  };
}

function mapCommentLead(record) {
  const f = record.fields;
  return {
    recordId: record.record_id, leadId: f.线索ID, commentId: f.评论ID, advisorId: f.顾问ID,
    contentId: f.内容ID, platform: f.平台, originalComment: f.原评论, city: f.城市,
    familyStructure: f.家庭结构, model: f.车型, purchaseWindow: f.购车时间,
    testDriveIntent: f.试驾意愿, score: f.线索分, grade: f.线索等级, status: f.状态,
    nextAction: f.下一步建议, fieldEvidence: parseJson(f.字段证据, {}), updatedAt: f.最后同步时间,
    simulation: yes(f.模拟数据),
  };
}
function feishuAssetType(value) { return ({ video: '视频', image: '图片', audio: '音频', text: '文本' })[value] || value; }
function feishuOrientation(value) { return ({ portrait: '竖屏9:16', landscape: '横屏16:9', any: '不限' })[value] || value; }
function assetType(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === '图片' || normalized.startsWith('image/')) return 'image';
  if (normalized === '音频' || normalized.startsWith('audio/')) return 'audio';
  if (normalized === '文本' || normalized.startsWith('text/')) return 'text';
  return 'video';
}
function assetOrientation(value) {
  if (value === '横屏16:9') return 'landscape';
  if (value === '不限') return 'any';
  return 'portrait';
}
function dimensions(value) {
  const match = String(value || '').match(/(\d+)x(\d+)/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 0, height: 0 };
}

function mapShootingRequirement(record) {
  const f = record.fields;
  return {
    recordId: record.record_id, slotId: f.素材槽位ID, contentId: f.内容ID, taskId: f.任务ID, shotId: f.镜头ID,
    shotOrder: Number(f.镜头顺序) || 0, scriptText: f.对应台词 || '', visualDescription: f.画面描述 || '',
    type: assetType(f.素材类型), required: yes(f.是否必填), suggestedDurationSec: Number(f.建议时长秒) || 0,
    minDurationSec: Number(f.最低时长秒) || 0, orientation: assetOrientation(f.画面方向), shootingGuide: f.拍摄步骤 || '',
    notes: f.注意事项 || '', status: f.状态 || '待上传', simulation: yes(f.模拟数据),
  };
}

function mapAdvisorAsset(record) {
  const f = record.fields;
  const attachment = Array.isArray(f.素材文件) ? f.素材文件[0] : null;
  const size = dimensions(f.分辨率);
  const checkStatus = f.技术检查状态 || '待检查';
  return {
    recordId: record.record_id, assetId: f.素材ID, contentId: f.内容ID, slotId: f.素材槽位ID, shotId: f.镜头ID,
    advisorId: f.顾问ID, fileToken: attachment?.file_token || f.飞书文件Token || null, fileName: attachment?.name || '',
    mimeType: attachment?.type || '', fileSize: Number(attachment?.size) || 0, type: assetType(f.文件类型 || attachment?.type),
    durationSec: Number(f.视频时长秒) || 0, width: size.width, height: size.height, orientation: assetOrientation(f.画面方向),
    resolution: f.分辨率 || '', technicalCheckStatus: checkStatus,
    advisorConfirmationStatus: f.顾问确认状态 || '待确认', requiresReshoot: yes(f.是否需要重拍), invalidReason: f.不合格原因 || '',
    status: attachment
      ? checkStatus === '检查通过' ? 'available' : ['待检查', '检查中'].includes(checkStatus) ? 'checking' : 'invalid'
      : 'waiting_upload',
    simulation: yes(f.模拟数据),
  };
}

function mapEditingJob(record) {
  const f = record.fields;
  return {
    recordId: record.record_id,
    editingJobId: f.剪辑任务ID,
    contentId: f.内容ID,
    contentVersion: Number(f.内容版本) || 1,
    assetIds: split(f.使用素材ID),
    editingPlan: parseJson(f.剪辑方案JSON, {}),
    editor: f.剪辑模型或Skill || 'local-ffmpeg',
    status: f.任务状态 || '待剪辑',
    progress: Number(f.进度) || 0,
    progressMessage: f.进度说明 || '',
    failureReason: f.失败原因 || '',
    retryCount: Number(f.重试次数) || 0,
    previewFileToken: f.预览视频Token || null,
    finalFileToken: f.最终视频Token || null,
    advisorConfirmationStatus: f.顾问确认状态 || '待确认',
    completedAt: f.完成时间 || null,
    simulation: yes(f.模拟数据),
  };
}

export class FeishuOneKosRepository {
  constructor({ client, tableIds }) {
    this.client = client;
    this.tableIds = tableIds;
  }

  async find(table, field, value) {
    return this.client.findRecordByField(this.tableIds[table], field, value);
  }

  async getAdvisor(advisorId) {
    const record = await this.find('advisors', '顾问ID', advisorId);
    if (!record) return null;
    return mapAdvisor(record);
  }

  async listAdvisors() {
    const records = await this.client.listRecords(this.tableIds.advisors);
    return records.filter((record) => record.fields.顾问ID).map(mapAdvisor);
  }

  async getProfileTags(advisorId) {
    const records = await this.client.listRecords(this.tableIds.profileTags);
    return records.filter((record) => record.fields.顾问ID === advisorId && record.fields.标签ID).map((record) => {
      const f = record.fields;
      return { recordId: record.record_id, tagId: f.标签ID, advisorId: f.顾问ID, profileVersion: f.画像版本, dimension: f.维度, label: f.标签, status: f.状态, confidence: f.置信度, weight: f.权重, source: f.来源, sourceRefs: split(f.来源引用), evidence: f.证据, updatedAt: f.更新时间, simulation: yes(f.模拟数据) };
    });
  }

  async getTask(taskId) {
    const record = await this.find('contentTasks', '任务ID', taskId);
    if (!record) return null;
    return mapContentTask(record);
  }

  async getContentResult(contentId) {
    const record = await this.find('contentResults', '内容ID', contentId);
    return record ? mapContentResult(record) : null;
  }

  async listContentTasks(advisorId) {
    const records = await this.client.listRecords(this.tableIds.contentTasks);
    return records.filter((record) => record.fields.任务ID && (!advisorId || record.fields.顾问ID === advisorId)).map(mapContentTask);
  }

  async listCommentLeads(advisorId) {
    const records = await this.client.listRecords(this.tableIds.commentLeads);
    return records.filter((record) => record.fields.线索ID && (!advisorId || record.fields.顾问ID === advisorId)).map(mapCommentLead);
  }

  async getValidKnowledge(model, today) {
    const records = await this.client.listRecords(this.tableIds.brandKnowledge);
    return records.filter((record) => {
      const f = record.fields;
      return f.车型 === model && f.状态 === '有效' && (!f.有效期至 || f.有效期至 >= today);
    }).map((record) => {
      const f = record.fields;
      return { recordId: record.record_id, knowledgeId: f.知识ID, model: f.车型, field: f.字段, value: f.事实值, version: f.版本, checkedAt: f.核验日期, validUntil: f.有效期至, status: f.状态, source: f.来源, sourceUrl: f.来源URL, simulation: yes(f.模拟数据) };
    });
  }

  async listContentResults() {
    const records = await this.client.listRecords(this.tableIds.contentResults);
    return records.filter((record) => record.fields.内容ID).map(mapContentResult);
  }

  async getFeedbackEvent(eventId) {
    const record = await this.find('feedbackEvents', '事件ID', eventId);
    if (!record) return null;
    const f = record.fields;
    return { recordId: record.record_id, eventId: f.事件ID, advisorId: f.顾问ID, sourceRecordId: f.来源记录ID, eventType: f.事件类型, affectedTagId: f.影响标签ID, weightDelta: f.权重变化, evidence: f.证据, createdAt: f.创建时间, status: f.状态, simulation: yes(f.模拟数据) };
  }

  async getOnboardingSession(sessionId) {
    const record = await this.find('onboardingSessions', '会话ID', sessionId);
    if (!record) return null;
    const f = record.fields;
    const snapshot = restoreOnboardingSnapshot(parseJson(f.输入快照, {}));
    return {
      recordId: record.record_id,
      sessionId: f.会话ID,
      advisorId: f.顾问ID,
      status: f.状态,
      ...snapshot,
      candidates: parseJson(f.候选标签, []),
      acceptedTags: parseJson(f.确认标签, []),
      writeProgress: parseJson(f.写入进度, {}),
      generator: f.生成方式 || null,
      warnings: parseJson(f.警告, []),
      lastError: f.最近错误 || null,
      createdAt: f.创建时间,
      updatedAt: f.更新时间,
      confirmedAt: f.确认时间 || null,
      profileVersion: f.画像版本 || null,
      taskId: f.首条任务ID || null,
      simulation: yes(f.模拟数据),
    };
  }

  async listShootingRequirements(contentId) {
    const records = await this.client.listRecords(this.tableIds.shootingRequirements);
    return records.filter((record) => record.fields.素材槽位ID && record.fields.内容ID === contentId).map(mapShootingRequirement);
  }

  async listAdvisorAssets(contentId) {
    const records = await this.client.listRecords(this.tableIds.advisorAssets);
    return records.filter((record) => record.fields.素材ID && record.fields.内容ID === contentId).map(mapAdvisorAsset);
  }

  uploadAdvisorAssetFile(file) { return this.client.uploadMedia(file); }
  downloadAdvisorAssetFile(fileToken) { return this.client.downloadMedia(fileToken); }
  uploadRenderedVideoFile(file) { return this.client.uploadMedia(file); }

  async getEditingJob(editingJobId) {
    const record = await this.find('editingJobs', '剪辑任务ID', editingJobId);
    return record ? mapEditingJob(record) : null;
  }

  async saveAdvisor(advisor) {
    const fields = {
      顾问ID: advisor.advisorId, 展示名称: advisor.displayName, 城市: advisor.city, 门店: advisor.store,
      从业年限: advisor.experienceYears, 目标用户: advisor.targetAudience, 画像成熟度: advisor.profileMaturity,
      流程状态: advisor.workflowStatus, 授权状态: advisor.authorizationStatus,
      模拟数据: advisor.simulation ? '是' : '否',
    };
    if (advisor.initializationStatus !== undefined) fields.初始化状态 = advisor.initializationStatus;
    if (advisor.profileVersion !== undefined) fields.当前画像版本 = advisor.profileVersion;
    if (advisor.identitySource !== undefined) fields.身份来源 = advisor.identitySource;
    if (advisor.externalUserId !== undefined) fields.外部用户标识 = advisor.externalUserId || '';
    if (advisor.initializedAt !== undefined) fields.首次初始化时间 = advisor.initializedAt || '';
    const result = await this.client.upsertByField(this.tableIds.advisors, '顾问ID', advisor.advisorId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveOnboardingSession(session) {
    const fields = {
      会话ID: session.sessionId, 顾问ID: session.advisorId, 状态: session.status,
      输入快照: json(onboardingSnapshot(session)), 候选标签: json(session.candidates || []), 确认标签: json(session.acceptedTags || []),
      写入进度: json(session.writeProgress || {}), 生成方式: session.generator || '',
      警告: json(session.warnings || []), 最近错误: session.lastError || '',
      创建时间: session.createdAt || '', 更新时间: session.updatedAt || '', 确认时间: session.confirmedAt || '',
      画像版本: session.profileVersion || '', 首条任务ID: session.taskId || '',
      模拟数据: session.simulation ? '是' : '否',
    };
    const result = await this.client.upsertByField(this.tableIds.onboardingSessions, '会话ID', session.sessionId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveContentTask(task) {
    const fields = {
      任务ID: task.taskId, 顾问ID: task.advisorId, 目标车型: task.targetModel, 用户问题: task.userQuestion,
      内容角度: task.topic, 路由匹配分: task.routeScore, 矩阵空白: task.matrixGap,
      画像证据ID: (task.profileEvidence || []).join('｜'), 任务日期: task.taskDate,
      状态: task.status, 路由时间: task.routedAt || '', 顾问决策: task.decision || '', 拒绝原因: task.rejectionReason || '', 决策时间: task.decidedAt || '', 模拟数据: task.simulation ? '是' : '否',
    };
    const result = await this.client.upsertByField(this.tableIds.contentTasks, '任务ID', task.taskId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveContentPackage(content) {
    const fields = {
      内容ID: content.contentId, 任务ID: content.taskId, 状态: content.status, 模拟数据: content.simulation ? '是' : '否',
      画像引用ID: (content.profileRefs || []).join('｜'), 事实引用ID: (content.factRefs || []).join('｜'),
      开场: content.hook, 口播脚本: content.script, 分镜: lines(content.storyboard), 素材清单: lines(content.materials), 标题: content.title,
      事实质检分: content.quality?.fact?.score, 合规质检分: content.quality?.compliance?.score,
      人设质检分: content.quality?.persona?.score, 矩阵质检分: content.quality?.matrix?.score,
    };
    const result = await this.client.upsertByField(this.tableIds.contentResults, '内容ID', content.contentId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveShootingRequirements(requirements) {
    const writes = [];
    for (const requirement of requirements) {
      const fields = {
        素材槽位ID: requirement.slotId,
        内容ID: requirement.contentId,
        任务ID: requirement.taskId,
        镜头ID: requirement.shotId,
        镜头顺序: requirement.shotOrder,
        对应台词: requirement.scriptText,
        画面描述: requirement.visualDescription,
        素材类型: feishuAssetType(requirement.type),
        是否必填: requirement.required ? '是' : '否',
        建议时长秒: requirement.suggestedDurationSec,
        最低时长秒: requirement.minDurationSec,
        画面方向: feishuOrientation(requirement.orientation),
        拍摄步骤: requirement.shootingGuide,
        注意事项: requirement.notes,
        状态: requirement.status,
        模拟数据: requirement.simulation ? '是' : '否',
      };
      const result = await this.client.upsertByField(this.tableIds.shootingRequirements, '素材槽位ID', requirement.slotId, fields);
      writes.push({ action: result.action, recordId: result.record?.record_id, record: result.record });
    }
    return writes;
  }

  async retireShootingRequirements(contentId, activeSlotIds) {
    const active = new Set(activeSlotIds);
    const records = await this.client.listRecords(this.tableIds.shootingRequirements);
    const stale = records.filter((record) => record.fields.内容ID === contentId
      && record.fields.素材槽位ID
      && !active.has(record.fields.素材槽位ID)
      && yes(record.fields.是否必填));
    const writes = [];
    for (const record of stale) {
      const updated = await this.client.updateRecord(this.tableIds.shootingRequirements, record.record_id, {
        是否必填: '否',
        状态: '可选未上传',
      });
      writes.push({ action: 'updated', recordId: updated.record_id, record: updated });
    }
    return writes;
  }

  async saveAdvisorAssets(assets) {
    const writes = [];
    for (const asset of assets) {
      const fields = {
        素材ID: asset.assetId,
        内容ID: asset.contentId,
        素材槽位ID: asset.slotId,
        镜头ID: asset.shotId,
        顾问ID: asset.advisorId,
        文件类型: feishuAssetType(asset.type),
        视频时长秒: asset.durationSec,
        画面方向: feishuOrientation(asset.orientation),
        分辨率: asset.resolution,
        技术检查状态: asset.technicalCheckStatus,
        顾问确认状态: asset.advisorConfirmationStatus,
        是否需要重拍: asset.requiresReshoot ? '是' : '否',
        不合格原因: asset.invalidReason,
        模拟数据: asset.simulation ? '是' : '否',
      };
      if (asset.fileToken) {
        fields.飞书文件Token = asset.fileToken;
        fields.素材文件 = [{ file_token: asset.fileToken }];
      }
      const result = await this.client.upsertByField(this.tableIds.advisorAssets, '素材ID', asset.assetId, fields);
      writes.push({ action: result.action, recordId: result.record?.record_id, record: result.record });
    }
    return writes;
  }

  async saveEditingJob(job) {
    const fields = {
      剪辑任务ID: job.editingJobId,
      内容ID: job.contentId,
      内容版本: job.contentVersion,
      使用素材ID: (job.assetIds || []).join('｜'),
      剪辑方案JSON: JSON.stringify(job.editingPlan),
      剪辑模型或Skill: job.editor,
      任务状态: job.status,
      进度: job.progress,
      失败原因: job.failureReason,
      重试次数: job.retryCount,
      顾问确认状态: job.advisorConfirmationStatus,
      模拟数据: job.simulation ? '是' : '否',
    };
    if (job.previewFileToken) {
      fields.预览视频Token = job.previewFileToken;
      fields.预览视频 = [{ file_token: job.previewFileToken }];
    }
    if (job.finalFileToken) {
      fields.最终视频Token = job.finalFileToken;
      fields.最终视频 = [{ file_token: job.finalFileToken }];
    }
    if (job.completedAt) fields.完成时间 = Date.parse(job.completedAt) || job.completedAt;
    if (job.recordId) {
      const record = await this.client.updateRecord(this.tableIds.editingJobs, job.recordId, fields);
      return { action: 'updated', recordId: record?.record_id || job.recordId, record };
    }
    const result = await this.client.upsertByField(this.tableIds.editingJobs, '剪辑任务ID', job.editingJobId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveCommentLead(lead) {
    const fields = {
      线索ID: lead.leadId, 线索等级: lead.grade, 评论ID: lead.commentId, 顾问ID: lead.advisorId, 内容ID: lead.contentId,
      平台: lead.platform, 原评论: lead.originalComment, 城市: lead.city, 家庭结构: lead.familyStructure, 车型: lead.model,
      购车时间: lead.purchaseWindow, 试驾意愿: lead.testDriveIntent, 线索分: lead.score, 状态: lead.status,
      下一步建议: lead.nextAction, 字段证据: JSON.stringify(lead.fieldEvidence), 授权状态: '仅演示，须人工接管',
      最后同步时间: lead.updatedAt, 模拟数据: lead.simulation ? '是' : '否',
    };
    const result = await this.client.upsertByField(this.tableIds.commentLeads, '线索ID', lead.leadId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveFeedbackEvent(event) {
    const fields = { 事件ID: event.eventId, 顾问ID: event.advisorId, 来源记录ID: event.sourceRecordId, 事件类型: event.eventType, 影响标签ID: event.affectedTagId, 权重变化: event.weightDelta, 证据: event.evidence, 创建时间: event.createdAt, 状态: event.status, 模拟数据: event.simulation ? '是' : '否' };
    const result = await this.client.upsertByField(this.tableIds.feedbackEvents, '事件ID', event.eventId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }

  async saveProfileTag(tag) {
    const fields = { 标签ID: tag.tagId, 顾问ID: tag.advisorId, 画像版本: tag.profileVersion, 维度: tag.dimension, 标签: tag.label, 状态: tag.status, 置信度: tag.confidence, 权重: tag.weight, 来源: tag.source, 来源引用: (tag.sourceRefs || []).join('｜'), 证据: tag.evidence, 更新时间: tag.updatedAt, 模拟数据: tag.simulation ? '是' : '否' };
    const result = await this.client.upsertByField(this.tableIds.profileTags, '标签ID', tag.tagId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }
}
