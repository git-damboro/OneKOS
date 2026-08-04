import { analyzeCommentLead, applyConfirmedFeedback, inspectContentPackage } from './live-engine.mjs';

function requireRecord(record, label, id) {
  if (!record) {
    const error = new Error(`${label}不存在：${id}`);
    error.statusCode = 404;
    throw error;
  }
  return record;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value ? [String(value)] : [];
}

function normalizeCandidate(candidate, task) {
  return {
    title: String(candidate.title || task.topic),
    hook: String(candidate.hook || '先记录真实场景，再给条件化结论。'),
    script: String(candidate.script || ''),
    storyboard: asList(candidate.storyboard),
    materials: asList(candidate.materials),
    replyPlan: asList(candidate.replyPlan),
    cta: String(candidate.cta || '留下你的真实用车条件，由顾问人工判断。'),
    factRefs: asList(candidate.factRefs),
    profileRefs: asList(candidate.profileRefs),
    selectedReason: String(candidate.selectedReason || `命中矩阵空白“${task.matrixGap}”，并匹配顾问当前生效画像。`),
  };
}

function localCandidate(context) {
  const { advisor, task } = context;
  return {
    title: `${advisor.city}晚高峰补能路线：先实测，再回答一周几次`,
    hook: `没有家充、每天通勤 42 公里，到底一周需要补能几次？先别听固定答案，我会把${advisor.city}工作日晚高峰这条路线真实跑一遍。`,
    script: [
      '0—5 秒：提出用户原问题，并说明本条先展示实测方法，不提前给结果。',
      `5—15 秒：说明路线位于${advisor.city}，出发时间、起始电量和当天路况均由顾问拍摄后补充。`,
      '15—40 秒：依次记录导航路线、到站等待时间、补能耗时与结束电量；所有数字只使用现场拍摄画面。',
      '40—55 秒：等待五天数据完整后，再按真实记录给出条件化补能建议；当前不承诺固定次数。',
      '55—60 秒：邀请用户留下城市和通勤距离，由顾问人工挑选相似场景继续实测。',
    ].join('\n'),
    storyboard: ['正对镜头提出问题', '导航路线与仪表盘特写', '到站排队和计时画面', '五日数据表留白', '顾问人工承接评论'],
    materials: ['顾问本人 9:16 口播', '五天出发时间与起始电量', '真实导航路线', '等待与补能计时', '天气和路况', '结束电量与顾问结论'],
    replyPlan: ['通勤距离问题：人工追问单程或往返', '补能方式问题：另建对比任务', '试驾意愿：标记线索后由顾问人工接管'],
    cta: '留下你的城市、通勤距离和是否有家充，我把相似问题排进下一轮实测。',
    factRefs: [],
    profileRefs: task.profileEvidence,
    selectedReason: `路由匹配分 ${task.routeScore}，匹配${advisor.city}地域经验、结论式表达与实车证据偏好，并补位“${task.matrixGap}”。`,
  };
}

function modelPrompt(context) {
  const safeContext = {
    advisor: context.advisor,
    profileTags: context.profileTags,
    task: context.task,
    validBrandKnowledge: context.knowledge,
    hardRules: [
      '只能引用 validBrandKnowledge 中的事实和 knowledgeId',
      '缺失的补能数字必须写为顾问拍摄后补充，不得推算或编造',
      '不得承诺价格、权益、试驾结果，不得自动联系用户',
      '只返回 JSON，字段为 title,hook,script,storyboard,materials,replyPlan,cta,factRefs,profileRefs,selectedReason',
    ],
  };
  return JSON.stringify(safeContext, null, 2);
}

export class OneKosService {
  constructor({ repository, llmClient = null, mode = 'simulation', clock = () => new Date() }) {
    this.repository = repository;
    this.llmClient = llmClient;
    this.mode = mode;
    this.clock = clock;
  }

  today() { return this.clock().toISOString().slice(0, 10); }
  timestamp() { return this.clock().toISOString(); }

  async getAdvisorContext({ advisorId = 'ADV-017', taskId = 'TASK-001' } = {}) {
    const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
    const task = requireRecord(await this.repository.getTask(taskId), '内容任务', taskId);
    if (task.advisorId !== advisorId) {
      const error = new Error(`任务 ${taskId} 不属于顾问 ${advisorId}`);
      error.statusCode = 409;
      throw error;
    }
    const [profileTags, knowledge, recentContents] = await Promise.all([
      this.repository.getProfileTags(advisorId),
      this.repository.getValidKnowledge(task.targetModel, this.today()),
      this.repository.listContentResults(),
    ]);
    return {
      advisor, task, profileTags, knowledge, recentContents,
      simulation: Boolean(advisor.simulation || task.simulation),
      warnings: knowledge.length ? [] : [`${task.targetModel} 暂无有效品牌知识，只能生成待实拍的内容框架`],
    };
  }

  async getDemoState(options = {}) {
    const context = await this.getAdvisorContext(options);
    const feedbackEvents = this.repository.snapshot ? this.repository.snapshot().feedbackEvents : [];
    const commentLeads = this.repository.snapshot ? this.repository.snapshot().commentLeads : [];
    return { ...context, feedbackEvents, commentLeads };
  }

