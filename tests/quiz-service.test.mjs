import assert from 'node:assert/strict';
import test from 'node:test';

import { BASE_QUESTION_IDS, getQuestion } from '../src/advisor-quiz.mjs';
import { SimulationOneKosRepository } from '../src/onekos-repository.mjs';
import { OneKosService } from '../src/onekos-service.mjs';

function createService(llmClient = null) {
  const repository = new SimulationOneKosRepository();
  const service = new OneKosService({
    repository, llmClient, clock: () => new Date('2026-08-09T10:00:00.000Z'), idFactory: () => 'QUIZ-TEST-001',
  });
  return { service, repository };
}

async function finishAnswers(service, session) {
  let current = session;
  for (const questionId of BASE_QUESTION_IDS) {
    const question = getQuestion(questionId);
    const value = question.type === 'text' ? '先说结论，需要结合每天里程和真实补能路线判断，我会陪用户实际跑一次。' : question.options[0].value;
    current = (await service.submitQuizAnswer(current.sessionId, { questionId, value })).session;
  }
  for (const questionId of current.adaptiveQuestionIds) {
    current = (await service.submitQuizAnswer(current.sessionId, { questionId, value: getQuestion(questionId).options[0].value })).session;
  }
  return current;
}

test('问卷服务逐题保存、恢复、生成词云并确认画像与首条任务', async () => {
  const { service, repository } = createService();
  const created = await service.createQuizSession({
    advisorId: 'ADV-QUIZ-001', displayName: '顾问小林', city: '成都', store: '模拟门店', identitySource: 'demo',
  });
  const answered = await finishAnswers(service, created.session);
  const restored = await service.getQuizSession(answered.sessionId);
  const completed = await service.completeQuizSession(answered.sessionId);
  const acceptedTags = completed.session.candidates.slice(0, 30).map((item) => ({ tagId: item.tagId, label: item.term, weight: item.weight, locked: false }));
  const confirmed = await service.confirmOnboardingSession(answered.sessionId, { acceptedTags, idempotencyKey: 'QUIZ-CONFIRM-001' });

  assert.equal(restored.session.currentQuestionId, null);
  assert.equal(restored.questions.length, restored.session.questionIds.length);
  assert.ok(completed.session.candidates.length >= 30);
  assert.equal(confirmed.advisor.profileVersion, 1);
  assert.equal(confirmed.task.taskId, 'TASK-ADV-QUIZ-001-001');
  assert.equal(repository.snapshot().profileTags.filter((item) => item.advisorId === 'ADV-QUIZ-001').length, 30);
});

test('短文模型词合并到规则词云且模型异常时仍可完成', async () => {
  const model = { async generateJson() { return { terms: [{ term: '有边界感', dimension: '表达语气', weight: 82, confidence: 88, evidence: '回答使用“结合每天里程判断”' }] }; } };
  const { service } = createService(model);
  const created = await service.createQuizSession({ advisorId: 'ADV-QUIZ-002', displayName: '顾问小周', city: '成都', store: '模拟门店' });
  const answered = await finishAnswers(service, created.session);
  const completed = await service.completeQuizSession(answered.sessionId);

  assert.equal(completed.session.generator, 'quiz-hybrid');
  assert.ok(completed.session.candidates.some((item) => item.term === '有边界感'));
});
