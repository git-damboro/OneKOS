const TERMINAL_TASK_STATUSES = new Set(['已拒绝', '已完成', '已发布', '已关闭']);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function textOf(...values) {
  return values.filter(Boolean).join(' ').toLowerCase();
}

function modelKey(value) {
  return String(value || '').replace(/乐道|\s+/g, '').toLowerCase();
}

function tokens(value) {
  const text = textOf(value).replace(/[，。！？、：；（）()\s]/g, '');
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

function overlap(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const token of a) if (b.has(token)) matches += 1;
  return matches / Math.min(a.size, b.size);
}

function profileMatch(task, profileTags) {
  const usable = profileTags.filter((tag) => tag.status !== '禁用' && tag.status !== 'disabled');
  const byId = new Map(usable.map((tag) => [tag.tagId, tag]));
  const taskText = textOf(task.topic, task.userQuestion, task.matrixGap);
  const referenced = (task.profileEvidence || []).map((tagId) => byId.get(tagId)).filter(Boolean);
  const inferred = usable.filter((tag) => taskText.includes(String(tag.label || '').toLowerCase()));
  const matched = [...new Map([...referenced, ...inferred].map((tag) => [tag.tagId, tag])).values()];
  if (!matched.length) return { score: 20, tags: [] };
  const score = matched.reduce((sum, tag) => sum + Number(tag.weight || 0) * 0.7 + Number(tag.confidence || 0) * 0.3, 0) / matched.length;
  return { score: clamp(score), tags: matched };
}

function demandMatch(task, leads) {
  const taskText = textOf(task.targetModel, task.userQuestion, task.topic);
  const taskModel = modelKey(task.targetModel);
  const matched = leads.filter((lead) => {
    const leadText = textOf(lead.model, lead.originalComment, lead.sourceComment, lead.sourceText);
    return (taskModel && modelKey(lead.model).includes(taskModel)) || overlap(taskText, leadText) >= 0.12;
  });
  const gradeWeight = { A: 34, B: 22, C: 10 };
  return { score: clamp(matched.reduce((sum, lead) => sum + (gradeWeight[lead.grade] || 12), 0)), leads: matched };
}

function matrixOpportunity(task, contentResults) {
  const taskText = textOf(task.topic, task.userQuestion);
  const similarities = contentResults.map((content) => overlap(taskText, textOf(content.title, content.hook, content.script)));
  const highest = similarities.length ? Math.max(...similarities) : 0;
  return { score: clamp(90 - highest * 70), similarity: clamp(highest * 100) };
}

export function routeOpportunities({ advisorId, tasks = [], profileTags = [], leads = [], contentResults = [], limit = 3 }) {
  const candidates = tasks.filter((task) => (!task.advisorId || task.advisorId === advisorId) && !TERMINAL_TASK_STATUSES.has(task.status));
  const recommendations = candidates.map((task) => {
    const profile = profileMatch(task, profileTags);
    const demand = demandMatch(task, leads.filter((lead) => !lead.advisorId || lead.advisorId === advisorId));
    const matrix = matrixOpportunity(task, contentResults);
    const score = clamp(profile.score * 0.45 + demand.score * 0.3 + matrix.score * 0.25);
    const matchedProfileTags = profile.tags.map((tag) => tag.label);
    return {
      ...task,
      score,
      routeScore: score,
      matchedProfileTags,
      matchedProfileTagIds: profile.tags.map((tag) => tag.tagId),
      demandEvidence: demand.leads.map((lead) => lead.originalComment || lead.sourceComment || lead.sourceText).filter(Boolean).slice(0, 3),
      scoreBreakdown: { profile: profile.score, demand: demand.score, matrix: matrix.score },
      matrixSimilarity: matrix.similarity,
      why: `画像匹配 ${profile.score} 分、需求信号 ${demand.score} 分、矩阵空白 ${matrix.score} 分；${matchedProfileTags.length ? `命中“${matchedProfileTags.join('、')}”` : '当前画像证据较弱'}。`,
    };
  }).sort((left, right) => right.score - left.score).slice(0, Math.max(1, Math.min(3, Number(limit) || 3)));

  return {
    recommendations,
    summary: {
      profileSignals: profileTags.filter((tag) => tag.status !== '禁用' && tag.status !== 'disabled').length,
      taskPool: candidates.length,
      demandSignals: leads.filter((lead) => !lead.advisorId || lead.advisorId === advisorId).length,
      matrixCorpus: contentResults.length,
    },
  };
}

export function decideOpportunity(task, { decision, reason = '', affectedTagId = null, eventId = '', now = new Date().toISOString() } = {}) {
  if (!task) throw new Error('机会任务不存在');
  if (!['accept', 'reject'].includes(decision)) throw new Error('机会决策必须是 accept 或 reject');
  const cleanReason = String(reason || '').trim();
  if (decision === 'reject' && !cleanReason) throw new Error('拒绝原因不能为空');
  const updatedTask = {
    ...task,
    status: decision === 'accept' ? '待生成' : '已拒绝',
    decision,
    rejectionReason: decision === 'reject' ? cleanReason : '',
    decidedAt: now,
  };
  const feedbackEvent = decision === 'reject' ? {
    eventId,
    advisorId: task.advisorId,
    sourceRecordId: task.taskId,
    eventType: '选题拒绝',
    affectedTagId,
    weightDelta: -2,
    evidence: `顾问拒绝选题“${task.topic}”：${cleanReason}`,
    createdAt: now,
    status: '待顾问确认后学习',
    simulation: Boolean(task.simulation),
  } : null;
  return { task: updatedTask, feedbackEvent };
}
