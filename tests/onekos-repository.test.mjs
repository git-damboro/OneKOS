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

  const snapshot = repository.snapshot();
  assert.equal(snapshot.advisors.filter((item) => item.advisorId === advisor.advisorId).length, 1);
  assert.equal(snapshot.onboardingSessions.filter((item) => item.sessionId === 'ONB-001').length, 1);
  assert.equal(snapshot.contentTasks.filter((item) => item.taskId === task.taskId).length, 1);
  assert.equal(snapshot.contentTasks.find((item) => item.taskId === task.taskId).topic, '更新后的首条内容');
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
    profileEvidence: ['TAG-001'], taskDate: '2026-08-09', status: '待生成', simulation: true,
  });

  assert.equal(upserts[0].fields.当前画像版本, 1);
  assert.equal(upserts[0].fields.初始化状态, 'active');
  assert.equal(upserts[1].fields.画像版本, 1);
  assert.equal(upserts[1].fields.来源引用, 'ONB-001');
  assert.equal(upserts[2].fields.任务ID, 'TASK-ADV-NEW-001-001');
});

