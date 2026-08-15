import { analyzeCommentLead, applyConfirmedFeedback, inspectContentPackage } from './live-engine.mjs';
import {
  confirmCandidateTags,
  createOnboardingSession as buildOnboardingSession,
  generateRuleCandidates,
  normalizeModelCandidates,
  normalizeOnboardingInput,
} from './advisor-onboarding.mjs';
import {
  completeQuizSession as buildCompletedQuizSession,
  createQuizSession as buildQuizSession,
  getQuestion,
  mergeQuizCandidateTerms,
  recordQuizAnswer,
} from './advisor-quiz.mjs';
import { decideOpportunity as buildOpportunityDecision, routeOpportunities as buildOpportunityRoutes } from './opportunity-router.mjs';
import {
  buildAssetPlaceholders,
  buildEditingJob,
  buildShootingRequirements,
  buildSimulatedAssets,
  compareRequirementsAndAssets,
  inspectUploadedAsset,
  normalizeProductionCandidate,
} from './production-pipeline.mjs';

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

function contentIdForTask(taskId) {
  const normalized = String(taskId || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `CONTENT-${normalized || 'UNTITLED'}`;
}

function latestTask(tasks) {
  return [...tasks].sort((left, right) => {
    const leftTime = Date.parse(left.decidedAt || left.routedAt || left.taskDate || '') || 0;
    const rightTime = Date.parse(right.decidedAt || right.routedAt || right.taskDate || '') || 0;
    return rightTime - leftTime || String(right.taskId).localeCompare(String(left.taskId));
  })[0] || null;
}

function contentForTask(task, contents) {
  if (!task) return null;
  const matching = contents.filter((item) => item.taskId === task.taskId);
  return matching.find((item) => item.contentId === contentIdForTask(task.taskId)) || matching.at(-1) || null;
}

function editingContentFromRequirements(content, requirements) {
  const required = requirements.filter((item) => item.required).sort((a, b) => a.shotOrder - b.shotOrder || a.slotId.localeCompare(b.slotId));
  return {
    ...content,
    aspectRatio: '9:16',
    estimatedDurationSec: required.reduce((sum, item) => sum + (Number(item.suggestedDurationSec) || Number(item.minDurationSec) || 5), 0),
    shots: required.map((requirement) => ({
      shotId: requirement.shotId || requirement.slotId,
      durationSec: Number(requirement.suggestedDurationSec) || Number(requirement.minDurationSec) || 5,
      scriptText: requirement.scriptText || '',
      requiredAssets: [{ slotId: requirement.slotId }],
    })),
    editInstructions: content.editInstructions || [],
  };
}

function localCandidate(context) {
  const { advisor, task } = context;
  return {
    title: `${advisor.city}晚高峰补能路线：先实测，再回答一周几次`,
    hook: `没有家充、每天通勤 42 公里，到底一周需要补能几次？先别听固定答案，我会把${advisor.city}工作日晚高峰这条路线真实跑一遍。`,
    script: [
      '提出用户原问题，并说明本条先展示实测方法，不提前给结果。',
      `说明路线位于${advisor.city}，出发时间、起始电量和当天路况均由顾问拍摄后补充。`,
      '依次记录导航路线、到站等待时间、补能耗时与结束电量；所有数字只使用现场拍摄画面。',
      '等待五天数据完整后，再按真实记录给出条件化补能建议；当前不承诺固定次数。',
      '邀请用户留下城市和通勤距离，由顾问人工挑选相似场景继续实测。',
    ].join('\n'),
    estimatedDurationSec: 35,
    aspectRatio: '9:16',
    shots: [
      { durationSec: 10, scriptText: '没有家充、每天通勤 42 公里，一周到底补能几次？先别急着听固定答案。', visualDescription: '顾问站在车旁正对镜头提出问题，同时带到车辆和周边真实环境', shootingGuide: '手机竖拍到腰部以上。先让车辆出现在身后，再看镜头说完口播；说完停 2 秒。', requiredAssets: [{ type: 'video', required: true, minDurationSec: 8, orientation: 'portrait', description: '顾问车旁开场与环境连续视频' }] },
      { durationSec: 14, scriptText: '我会记录出发时间、起始电量、当天路况和补能等待，所有结论都以现场画面为准。', visualDescription: '一段连续素材中依次展示导航路线、仪表电量和到站等待', shootingGuide: '手机竖拍。先拍导航路线 3 秒，再拍仪表电量 3 秒，最后拍到站环境；不要拍到家庭住址。可以边拍边说口播。', requiredAssets: [{ type: 'video', required: true, minDurationSec: 10, orientation: 'portrait', description: '路线、电量和到站环境连续记录' }] },
      { durationSec: 10, scriptText: '留下你的城市、通勤距离和是否有家充，我按真实记录继续回答。', visualDescription: '顾问展示记录画面后正对镜头收尾', shootingGuide: '手机竖拍。先带到记录画面，再转向顾问正脸并完整说完口播；不要承诺价格或权益。', requiredAssets: [{ type: 'video', required: true, minDurationSec: 8, orientation: 'portrait', description: '记录展示与顾问收尾连续视频' }] },
    ],
    replyPlan: ['通勤距离问题：人工追问单程或往返', '补能方式问题：另建对比任务', '试驾意愿：标记线索后由顾问人工接管'],
    cta: '留下你的城市、通勤距离和是否有家充，我把相似问题排进下一轮实测。',
    factRefs: [],
    profileRefs: task.profileEvidence,
    selectedReason: `路由匹配分 ${task.routeScore}，匹配${advisor.city}地域经验、结论式表达与实车证据偏好，并补位“${task.matrixGap}”。`,
  };
}

function homeEditingTestCandidate() {
  return {
    title: '居家素材识别与自动剪辑测试',
    hook: '不用车辆，只用家里的水杯完成一次真实素材解析和剪辑测试。',
    script: '今天用家里的水杯测试素材识别和自动字幕。现在我把水杯拿起来，再放回桌面，看看系统能不能找到动作和口播对应的时间点。',
    estimatedDurationSec: 18,
    aspectRatio: '9:16',
    shots: [
      {
        durationSec: 8,
        scriptText: '今天用家里的水杯测试素材识别和自动字幕。',
        visualDescription: '顾问在家中桌旁正对镜头，桌上能看到一个水杯',
        shootingGuide: '手机竖拍，放稳后让上半身和桌上水杯同时入镜。看镜头说完口播，再停 2 秒。',
        requiredAssets: [{ type: 'video', required: true, minDurationSec: 6, orientation: 'portrait', description: '居家桌旁开场口播视频' }],
      },
      {
        durationSec: 10,
        scriptText: '现在我把水杯拿起来，再放回桌面，看看系统能不能找到动作和口播对应的时间点。',
        visualDescription: '顾问拿起水杯展示，再把水杯放回桌面',
        shootingGuide: '手机继续竖拍。边说口播边慢慢拿起水杯，停 1 秒后放回桌面；说完后再停 2 秒。',
        requiredAssets: [{ type: 'video', required: true, minDurationSec: 8, orientation: 'portrait', description: '拿起并放回水杯的动作口播视频' }],
      },
    ],
    editInstructions: [{ shotOrder: 1, instruction: '保留顾问原声，按识别到的口播时间生成字幕。', sourceShotOrders: [1, 2] }],
    replyPlan: ['该内容仅用于居家剪辑链路测试，不用于发布。'],
    cta: '测试完成后查看画面截取、真实字幕、声音和进度条是否正常。',
    factRefs: [], profileRefs: [],
    selectedReason: '这是独立的居家剪辑测试内容，使用两段最简单的竖屏视频验证与真实汽车内容相同的上传、解析、字幕和剪辑链路。',
  };
}

function modelPrompt(context, contentId) {
  const safeContext = {
    contentId,
    advisor: context.advisor,
    profileTags: context.profileTags,
    task: context.task,
    validBrandKnowledge: context.knowledge,
    hardRules: [
      '只能引用 validBrandKnowledge 中的事实和 knowledgeId',
      '缺失的补能数字必须写为顾问拍摄后补充，不得推算或编造',
      '当前处于拍摄前策划阶段：不得声称已经出发、已经到站、已经排队、已经计时或已经得到实测结论',
      '不得推算一周补能次数、实际续航折扣、现场电量、排队人数、路程和耗时；这些必须写成“待顾问实拍补充”',
      '除用户问题和 validBrandKnowledge 原文已有数字外，标题、开场、完整口播和镜头台词不得新增任何数字',
      '脚本要教顾问记录什么，而不是提前替顾问填写记录结果',
      '不得承诺价格、权益、试驾结果，不得自动联系用户',
      '直接生成完整拍摄执行方案，不要先输出粗脚本，不要解释过程，不要使用 Markdown 代码块',
      '以完成内容任务所需的最小拍摄次数为目标：优先只设计 1—3 段必填视频；确有必要时允许 4—5 段，但必须在 selectedReason 中解释为什么不能合并，禁止超过 5 段必填视频',
      '能在同一机位或一次连续拍摄中完成的画面与口播必须合并，图片、空镜和补充音频默认设为可选，不得为了丰富形式增加顾问负担',
      '每个需要顾问说话的镜头必须同时给出 visualDescription、shootingGuide 和逐字 scriptText，让顾问在同一个位置即可知道拍什么、怎么拍、说什么',
      '默认保留顾问视频中的真实声音；禁止要求 AI 配音或额外录制与视频重复的音频',
      '每个镜头都必须包含面向外行顾问的简短 shootingGuide；不得只写“拍摄车辆”或“补充素材”',
      '每个需要顾问补充的素材必须放在对应镜头 requiredAssets 中，并明确类型、必填性、最低时长、方向、描述和上传提示',
      'requiredAssets 和 shootingGuide 只能描述顾问需要拍摄或上传的原始素材；剪辑、拼接、快切、转场、字幕、配乐、调色、导出等后期动作必须放入 editInstructions，不能创建上传槽位',
      'factRefs 和 profileRefs 只能使用输入中真实存在的 ID',
    ],
    outputSchema: {
      title: '字符串',
      hook: '字符串',
      script: '完整口播稿字符串',
      estimatedDurationSec: 35,
      aspectRatio: '9:16',
      shots: [{
        durationSec: 8,
        scriptText: '这个镜头对应的口播台词，没有台词时为空字符串',
        visualDescription: '镜头中应该看到什么',
        shootingGuide: '顾问照着做即可完成拍摄的简短步骤',
        notes: '安全、隐私、收音或品牌注意事项',
        requiredAssets: [{
          type: 'video | image | audio | text',
          required: true,
          suggestedDurationSec: 8,
          minDurationSec: 5,
          orientation: 'portrait | landscape | any',
          description: '需要上传的素材内容',
          uploadTip: '上传前如何快速自检',
        }],
      }],
      editInstructions: [{ shotOrder: 1, instruction: '素材齐全后由 AI 执行的剪辑动作', sourceShotOrders: [1] }],
      replyPlan: ['评论回复建议'],
      cta: '字符串',
      factRefs: ['有效知识ID'],
      profileRefs: ['生效画像标签ID'],
      selectedReason: '选择该内容角度的可解释原因',
    },
  };
  return JSON.stringify(safeContext, null, 2);
}

function quizView(session) {
  return {
    question: session.currentQuestionId ? getQuestion(session.currentQuestionId) : null,
    questions: session.questionIds.map((questionId) => getQuestion(questionId)),
  };
}

function onboardingModelPrompt(input) {
  return JSON.stringify({
    advisor: {
      city: input.city,
      experienceYears: input.experienceYears,
      targetAudience: input.targetAudience,
      specialties: input.specialties,
      preferences: input.preferences,
      historyContents: input.historyContents,
      voiceTranscript: input.voiceTranscript,
      forbiddenExpressions: input.forbiddenExpressions,
    },
    rules: [
      '只输出 JSON 对象，字段为 tags 数组',
      '每个标签字段为 dimension,label,weight,confidence,evidence',
      'evidence 必须引用输入中的具体文字，不得推断敏感属性',
      '不得把车型价格、权益、参数或政策作为顾问画像证据',
    ],
  }, null, 2);
}

export class OneKosService {
  constructor({ repository, llmClient = null, mediaAnalysisClient = null, mediaAnalysisConfig = {}, videoEditor = null, mode = 'simulation', clock = () => new Date(), idFactory = () => `ONB-${crypto.randomUUID()}` }) {
    this.repository = repository;
    this.llmClient = llmClient;
    this.videoEditor = videoEditor;
    this.mediaAnalysisClient = mediaAnalysisClient;
    this.mediaAnalysisConfig = mediaAnalysisConfig;
    this.mode = mode;
    this.clock = clock;
    this.idFactory = idFactory;
    this.runningEditingJobs = new Set();
  }

  today() { return this.clock().toISOString().slice(0, 10); }
  timestamp() { return this.clock().toISOString(); }

  async listAdvisors() {
    return this.repository.listAdvisors();
  }

  async getAdvisorProfile(advisorId) {
    const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
    const profileTags = await this.repository.getProfileTags(advisorId);
    return { advisor, profileTags };
  }

  async createAdvisorIdentity(raw = {}) {
    const advisorId = String(raw.advisorId || '').trim().toUpperCase();
    const displayName = String(raw.displayName || '').trim();
    if (!advisorId || !displayName) {
      const error = new Error('顾问ID与展示名称不能为空');
      error.statusCode = 400;
      throw error;
    }
    const existing = await this.repository.getAdvisor(advisorId);
    if (existing) return { advisor: existing, created: false };
    const advisor = {
      advisorId, displayName, city: String(raw.city || '').trim(), store: String(raw.store || '').trim(),
      experienceYears: Number(raw.experienceYears) || 0, targetAudience: String(raw.targetAudience || '').trim(),
      profileMaturity: 0, workflowStatus: '待校准', initializationStatus: 'uninitialized', profileVersion: 0,
      identitySource: raw.identitySource === 'feishu' ? 'feishu' : 'demo',
      externalUserId: String(raw.externalUserId || '').trim(),
      authorizationStatus: '待顾问确认', simulation: raw.identitySource !== 'feishu',
    };
    const write = await this.repository.saveAdvisor(advisor);
    return { advisor, write, created: true };
  }

  async resolveFeishuAdvisor(user = {}) {
    const openId = String(user.openId || '').trim();
    if (!openId) {
      const error = new Error('飞书用户身份缺少 open_id');
      error.statusCode = 400;
      throw error;
    }
    const advisors = await this.repository.listAdvisors();
    const existing = advisors.find((advisor) => advisor.externalUserId === openId);
    if (existing) return { advisor: existing, created: false };
    return this.createAdvisorIdentity({
      advisorId: `FS-${openId}`, displayName: user.name || '飞书顾问', city: '', store: '',
      identitySource: 'feishu', externalUserId: openId,
    });
  }

  async createOnboardingSession(rawInput) {
    const input = normalizeOnboardingInput(rawInput);
    const now = this.timestamp();
    const session = {
      ...buildOnboardingSession(input, { sessionId: this.idFactory(), now }),
      simulation: input.identitySource !== 'feishu',
    };
    const advisor = {
      advisorId: input.advisorId,
      displayName: input.displayName,
      city: input.city,
      store: input.store,
      experienceYears: input.experienceYears,
      targetAudience: input.targetAudience,
      profileMaturity: 0,
      workflowStatus: '待校准',
      initializationStatus: 'collecting',
      profileVersion: 0,
      identitySource: input.identitySource,
      externalUserId: input.externalUserId,
      authorizationStatus: input.authorizationStatus,
      simulation: session.simulation,
    };
    const [advisorWrite, sessionWrite] = await Promise.all([
      this.repository.saveAdvisor(advisor),
      this.repository.saveOnboardingSession(session),
    ]);
    return { advisor, session, advisorWrite, sessionWrite };
  }

  async createQuizSession(raw = {}) {
    const advisorId = String(raw.advisorId || '').trim().toUpperCase();
    const identity = { displayName: raw.displayName, city: raw.city, store: raw.store };
    const now = this.timestamp();
    const session = {
      ...buildQuizSession({ advisorId, identity }, { sessionId: this.idFactory(), now }),
      simulation: raw.identitySource !== 'feishu',
    };
    const advisor = {
      advisorId, ...session.identity, experienceYears: 0, targetAudience: '', profileMaturity: 0,
      workflowStatus: '答题中', initializationStatus: 'collecting', profileVersion: 0,
      identitySource: raw.identitySource === 'feishu' ? 'feishu' : 'demo', authorizationStatus: '仅使用顾问主动回答的问卷',
      simulation: session.simulation,
    };
    const [advisorWrite, sessionWrite] = await Promise.all([
      this.repository.saveAdvisor(advisor), this.repository.saveOnboardingSession(session),
    ]);
    return { advisor, session, ...quizView(session), advisorWrite, sessionWrite };
  }

  async getQuizSession(sessionId) {
    const session = await this.getOnboardingSession(sessionId);
    if (session.mode !== 'quiz') {
      const error = new Error('当前初始化会话不是问卷模式');
      error.statusCode = 409;
      throw error;
    }
    return { session, ...quizView(session) };
  }

  async abandonQuizSession(sessionId) {
    const { session } = await this.getQuizSession(sessionId);
    if (session.status === 'confirmed') {
      const error = new Error('已生效画像不能作为未完成画像删除');
      error.statusCode = 409;
      throw error;
    }
    if (session.status === 'abandoned') return { session, idempotent: true };
    const updated = { ...session, status: 'abandoned', updatedAt: this.timestamp(), lastError: null };
    const sessionWrite = await this.repository.saveOnboardingSession(updated);
    const advisor = await this.repository.getAdvisor(session.advisorId);
    let advisorWrite = null;
    if (advisor?.initializationStatus === 'collecting') {
      advisorWrite = await this.repository.saveAdvisor({ ...advisor, initializationStatus: 'uninitialized', workflowStatus: '待校准' });
    }
    return { session: updated, advisor: advisor ? { ...advisor, ...(advisorWrite ? { initializationStatus: 'uninitialized', workflowStatus: '待校准' } : {}) } : null, sessionWrite, advisorWrite, idempotent: false };
  }

  async submitQuizAnswer(sessionId, answer) {
    const { session } = await this.getQuizSession(sessionId);
    const updated = recordQuizAnswer(session, answer, this.timestamp());
    const write = await this.repository.saveOnboardingSession(updated);
    return { session: updated, ...quizView(updated), write };
  }

  async completeQuizSession(sessionId) {
    const { session } = await this.getQuizSession(sessionId);
    let updated = buildCompletedQuizSession(session, { now: this.timestamp() });
    const warnings = [];
    if (this.llmClient) {
      try {
        const raw = await this.llmClient.generateJson({
          system: '你是 OneKOS 顾问表达分析器。仅依据短文回答提炼可验证的表达词，只返回 JSON 对象，字段为 terms 数组。',
          user: JSON.stringify({ writingAnswer: session.answers['Q-WRITING'], allowedDimensions: ['表达结构', '表达语气', '证据偏好', '内容形式'] }),
          temperature: 0.1,
        });
        const merged = mergeQuizCandidateTerms(updated.candidates, raw, session.advisorId);
        if (merged.length > updated.candidates.length) {
          updated.candidates = merged;
          updated.generator = 'quiz-hybrid';
        }
      } catch {
        warnings.push('短文模型分析不可用，已使用本地规则完成词云。');
      }
    }
    const byDimension = (dimension) => updated.candidates.filter((item) => item.dimension === dimension).sort((a, b) => b.weight - a.weight);
    const input = {
      advisorId: session.advisorId, displayName: session.identity.displayName, city: session.identity.city, store: session.identity.store,
      experienceYears: 0, targetAudience: byDimension('目标用户')[0]?.term || '待持续学习', targetModel: '乐道 L60',
      specialties: byDimension('专业能力').slice(0, 3).map((item) => item.term),
      preferences: {
        openingStyle: byDimension('表达结构')[0]?.term || '自然表达',
        evidencePreference: byDimension('证据偏好')[0]?.term || '真实证据',
        tone: byDimension('表达语气')[0]?.term || '专业克制',
      },
      historyContents: [], voiceTranscript: session.answers['Q-WRITING'] || '', forbiddenExpressions: [],
      identitySource: session.simulation ? 'demo' : 'feishu', externalUserId: '', authorizationStatus: '仅使用顾问主动回答的问卷',
    };
    updated = { ...updated, input, warnings: [...(updated.warnings || []), ...warnings] };
    const write = await this.repository.saveOnboardingSession(updated);
    return { session: updated, write };
  }

  async getOnboardingSession(sessionId) {
    return requireRecord(await this.repository.getOnboardingSession(sessionId), '初始化会话', sessionId);
  }

  async generateOnboardingCandidates(sessionId) {
    const session = await this.getOnboardingSession(sessionId);
    if (['generated', 'confirming', 'confirmed'].includes(session.status)) return { session };
    if (!['draft', 'generation_failed'].includes(session.status)) {
      const error = new Error(`当前会话状态不能生成候选画像：${session.status}`);
      error.statusCode = 409;
      throw error;
    }

    let candidates;
    let generator = 'local-rule-fallback';
    const warnings = [];
    if (this.llmClient) {
      try {
        const raw = await this.llmClient.generateJson({
          system: '你是 OneKOS 顾问画像初始化分析器。只依据顾问主动提供的资料生成候选标签，只返回 JSON。',
          user: onboardingModelPrompt(session.input),
          temperature: 0.15,
        });
        candidates = normalizeModelCandidates(raw, session.input);
        generator = 'external-llm';
      } catch {
        warnings.push('模型候选不可用，已使用本地规则生成可确认画像。');
      }
    }
    if (!candidates) candidates = generateRuleCandidates(session.input);

    const updated = {
      ...session,
      status: 'generated',
      candidates,
      generator,
      warnings,
      lastError: null,
      updatedAt: this.timestamp(),
    };
    const write = await this.repository.saveOnboardingSession(updated);
    return { session: updated, write };
  }

  async confirmOnboardingSession(sessionId, { acceptedTags = [], idempotencyKey = '' } = {}) {
    const session = await this.getOnboardingSession(sessionId);
    if (session.status === 'confirmed') {
      const [advisor, tags, task] = await Promise.all([
        this.repository.getAdvisor(session.advisorId),
        this.repository.getProfileTags(session.advisorId),
        this.repository.getTask(session.taskId),
      ]);
      return {
        advisor,
        tags: tags.filter((tag) => tag.profileVersion == null || tag.profileVersion === '' || Number(tag.profileVersion) === Number(session.profileVersion)),
        task,
        session,
        idempotent: true,
      };
    }
    if (!['generated', 'confirming', 'write_failed'].includes(session.status)) {
      const error = new Error('当前初始化会话尚未生成候选画像');
      error.statusCode = 409;
      throw error;
    }

    const now = this.timestamp();
    const result = confirmCandidateTags({ ...session, status: 'generated' }, acceptedTags, now);
    let working = {
      ...session,
      status: 'confirming',
      acceptedTags: result.tags,
      idempotencyKey: String(idempotencyKey || ''),
      lastError: null,
      updatedAt: now,
      writeProgress: { ...(session.writeProgress || {}) },
    };
    await this.repository.saveOnboardingSession(working);

    const advisor = {
      ...session.input,
      profileMaturity: Math.min(80, 56 + result.tags.length * 6),
      workflowStatus: '已校准',
      initializationStatus: 'active',
      profileVersion: result.profileVersion,
      initializedAt: now,
      simulation: session.simulation,
    };
    const tags = result.tags.map((tag) => ({ ...tag, sourceRefs: [sessionId], simulation: session.simulation }));

    try {
      if (!working.writeProgress.advisor) {
        await this.repository.saveAdvisor(advisor);
        working.writeProgress.advisor = true;
        await this.repository.saveOnboardingSession(working);
      }
      const writtenTags = new Set(working.writeProgress.tags || []);
      for (const tag of tags) {
        if (!writtenTags.has(tag.tagId)) {
          await this.repository.saveProfileTag(tag);
          writtenTags.add(tag.tagId);
          working.writeProgress.tags = [...writtenTags];
          await this.repository.saveOnboardingSession(working);
        }
      }
      if (!working.writeProgress.task) {
        await this.repository.saveContentTask(result.task);
        working.writeProgress.task = true;
      }
      working = {
        ...working,
        status: 'confirmed',
        profileVersion: result.profileVersion,
        taskId: result.task.taskId,
        confirmedAt: now,
        updatedAt: now,
      };
      await this.repository.saveOnboardingSession(working);
      return { advisor, tags, task: result.task, session: working, idempotent: false };
    } catch {
      const failed = { ...working, status: 'write_failed', lastError: '初始化写入未完成，可安全重试。', updatedAt: this.timestamp() };
      await this.repository.saveOnboardingSession(failed);
      const error = new Error(failed.lastError);
      error.statusCode = 502;
      throw error;
    }
  }

  async getOpportunities({ advisorId, limit = 3 } = {}) {
    const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
    const [tasks, profileTags, leads, contentResults] = await Promise.all([
      this.repository.listContentTasks(advisorId),
      this.repository.getProfileTags(advisorId),
      this.repository.listCommentLeads(advisorId),
      this.repository.listContentResults(),
    ]);
    return {
      advisor,
      ...buildOpportunityRoutes({ advisorId, tasks, profileTags, leads, contentResults, limit }),
      generatedAt: this.timestamp(),
      dataSource: this.mode === 'simulation' ? 'repository-simulation' : 'feishu-bitable',
    };
  }

  async routeOpportunities({ advisorId, limit = 3 } = {}) {
    const result = await this.getOpportunities({ advisorId, limit });
    await Promise.all(result.recommendations.map((recommendation) => this.repository.saveContentTask({
      ...recommendation,
      profileEvidence: recommendation.matchedProfileTagIds,
      routeScore: recommendation.score,
      routedAt: result.generatedAt,
    })));
    return result;
  }

  async decideOpportunity(taskId, { advisorId, decision, reason = '' } = {}) {
    const task = requireRecord(await this.repository.getTask(taskId), '机会任务', taskId);
    if (task.advisorId !== advisorId) {
      const error = new Error(`任务 ${taskId} 不属于顾问 ${advisorId}`);
      error.statusCode = 409;
      throw error;
    }
    const tags = await this.repository.getProfileTags(advisorId);
    const affectedTag = (task.profileEvidence || []).map((tagId) => tags.find((tag) => tag.tagId === tagId)).find(Boolean)
      || [...tags].sort((left, right) => Number(right.weight || 0) - Number(left.weight || 0))[0];
    let result;
    try {
      result = buildOpportunityDecision(task, {
        decision,
        reason,
        affectedTagId: affectedTag?.tagId || null,
        eventId: `EVENT-OPPORTUNITY-${taskId}`,
        now: this.timestamp(),
      });
    } catch (error) {
      error.statusCode = 400;
      throw error;
    }
    const taskWrite = await this.repository.saveContentTask(result.task);
    let eventWrite = null;
    if (result.feedbackEvent) eventWrite = await this.repository.saveFeedbackEvent(result.feedbackEvent);
    if (decision === 'accept') {
      const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
      await this.repository.saveAdvisor({ ...advisor, workflowStatus: '待生成' });
    }
    return { ...result, taskWrite, eventWrite };
  }

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

  async getAdvisorWorkspace(advisorId) {
    const advisor = requireRecord(await this.repository.getAdvisor(advisorId), '顾问', advisorId);
    const [tasks, contents] = await Promise.all([
      this.repository.listContentTasks(advisorId),
      this.repository.listContentResults(),
    ]);
    const acceptedTasks = tasks.filter((task) => task.decision === 'accept');
    const acceptedTask = latestTask(acceptedTasks);
    const taskWithContent = latestTask(tasks.filter((task) => contents.some((content) => content.taskId === task.taskId)));
    const task = acceptedTask || taskWithContent;
    const loadContentState = async (targetTask) => {
      const savedContent = contentForTask(targetTask, contents);
      if (!savedContent) return { savedContent: null, contentPackage: null };
      try {
        return { savedContent, contentPackage: await this.getContentPackage(savedContent.contentId) };
      } catch (error) {
        if (error?.statusCode !== 404) throw error;
        return { savedContent, contentPackage: null };
      }
    };
    const sortedAcceptedTasks = [...acceptedTasks].sort((left, right) => {
      const leftTime = Date.parse(left.decidedAt || left.routedAt || left.taskDate || '') || 0;
      const rightTime = Date.parse(right.decidedAt || right.routedAt || right.taskDate || '') || 0;
      return rightTime - leftTime;
    });
    const acceptedContentStates = await Promise.all(sortedAcceptedTasks.map(loadContentState));
    const selectedAcceptedIndex = sortedAcceptedTasks.findIndex((item) => item.taskId === task?.taskId);
    const selectedState = selectedAcceptedIndex >= 0 ? acceptedContentStates[selectedAcceptedIndex] : await loadContentState(task);
    const contentPackage = selectedState.contentPackage;
    return {
      advisor,
      task,
      acceptedTasks: sortedAcceptedTasks.map((accepted, index) => {
        const savedContent = acceptedContentStates[index].contentPackage?.content || null;
        return {
          ...accepted,
          contentId: savedContent?.contentId || '',
          contentStatus: savedContent?.status || '',
          hasContent: Boolean(savedContent),
        };
      }),
      contentPackage,
      stage: contentPackage ? contentPackage.status : task ? 'accepted_waiting_generation' : 'waiting_opportunity',
      recoveryWarning: '',
    };
  }

  async generateContent({ advisorId = 'ADV-017', taskId = 'TASK-001', contentId: requestedContentId, testMode = '' } = {}) {
    const context = await this.getAdvisorContext({ advisorId, taskId });
    if (context.task.status !== '待生成') {
      const error = new Error(`任务 ${taskId} 尚未被顾问接受，不能生成内容`);
      error.statusCode = 409;
      throw error;
    }
    const contentId = requestedContentId || contentIdForTask(taskId);
    const existingContent = await this.repository.getContentResult(contentId);
    if (existingContent && existingContent.taskId !== taskId) {
      const error = new Error(`内容ID ${contentId} 已属于任务 ${existingContent.taskId}，不能由任务 ${taskId} 覆盖`);
      error.statusCode = 409;
      throw error;
    }
    let candidate;
    let generator = 'local-deterministic';
    let generationWarning = '';
    if (testMode === 'home-editing') {
      candidate = homeEditingTestCandidate();
      generator = 'home-editing-test';
    } else if (this.llmClient) {
      try {
        candidate = await this.llmClient.generateJson({
          system: '你是 OneKOS 内容生成器。严格依据上下文生成个性化短视频方案，只返回 JSON。',
          user: modelPrompt(context, contentId),
          temperature: 0.25,
        });
        generator = 'external-llm';
      } catch (error) {
        candidate = localCandidate(context);
        generator = 'local-deterministic-fallback';
        generationWarning = `外部模型不可用，已明确使用本地确定性生成器：${error.message}`;
      }
    } else {
      candidate = localCandidate(context);
    }
    const normalized = normalizeProductionCandidate(candidate, { task: context.task, contentId });
    const quality = inspectContentPackage({
      content: normalized,
      knowledge: context.knowledge,
      profileTags: context.profileTags,
      matrixContents: context.recentContents.filter((item) => item.taskId !== taskId && item.contentId !== contentId),
      task: context.task,
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
    const shootingRequirements = buildShootingRequirements(content);
    const requirementWrites = await this.repository.saveShootingRequirements(shootingRequirements);
    const retiredRequirementWrites = await this.repository.retireShootingRequirements(contentId, shootingRequirements.map((item) => item.slotId));
    const advisorAssets = buildAssetPlaceholders(shootingRequirements, { advisorId, contentId });
    const assetPlaceholderWrites = await this.repository.saveAdvisorAssets(advisorAssets);
    return {
      mode: this.mode, generator, content, quality, write, shootingRequirements, requirementWrites, retiredRequirementWrites,
      advisorAssets, assetPlaceholderWrites,
      contextWarnings: [...context.warnings, ...(generationWarning ? [generationWarning] : [])],
    };
  }

  async getContentMaterials(contentId) {
    const [allShootingRequirements, allAdvisorAssets, savedEditingJob] = await Promise.all([
      this.repository.listShootingRequirements(contentId),
      this.repository.listAdvisorAssets(contentId),
      this.repository.getEditingJob ? this.repository.getEditingJob(`${contentId}-RENDER-001`) : null,
    ]);
    const shootingRequirements = allShootingRequirements.filter((item) => item.required);
    const activeSlots = new Set(shootingRequirements.map((item) => item.slotId));
    const advisorAssets = allAdvisorAssets.filter((item) => activeSlots.has(item.slotId));
    if (!shootingRequirements.length) requireRecord(null, '内容拍摄要求', contentId);
    const comparison = compareRequirementsAndAssets(shootingRequirements, advisorAssets);
    let editingJob = savedEditingJob;
    if (comparison.complete && !editingJob) {
      const content = requireRecord(await this.repository.getContentResult(contentId), '内容成果', contentId);
      editingJob = buildEditingJob({
        content: editingContentFromRequirements(content, shootingRequirements),
        assets: advisorAssets,
        comparison,
        timestamp: this.timestamp(),
      });
      editingJob.editor = '本地 FFmpeg';
      editingJob.simulation = advisorAssets.some((asset) => asset.simulation);
      await this.repository.saveEditingJob(editingJob);
    }
    return {
      contentId,
      shootingRequirements,
      json3: { contentId, uploadedAssets: advisorAssets, simulation: advisorAssets.some((asset) => asset.simulation) },
      comparison,
      status: comparison.complete ? 'ready_for_edit' : comparison.invalid.length ? 'waiting_reshoot' : 'waiting_upload',
      editingJob,
    };
  }

  async getContentPackage(contentId) {
    const content = requireRecord(await this.repository.getContentResult(contentId), '内容成果', contentId);
    const materials = await this.getContentMaterials(contentId);
    const persistedStoryboardIsLossy = content.storyboard.length
      && content.storyboard.every((item) => item === '[object Object]');
    if (!content.storyboard.length || persistedStoryboardIsLossy) {
      content.storyboard = materials.shootingRequirements.map((item) => item.visualDescription || item.scriptText || item.description);
    }
    return {
      content,
      quality: content.quality,
      shootingRequirements: materials.shootingRequirements,
      advisorAssets: materials.json3.uploadedAssets,
      comparison: materials.comparison,
      status: materials.status,
      editingJob: materials.editingJob,
      recovered: true,
    };
  }

  async stageAdvisorAssetUpload({ contentId, slotId, advisorId, fileName, mimeType, bytes, durationSec = 0, width = 0, height = 0 }) {
    if (!contentId || !slotId || !advisorId || !fileName || !bytes?.byteLength) {
      const error = new Error('内容、素材槽位、顾问和文件均不能为空');
      error.statusCode = 400;
      throw error;
    }
    const requirements = await this.repository.listShootingRequirements(contentId);
    const requirement = requirements.find((item) => item.slotId === slotId);
    if (!requirement) requireRecord(null, '素材槽位', slotId);
    const task = requireRecord(await this.repository.getTask(requirement.taskId), '内容任务', requirement.taskId);
    if (task.advisorId !== advisorId) {
      const error = new Error(`素材槽位 ${slotId} 不属于顾问 ${advisorId}`);
      error.statusCode = 409;
      throw error;
    }

    const existingAssets = await this.repository.listAdvisorAssets(contentId);
    const placeholder = existingAssets.find((item) => item.slotId === slotId);
    if (placeholder?.advisorId && placeholder.advisorId !== advisorId) {
      const error = new Error(`素材槽位 ${slotId} 不属于顾问 ${advisorId}`);
      error.statusCode = 409;
      throw error;
    }

    const uploaded = await this.repository.uploadAdvisorAssetFile({ fileName, mimeType, bytes });
    const uploadedAsset = {
      ...(placeholder || {}),
      assetId: placeholder?.assetId || `${contentId}-ASSET-${slotId.split('-SLOT-').pop()}`,
      contentId, slotId, shotId: requirement.shotId, advisorId,
      fileToken: uploaded.fileToken, fileName, mimeType, fileSize: bytes.byteLength,
      type: requirement.type,
      durationSec: Number(durationSec) || 0,
      width: Number(width) || 0,
      height: Number(height) || 0,
      orientation: requirement.orientation,
      resolution: width && height ? `${width}x${height}` : '',
      technicalCheckStatus: '检查中',
      advisorConfirmationStatus: '待确认',
      requiresReshoot: false,
      invalidReason: '',
      status: 'checking',
      simulation: Boolean(uploaded.simulation),
    };
    const assetWrite = await this.repository.saveAdvisorAssets([uploadedAsset]);
    const assets = existingAssets.filter((item) => item.assetId !== uploadedAsset.assetId).concat(uploadedAsset);
    const comparison = compareRequirementsAndAssets(requirements, assets);
    return {
      contentId,
      uploadedAsset,
      assetWrite,
      shootingRequirements: requirements,
      json3: { contentId, uploadedAssets: assets, simulation: assets.some((asset) => asset.simulation) },
      comparison,
      status: 'checking',
      editingJob: null,
    };
  }

  async checkAdvisorAsset({ contentId, slotId, advisorId, fileName, mimeType, bytes, durationSec = 0, width = 0, height = 0 }) {
    const requirements = await this.repository.listShootingRequirements(contentId);
    const requirement = requirements.find((item) => item.slotId === slotId);
    if (!requirement) requireRecord(null, '素材槽位', slotId);
    const task = requireRecord(await this.repository.getTask(requirement.taskId), '内容任务', requirement.taskId);
    if (task.advisorId !== advisorId) {
      const error = new Error(`素材槽位 ${slotId} 不属于顾问 ${advisorId}`);
      error.statusCode = 409;
      throw error;
    }
    const existingAssets = await this.repository.listAdvisorAssets(contentId);
    const uploadedAsset = requireRecord(existingAssets.find((item) => item.slotId === slotId), '已上传素材', slotId);
    const serverMetadata = this.videoEditor?.inspectBytes
      ? await this.videoEditor.inspectBytes({ bytes, fileName, mimeType, type: requirement.type })
      : null;
    const rawAsset = {
      ...uploadedAsset,
      fileName: fileName || uploadedAsset.fileName,
      mimeType: mimeType || uploadedAsset.mimeType,
      fileSize: bytes?.byteLength || uploadedAsset.fileSize,
      durationSec: Number(serverMetadata?.durationSec) || Number(durationSec) || uploadedAsset.durationSec || 0,
      width: Number(serverMetadata?.width) || Number(width) || uploadedAsset.width || 0,
      height: Number(serverMetadata?.height) || Number(height) || uploadedAsset.height || 0,
    };
    let checkedAsset = { ...inspectUploadedAsset(requirement, rawAsset), simulation: Boolean(uploadedAsset.simulation) };
    if (checkedAsset.status === 'available' && requirement.type === 'video' && this.mediaAnalysisClient && this.videoEditor?.prepareAnalysis) {
      try {
        const prepared = await this.videoEditor.prepareAnalysis({
          bytes,
          fileName,
          mimeType,
          frameIntervalSec: this.mediaAnalysisConfig.frameIntervalSec,
          maxFrames: this.mediaAnalysisConfig.maxFrames,
        });
        checkedAsset = {
          ...checkedAsset,
          analysisStatus: '已完成',
          analysis: await this.mediaAnalysisClient.analyze({ prepared, requirement }),
        };
      } catch (error) {
        checkedAsset = {
          ...checkedAsset,
          analysisStatus: '解析降级',
          analysis: {
            status: '解析降级',
            error: error.message,
            recommendedClip: { startSec: 0, endSec: checkedAsset.durationSec },
            asr: { transcript: '', sentences: [] },
            vision: { summary: '', segments: [], warnings: [] },
          },
        };
      }
    }
    const assetWrite = await this.repository.saveAdvisorAssets([checkedAsset]);
    const persistedAssets = await this.repository.listAdvisorAssets(contentId);
    const assets = (persistedAssets.length ? persistedAssets : existingAssets)
      .filter((item) => item.assetId !== checkedAsset.assetId)
      .concat(checkedAsset);
    const comparison = compareRequirementsAndAssets(requirements, assets);
    const resolvedRequirements = requirements.map((item) => ({
      ...item,
      status: comparison.matched.some((match) => match.slotId === item.slotId)
        ? '检查通过'
        : comparison.invalid.some((invalid) => invalid.slotId === item.slotId) ? '需要重拍' : '待上传',
    }));
    const requirementWrites = await this.repository.saveShootingRequirements(resolvedRequirements);
    let editingJob = null;
    let editingJobWrite = null;
    if (comparison.complete) {
      const content = requireRecord(await this.repository.getContentResult(contentId), '内容成果', contentId);
      editingJob = buildEditingJob({
        content: editingContentFromRequirements(content, resolvedRequirements),
        assets,
        comparison,
        timestamp: this.timestamp(),
      });
      editingJob.editor = '本地 FFmpeg';
      editingJob.simulation = assets.some((asset) => asset.simulation);
      editingJobWrite = await this.repository.saveEditingJob(editingJob);
    }
    return {
      contentId, checkedAsset, assetWrite, shootingRequirements: resolvedRequirements,
      json3: { contentId, uploadedAssets: assets, simulation: assets.some((asset) => asset.simulation) },
      comparison,
      status: comparison.complete ? 'ready_for_edit' : comparison.invalid.length ? 'waiting_reshoot' : 'waiting_upload',
      requirementWrites, editingJob, editingJobWrite,
    };
  }

  async failAdvisorAssetCheck({ contentId, slotId, message }) {
    const assets = await this.repository.listAdvisorAssets(contentId);
    const uploadedAsset = assets.find((item) => item.slotId === slotId);
    if (!uploadedAsset) return null;
    const failedAsset = {
      ...uploadedAsset,
      technicalCheckStatus: '检查失败',
      requiresReshoot: true,
      invalidReason: `自动检查失败：${message}`,
      status: 'invalid',
    };
    await this.repository.saveAdvisorAssets([failedAsset]);
    return failedAsset;
  }

  async uploadAdvisorAsset(input) {
    await this.stageAdvisorAssetUpload(input);
    return this.checkAdvisorAsset(input);
  }

  async getEditingJob(editingJobId) {
    return requireRecord(await this.repository.getEditingJob(editingJobId), '剪辑任务', editingJobId);
  }

  async getEditingPreview(editingJobId) {
    if (!this.videoEditor) requireRecord(null, '视频剪辑器', 'local-ffmpeg');
    const job = await this.getEditingJob(editingJobId);
    if (!['待顾问预览', '已完成'].includes(job.status)) {
      const error = new Error(`剪辑任务尚未完成：${job.status}`);
      error.statusCode = 409;
      throw error;
    }
    return this.videoEditor.readOutput(job);
  }

  async startEditingJob(editingJobId) {
    if (!this.videoEditor) {
      const error = new Error('本地视频剪辑器未配置');
      error.statusCode = 503;
      throw error;
    }
    const job = await this.getEditingJob(editingJobId);
    if (job.status === '已完成') return job;
    if (this.runningEditingJobs.has(editingJobId)) {
      return { ...job, status: '待剪辑', progress: Math.max(5, Number(job.progress) || 0) };
    }
    this.runningEditingJobs.add(editingJobId);
    try {
      await this.videoEditor.checkAvailability();
      const queued = {
        ...job,
        editor: '本地 FFmpeg',
        status: '待剪辑',
        progress: 5,
        failureReason: '',
        retryCount: job.status === '失败' ? Number(job.retryCount || 0) + 1 : Number(job.retryCount || 0),
      };
      await this.repository.saveEditingJob(queued);
      setTimeout(() => {
        this.executeEditingJob(editingJobId).catch(() => {}).finally(() => this.runningEditingJobs.delete(editingJobId));
      }, 0);
      return queued;
    } catch (error) {
      this.runningEditingJobs.delete(editingJobId);
      throw error;
    }
  }

  async executeEditingJob(editingJobId) {
    let job = await this.getEditingJob(editingJobId);
    const saveProgress = async (status, progress, failureReason = '') => {
      job = { ...job, status, progress, failureReason };
      await this.repository.saveEditingJob(job);
    };
    try {
      await saveProgress('剪辑中', 10);
      const assets = (await this.repository.listAdvisorAssets(job.contentId))
        .filter((asset) => job.assetIds.includes(asset.assetId) && asset.status === 'available' && asset.fileToken);
      if (assets.length !== job.assetIds.length) throw new Error(`剪辑任务需要 ${job.assetIds.length} 个素材，当前只有 ${assets.length} 个可用素材`);
      await saveProgress('剪辑中', 20);
      const result = await this.videoEditor.render({
        job,
        assets,
        getAssetBytes: async (asset) => (await this.repository.downloadAdvisorAssetFile(asset.fileToken)).bytes,
        onProgress: async (progress) => saveProgress('剪辑中', progress),
      });
      await saveProgress('剪辑中', 90);
      const uploaded = await this.repository.uploadRenderedVideoFile(result);
      job = {
        ...job,
        status: '待顾问预览',
        progress: 100,
        failureReason: '',
        previewFileToken: uploaded.fileToken,
        finalFileToken: null,
        completedAt: this.timestamp(),
        simulation: Boolean(uploaded.simulation),
        output: { fileName: result.fileName, size: result.size, durationSec: result.durationSec, localPath: result.outputPath },
      };
      await this.repository.saveEditingJob(job);
      return job;
    } catch (error) {
      job = { ...job, status: '失败', progress: 0, failureReason: error.message || '未知剪辑错误' };
      await this.repository.saveEditingJob(job).catch(() => {});
      throw error;
    }
  }

  async runProductionDemo(options = {}) {
    const generation = await this.generateContent(options);
    const { content, shootingRequirements } = generation;
    if (!generation.quality.passed) {
      return {
        ...generation,
        json2: content,
        json3: { contentId: content.contentId, uploadedAssets: [], simulation: true },
        comparison: {
          complete: false,
          requiredCount: shootingRequirements.filter((item) => item.required).length,
          matchedCount: 0,
          missing: [],
          invalid: [],
          matched: [],
          blockedByQuality: true,
        },
        assetWrites: [],
        resolvedRequirementWrites: [],
        editingJob: null,
        editingJobWrite: null,
        simulationNotice: '内容事实或合规质检未通过，系统没有模拟素材，也没有创建剪辑任务。',
      };
    }
    const assets = buildSimulatedAssets(shootingRequirements, { advisorId: content.advisorId, contentId: content.contentId });
    const assetWrites = await this.repository.saveAdvisorAssets(assets);
    const comparison = compareRequirementsAndAssets(shootingRequirements, assets);
    const resolvedRequirements = shootingRequirements.map((requirement) => ({
      ...requirement,
      status: comparison.matched.some((item) => item.slotId === requirement.slotId) ? '检查通过' : requirement.status,
    }));
    const resolvedRequirementWrites = await this.repository.saveShootingRequirements(resolvedRequirements);
    let editingJob = null;
    let editingJobWrite = null;
    if (comparison.complete && generation.quality.passed) {
      editingJob = buildEditingJob({ content, assets, comparison, timestamp: this.timestamp() });
      editingJobWrite = await this.repository.saveEditingJob(editingJob);
    }
    return {
      ...generation,
      json2: content,
      json3: { contentId: content.contentId, uploadedAssets: assets, simulation: true },
      comparison,
      assetWrites,
      resolvedRequirementWrites,
      editingJob,
      editingJobWrite,
      simulationNotice: '本次没有顾问真实媒体文件，JSON3 中的文件属性为模拟数据，未伪造飞书文件 Token。',
    };
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
