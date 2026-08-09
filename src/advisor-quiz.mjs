const choice = (value, label, terms, followupIds = []) => ({ value, label, terms, followupIds });
const term = (termValue, dimension, weight = 70) => ({ term: termValue, dimension, weight });

const QUESTIONS = [
  {
    id: 'Q-PROFESSIONAL', type: 'choice', dimension: '专业能力', title: '用户提出购车问题时，你最愿意先从哪里开始？',
    options: [
      choice('real-route', '先带用户走一遍真实路线，再给结论', [term('实车验证', '专业能力', 90), term('真实路线', '专业能力', 88), term('场景判断', '专业能力', 82), term('实践派', '专业能力', 76)], ['Q-ADAPT-BOUNDARY']),
      choice('parameter', '先把关键参数和差异整理清楚', [term('参数清晰', '专业能力', 88), term('数据分析', '专业能力', 84), term('理性判断', '专业能力', 80), term('结构化讲解', '专业能力', 76)]),
      choice('needs', '先追问家庭和日常使用条件', [term('需求洞察', '专业能力', 90), term('条件判断', '专业能力', 86), term('耐心追问', '专业能力', 80), term('用户视角', '专业能力', 78)]),
    ],
  },
  {
    id: 'Q-AUDIENCE', type: 'choice', dimension: '目标用户', title: '你最擅长帮助哪类用户做决定？',
    options: [
      choice('family', '多成员家庭和家庭增换购用户', [term('家庭用户', '目标用户', 90), term('多成员出行', '目标用户', 84), term('空间需求', '目标用户', 82), term('家庭决策', '目标用户', 80)]),
      choice('commute', '城市通勤和首次购车用户', [term('城市通勤', '目标用户', 90), term('首次购车', '目标用户', 84), term('日常成本', '目标用户', 80), term('入门友好', '目标用户', 76)]),
      choice('upgrade', '关注体验和品质的升级用户', [term('品质升级', '目标用户', 88), term('体验导向', '目标用户', 84), term('配置敏感', '目标用户', 78), term('审美表达', '目标用户', 74)]),
    ],
  },
  {
    id: 'Q-OPENING', type: 'choice', dimension: '表达结构', title: '哪一种内容开场最像你？',
    options: [
      choice('conclusion', '先说结论，再解释适用条件', [term('结论先行', '表达结构', 92), term('条件限定', '表达结构', 86), term('重点明确', '表达结构', 82), term('节奏紧凑', '表达结构', 78)]),
      choice('question', '先抛出用户真正纠结的问题', [term('问题开场', '表达结构', 90), term('用户共鸣', '表达结构', 84), term('悬念引导', '表达结构', 78), term('循序解释', '表达结构', 74)]),
      choice('story', '先讲一个真实接待或用车故事', [term('故事开场', '表达结构', 90), term('场景叙事', '表达结构', 86), term('人物细节', '表达结构', 78), term('自然铺陈', '表达结构', 74)]),
    ],
  },
  {
    id: 'Q-EVIDENCE', type: 'choice', dimension: '证据偏好', title: '用户犹豫时，哪类证据最有说服力？',
    options: [
      choice('scene', '真实路线、实车体验和过程记录', [term('场景证据', '证据偏好', 92), term('过程记录', '证据偏好', 86), term('真实体验', '证据偏好', 84), term('可验证', '证据偏好', 80)]),
      choice('data', '参数、费用和同条件数据对比', [term('数据对比', '证据偏好', 92), term('参数依据', '证据偏好', 86), term('成本测算', '证据偏好', 82), term('量化表达', '证据偏好', 78)]),
      choice('case', '相似用户的真实选择和结果', [term('用户案例', '证据偏好', 90), term('同类参考', '证据偏好', 84), term('结果复盘', '证据偏好', 80), term('经验佐证', '证据偏好', 76)]),
    ],
  },
  {
    id: 'Q-TONE', type: 'choice', dimension: '表达语气', title: '面对质疑评论，你更可能怎样回应？',
    options: [
      choice('restrained', '承认条件差异，专业而克制地解释', [term('专业克制', '表达语气', 92), term('直接坦诚', '表达语气', 86), term('尊重差异', '表达语气', 82), term('不夸张', '表达语气', 80)], ['Q-ADAPT-TONE']),
      choice('friendly', '先表示理解，再用日常语言说明', [term('亲切自然', '表达语气', 90), term('耐心解释', '表达语气', 86), term('生活化', '表达语气', 80), term('情绪稳定', '表达语气', 78)]),
      choice('decisive', '快速指出关键误区并给出判断', [term('观点鲜明', '表达语气', 90), term('果断直接', '表达语气', 86), term('纠正常识', '表达语气', 78), term('高信息密度', '表达语气', 76)]),
    ],
  },
  {
    id: 'Q-FORMAT', type: 'choice', dimension: '内容形式', title: '你最愿意持续制作哪类内容？',
    options: [
      choice('practical', '真实路线、到店体验和实测记录', [term('实测内容', '内容形式', 92), term('路线记录', '内容形式', 86), term('现场感', '内容形式', 82), term('行动清单', '内容形式', 78)]),
      choice('explain', '一分钟讲清一个购车问题', [term('知识讲解', '内容形式', 90), term('一分钟回答', '内容形式', 84), term('问题拆解', '内容形式', 82), term('清单表达', '内容形式', 78)]),
      choice('conversation', '模拟用户问答和接待对话', [term('问答内容', '内容形式', 90), term('对话感', '内容形式', 84), term('真实接待', '内容形式', 80), term('评论回应', '内容形式', 76)]),
    ],
  },
  {
    id: 'Q-CONVERSION', type: 'choice', dimension: '转化能力', title: '一条内容结束时，你更愿意怎样邀请用户行动？',
    options: [
      choice('question-cta', '请用户留下自己的真实用车条件', [term('提问互动', '转化能力', 90), term('需求收集', '转化能力', 86), term('低压转化', '转化能力', 82), term('人工判断', '转化能力', 78)], ['Q-ADAPT-CONVERSION']),
      choice('test-drive', '邀请用户带着问题来完成针对性试驾', [term('试驾引导', '转化能力', 90), term('线下承接', '转化能力', 84), term('体验转化', '转化能力', 82), term('明确行动', '转化能力', 78)]),
      choice('save', '建议先收藏清单，比较后再来沟通', [term('长期培育', '转化能力', 86), term('收藏引导', '转化能力', 82), term('决策陪伴', '转化能力', 80), term('不过度催促', '转化能力', 78)]),
    ],
  },
  { id: 'Q-WRITING', type: 'text', dimension: '表达结构', title: '请用三句话回答：没有家充是否适合买电车？', placeholder: '像平时对用户说话一样回答，至少 12 个字。', minLength: 12 },
  {
    id: 'Q-ADAPT-BOUNDARY', type: 'choice', adaptive: true, dimension: '专业能力', title: '当信息不足时，你通常怎么处理？',
    options: [choice('ask', '明确说还不能下结论，并继续追问', [term('信息边界', '专业能力', 88), term('谨慎判断', '专业能力', 84), term('继续追问', '专业能力', 80)])],
  },
  {
    id: 'Q-ADAPT-TONE', type: 'choice', adaptive: true, dimension: '表达语气', title: '用户坚持不同观点时，你会怎么做？',
    options: [choice('respect', '保留不同意见，再说明适用条件', [term('尊重观点', '表达语气', 88), term('边界清晰', '表达语气', 84), term('平和沟通', '表达语气', 80)])],
  },
  {
    id: 'Q-ADAPT-CONVERSION', type: 'choice', adaptive: true, dimension: '转化能力', title: '识别到高意向用户后，下一步是什么？',
    options: [choice('manual', '交由顾问确认需求后人工接管', [term('人工接管', '转化能力', 92), term('意向识别', '转化能力', 86), term('合规跟进', '转化能力', 82)])],
  },
  {
    id: 'Q-ADAPT-CONTENT', type: 'choice', adaptive: true, dimension: '内容形式', title: '如果只能长期坚持一种素材，你会选择什么？',
    options: [choice('daily', '真实接待问题和日常实拍', [term('日常积累', '内容形式', 88), term('真实素材', '内容形式', 86), term('持续创作', '内容形式', 80)])],
  },
];

