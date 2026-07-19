import { topicCatalog, publishReplies } from './data.mjs';

const NEEDS = [
  { key: 'space', label: '家庭空间', words: ['空间', '后排', '第三排', '二排', '后备箱', '安全座椅', '婴儿车', '二胎', '一家五口', '储物'] },
  { key: 'charging', label: '充电补能', words: ['充电', '家充', '补能', '充电桩', '快充', '排队', '固定车位'] },
  { key: 'range', label: '真实续航', words: ['续航', '掉电', '能耗', '低温', '冬天', '高速', '川西', '海拔'] },
  { key: 'price', label: '预算权益', words: ['价格', '优惠', '预算', '权益', '成本', '省多少', '贷款'] },
  { key: 'safety', label: '安全配置', words: ['安全', '刹车', '碰撞', '电池安全'] },
  { key: 'policy', label: '置换政策', words: ['置换', '补贴', '牌照', '政策'] },
];

const POSITIVE_WORDS = ['实用', '不错', '靠谱', '清楚', '喜欢', '满意', '直观', '有用', '收藏', '认真'];
const NEGATIVE_WORDS = ['挤', '担心', '焦虑', '不敢', '太快', '排队', '难受', '怕', '问题'];
const ABSOLUTE_WORDS = ['全网最低价', '闭眼买', '一定', '保证', '所有家庭都满意', '绝对', '百分之百'];

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function countSentiment(comments) {
  return comments.reduce(
    (totals, comment) => {
      const text = comment.text ?? '';
      if (includesAny(text, POSITIVE_WORDS)) totals.positive += 1;
      else if (includesAny(text, NEGATIVE_WORDS)) totals.negative += 1;
      else totals.neutral += 1;
      return totals;
    },
    { positive: 0, neutral: 0, negative: 0 },
  );
}

export function analyzeComments(comments = []) {
  const safeComments = Array.isArray(comments) ? comments : [];
  const topNeeds = NEEDS.map((need) => {
    const matched = safeComments.filter((comment) => includesAny(comment.text ?? '', need.words));
    return {
      key: need.key,
      label: need.label,
      count: matched.length,
      heat: matched.reduce((sum, comment) => sum + 1 + Math.min(5, Math.round((comment.likes ?? 0) / 20)), 0),
      examples: matched.slice(0, 2).map((comment) => comment.text),
    };
  })
    .filter((need) => need.count > 0)
    .sort((a, b) => b.count - a.count || b.heat - a.heat);

  const sentiment = countSentiment(safeComments);
  const total = safeComments.length;
  const top = topNeeds[0] ?? { label: '真实用车', count: 0 };
  const intentionCount = safeComments.filter((comment) => /试驾|到店|准备定|换车|买车|预约/.test(comment.text ?? '')).length;
  const positiveRate = total ? Math.round((sentiment.positive / total) * 100) : 0;

  return {
    total,
    sentiment,
    positiveRate,
    topNeeds,
    intentionCount,
    direction: `评论区风向整体理性偏积极，“${top.label}”讨论最集中；建议用真实场景回应质疑，并在结尾承接${intentionCount}条潜在购车意向。`,
    risk: sentiment.negative > sentiment.positive ? '质疑声量较高，需优先澄清边界条件' : '未发现集中负面舆情，适合顺势深化选题',
  };
}

export function rankTopics(analysis = {}, advisor = {}) {
  const demand = new Map((analysis.topNeeds ?? []).map((item) => [item.key, item.count]));
  const strengths = advisor.strengths ?? [];

  return topicCatalog
    .map((topic) => {
      const demandCount = demand.get(topic.id) ?? 0;
      const personaMatch = strengths.includes(topic.strength) ? 12 : 4;
      const score = Math.min(99, 58 + demandCount * 3 + personaMatch + topic.potential);
      return {
        ...topic,
        score,
        demandCount,
        reason: `${demandCount || '少量'}条相关评论 · ${topic.strength}人设匹配 · ${topic.format}形式`,
      };
    })
    .sort((a, b) => b.score - a.score || b.potential - a.potential)
    .slice(0, 3);
}

