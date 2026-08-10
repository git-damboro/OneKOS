const ABSOLUTE_OR_PROMISE_PATTERNS = [
  /全网第一|行业第一|唯一|百分之百|100%/i,
  /保证|一定能|绝对|永久|零风险/,
  /最低价|最划算|闭眼买/,
];

function normalizedText(value = '') {
  return String(value).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function shingles(value) {
  const text = normalizedText(value);
  if (!text) return new Set();
  if (text.length === 1) return new Set([text]);
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

export function jaccardSimilarity(left, right) {
  const a = shingles(left);
  const b = shingles(right);
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function combinedContent(content) {
  return [content.title, content.hook, content.script].filter(Boolean).join('\n');
}

function numericTokens(value) {
  return new Set(String(value || '').match(/\d+(?:\.\d+)?/g) || []);
}

function unsupportedNumericClaims(content, knowledge, task) {
  let fullText = combinedContent(content);
  if (task?.targetModel) fullText = fullText.replaceAll(String(task.targetModel), '');
  const used = numericTokens(fullText);
  const allowed = numericTokens([
    task?.userQuestion,
    task?.topic,
    ...knowledge.map((item) => item.value),
  ].filter(Boolean).join('\n'));
  return [...used].filter((token) => !allowed.has(token));
}

const PRETEND_COMPLETED_PATTERNS = [
  /我(?:今天|刚刚|已经|特意).{0,20}(?:实测|跑了|记录)/,
  /实测给你看|实测结果(?:是|显示)/,
  /出发时(?:的)?(?:电量|里程)(?:为|是|还有|剩余)/,
  /导航显示.{0,20}(?:排队|等待)/,
  /到了之后.{0,30}(?:分钟|用时|耗时)/,
  /全程(?:计时|用时).{0,12}\d/,
  /(?:换电站|补能站).{0,12}(?:就在|覆盖很密|下班顺路)/,
  /一周补能.{0,8}(?:完全够|就够|足够)/,
];

function isKnowledgeValid(item, today) {
  if (!item || item.status !== '有效') return false;
  return !item.validUntil || item.validUntil >= today;
}

export function inspectContentPackage({ content, knowledge = [], profileTags = [], matrixContents = [], task = null, today = new Date().toISOString().slice(0, 10) }) {
  const issues = [];
  const validKnowledgeIds = new Set(knowledge.filter((item) => isKnowledgeValid(item, today)).map((item) => item.knowledgeId));
  const missingFacts = (content.factRefs || []).filter((id) => !validKnowledgeIds.has(id));
  const unsupportedNumbers = unsupportedNumericClaims(content, knowledge, task);
  const fullText = combinedContent(content);
  const pretendCompletedHits = PRETEND_COMPLETED_PATTERNS.filter((pattern) => pattern.test(fullText));
  const factScore = missingFacts.length || unsupportedNumbers.length || pretendCompletedHits.length
    ? Math.max(40, 78 - missingFacts.length * 12 - unsupportedNumbers.length * 5 - pretendCompletedHits.length * 8)
    : 95;
  if (missingFacts.length) issues.push(`事实引用不存在或已失效：${missingFacts.join('、')}`);
  if (unsupportedNumbers.length) issues.push(`正文包含无输入来源数字：${unsupportedNumbers.join('、')}`);
  if (pretendCompletedHits.length) issues.push('拍摄前脚本将待实拍数据描述成了已经发生的实测结果');

  const complianceHits = ABSOLUTE_OR_PROMISE_PATTERNS.filter((pattern) => pattern.test(fullText));
  const complianceScore = complianceHits.length ? Math.max(45, 76 - complianceHits.length * 8) : 95;
  if (complianceHits.length) issues.push('存在绝对化、保证性或价格承诺表达');

  const activeTags = new Set(profileTags.filter((item) => ['生效', '已锁定', 'active', 'locked'].includes(item.status)).map((item) => item.tagId));
  const invalidProfileRefs = (content.profileRefs || []).filter((id) => !activeTags.has(id));
  const personaScore = invalidProfileRefs.length ? Math.max(55, 82 - invalidProfileRefs.length * 10) : (content.profileRefs || []).length ? 94 : 78;
  if (invalidProfileRefs.length) issues.push(`画像引用未生效：${invalidProfileRefs.join('、')}`);
  if (!(content.profileRefs || []).length) issues.push('未引用顾问画像标签');

  const similarities = matrixContents.map((item) => ({
    contentId: item.contentId || null,
    similarity: jaccardSimilarity(fullText, combinedContent(item)),
  })).sort((a, b) => b.similarity - a.similarity);
  const closest = similarities[0] || { contentId: null, similarity: 0 };
  const matrixRisk = closest.similarity >= 0.55 ? '高' : closest.similarity >= 0.35 ? '中' : '低';
  const matrixScore = matrixRisk === '高' ? 58 : matrixRisk === '中' ? 78 : 94;
  if (matrixRisk === '高') issues.push('与矩阵既有内容近重复，需要重新路由内容角度');

  return {
    fact: { score: factScore, missingRefs: missingFacts, unsupportedNumbers, pretendCompletedHits: pretendCompletedHits.length },
    compliance: { score: complianceScore, hits: complianceHits.length },
    persona: { score: personaScore, invalidRefs: invalidProfileRefs },
    matrix: { score: matrixScore, risk: matrixRisk, similarity: Number(closest.similarity.toFixed(3)), closestContentId: closest.contentId },
    passed: factScore >= 80 && complianceScore >= 80 && personaScore >= 80 && matrixRisk !== '高',
    issues,
  };
}

function capture(text, pattern, fallback = '待确认') {
  return text.match(pattern)?.[1] || fallback;
}

export function analyzeCommentLead({ commentId, text, platform = '抖音（模拟）', likes = 0 }) {
  const city = capture(text, /(成都高新区|成都|德阳|绵阳|重庆)/);
  const familyStructure = /两个孩子|二孩/.test(text) ? '二孩家庭' : /孩子|老人|家庭|家里/.test(text) ? '家庭用户' : '待确认';
  const rawModel = capture(text, /(L60|L90)/i);
  const model = rawModel === '待确认' ? rawModel : `乐道 ${rawModel.toUpperCase()}`;
  const purchaseWindow = /最近一个月|这个月|下个月|30天/.test(text) ? '30天内' : /这周|周六|周日|7天/.test(text) ? '7天内' : '待确认';
  const testDriveIntent = /试驾|到店/.test(text) ? '明确' : /看看|了解|换车/.test(text) ? '潜在' : '待确认';

  let score = 0;
  if (city !== '待确认') score += 10;
  if (familyStructure !== '待确认') score += 10;
  if (model !== '待确认') score += 15;
  if (purchaseWindow !== '待确认') score += 15;
  if (testDriveIntent === '明确') score += 20;
  else if (testDriveIntent === '潜在') score += 8;
  if (/准备换车|想换车/.test(text)) score += 8;
  if (likes >= 20) score += 8;
  score = Math.min(100, score);

  return {
    commentId,
    originalComment: text,
    platform,
    likes,
    city,
    familyStructure,
    model,
    purchaseWindow,
    testDriveIntent,
    score,
    grade: score >= 75 ? 'A' : score >= 45 ? 'B' : 'C',
    status: score >= 75 ? '待顾问人工接管' : '待顾问查看',
    automationAllowed: false,
    nextAction: score >= 75 ? '顾问人工确认用户身份、门店、试驾时间与重点需求' : '顾问人工补问缺失字段',
    fieldEvidence: {
      city: city === '待确认' ? null : `原评论“${city}”`,
      familyStructure: familyStructure === '待确认' ? null : '原评论包含家庭成员描述',
      model: model === '待确认' ? null : `原评论“${rawModel.toUpperCase()}”`,
      purchaseWindow: purchaseWindow === '待确认' ? null : '原评论包含明确购车时间窗',
      testDriveIntent: testDriveIntent === '待确认' ? null : '原评论包含试驾或换车意愿',
    },
  };
}

export function applyConfirmedFeedback(profileTags, event, confirmed) {
  const tags = structuredClone(profileTags);
  const nextEvent = structuredClone(event);
  if (!confirmed) return { tags, event: nextEvent, applied: false };

  const tag = tags.find((item) => item.tagId === event.affectedTagId);
  if (!tag) throw new Error(`找不到反馈事件对应画像标签：${event.affectedTagId}`);
  tag.weight = Math.max(0, Math.min(100, Number(tag.weight || 0) + Number(event.weightDelta || 0)));
  tag.confidence = Math.max(0, Math.min(100, Number(tag.confidence || 0) + 2));
  nextEvent.status = '已确认并学习';
  return { tags, event: nextEvent, applied: true };
}
