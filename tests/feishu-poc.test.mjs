import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BITABLE_TABLES,
  createFeishuPocDataset,
  createInitialWorkflowState,
  applyFeishuWorkflowEvent,
} from '../src/feishu-poc.mjs';

test('飞书 PoC 提供七张相互关联且明确标注模拟的数据表', () => {
  const dataset = createFeishuPocDataset();

  assert.deepEqual(Object.keys(dataset), BITABLE_TABLES);
  assert.equal(BITABLE_TABLES.length, 7);
  for (const table of BITABLE_TABLES) {
    assert.ok(dataset[table].length > 0, `${table} 不应为空`);
    assert.ok(dataset[table].every((record) => record.simulation === true), `${table} 必须标注模拟数据`);
  }
});

test('画像、任务、内容、评论线索和反馈事件都能追溯到顾问与原始证据', () => {
  const dataset = createFeishuPocDataset();
  const advisorIds = new Set(dataset.advisors.map((item) => item.advisorId));
  const taskIds = new Set(dataset.contentTasks.map((item) => item.taskId));
  const commentIds = new Set(dataset.commentLeads.map((item) => item.commentId));

  assert.ok(dataset.profileTags.every((item) => advisorIds.has(item.advisorId) && item.evidence && item.source));
  assert.ok(dataset.contentTasks.every((item) => advisorIds.has(item.advisorId)));
  assert.ok(dataset.contentResults.every((item) => taskIds.has(item.taskId) && item.factRefs.length > 0));
  assert.ok(dataset.commentLeads.every((item) => item.sourceText && item.fieldEvidence));
  assert.ok(dataset.feedbackEvents.every((item) => advisorIds.has(item.advisorId)));
  assert.ok(dataset.feedbackEvents.some((item) => commentIds.has(item.sourceRecordId)));
});

test('工作流只允许按校准、选题、生成、质检、线索接管和学习顺序推进', () => {
  let state = createInitialWorkflowState('ADV-017');
  assert.deepEqual(state, {
    advisorId: 'ADV-017',
    stage: '待校准',
    taskId: null,
    contentId: null,
    leadId: null,
    history: [],
  });

  state = applyFeishuWorkflowEvent(state, { type: 'PROFILE_CALIBRATED' });
  state = applyFeishuWorkflowEvent(state, { type: 'TOPIC_ROUTED', taskId: 'TASK-001' });
  state = applyFeishuWorkflowEvent(state, { type: 'CONTENT_GENERATED', contentId: 'CONTENT-001' });
  state = applyFeishuWorkflowEvent(state, { type: 'QUALITY_PASSED' });
  state = applyFeishuWorkflowEvent(state, { type: 'LEAD_IDENTIFIED', leadId: 'LEAD-001' });
  state = applyFeishuWorkflowEvent(state, { type: 'LEAD_TAKEN_OVER' });
  state = applyFeishuWorkflowEvent(state, { type: 'OUTCOME_RECORDED' });

  assert.equal(state.stage, '已学习');
  assert.equal(state.history.length, 7);
  assert.throws(
    () => applyFeishuWorkflowEvent(createInitialWorkflowState('ADV-017'), { type: 'CONTENT_GENERATED', contentId: 'CONTENT-001' }),
    /非法工作流转换/,
  );
});

test('外部平台字段保留来源、授权和最后同步时间，不伪装实时接入', () => {
  const dataset = createFeishuPocDataset();
  const comment = dataset.commentLeads[0];

  assert.equal(comment.platform, '抖音（模拟）');
  assert.equal(comment.authorizationStatus, '未接入真实账号');
  assert.match(comment.lastSyncedAt, /模拟/);
});