const QUESTION_MAP = new Map(QUESTIONS.map((question) => [question.id, question]));
export const BASE_QUESTION_IDS = QUESTIONS.filter((question) => !question.adaptive).map((question) => question.id);
const DEFAULT_ADAPTIVE_IDS = ['Q-ADAPT-CONTENT', 'Q-ADAPT-CONVERSION'];
const SYNONYMS = new Map([['结论先行', '先说结论'], ['先讲结论', '先说结论'], ['实车场景', '场景证据']]);
const ALLOWED_DIMENSIONS = new Set(['专业能力', '地域场景', '目标用户', '表达结构', '表达语气', '证据偏好', '内容形式', '转化能力', '禁用表达']);

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

export function getQuestion(questionId) {
  const question = QUESTION_MAP.get(questionId);
  if (!question) throw requestError(`题目不存在：${questionId}`, 404);
  return structuredClone(question);
}

export function createQuizSession(raw, { sessionId, now }) {
  const advisorId = required(raw?.advisorId, '顾问ID').toUpperCase();
  const identity = {
    displayName: required(raw?.identity?.displayName, '展示名称'),
    city: required(raw?.identity?.city, '城市'),
    store: required(raw?.identity?.store, '门店'),
  };
  return {
    sessionId: required(sessionId, '问卷会话ID'), advisorId, mode: 'quiz', status: 'quiz_active', identity,
    questionIds: [...BASE_QUESTION_IDS], adaptiveQuestionIds: [], answers: {}, currentQuestionId: BASE_QUESTION_IDS[0],
    candidates: [], acceptedTags: [], writeProgress: {}, generator: null, warnings: [], createdAt: now, updatedAt: now, simulation: true,
  };
}