const SCRIPT_CONTENT = {
  space: {
    hook: '二胎家庭选车，别先看轴距。把两个安全座椅和一辆婴儿车放进去，答案马上就出来。',
    points: ['两个安全座椅安装后的中间座位', '第三排成年人短途乘坐姿态', '婴儿车与露营装备共同装载'],
    fact: 'A7后备箱官方容积为532升，实际装载仍需结合物品尺寸。',
  },
  charging: {
    hook: '没有家充，纯电车不是一定不能买，但先把每周补能时间算清楚。',
    points: ['一周真实通勤里程', '公司与商圈可用充电点', '高峰排队和每月补能成本'],
    fact: 'A7官方资料显示，30%—80%快充时间约26分钟，实际受温度与桩功率影响。',
  },
  range: {
    hook: '成都到川西，真正影响续航的不是一个“打几折”，而是速度、温度和海拔三件事。',
    points: ['出发气温与满载状态', '高速100和120公里时速能耗差异', '返程补能点与安全余量'],
    fact: 'A7官方CLTC续航为620公里，长途规划应以真实路况和安全余量为准。',
  },
  price: {
    hook: '预算25万，裸车价只是一部分，保险、补能和保值也要放进同一张表。',
    points: ['官方指导价与门店公示权益', '首年保险及金融成本', '三年补能与保养支出'],
    fact: 'A7当前官方指导价为21.98万元起，具体成交权益以门店当日公示为准。',
  },
  safety: {
    hook: '带孩子出行，我不会先背配置表，而是先检查四个每天都用得到的安全细节。',
    points: ['安全座椅接口与安装空间', '车门儿童锁与上下车提醒', '主动刹车边界条件'],
    fact: '驾驶辅助配置不能替代驾驶员观察和控制。',
  },
  policy: {
    hook: '成都家庭准备置换新能源车，先别急着卖旧车，这三份材料会影响后面的流程。',
    points: ['旧车登记与持有时间', '补贴申请主体一致性', '发票与交付时间节点'],
    fact: '政策信息存在时效性，申请前应以主管部门最新公告为准。',
  },
};

export function generateScript(topic = {}, advisor = {}) {
  const content = SCRIPT_CONTENT[topic.id] ?? SCRIPT_CONTENT.space;
  const name = advisor.name ?? '顾问';
  const city = advisor.city ?? '本地';
  const points = content.points.map((point, index) => `${index + 1}）${point}`).join('；');
  const body = `我是${name}，在${city}做新能源产品顾问。先给结论：这件事没有统一答案，要看你的真实使用条件。今天只拆三个场景：${points}。${content.fact} 如果你的条件和视频里不同，把每天里程、居住区域和家庭人数留在评论区，我按你的场景一起算。`;

  return {
    topicId: topic.id ?? 'space',
    title: topic.title ?? '把真实用车问题讲清楚',
    target: '25—40岁本地家庭用户',
    duration: '60—75秒',
    hook: content.hook,
    body,
    shots: [
      { time: '0—5秒', frame: '顾问正面近景＋问题大字', line: content.hook, asset: '顾问口播' },
      { time: '6—20秒', frame: '真实场景一，手持镜头', line: content.points[0], asset: '实车素材' },
      { time: '21—40秒', frame: '场景二、三快速切换', line: `${content.points[1]}；${content.points[2]}`, asset: '对比镜头' },
      { time: '41—58秒', frame: '参数卡片＋来源角标', line: content.fact, asset: '知识库卡片' },
      { time: '59—70秒', frame: '顾问回到镜头前', line: '留下你的真实条件，我按场景回答。', asset: '评论引导' },
    ],
    materials: ['顾问竖屏口播', '实车场景素材3组', '带来源的事实卡片', '门店或本地场景空镜'],
    titles: [topic.title ?? '真实用车问题拆解', `评论区问得最多的事，我在${city}实测了`, `${city}家庭用户选车前，先看这个场景`],
    commentPlan: ['置顶：留下城市＋每天里程＋家庭人数，我帮你匹配真实场景。', '追问：最近三个月内是否计划试驾或换车？', '争议回应：参数是参考，视频结论只对明确测试条件负责。'],
    cta: '评论区留下“城市＋家庭人数＋购车时间”，需要试驾路线的回复“试驾”。',
    factRefs: [content.fact],
  };
}

function allText(script) {
  return [script.title, script.hook, script.body].filter(Boolean).join(' ');
}

function replaceUnsafeText(text, knowledgeBase) {
  const officialPrice = knowledgeBase.find((item) => item.field.includes('指导价'))?.value ?? '官方公示价格';
  return (text ?? '')
    .replaceAll('全网最低价', '结合当前门店公示权益看')
    .replaceAll('闭眼买', '建议结合真实需求理性选择')
    .replaceAll('一定达到700公里', '官方标称续航需结合实际路况理解')
    .replaceAll('保证所有家庭都满意', '更适合重视家庭场景的用户')
    .replaceAll('19.98万元', officialPrice)
    .replace(/(?<!不是)(?<!不)一定/g, '在明确条件下通常');
}

