const clone = (value) => JSON.parse(JSON.stringify(value));

export const BITABLE_TABLES = [
  'advisors',
  'profileTags',
  'brandKnowledge',
  'contentTasks',
  'contentResults',
  'commentLeads',
  'feedbackEvents',
];

const simulation = true;

const dataset = {
  advisors: [
    {
      advisorId: 'ADV-017',
      displayName: '顾问 017',
      city: '成都',
      store: '成都区域模拟门店',
      experienceYears: 4,
      targetAudience: '城市通勤与多成员家庭',
      profileMaturity: 78,
      authorizationStatus: '仅使用生成的模拟资料',
      workflowStatus: '已校准',
      simulation,
    },
  ],
  profileTags: [
    {
      tagId: 'TAG-001', advisorId: 'ADV-017', dimension: '地域经验', label: '成都本地补能',
      weight: 91, confidence: 94, source: '模拟历史内容＋顾问确认',
      evidence: '18 条模拟历史内容中 7 条涉及成都通勤与补能，顾问在偏好校准中确认',
      status: '生效', updatedAt: '2026-08-03 09:15', simulation,
    },
    {
      tagId: 'TAG-002', advisorId: 'ADV-017', dimension: '表达方式', label: '先结论后解释',
      weight: 86, confidence: 89, source: '60 秒模拟语音转写＋编辑行为',
      evidence: '最近 6 次模拟轻改均保留结论式开场，并删除过长铺垫',
      status: '生效', updatedAt: '2026-08-03 09:15', simulation,
    },
    {
      tagId: 'TAG-003', advisorId: 'ADV-017', dimension: '证据偏好', label: '实车场景证明',
      weight: 83, confidence: 87, source: '模拟发布表现',
      evidence: '带路线计时和乘坐实测的模拟内容，合格线索率高于参数口播样本',
      status: '生效', updatedAt: '2026-08-03 09:15', simulation,
    },
    {
      tagId: 'TAG-004', advisorId: 'ADV-017', dimension: '目标用户', label: '多成员家庭决策',
      weight: 76, confidence: 82, source: '模拟评论与线索结果',
      evidence: '近 30 条模拟评论中 11 条涉及老人、儿童座椅和第三排',
      status: '待继续验证', updatedAt: '2026-08-03 09:15', simulation,
    },
  ],
  brandKnowledge: [
    {
      knowledgeId: 'KB-L60-001', model: '乐道 L60', field: '车身尺寸与轴距',
      value: '4828×1930×1616mm，轴距 2950mm', version: '官方用户手册当前版本',
      source: '乐道 L60 官方用户手册', sourceUrl: 'https://cdn-up-public.onvo.cn/www-alps-cn/user-instructions/L60/index.html',
      checkedAt: '2026-08-03', validUntil: '2026-12-31', status: '有效', simulation,
    },
    {
      knowledgeId: 'KB-L90-001', model: '乐道 L90', field: '第三排安全结构',
      value: '全铝后部防护体系，全车标配 9 个安全气囊', version: '官方车型页当前版本',
      source: '乐道 L90 官方车型页', sourceUrl: 'https://www.onvo.cn/l90',
      checkedAt: '2026-08-03', validUntil: '2026-12-31', status: '有效', simulation,
    },
  ],
  contentTasks: [
    {
      taskId: 'TASK-001', advisorId: 'ADV-017', taskDate: '2026-08-03',
      userQuestion: '没有家充、每天通勤 42 公里，一周补能几次更现实？',
      topic: '成都工作日晚高峰补能路线全程计时', targetModel: '乐道 L60',
      routeScore: 96, profileEvidence: ['TAG-001', 'TAG-002', 'TAG-003'],
      matrixGap: '工作日晚高峰真实等待时间', status: '待生成', simulation,
    },
    {
      taskId: 'TASK-002', advisorId: 'ADV-017', taskDate: '2026-08-03',
      userQuestion: '一家六口坐满后，老人上下车和第三排安全怎么判断？',
      topic: '六口之家第三排上车、乘坐与安全实测', targetModel: '乐道 L90',
      routeScore: 91, profileEvidence: ['TAG-002', 'TAG-003', 'TAG-004'],
      matrixGap: '老人上下车＋第三排结构证据', status: '候选', simulation,
    },
  ],
  contentResults: [
    {
      contentId: 'CONTENT-001', taskId: 'TASK-001', title: '没家充，先跑完这条晚高峰路线',
      hook: '别先看充电桩数量，先把你下班那一小时跑一遍。',
      script: '从成都高新区下班出发，按真实导航记录绕行、等待和补能总用时，再按日通勤里程给出条件化建议。',
      storyboard: ['结论开场', '路线录屏', '补能计时', '三类家庭总结', '问题型 CTA'],
      materials: ['顾问本人竖屏口播', '成都真实路线录屏', '补能过程计时', '车辆与门店环境'],
      factRefs: ['KB-L60-001'], profileRefs: ['TAG-001', 'TAG-002', 'TAG-003'],
      factScore: 96, complianceScore: 95, personaScore: 92, matrixScore: 94,
      status: '待顾问补真实素材', simulation,
    },
  ],
  commentLeads: [
    {
      leadId: 'LEAD-001', commentId: 'COMMENT-003', advisorId: 'ADV-017', contentId: 'CONTENT-001',
      platform: '抖音（模拟）', sourceUser: '锦城小周（模拟）',
      sourceText: '我在高新区，这周六想带家里人试驾 L90，能不能重点试一下第三排？',
      city: '成都高新区', familyStructure: '带家人到店，具体人数待确认', model: 'L90',
      purchaseWindow: '7 天内', testDriveIntent: '强', leadScore: 88, leadGrade: 'A',
      fieldEvidence: {
        city: '原评论“高新区”', model: '原评论“L90”', purchaseWindow: '原评论“这周六”', testDriveIntent: '原评论“想…试驾”',
      },
      nextAction: '顾问人工确认门店、时间、家庭人数与第三排试驾重点',
      status: '待人工接管', authorizationStatus: '未接入真实账号', lastSyncedAt: '2026-08-03 10:30（模拟）', simulation,
    },
    {
      leadId: 'LEAD-002', commentId: 'COMMENT-006', advisorId: 'ADV-017', contentId: 'CONTENT-001',
      platform: '抖音（模拟）', sourceUser: '德阳陈先生（模拟）',
      sourceText: '下个月换车，L60 和同价位增程还没决定，成都周边补能方便吗？',
      city: '德阳', familyStructure: '待确认', model: 'L60', purchaseWindow: '30 天内',
      testDriveIntent: '中', leadScore: 63, leadGrade: 'B',
      fieldEvidence: {
        city: '原评论“德阳”', model: '原评论“L60”', purchaseWindow: '原评论“下个月”', testDriveIntent: '未明确提出试驾',
      },
      nextAction: '先补问日常通勤里程和家庭用车条件，再决定是否邀请试驾',
      status: '待补充信息', authorizationStatus: '未接入真实账号', lastSyncedAt: '2026-08-03 10:30（模拟）', simulation,
    },
  ],
  feedbackEvents: [
    {
      eventId: 'EVENT-001', advisorId: 'ADV-017', sourceRecordId: 'COMMENT-003', eventType: '高意向线索验证',
      affectedTagId: 'TAG-004', weightDelta: 6,
      evidence: '模拟用户明确提出近期带家人试驾，验证家庭场景内容具备转化价值',
      createdAt: '2026-08-03 10:45', status: '待顾问确认后学习', simulation,
    },
    {
      eventId: 'EVENT-002', advisorId: 'ADV-017', sourceRecordId: 'CONTENT-001', eventType: '顾问轻改采用',
      affectedTagId: 'TAG-002', weightDelta: 2,
      evidence: '顾问保留结论式开场，仅修改两处口语表达',
      createdAt: '2026-08-03 10:10', status: '已写回画像', simulation,
    },
  ],
};

export function createFeishuPocDataset() {
  return clone(dataset);
}

export function createInitialWorkflowState(advisorId) {
  return { advisorId, stage: '待校准', taskId: null, contentId: null, leadId: null, history: [] };
}

const transitions = {
  待校准: { PROFILE_CALIBRATED: '待选题' },
  待选题: { TOPIC_ROUTED: '待生成' },
  待生成: { CONTENT_GENERATED: '待质检' },
  待质检: { QUALITY_PASSED: '可发布' },
  可发布: { LEAD_IDENTIFIED: '待接管' },
  待接管: { LEAD_TAKEN_OVER: '跟进中' },
  跟进中: { OUTCOME_RECORDED: '已学习' },
};

export function applyFeishuWorkflowEvent(currentState, event) {
  const nextStage = transitions[currentState.stage]?.[event.type];
  if (!nextStage) throw new Error(`非法工作流转换：${currentState.stage} -> ${event.type}`);

  const next = clone(currentState);
  next.stage = nextStage;
  if (event.taskId) next.taskId = event.taskId;
  if (event.contentId) next.contentId = event.contentId;
  if (event.leadId) next.leadId = event.leadId;
  next.history.push({ type: event.type, stage: nextStage });
  return next;
}