function selectedOption(question, value) {
  const option = question.options?.find((item) => item.value === value);
  if (!option) throw requestError(`题目 ${question.id} 的答案无效`);
  return option;
}

function adaptiveIds(answers) {
  const result = [];
  for (const questionId of BASE_QUESTION_IDS) {
    const question = QUESTION_MAP.get(questionId);
    if (question.type !== 'choice' || !(questionId in answers)) continue;
    for (const followupId of selectedOption(question, answers[questionId]).followupIds || []) {
      if (!result.includes(followupId)) result.push(followupId);
    }
  }
  for (const questionId of DEFAULT_ADAPTIVE_IDS) if (!result.includes(questionId)) result.push(questionId);
  return result.slice(0, 4);
}

export function recordQuizAnswer(session, rawAnswer, now) {
  if (session.status !== 'quiz_active') throw requestError('当前问卷不可继续答题', 409);
  const questionId = required(rawAnswer?.questionId, '题目ID');
  if (!session.questionIds.includes(questionId) && !BASE_QUESTION_IDS.includes(questionId)) throw requestError(`题目不属于当前问卷：${questionId}`);
  const question = QUESTION_MAP.get(questionId);
  const value = String(rawAnswer?.value || '').trim();
  if (question.type === 'text') {
    if (value.length < question.minLength) throw requestError(`回答至少需要 ${question.minLength} 个字`);
  } else {
    selectedOption(question, value);
  }

  const next = structuredClone(session);
  next.answers[questionId] = value;
  if (BASE_QUESTION_IDS.every((id) => id in next.answers)) {
    next.adaptiveQuestionIds = adaptiveIds(next.answers);
    next.questionIds = [...BASE_QUESTION_IDS, ...next.adaptiveQuestionIds];
    for (const answeredId of Object.keys(next.answers)) {
      if (!next.questionIds.includes(answeredId)) delete next.answers[answeredId];
    }
  }
  next.currentQuestionId = next.questionIds.find((id) => !(id in next.answers)) || null;
  next.updatedAt = now;
  return next;
}

function writingTerms(text) {
  const result = [
    term('自然表达', '表达语气', 78), term('完整回答', '表达结构', 76), term('用户解释', '表达结构', 74),
    term('条件判断', '专业能力', 80), term('口语化', '表达语气', 72), term('问题回应', '内容形式', 72),
  ];
  if (/先|结论/.test(text)) result.push(term('先说结论', '表达结构', 86));
  if (/如果|结合|条件|根据/.test(text)) result.push(term('条件限定', '表达结构', 84));
  if (/路线|实测|体验/.test(text)) result.push(term('真实路线', '证据偏好', 82));
  return result;
}

