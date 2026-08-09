import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_QUESTION_IDS,
  completeQuizSession,
  createQuizSession,
  getQuestion,
  mergeQuizCandidateTerms,
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
  assert.ok(session.adaptiveQuestionIds.every((questionId) => getQuestion(questionId).options.length >= 3));
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

test('模型表达词只有维度和证据有效时才合并进规则词云', () => {
  const base = [{ tagId: 'TERM-01', term: '先说结论', label: '先说结论', dimension: '表达结构', weight: 80, confidence: 80, sources: ['Q-OPENING'], evidence: ['选择结论式开场'] }];
  const merged = mergeQuizCandidateTerms(base, { terms: [
    { term: '有边界感', dimension: '表达语气', weight: 76, confidence: 85, evidence: '短文使用“结合每天里程判断”' },
    { term: '敏感推断', dimension: '性格类型', weight: 99, confidence: 99, evidence: '无效维度' },
    { term: '无证据', dimension: '表达语气', weight: 90, confidence: 90, evidence: '' },
  ] }, 'ADV-QUIZ-001');

  assert.ok(merged.some((item) => item.term === '有边界感' && item.source === '短文模型分析'));
  assert.equal(merged.some((item) => item.term === '敏感推断' || item.term === '无证据'), false);
});
