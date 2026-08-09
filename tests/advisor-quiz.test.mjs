import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_QUESTION_IDS,
  completeQuizSession,
  createQuizSession,
  getQuestion,
  recordQuizAnswer,
} from '../src/advisor-quiz.mjs';

const now = '2026-08-09T10:00:00.000Z';

function answerBaseQuestions(session) {
  let current = session;
  for (const questionId of BASE_QUESTION_IDS) {
    const question = getQuestion(questionId);
    const value = question.type === 'text' ? '先说结论，没有家充也要结合每天里程和真实补能路线判断，我会先陪用户跑一次路线。' : question.options[0].value;
    current = recordQuizAnswer(current, { questionId, value }, now);
  }
  return current;
}

test('新顾问创建一题一屏的八题基础问卷', () => {
  const session = createQuizSession({
    advisorId: 'ADV-QUIZ-001', identity: { displayName: '顾问小林', city: '成都', store: '模拟门店' },
  }, { sessionId: 'QUIZ-001', now });

  assert.equal(BASE_QUESTION_IDS.length, 8);
  assert.equal(session.status, 'quiz_active');
  assert.equal(session.currentQuestionId, BASE_QUESTION_IDS[0]);
  assert.deepEqual(session.answers, {});
});

test('答完基础题后追加二至四道自适应题并保存当前进度', () => {
  const session = answerBaseQuestions(createQuizSession({
    advisorId: 'ADV-QUIZ-001', identity: { displayName: '顾问小林', city: '成都', store: '模拟门店' },
  }, { sessionId: 'QUIZ-001', now }));

  assert.ok(session.adaptiveQuestionIds.length >= 2);
  assert.ok(session.adaptiveQuestionIds.length <= 4);
  assert.equal(session.questionIds.length, 8 + session.adaptiveQuestionIds.length);
  assert.equal(session.currentQuestionId, session.adaptiveQuestionIds[0]);
  assert.equal(Object.keys(session.answers).length, 8);
});

test('完成问卷后生成三十至五十个有来源证据且同义词合并的画像词', () => {
  let session = answerBaseQuestions(createQuizSession({
    advisorId: 'ADV-QUIZ-001', identity: { displayName: '顾问小林', city: '成都', store: '模拟门店' },
  }, { sessionId: 'QUIZ-001', now }));
  for (const questionId of session.adaptiveQuestionIds) {
    session = recordQuizAnswer(session, { questionId, value: getQuestion(questionId).options[0].value }, now);
  }

  const completed = completeQuizSession(session, { now });
  const terms = completed.candidates;

  assert.equal(completed.status, 'generated');
  assert.ok(terms.length >= 30 && terms.length <= 50, `实际生成 ${terms.length} 个词`);
  assert.ok(terms.every((term) => term.term && term.dimension && term.sources.length && term.evidence.length));
  assert.equal(new Set(terms.map((term) => term.term)).size, terms.length);
  assert.ok(terms.some((term) => term.term === '先说结论'));
  assert.equal(terms.some((term) => term.term === '结论先行'), false);
});

test('未答完当前问卷时禁止生成词云', () => {
  const session = createQuizSession({
    advisorId: 'ADV-QUIZ-001', identity: { displayName: '顾问小林', city: '成都', store: '模拟门店' },
  }, { sessionId: 'QUIZ-001', now });

  assert.throws(() => completeQuizSession(session, { now }), /尚未完成/);
});
