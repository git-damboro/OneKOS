const ALLOWED_DIMENSIONS = new Set([
  '专业能力',
  '地域场景',
  '目标用户',
  '表达结构',
  '表达语气',
  '证据偏好',
  '内容形式',
  '转化能力',
  '禁用表达',
]);

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredText(value, label, maxLength = 200) {
  const text = String(value || '').trim();
  if (!text) throw requestError(`${label}不能为空`);
  return text.slice(0, maxLength);
}

function boundedNumber(value, { min = 0, max = 100, fallback = min } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function textList(value, { limit, splitPattern = /[，,\n]/, maxLength = 500 } = {}) {
  const rows = Array.isArray(value) ? value : String(value || '').split(splitPattern);
  return rows.map((item) => String(item).trim().slice(0, maxLength)).filter(Boolean).slice(0, limit);
}

function preference(raw, key, label) {
  return requiredText(raw?.[key], label, 80);
}

export function normalizeOnboardingInput(raw = {}) {
  const specialties = textList(raw.specialties, { limit: 10, maxLength: 100 });
  if (!specialties.length) throw requestError('至少填写一个擅长问题');

  return {
    advisorId: requiredText(raw.advisorId, '顾问ID', 64).toUpperCase(),
    displayName: requiredText(raw.displayName, '展示名称', 80),
    city: requiredText(raw.city, '城市', 80),
    store: requiredText(raw.store, '门店', 120),
    experienceYears: boundedNumber(raw.experienceYears, { min: 0, max: 50, fallback: 0 }),
    targetAudience: requiredText(raw.targetAudience, '目标用户', 200),
    targetModel: String(raw.targetModel || '乐道 L60').trim().slice(0, 80),
    specialties,
    preferences: {
      openingStyle: preference(raw.preferences, 'openingStyle', '开场偏好'),
      evidencePreference: preference(raw.preferences, 'evidencePreference', '证据偏好'),
      tone: preference(raw.preferences, 'tone', '表达语气'),
    },
    historyContents: textList(raw.historyContents, { limit: 5, splitPattern: /\n/, maxLength: 2000 }),
    voiceTranscript: String(raw.voiceTranscript || '').trim().slice(0, 4000),
    forbiddenExpressions: textList(raw.forbiddenExpressions, { limit: 20, maxLength: 100 }),
    identitySource: raw.identitySource === 'feishu' ? 'feishu' : 'demo',
    externalUserId: String(raw.externalUserId || '').trim().slice(0, 128),
    authorizationStatus: String(raw.authorizationStatus || '仅使用顾问主动提供的资料').trim().slice(0, 200),
  };
}

export function createOnboardingSession(input, { sessionId, now }) {
  return {
    sessionId: requiredText(sessionId, '初始化会话ID', 80),
    advisorId: input.advisorId,
    status: 'draft',
    input: structuredClone(input),
    candidates: [],
    acceptedTags: [],
    generator: null,
    warnings: [],
    writeProgress: {},
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

function candidate(input, index, dimension, label, evidence, source, confidence, weight) {
  return {
    tagId: `TAG-${input.advisorId}-${String(index + 1).padStart(2, '0')}`,
    advisorId: input.advisorId,
    dimension,
    label,
    weight,
    confidence,
    source,
    sourceRefs: [],
    evidence,
    status: '候选',
    simulation: input.identitySource !== 'feishu',
  };
}

export function generateRuleCandidates(input) {
  const sampleSources = [];
  if (input.historyContents.length) sampleSources.push('历史内容');
  if (input.voiceTranscript) sampleSources.push('语音转写');
  const richEvidence = sampleSources.length > 0;
  const source = richEvidence ? `资料＋${sampleSources.join('＋')}` : '资料＋偏好冷启动';
  const confidence = richEvidence ? 86 : 68;

  const rows = [
    ['专业能力', input.specialties[0], `顾问主动填写擅长问题“${input.specialties[0]}”`, 78],
    ['地域场景', `${input.city}本地场景`, `顾问服务城市为“${input.city}”`, 72],
    ['目标用户', input.targetAudience, `顾问主动填写目标用户“${input.targetAudience}”`, 74],
    ['表达结构', input.preferences.openingStyle, `顾问偏好选择“${input.preferences.openingStyle}”`, 70],
    ['证据偏好', input.preferences.evidencePreference, `顾问偏好选择“${input.preferences.evidencePreference}”`, 72],
    ['表达语气', input.preferences.tone, `顾问偏好选择“${input.preferences.tone}”`, 66],
  ];
  if (input.forbiddenExpressions.length) {
    rows.push(['禁用表达', input.forbiddenExpressions.join('、'), `顾问主动设置禁用表达“${input.forbiddenExpressions.join('、')}”`, 90]);
  }
  return rows.map(([dimension, label, evidence, weight], index) => (
    candidate(input, index, dimension, label, evidence, source, confidence, weight)
  ));
}

function evidenceBasis(input) {
  return [
    input.city,
    input.targetAudience,
    ...input.specialties,
    ...Object.values(input.preferences),
    ...input.historyContents,
    input.voiceTranscript,
    ...input.forbiddenExpressions,
  ].map((item) => String(item || '').trim()).filter((item) => item.length >= 2);
}

export function normalizeModelCandidates(raw, input) {
  const rows = Array.isArray(raw) ? raw : raw?.tags;
  if (!Array.isArray(rows)) throw requestError('模型候选标签必须是数组', 502);
  const basis = evidenceBasis(input);
  const seen = new Set();
  const result = [];

  for (const item of rows) {
    const dimension = String(item?.dimension || '').trim();
    const label = String(item?.label || '').trim();
    const evidence = String(item?.evidence || '').trim();
    if (!ALLOWED_DIMENSIONS.has(dimension) || !label || !evidence) continue;
    if (!basis.some((source) => evidence.includes(source) || source.includes(evidence))) continue;
    const key = `${dimension}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate(
      input,
      result.length,
      dimension,
      label.slice(0, 100),
      evidence.slice(0, 500),
      '模型分析授权资料',
      boundedNumber(item.confidence, { fallback: 50 }),
      boundedNumber(item.weight, { fallback: 50 }),
    ));
  }
  if (!result.length) throw requestError('模型候选标签没有可验证的输入证据', 502);
  return result;
}

export function confirmCandidateTags(session, acceptedTags, now) {
  if (session.status !== 'generated') throw requestError('当前初始化会话尚未生成候选画像', 409);
  const edits = new Map((acceptedTags || []).map((item) => [String(item.tagId), item]));
  const tags = session.candidates.filter((item) => edits.has(item.tagId)).map((item) => {
    const edit = edits.get(item.tagId);
    return {
      ...structuredClone(item),
      label: String(edit.label || item.label).trim().slice(0, 100),
      weight: boundedNumber(edit.weight ?? item.weight, { fallback: item.weight }),
      status: edit.locked ? '锁定' : '生效',
      profileVersion: 1,
      updatedAt: now,
    };
  });
  if (!tags.length) throw requestError('至少确认一个画像标签');

  return {
    tags,
    profileVersion: 1,
    task: {
      taskId: `TASK-${session.advisorId}-001`,
      advisorId: session.advisorId,
      taskDate: now.slice(0, 10),
      targetModel: session.input.targetModel,
      userQuestion: `${session.input.targetAudience}最关心的真实购车问题是什么？`,
      topic: `${session.input.city}${session.input.specialties[0]}首条内容任务`,
      routeScore: 80,
      matrixGap: '新顾问首条真实场景内容',
      profileEvidence: tags.map((item) => item.tagId),
      status: '待生成',
      simulation: session.input.identitySource !== 'feishu',
    },
  };
}

