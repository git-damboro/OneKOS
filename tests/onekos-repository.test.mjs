import assert from 'node:assert/strict';
import test from 'node:test';

import { FeishuOneKosRepository, SimulationOneKosRepository } from '../src/onekos-repository.mjs';

test('模拟仓库可保存顾问、恢复初始化会话并幂等写入首条任务', async () => {
  const repository = new SimulationOneKosRepository();
  const advisor = {
    advisorId: 'ADV-NEW-001', displayName: '顾问小林', city: '成都', store: '成都模拟门店',
    experienceYears: 3, targetAudience: '城市通勤家庭', profileMaturity: 0,
    workflowStatus: '待校准', initializationStatus: 'collecting', profileVersion: 0,
    identitySource: 'demo', authorizationStatus: '仅使用主动提供的资料', simulation: true,
  };
  const session = {
    sessionId: 'ONB-001', advisorId: advisor.advisorId, status: 'draft', input: advisor,
    candidates: [], acceptedTags: [], writeProgress: {}, createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z', simulation: true,
  };
  const task = {
    taskId: 'TASK-ADV-NEW-001-001', advisorId: advisor.advisorId, targetModel: '乐道 L60',
    userQuestion: '城市通勤家庭最关心什么？', topic: '成都补能首条内容', profileEvidence: ['TAG-001'],
    taskDate: '2026-08-09', status: '待生成', simulation: true,
  };

  assert.equal((await repository.saveAdvisor(advisor)).action, 'created');
  assert.ok((await repository.listAdvisors()).some((item) => item.advisorId === advisor.advisorId));
  assert.equal((await repository.saveOnboardingSession(session)).action, 'created');
  assert.equal((await repository.getOnboardingSession('ONB-001')).status, 'draft');
  assert.equal((await repository.saveContentTask(task)).action, 'created');
  assert.equal((await repository.saveContentTask({ ...task, topic: '更新后的首条内容' })).action, 'updated');
  await repository.saveCommentLead({ leadId: 'LEAD-001', advisorId: advisor.advisorId, originalComment: '想了解 L60', grade: 'B' });

  const snapshot = repository.snapshot();
  assert.equal(snapshot.advisors.filter((item) => item.advisorId === advisor.advisorId).length, 1);
  assert.equal(snapshot.onboardingSessions.filter((item) => item.sessionId === 'ONB-001').length, 1);
  assert.equal(snapshot.contentTasks.filter((item) => item.taskId === task.taskId).length, 1);
  assert.equal(snapshot.contentTasks.find((item) => item.taskId === task.taskId).topic, '更新后的首条内容');
  assert.deepEqual((await repository.listContentTasks(advisor.advisorId)).map((item) => item.taskId), [task.taskId]);
  assert.deepEqual((await repository.listCommentLeads(advisor.advisorId)).map((item) => item.leadId), ['LEAD-001']);
});

test('模拟仓库返回克隆值，不允许调用方修改内部会话', async () => {
  const repository = new SimulationOneKosRepository();
  await repository.saveOnboardingSession({
    sessionId: 'ONB-CLONE', advisorId: 'ADV-017', status: 'draft', input: {}, candidates: [],
    acceptedTags: [], writeProgress: {}, simulation: true,
  });

  const session = await repository.getOnboardingSession('ONB-CLONE');
  session.status = 'confirmed';

  assert.equal((await repository.getOnboardingSession('ONB-CLONE')).status, 'draft');
});

test('飞书仓库把初始化会话写入独立表并可恢复 JSON 字段', async () => {
  const upserts = [];
  const records = new Map();
  const client = {
    async upsertByField(tableId, field, value, fields) {
      upserts.push({ tableId, field, value, fields });
      records.set(`${tableId}:${value}`, { record_id: `rec-${value}`, fields });
      return { action: upserts.length === 1 ? 'created' : 'updated', record: records.get(`${tableId}:${value}`) };
    },
    async findRecordByField(tableId, field, value) {
      return records.get(`${tableId}:${value}`) || null;
    },
    async listRecords() { return []; },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: {
      advisors: 'tbl-advisors', profileTags: 'tbl-tags', brandKnowledge: 'tbl-knowledge',
      contentTasks: 'tbl-tasks', contentResults: 'tbl-results', commentLeads: 'tbl-leads',
      feedbackEvents: 'tbl-events', onboardingSessions: 'tbl-onboarding',
    },
  });
  const session = {
    sessionId: 'ONB-001', advisorId: 'ADV-NEW-001', status: 'generated', input: { city: '成都' },
    candidates: [{ tagId: 'TAG-001' }], acceptedTags: [], writeProgress: { advisor: true },
    generator: 'local-rule-fallback', warnings: ['模型不可用'], lastError: null,
    createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T01:00:00.000Z', simulation: true,
  };

  const write = await repository.saveOnboardingSession(session);
  const restored = await repository.getOnboardingSession('ONB-001');

  assert.equal(write.action, 'created');
  assert.equal(upserts[0].tableId, 'tbl-onboarding');
  assert.equal(upserts[0].field, '会话ID');
  assert.equal(upserts[0].fields.状态, 'generated');
  assert.deepEqual(restored.input, { city: '成都' });
  assert.deepEqual(restored.writeProgress, { advisor: true });
  assert.equal(restored.generator, 'local-rule-fallback');
});

