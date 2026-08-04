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
};

export class SimulationOneKosRepository {
  constructor(seed = SIMULATION_DATA) {
    this.data = clone(seed);
    this.sequence = 1;
  }

  snapshot() { return clone(this.data); }
  async getAdvisor(advisorId) { return clone(this.data.advisors.find((item) => item.advisorId === advisorId) || null); }
  async getProfileTags(advisorId) { return clone(this.data.profileTags.filter((item) => item.advisorId === advisorId)); }
  async getTask(taskId) { return clone(this.data.contentTasks.find((item) => item.taskId === taskId) || null); }
  async getValidKnowledge(model, today) { return clone(this.data.brandKnowledge.filter((item) => item.model === model && item.status === '有效' && (!item.validUntil || item.validUntil >= today))); }
  async listContentResults() { return clone(this.data.contentResults); }
  async getFeedbackEvent(eventId) { return clone(this.data.feedbackEvents.find((item) => item.eventId === eventId) || null); }

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
  saveCommentLead(lead) { return this.upsert('commentLeads', 'leadId', lead.leadId, lead); }
  saveFeedbackEvent(event) { return this.upsert('feedbackEvents', 'eventId', event.eventId, event); }
  saveProfileTag(tag) { return this.upsert('profileTags', 'tagId', tag.tagId, tag); }
}

function yes(value) { return value === true || value === '是'; }
function split(value) {
  if (Array.isArray(value)) return value;
  return value ? String(value).split(/[｜|\n]/).map((item) => item.trim()).filter(Boolean) : [];
}
function lines(value) { return Array.isArray(value) ? value.join('\n') : value || ''; }

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
    const f = record.fields;
    return { recordId: record.record_id, advisorId: f.顾问ID, displayName: f.展示名称, city: f.城市, store: f.门店, experienceYears: f.从业年限, targetAudience: f.目标用户, profileMaturity: f.画像成熟度, workflowStatus: f.流程状态, authorizationStatus: f.授权状态, simulation: yes(f.模拟数据) };
  }

  async getProfileTags(advisorId) {
    const records = await this.client.listRecords(this.tableIds.profileTags);
    return records.filter((record) => record.fields.顾问ID === advisorId && record.fields.标签ID).map((record) => {
      const f = record.fields;
      return { recordId: record.record_id, tagId: f.标签ID, advisorId: f.顾问ID, dimension: f.维度, label: f.标签, status: f.状态, confidence: f.置信度, weight: f.权重, source: f.来源, evidence: f.证据, updatedAt: f.更新时间, simulation: yes(f.模拟数据) };
    });
  }

  async getTask(taskId) {
    const record = await this.find('contentTasks', '任务ID', taskId);
    if (!record) return null;
    const f = record.fields;
    return { recordId: record.record_id, taskId: f.任务ID, advisorId: f.顾问ID, targetModel: f.目标车型, userQuestion: f.用户问题, topic: f.内容角度, routeScore: f.路由匹配分, matrixGap: f.矩阵空白, profileEvidence: split(f.画像证据ID), taskDate: f.任务日期, status: f.状态, simulation: yes(f.模拟数据) };
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
    return records.filter((record) => record.fields.内容ID).map((record) => {
      const f = record.fields;
      return { recordId: record.record_id, contentId: f.内容ID, taskId: f.任务ID, title: f.标题, hook: f.开场, script: f.口播脚本, storyboard: split(f.分镜), materials: split(f.素材清单), factRefs: split(f.事实引用ID), profileRefs: split(f.画像引用ID), status: f.状态, simulation: yes(f.模拟数据) };
    });
  }

  async getFeedbackEvent(eventId) {
    const record = await this.find('feedbackEvents', '事件ID', eventId);
    if (!record) return null;
    const f = record.fields;
    return { recordId: record.record_id, eventId: f.事件ID, advisorId: f.顾问ID, sourceRecordId: f.来源记录ID, eventType: f.事件类型, affectedTagId: f.影响标签ID, weightDelta: f.权重变化, evidence: f.证据, createdAt: f.创建时间, status: f.状态, simulation: yes(f.模拟数据) };
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
    const fields = { 标签ID: tag.tagId, 顾问ID: tag.advisorId, 维度: tag.dimension, 标签: tag.label, 状态: tag.status, 置信度: tag.confidence, 权重: tag.weight, 来源: tag.source, 证据: tag.evidence, 更新时间: tag.updatedAt, 模拟数据: tag.simulation ? '是' : '否' };
    const result = await this.client.upsertByField(this.tableIds.profileTags, '标签ID', tag.tagId, fields);
    return { action: result.action, recordId: result.record?.record_id, record: result.record };
  }
}