  async generateContent({ advisorId = 'ADV-017', taskId = 'TASK-001', contentId = 'CONTENT-DEMO-001' } = {}) {
    const context = await this.getAdvisorContext({ advisorId, taskId });
    let candidate;
    let generator = 'local-deterministic';
    if (this.llmClient) {
      candidate = await this.llmClient.generateJson({
        system: '你是 OneKOS 内容生成器。严格依据上下文生成个性化短视频方案，只返回 JSON。',
        user: modelPrompt(context),
        temperature: 0.25,
      });
      generator = 'external-llm';
    } else {
      candidate = localCandidate(context);
    }
    const normalized = normalizeCandidate(candidate, context.task);
    const quality = inspectContentPackage({
      content: normalized,
      knowledge: context.knowledge,
      profileTags: context.profileTags,
      matrixContents: context.recentContents.filter((item) => item.taskId !== taskId && item.contentId !== contentId),
      today: this.today(),
    });
    const content = {
      ...normalized,
      contentId,
      taskId,
      advisorId,
      quality,
      status: quality.passed ? '待顾问补真实素材' : '质检未通过',
      simulation: context.simulation,
      generatedAt: this.timestamp(),
      generator,
      missingBrandFacts: context.knowledge.length === 1 && context.knowledge[0].field === '车身尺寸与轴距'
        ? ['电池容量', '续航与能耗', '换电时间', '快充功率', '本地补能站点与权益']
        : [],
    };
    const write = await this.repository.saveContentPackage(content);
    return { mode: this.mode, generator, content, quality, write, contextWarnings: context.warnings };
  }

  async analyzeComment({ advisorId = 'ADV-017', contentId, commentId, text, platform = '抖音（模拟）', likes = 0, leadId, eventId }) {
    if (!commentId || !text) {
      const error = new Error('commentId 与 text 不能为空');
      error.statusCode = 400;
      throw error;
    }
    const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
    const tags = await this.repository.getProfileTags(advisorId);
    const extracted = analyzeCommentLead({ commentId, text, platform, likes });
    if (extracted.city === '待确认' && advisor.city && /高新区/.test(text)) {
      extracted.city = `${advisor.city}高新区`;
      extracted.score += 10;
      extracted.fieldEvidence.city = `原评论“高新区”＋顾问服务城市“${advisor.city}”`;
    }
    const localEnergyTag = tags.find((item) => item.status === '生效' && /本地补能/.test(item.label));
    const scenarioSignals = [/通勤/.test(text), /家充/.test(text), /换电|补能/.test(text), /L60/i.test(text)].filter(Boolean).length;
    if (localEnergyTag && scenarioSignals >= 3) {
      extracted.score += 15;
      extracted.fieldEvidence.profileMatch = `命中生效画像“${localEnergyTag.label}”与当前补能内容主题`;
    }
    extracted.score = Math.min(100, extracted.score);
    extracted.grade = extracted.score >= 75 ? 'A' : extracted.score >= 45 ? 'B' : 'C';
    extracted.status = extracted.grade === 'A' ? '待顾问人工接管' : '待顾问查看';
    extracted.nextAction = extracted.grade === 'A' ? '顾问人工确认用户身份、门店、试驾时间与重点需求' : '顾问人工补问缺失字段';
    const lead = {
      ...extracted,
      leadId: leadId || `LEAD-${commentId}`,
      advisorId,
      contentId,
      simulation: Boolean(advisor.simulation || platform.includes('模拟')),
      updatedAt: this.timestamp(),
    };
    const leadWrite = await this.repository.saveCommentLead(lead);
    const affectedTag = tags.find((item) => item.tagId === 'TAG-004') || tags.sort((a, b) => b.weight - a.weight)[0];
    const feedbackEvent = {
      eventId: eventId || `EVENT-${commentId}`,
      advisorId,
      sourceRecordId: commentId,
      eventType: '评论转线索',
      affectedTagId: affectedTag?.tagId || null,
      weightDelta: lead.grade === 'A' ? 6 : lead.grade === 'B' ? 2 : 0,
      evidence: `评论识别为 ${lead.grade} 级线索；画像变化必须由顾问确认。`,
      createdAt: this.timestamp(),
      status: '待顾问确认后学习',
      simulation: lead.simulation,
    };
    const eventWrite = await this.repository.saveFeedbackEvent(feedbackEvent);
    return { mode: this.mode, lead, feedbackEvent, leadWrite, eventWrite };
  }

  async confirmFeedback(eventId) {
    const event = requireRecord(await this.repository.getFeedbackEvent(eventId), '反馈事件', eventId);
    const tags = await this.repository.getProfileTags(event.advisorId);
    const result = applyConfirmedFeedback(tags, event, true);
    const updatedTag = result.tags.find((item) => item.tagId === event.affectedTagId);
    updatedTag.updatedAt = this.timestamp();
    const [tagWrite, eventWrite] = await Promise.all([
      this.repository.saveProfileTag(updatedTag),
      this.repository.saveFeedbackEvent(result.event),
    ]);
    return { ...result, updatedTag, tagWrite, eventWrite };
  }
}