export function runQualityCheck(script = {}, knowledgeBase = []) {
  const text = allText(script);
  const issues = [];
  const numericClaimPattern = /\d+(?:\.\d+)?(?:公里|万元|分钟|%|升)/g;
  const officialClaims = new Set(
    knowledgeBase.flatMap((item) => item.value.match(numericClaimPattern) ?? []),
  );
  const numericClaims = text.match(numericClaimPattern) ?? [];

  numericClaims.forEach((claim) => {
    if (!officialClaims.has(claim)) {
      issues.push({ type: '事实', severity: '高', text: `“${claim}”未在当前知识库中找到一致来源`, suggestion: '改为带来源的官方口径或删除精确数值' });
    }
  });

  ABSOLUTE_WORDS.forEach((word) => {
    const found = word === '一定' ? /(?<!不是)(?<!不)一定/.test(text) : text.includes(word);
    if (found) {
      issues.push({ type: '合规', severity: '高', text: `包含绝对化表达“${word}”`, suggestion: '改为有条件、可验证的描述' });
    }
  });

  if (!/我|真实|场景|评论区/.test(text)) {
    issues.push({ type: '人设', severity: '中', text: '缺少顾问个人经验或真实场景表达', suggestion: '补充第一人称经验和本地场景' });
  }
  if (/必看|一定要买|不买后悔/.test(script.title ?? '')) {
    issues.push({ type: '矩阵', severity: '中', text: '标题结构与常见营销内容过于相似', suggestion: '改为具体人群与具体场景' });
  }

  const count = (type) => issues.filter((issue) => issue.type === type).length;
  const scores = {
    fact: Math.max(55, 98 - count('事实') * 18),
    compliance: Math.max(55, 98 - count('合规') * 14),
    persona: Math.max(68, 94 - count('人设') * 20),
    matrix: Math.max(70, 92 - count('矩阵') * 18),
  };

  return {
    scores,
    issues,
    passed: issues.filter((issue) => issue.severity === '高').length === 0,
    optimized: {
      ...script,
      title: replaceUnsafeText(script.title, knowledgeBase),
      hook: replaceUnsafeText(script.hook, knowledgeBase),
      body: replaceUnsafeText(script.body, knowledgeBase),
    },
    summary: issues.length ? `发现${issues.length}项可优化内容，已生成安全改写。` : '四项检查通过，可以进入发布确认。',
  };
}

export function canPublish(qualityResult) {
  return qualityResult?.passed === true && (qualityResult.issues?.length ?? 0) === 0;
}

export function simulatePublish(topic = {}) {
  const multipliers = { charging: 1.16, space: 1.08, range: 1.12, price: 1.04, safety: 1, policy: 0.96 };
  const multiplier = multipliers[topic.id] ?? 1;
  return {
    publishedAt: '2026-07-19 20:08',
    status: '模拟发布成功',
    predicted: {
      views: Math.round(38600 * multiplier),
      likes: Math.round(2310 * multiplier),
      favorites: Math.round(920 * multiplier),
      shares: Math.round(430 * multiplier),
      comments: Math.round(286 * multiplier),
      qualifiedLeads: Math.round(24 * multiplier),
    },
    newComments: publishReplies[topic.id] ?? publishReplies.space,
    learning: '“本地场景＋明确条件”的内容更容易形成收藏和高意向追问，建议下一条延展为用户案例。',
  };
}

function findCity(text) {
  return ['成都', '重庆', '绵阳', '德阳', '乐山', '眉山'].find((city) => text.includes(city)) ?? '未识别';
}

function findFamily(text) {
  if (/二胎|两个孩子/.test(text)) return '二胎家庭';
  if (/一家五口|带父母|三代/.test(text)) return '三代同堂';
  if (/孩子|安全座椅|婴儿车|接送/.test(text)) return '有孩家庭';
  return '未识别';
}

function findPurchaseWindow(text) {
  if (/这周|周六|最近|马上|准备定/.test(text)) return '7天内';
  if (/下个月|月底|这个月/.test(text)) return '30天内';
  if (/三个月/.test(text)) return '3个月内';
  if (/明年|先了解|先看看/.test(text)) return '长期关注';
  return '待确认';
}

export function extractLeads(comments = []) {
  return comments.map((comment) => {
    const text = comment.text ?? '';
    const city = findCity(text);
    const family = findFamily(text);
    const model = text.match(/(?:A7|B6|C9)/)?.[0] ?? '未识别';
    const purchaseWindow = findPurchaseWindow(text);
    const testDriveIntent = /试驾|到店|预约|安排/.test(text) ? '强' : /看车|想看/.test(text) ? '中' : '弱';
    let score = 5;
    if (city !== '未识别') score += 15;
    if (family !== '未识别') score += 15;
    if (model !== '未识别') score += 15;
    if (purchaseWindow === '7天内') score += 25;
    else if (purchaseWindow === '30天内') score += 15;
    else if (purchaseWindow === '3个月内') score += 8;
    if (testDriveIntent === '强') score += 30;
    else if (testDriveIntent === '中') score += 12;
    score = Math.min(100, score);
    const grade = score >= 70 ? 'A' : score >= 40 ? 'B' : 'C';
    const nextAction = grade === 'A' ? '15分钟内人工接管，确认试驾时间' : grade === 'B' ? '私信补充预算与用车条件' : '持续内容培育';

    return {
      id: `lead-${comment.id ?? Math.random().toString(36).slice(2, 8)}`,
      user: comment.user ?? '抖音用户',
      sourceComment: text,
      city,
      family,
      model,
      purchaseWindow,
      testDriveIntent,
      score,
      grade,
      nextAction,
      status: '待跟进',
    };
  });
}