function addTerm(target, rawTerm, source, evidence) {
  const canonical = SYNONYMS.get(rawTerm.term) || rawTerm.term;
  const key = canonical;
  const existing = target.get(key);
  if (existing) {
    if (rawTerm.weight > existing.weight) existing.dimension = rawTerm.dimension;
    existing.weight = Math.min(100, Math.max(existing.weight, rawTerm.weight) + 3);
    existing.confidence = Math.min(98, existing.confidence + 3);
    if (!existing.sources.includes(source)) existing.sources.push(source);
    if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence);
    return;
  }
  target.set(key, { term: canonical, label: canonical, dimension: rawTerm.dimension, weight: rawTerm.weight, confidence: 78, sources: [source], evidence: [evidence] });
}

export function completeQuizSession(session, { now }) {
  const missing = session.questionIds.filter((id) => !(id in session.answers));
  if (missing.length || !session.adaptiveQuestionIds.length) throw requestError('问卷尚未完成', 409);
  const merged = new Map();
  addTerm(merged, term(`${session.identity.city}本地`, '地域场景', 82), 'IDENTITY', `服务城市：${session.identity.city}`);
  addTerm(merged, term('一线顾问', '专业能力', 72), 'IDENTITY', `顾问身份：${session.identity.displayName}`);

  for (const questionId of session.questionIds) {
    const question = QUESTION_MAP.get(questionId);
    const answer = session.answers[questionId];
    if (question.type === 'text') {
      for (const item of writingTerms(answer)) addTerm(merged, item, questionId, `短文回答：“${answer.slice(0, 120)}”`);
      continue;
    }
    const option = selectedOption(question, answer);
    for (const item of option.terms) addTerm(merged, item, questionId, `选择：“${option.label}”`);
  }

  const next = structuredClone(session);
  next.status = 'generated';
  next.currentQuestionId = null;
  next.candidates = [...merged.values()].sort((a, b) => b.weight - a.weight).slice(0, 50).map((item, index) => ({
    ...item, tagId: `TERM-${session.advisorId}-${String(index + 1).padStart(2, '0')}`, advisorId: session.advisorId,
    source: '问卷答题', sourceRefs: item.sources, status: '候选', simulation: session.simulation,
  }));
  next.generator = 'quiz-rule-fallback';
  next.updatedAt = now;
  return next;
}

export function mergeQuizCandidateTerms(baseCandidates, raw, advisorId) {
  const result = structuredClone(baseCandidates || []);
  const byTerm = new Map(result.map((item) => [item.term, item]));
  const rows = Array.isArray(raw) ? raw : raw?.terms;
  if (!Array.isArray(rows)) return result;
  for (const row of rows) {
    const canonical = SYNONYMS.get(String(row?.term || '').trim()) || String(row?.term || '').trim();
    const dimension = String(row?.dimension || '').trim();
    const evidence = String(row?.evidence || '').trim();
    if (!canonical || !ALLOWED_DIMENSIONS.has(dimension) || !evidence) continue;
    const existing = byTerm.get(canonical);
    if (existing) {
      existing.weight = Math.min(100, Math.max(existing.weight, Number(row.weight) || 50));
      existing.confidence = Math.min(98, Math.max(existing.confidence, Number(row.confidence) || 50));
      if (!existing.sources.includes('WRITING-LLM')) existing.sources.push('WRITING-LLM');
      if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence.slice(0, 240));
      continue;
    }
    const item = {
      tagId: `TERM-${advisorId}-${String(result.length + 1).padStart(2, '0')}`, advisorId, term: canonical.slice(0, 20), label: canonical.slice(0, 20),
      dimension, weight: Math.max(0, Math.min(100, Number(row.weight) || 50)), confidence: Math.max(0, Math.min(100, Number(row.confidence) || 50)),
      sources: ['WRITING-LLM'], sourceRefs: ['WRITING-LLM'], evidence: [evidence.slice(0, 240)], source: '短文模型分析', status: '候选', simulation: true,
    };
    result.push(item);
    byTerm.set(canonical, item);
    if (result.length >= 50) break;
  }
  return result;
}
