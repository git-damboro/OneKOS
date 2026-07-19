import {
  calibratedProfile,
  topicCatalog,
  matrixSamples,
  postPublishComments,
} from './data-v2.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function calibrateProfile() {
  return clone(calibratedProfile);
}

export function adjustProfileTag(profile, tagId, action) {
  const next = clone(profile);
  const tag = next.tags.find((item) => item.id === tagId);
  if (!tag) return next;

  if (action === 'lower') {
    tag.weight = Math.max(20, tag.weight - 12);
    tag.confidence = Math.max(20, tag.confidence - 8);
    tag.evidence = `${tag.evidence}；顾问主动降低权重`;
  }
  if (action === 'lock') tag.status = tag.status === 'locked' ? 'active' : 'locked';
  next.events.unshift({ time: '刚刚', type: '顾问纠偏', detail: `${tag.label}：${action === 'lower' ? '降低权重' : tag.status === 'locked' ? '已锁定' : '解除锁定'}` });
  next.updatedAt = '刚刚 · 顾问主动纠偏';
  return next;
}

export function learnFromOutcome(profile, event = {}) {
  const next = clone(profile);
  const tag = next.tags.find((item) => item.id === (event.tagId || 'local'));
  if (tag && tag.status !== 'locked') {
    tag.weight = Math.min(96, tag.weight + 6);
    tag.confidence = Math.min(98, tag.confidence + 5);
    tag.evidence = `${tag.evidence}；本轮高意向线索验证有效`;
  }
  next.maturity = Math.min(96, next.maturity + 4);
  next.stage = '已获得转化反馈';
  next.updatedAt = '刚刚 · 线索接管结果已学习';
  next.events.unshift({ time: '刚刚', type: '效果记忆', detail: event.detail || '高意向试驾线索验证了本地补能选题' });
  return next;
}

const themeRules = [
  ['补能与通勤', /家充|补能|换电|通勤|排队/],
  ['空间与第三排', /空间|第三排|六口|安全座椅|后备箱|老人/],
  ['价格与决策', /价格|预算|增程|换车|权益/],
  ['安全与结构', /安全|追尾|气囊|结构/],
];

export function analyzeSignals(comments = []) {
  const themes = themeRules.map(([label, rule]) => ({
    label,
    count: comments.filter((item) => rule.test(item.text)).length,
    examples: comments.filter((item) => rule.test(item.text)).slice(0, 2).map((item) => item.text),
  })).sort((a, b) => b.count - a.count);

  const intentCount = comments.filter((item) => /试驾|这周|周六|周日|下个月|换车|计划/.test(item.text)).length;
  const concernCount = comments.filter((item) => /别只|会不会|排不排|担心|安全/.test(item.text)).length;
  return {
    total: comments.length,
    themes,
    intentCount,
    concernCount,
    direction: themes[0]?.label === '补能与通勤'
      ? '用户不缺补能概念，缺的是成都工作日晚高峰的真实路线和等待时间。'
      : '空间讨论已经从“尺寸多大”转向“全家真实乘坐是否舒服、安全”。',
  };
}

export function routeTopics(profile, comments = []) {
  const analysis = analyzeSignals(comments);
  const profileLabels = new Set(profile.tags.filter((tag) => tag.status !== 'disabled').map((tag) => tag.label));
  return topicCatalog.map((topic) => {
    const matched = topic.profileTags.filter((label) => profileLabels.has(label));
    const demand = analysis.themes.find((item) => topic.need.includes(item.label.split('与')[0]) || item.label.includes(topic.need.split('与')[0]));
    const score = Math.min(99, topic.value + matched.length * 2 + (demand?.count || 0));
    return {
      ...topic,
      score,
      matched,
      why: `${matched.join('、')}与“${topic.matrixGap}”矩阵空白共同匹配`,
      notChosen: topic.id === 'topic-budget' ? '当前评论中的近期试驾信号弱于补能和空间问题' : '',
    };
  }).sort((a, b) => b.score - a.score);
}

