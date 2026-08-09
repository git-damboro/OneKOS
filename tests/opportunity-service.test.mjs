import assert from 'node:assert/strict';
import test from 'node:test';

import { SimulationOneKosRepository } from '../src/onekos-repository.mjs';
import { OneKosService } from '../src/onekos-service.mjs';

function createService() {
  const repository = new SimulationOneKosRepository();
  const service = new OneKosService({
    repository,
    clock: () => new Date('2026-08-09T12:00:00.000Z'),
    idFactory: () => 'EVENT-OPPORTUNITY-001',
  });
  return { repository, service };
}

test('机会服务读取仓库信号、重新评分并把结果写回任务池', async () => {
  const { repository, service } = createService();
  await repository.saveContentTask({
    taskId: 'TASK-002', advisorId: 'ADV-017', targetModel: '乐道 L90', userQuestion: '第三排空间怎么样？',
    topic: '第三排空间参数讲解', routeScore: 99, matrixGap: '', profileEvidence: [], taskDate: '2026-08-09', status: '候选', simulation: true,
  });
  await repository.saveCommentLead({
    leadId: 'LEAD-001', advisorId: 'ADV-017', model: 'L60', originalComment: '成都没有家充，每天通勤怎么补能？', grade: 'A', simulation: true,
  });

  const result = await service.routeOpportunities({ advisorId: 'ADV-017', limit: 3 });
  const persisted = await repository.getTask(result.recommendations[0].taskId);

  assert.equal(result.summary.taskPool, 2);
  assert.equal(result.summary.demandSignals, 1);
  assert.equal(result.recommendations[0].taskId, 'TASK-001');
  assert.equal(persisted.routeScore, result.recommendations[0].score);
  assert.ok(persisted.routedAt);
});

test('机会服务持久化接受和拒绝，拒绝原因形成待确认学习事件', async () => {
  const { repository, service } = createService();
  await repository.saveContentTask({
    taskId: 'TASK-002', advisorId: 'ADV-017', targetModel: '乐道 L90', userQuestion: '第三排空间怎么样？',
    topic: '第三排空间参数讲解', routeScore: 60, matrixGap: '', profileEvidence: ['TAG-004'], taskDate: '2026-08-09', status: '候选', simulation: true,
  });

  const accepted = await service.decideOpportunity('TASK-001', { advisorId: 'ADV-017', decision: 'accept' });
  const rejected = await service.decideOpportunity('TASK-002', { advisorId: 'ADV-017', decision: 'reject', reason: '近期没有第三排实拍素材' });

  assert.equal(accepted.task.status, '待生成');
  assert.equal((await repository.getTask('TASK-001')).decision, 'accept');
  assert.equal(rejected.task.status, '已拒绝');
  assert.equal((await repository.getTask('TASK-002')).rejectionReason, '近期没有第三排实拍素材');
  assert.equal(repository.snapshot().feedbackEvents.at(-1).eventType, '选题拒绝');
  assert.equal(repository.snapshot().feedbackEvents.at(-1).status, '待顾问确认后学习');
});

test('未接受或已拒绝的机会不能直接生成内容', async () => {
  const { repository, service } = createService();
  await repository.saveContentTask({
    taskId: 'TASK-CANDIDATE', advisorId: 'ADV-017', targetModel: '乐道 L60', userQuestion: '候选问题',
    topic: '候选选题', routeScore: 70, matrixGap: '待判断', profileEvidence: ['TAG-001'], taskDate: '2026-08-09', status: '候选', simulation: true,
  });

  await assert.rejects(
    service.generateContent({ advisorId: 'ADV-017', taskId: 'TASK-CANDIDATE', contentId: 'CONTENT-CANDIDATE' }),
    (error) => error.statusCode === 409 && /接受/.test(error.message),
  );
});