test('Feishu repository preserves quiz session state across round trip', async () => {
  const records = new Map();
  const client = {
    async upsertByField(tableId, field, value, fields) {
      records.set(`${tableId}:${value}`, { record_id: `rec-${value}`, fields });
      return { action: 'created', record: records.get(`${tableId}:${value}`) };
    },
    async findRecordByField(tableId, field, value) {
      return records.get(`${tableId}:${value}`) || null;
    },
    async listRecords() { return []; },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: {
      advisors: 'tbl-advisors', profileTags: 'tbl-tags', brandKnowledge: 'tbl-knowledge',
      contentTasks: 'tbl-tasks', contentResults: 'tbl-results', commentLeads: 'tbl-leads',
      feedbackEvents: 'tbl-events', onboardingSessions: 'tbl-onboarding',
    },
  });
  const session = {
    sessionId: 'QUIZ-001',
    advisorId: 'ADV-FEISHU-001',
    mode: 'quiz',
    status: 'quiz_active',
    identity: { displayName: 'Feishu Advisor', city: 'Chengdu', store: 'OneKOS Store' },
    questionIds: ['Q-PROFESSIONAL', 'Q-AUDIENCE'],
    adaptiveQuestionIds: [],
    answers: { 'Q-PROFESSIONAL': 'needs' },
    currentQuestionId: 'Q-AUDIENCE',
    candidates: [],
    acceptedTags: [],
    writeProgress: {},
    generator: null,
    warnings: [],
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T01:00:00.000Z',
    simulation: false,
  };

  await repository.saveOnboardingSession(session);
  const restored = await repository.getOnboardingSession('QUIZ-001');

  assert.equal(restored.mode, 'quiz');
  assert.deepEqual(restored.identity, session.identity);
  assert.deepEqual(restored.questionIds, session.questionIds);
  assert.deepEqual(restored.answers, session.answers);
  assert.equal(restored.currentQuestionId, 'Q-AUDIENCE');
});

test('Feishu repository falls back when profile tag V1 fields are missing', async () => {
  const upserts = [];
  const client = {
    async upsertByField(tableId, field, value, fields) {
      upserts.push({ tableId, field, value, fields });
      if ('画像版本' in fields || '来源引用' in fields) throw new Error('飞书 OpenAPI 错误：FieldNameNotFound');
      return { action: 'created', record: { record_id: `rec-${value}`, fields } };
    },
    async findRecordByField() { return null; },
    async listRecords() { return []; },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: {
      advisors: 'tbl-advisors', profileTags: 'tbl-tags', brandKnowledge: 'tbl-knowledge',
      contentTasks: 'tbl-tasks', contentResults: 'tbl-results', commentLeads: 'tbl-leads',
      feedbackEvents: 'tbl-events', onboardingSessions: 'tbl-onboarding',
    },
  });

  const write = await repository.saveProfileTag({
    tagId: 'TAG-FEISHU-001', advisorId: 'ADV-FEISHU-001', profileVersion: 1, dimension: '内容形式',
    label: '实测内容', status: '生效', confidence: 92, weight: 88, source: '问卷答题',
    sourceRefs: ['QUIZ-001'], evidence: ['选择：实测路线'], updatedAt: '2026-08-09T01:00:00.000Z', simulation: false,
  });

  assert.equal(write.action, 'created');
  assert.equal(upserts.length, 2);
  assert.equal('画像版本' in upserts[0].fields, true);
  assert.equal('来源引用' in upserts[0].fields, true);
  assert.equal('画像版本' in upserts[1].fields, false);
  assert.equal('来源引用' in upserts[1].fields, false);
});