export function createContentPackage(topic, profile) {
  const isCharge = topic.id === 'topic-charge-week';
  const facts = isCharge
    ? ['新乐道 L60 官方起售价需以有效知识条目为准', '补能等待时间必须由顾问现场拍摄，不由 AI 编造']
    : ['L90 第三排结构与安全气囊信息来自官方车型页', '乘坐感受必须由真实家庭成员或顾问实测补充'];
  return {
    id: `content-${topic.id}`,
    topicId: topic.id,
    title: topic.title,
    hook: isCharge
      ? '没有家充能不能选纯电？先给结论：别先看充电桩数量，先把你下班那一小时跑一遍。'
      : '六口之家选三排 SUV，别只量腿部空间：上下车、坐满后的行李和第三排安全要一起看。',
    body: isCharge
      ? '我是成都的顾问 017。今天不念补能地图，我从高新区下班出发，按真实导航完成一次换电或补能：记录绕行、等待和总用时。最后把每天 35—45 公里通勤的家庭分成三种情况，告诉你哪一种适合、哪一种先别急。'
      : '今天请一组模拟六口之家把座位坐满。我们依次看老人上下车、儿童座椅安装、第三排坐姿和行李空间，再用官方安全资料解释第三排保护。舒不舒服由真实乘员说，事实参数由知识库说。',
    facts,
    usedProfile: topic.profileTags,
    storyboard: [
      { time: '00:00–00:05', shot: '顾问正对镜头给结论', subtitle: '先给结论，不先念参数' },
      { time: '00:06–00:18', shot: isCharge ? '地图与下班路线实拍' : '全家成员依次上车', subtitle: isCharge ? '真实路线：绕行＋等待＋操作' : '上下车是否方便，先让家人说' },
      { time: '00:19–00:42', shot: isCharge ? '补能过程计时' : '第三排与行李空间实测', subtitle: '屏幕只出现可核验数据' },
      { time: '00:43–00:58', shot: '顾问按三类用户总结', subtitle: '适合谁／不适合谁' },
      { time: '00:59–01:05', shot: '门店或车辆真实环境', subtitle: '评论你的通勤或家庭情况' },
    ],
    materials: [
      { label: '顾问本人 9:16 口播', status: '待补充' },
      { label: isCharge ? '成都真实补能路线录屏' : '真实乘员上下车与乘坐镜头', status: '待补充' },
      { label: '车辆外观、座舱与门店环境', status: '待补充' },
      { label: '知识库事实引用卡片', status: '系统已准备' },
    ],
    cover: isCharge ? '没家充，先跑这条路线' : '六口坐满，第三排一起测',
    editTimeline: [
      '0–5 秒：结论开场＋大字标题',
      '6–18 秒：场景建立，保留环境原声',
      '19–42 秒：三组证据镜头，字幕标注来源',
      '43–58 秒：适用人群分层结论',
      '59–65 秒：问题型 CTA，不做价格承诺',
    ],
    replyPlan: ['补能路线问题：询问城区与日通勤里程', '家庭空间问题：询问人数、儿童座椅和老人乘坐', '试驾问题：转人工确认门店与时间'],
    cta: '把你所在城市、每天通勤里程或家庭人数留在评论区，我按真实条件给你一条到店实测清单。',
    profileMaturity: profile.maturity,
  };
}

export function inspectMatrix(content, resolved = false) {
  if (resolved) {
    return {
      risk: '低', score: 18, action: '允许进入发布确认',
      fingerprint: { topic: 22, viewpoint: 18, structure: 26, wording: 12, visual: 19, cta: 16 },
      gap: '工作日晚高峰补能路线＋总时间成本',
      title: content.title.replace('一周补能路线实测', '晚高峰补能全程计时'),
    };
  }
  const collision = matrixSamples[0];
  return {
    risk: '高', score: 82, action: '停止同角度发布，重新路由至空白场景',
    fingerprint: { topic: 91, viewpoint: 84, structure: 76, wording: 39, visual: 72, cta: 48 },
    collision,
    gap: content.topicId === 'topic-charge-week' ? '晚高峰真实等待时间' : '老人上下车＋第三排安全结构',
    title: content.title,
  };
}

export function runFourChecks(content, matrixResult) {
  const hasPricePromise = /最低|保证|一定|闭眼/.test(`${content.title}${content.hook}${content.body}`);
  return {
    fact: 96,
    compliance: hasPricePromise ? 62 : 95,
    persona: 92,
    matrix: matrixResult.risk === '低' ? 94 : 58,
    passed: !hasPricePromise && matrixResult.risk === '低',
    issues: [
      ...(hasPricePromise ? ['存在绝对化承诺，需要改为条件化表达'] : []),
      ...(matrixResult.risk !== '低' ? ['与矩阵既有内容在选题、观点或视觉上过度接近'] : []),
    ],
  };
}

export function simulatePublication(content) {
  return {
    id: `pub-${content.topicId}`,
    status: '本地模拟发布成功',
    publishedAt: '刚刚',
    metrics: { views: 23840, likes: 1186, comments: 94, shares: 207, favorites: 356 },
    comments: clone(postPublishComments),
  };
}

function field(text, pattern, fallback = '待确认') {
  return text.match(pattern)?.[1] || fallback;
}

export function extractSalesLeads(comments = []) {
  return comments.map((comment) => {
    const city = field(comment.text, /(成都|高新区|德阳)/);
    const model = field(comment.text, /(L60|L90)/);
    const purchaseWindow = /这周|周日|试驾/.test(comment.text) ? '7 天内' : /下个月/.test(comment.text) ? '30 天内' : /明年/.test(comment.text) ? '长期关注' : '待确认';
    const testDrive = /试驾|约/.test(comment.text) ? '强' : /换车|计划|适合吗/.test(comment.text) ? '中' : '弱';
    const score = (testDrive === '强' ? 45 : testDrive === '中' ? 26 : 8) + (purchaseWindow === '7 天内' ? 30 : purchaseWindow === '30 天内' ? 18 : 4) + (city !== '待确认' ? 12 : 0) + (model !== '待确认' ? 10 : 0);
    return {
      id: `lead-${comment.id}`, user: comment.user, sourceComment: comment.text, city, model,
      family: /家庭|家里/.test(comment.text) ? '家庭用户' : '待确认', purchaseWindow, testDrive,
      score, grade: score >= 75 ? 'A' : score >= 45 ? 'B' : 'C',
      confidence: Math.min(96, score + 12),
      nextAction: score >= 75 ? '顾问人工确认门店、时间与试驾重点' : score >= 45 ? '补问家庭人数和日常用车条件' : '进入长期内容培育',
    };
  }).sort((a, b) => b.score - a.score);
}