test('Feishu repository falls back when content task decision fields are missing', async () => {
  const upserts = [];
  const client = {
    async upsertByField(tableId, field, value, fields) {
      upserts.push({ tableId, field, value, fields });
      if ('路由时间' in fields || '顾问决策' in fields || '拒绝原因' in fields || '决策时间' in fields) throw new Error('飞书 OpenAPI 错误：FieldNameNotFound');
      return { action: 'created', record: { record_id: `rec-${value}`, fields } };
    },
    async findRecordByField() { return null; },
    async listRecords() { return []; },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: {
      advisors: 'tbl-advisors', profileTags: 'tbl-tags', brandKnowledge: 'tbl-knowledge',
      contentTasks: 'tbl-tasks', contentResults: 'tbl-results', commentLeads: 'tbl-leads',
      feedbackEvents: 'tbl-events', onboardingSessions: 'tbl-onboarding',
    },
  });

  const write = await repository.saveContentTask({
    taskId: 'TASK-FEISHU-001', advisorId: 'ADV-FEISHU-001', targetModel: '乐道 L60',
    userQuestion: '用户最关心的问题是什么？', topic: '上海实测首条任务', routeScore: 80,
    matrixGap: '新顾问首条真实场景内容', profileEvidence: ['TAG-FEISHU-001'], taskDate: '2026-08-09',
    status: '待生成', routedAt: '2026-08-09T01:00:00.000Z', decision: 'accept', rejectionReason: '', decidedAt: '',
    simulation: false,
  });

  assert.equal(write.action, 'created');
  assert.equal(upserts.length, 2);
  assert.equal('路由时间' in upserts[0].fields, true);
  assert.equal('顾问决策' in upserts[0].fields, true);
  assert.equal('路由时间' in upserts[1].fields, false);
  assert.equal('顾问决策' in upserts[1].fields, false);
});

test('飞书仓库映射顾问、标签与首条任务的画像版本字段', async () => {
  const upserts = [];
  const client = {
    async upsertByField(tableId, field, value, fields) {
      upserts.push({ tableId, field, value, fields });
      return { action: 'created', record: { record_id: `rec-${value}`, fields } };
    },
    async findRecordByField() { return null; },
    async listRecords() { return []; },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: {
      advisors: 'tbl-advisors', profileTags: 'tbl-tags', contentTasks: 'tbl-tasks',
      onboardingSessions: 'tbl-onboarding', brandKnowledge: 'tbl-knowledge', contentResults: 'tbl-results',
      commentLeads: 'tbl-leads', feedbackEvents: 'tbl-events',
    },
  });

  await repository.saveAdvisor({
    advisorId: 'ADV-NEW-001', displayName: '顾问小林', city: '成都', store: '成都模拟门店',
    experienceYears: 3, targetAudience: '城市通勤家庭', profileMaturity: 72,
    workflowStatus: '已校准', initializationStatus: 'active', profileVersion: 1,
    identitySource: 'demo', authorizationStatus: '已确认', initializedAt: '2026-08-09T01:00:00.000Z', simulation: true,
  });
  await repository.saveProfileTag({
    tagId: 'TAG-001', advisorId: 'ADV-NEW-001', profileVersion: 1, dimension: '表达结构',
    label: '先结论后解释', status: '生效', confidence: 90, weight: 80,
    source: '资料＋偏好', sourceRefs: ['ONB-001'], evidence: '顾问主动选择', updatedAt: '2026-08-09T01:00:00.000Z', simulation: true,
  });
  await repository.saveContentTask({
    taskId: 'TASK-ADV-NEW-001-001', advisorId: 'ADV-NEW-001', targetModel: '乐道 L60',
    userQuestion: '用户问题', topic: '内容角度', routeScore: 80, matrixGap: '首条任务',
    profileEvidence: ['TAG-001'], taskDate: '2026-08-09', status: '待生成',
    routedAt: '2026-08-09T12:00:00.000Z', decision: 'accept', simulation: true,
  });

  assert.equal(upserts[0].fields.当前画像版本, 1);
  assert.equal(upserts[0].fields.初始化状态, 'active');
  assert.equal(upserts[1].fields.画像版本, 1);
  assert.equal(upserts[1].fields.来源引用, 'ONB-001');
  assert.equal(upserts[2].fields.任务ID, 'TASK-ADV-NEW-001-001');
  assert.equal(upserts[2].fields.路由时间, '2026-08-09T12:00:00.000Z');
  assert.equal(upserts[2].fields.顾问决策, 'accept');
});

test('飞书仓库读取机会任务池和评论需求信号', async () => {
  const client = {
    async listRecords(tableId) {
      if (tableId === 'tbl-tasks') return [{ record_id: 'rec-task', fields: {
        任务ID: 'TASK-001', 顾问ID: 'ADV-017', 目标车型: '乐道 L60', 用户问题: '没有家充怎么补能？',
        内容角度: '成都晚高峰补能', 路由匹配分: '88', 矩阵空白: '真实等待时间', 画像证据ID: 'TAG-001｜TAG-002',
        任务日期: '2026-08-09', 状态: '待生成', 路由时间: '2026-08-09T12:00:00.000Z', 顾问决策: 'accept', 拒绝原因: '', 决策时间: '', 模拟数据: '否',
      }}];
      if (tableId === 'tbl-leads') return [{ record_id: 'rec-lead', fields: {
        线索ID: 'LEAD-001', 顾问ID: 'ADV-017', 车型: 'L60', 原评论: '没有家充，每天通勤怎么补能？',
        线索等级: 'A', 状态: '待顾问人工接管', 模拟数据: '否',
      }}];
      return [];
    },
  };
  const repository = new FeishuOneKosRepository({
    client,
    tableIds: { contentTasks: 'tbl-tasks', commentLeads: 'tbl-leads' },
  });

  const taskRows = await repository.listContentTasks('ADV-017');
  const leadRows = await repository.listCommentLeads('ADV-017');

  assert.equal(taskRows[0].taskId, 'TASK-001');
  assert.equal(taskRows[0].routeScore, 88);
  assert.equal(typeof taskRows[0].routeScore, 'number');
  assert.deepEqual(taskRows[0].profileEvidence, ['TAG-001', 'TAG-002']);
  assert.equal(taskRows[0].routedAt, '2026-08-09T12:00:00.000Z');
  assert.equal(taskRows[0].decision, 'accept');
  assert.equal(leadRows[0].originalComment, '没有家充，每天通勤怎么补能？');
  assert.equal(leadRows[0].grade, 'A');
});

test('飞书仓库把顾问档案中的数字文本规范化为数字', async () => {
  const client = {
    async findRecordByField() {
      return { record_id: 'rec-advisor', fields: {
        顾问ID: 'ADV-017', 展示名称: '顾问 017', 从业年限: '4', 画像成熟度: '78', 模拟数据: '否',
      }};
    },
  };
  const repository = new FeishuOneKosRepository({ client, tableIds: { advisors: 'tbl-advisors' } });

  const advisor = await repository.getAdvisor('ADV-017');

  assert.equal(advisor.experienceYears, 4);
  assert.equal(advisor.profileMaturity, 78);
  assert.equal(typeof advisor.experienceYears, 'number');
  assert.equal(typeof advisor.profileMaturity, 'number');
});

test('飞书仓库更新旧版顾问时不提交不存在的可选画像字段', async () => {
  let writtenFields;
  const client = {
    async upsertByField(tableId, field, value, fields) {
      writtenFields = fields;
      return { action: 'updated', record: { record_id: 'rec-advisor', fields } };
    },
  };
  const repository = new FeishuOneKosRepository({ client, tableIds: { advisors: 'tbl-advisors' } });

  await repository.saveAdvisor({
    advisorId: 'ADV-017', displayName: '顾问 017', city: '成都', store: '成都门店',
    experienceYears: 4, targetAudience: '城市通勤家庭', profileMaturity: 78,
    workflowStatus: '待生成', authorizationStatus: '已授权', simulation: false,
  });

  assert.equal(writtenFields.流程状态, '待生成');
  assert.equal('外部用户标识' in writtenFields, false);
  assert.equal('首次初始化时间' in writtenFields, false);
  assert.equal('初始化状态' in writtenFields, false);
});

test('剪辑完成写回附件、Token 与飞书毫秒时间', async () => {
  let writtenFields;
  const client = {
    async upsertByField(tableId, field, value, fields) {
      writtenFields = fields;
      return { action: 'created', record: { record_id: 'rec-render', fields } };
    },
  };
  const repository = new FeishuOneKosRepository({ client, tableIds: { editingJobs: 'tbl-editing' } });
  await repository.saveEditingJob({
    editingJobId: 'RENDER-001', contentId: 'CONTENT-001', contentVersion: 1, assetIds: ['ASSET-001'],
    editingPlan: { shots: [] }, editor: '本地 FFmpeg', status: '待顾问预览', progress: 100,
    failureReason: '', retryCount: 0, previewFileToken: 'box-preview', finalFileToken: null,
    advisorConfirmationStatus: '待确认', completedAt: '2026-08-10T06:00:00.000Z', simulation: false,
  });

  assert.deepEqual(writtenFields.预览视频, [{ file_token: 'box-preview' }]);
  assert.equal(writtenFields.预览视频Token, 'box-preview');
  assert.equal(writtenFields.最终视频, undefined);
  assert.equal(writtenFields.完成时间, Date.parse('2026-08-10T06:00:00.000Z'));
  assert.equal(writtenFields.模拟数据, '否');
});

