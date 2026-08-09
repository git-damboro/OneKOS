export const advisorSeed = {
  id: 'advisor-demo-001',
  name: '顾问 017',
  city: '成都',
  store: '成都高新区体验中心（模拟）',
  experience: '5 年汽车销售经验',
  target: '成都及周边家庭购车用户',
  disclosure: '匿名模拟顾问，不对应任何真实员工',
};

export const onboardingSources = [
  { id: 'base', label: '基础资料', detail: '地域、经验、擅长问题、目标用户', count: '8 项', status: 'ready' },
  { id: 'history', label: '历史内容', detail: '授权导入标题、脚本及发布表现', count: '18 条', status: 'ready' },
  { id: 'voice', label: '语音样例', detail: '识别节奏、句式与常用表达', count: '60 秒', status: 'ready' },
  { id: 'preference', label: '偏好选择', detail: '结论/故事、参数/场景成对选择', count: '6 组', status: 'ready' },
];

export const initialProfile = {
  maturity: 32,
  stage: '待校准',
  updatedAt: '尚未完成首次校准',
  tags: [
    { id: 'family', dimension: '专业能力', label: '家庭用车需求拆解', weight: 48, confidence: 42, source: '基础资料', evidence: '自述擅长家庭用车咨询', status: 'active' },
    { id: 'local', dimension: '地域场景', label: '成都本地补能', weight: 44, confidence: 40, source: '基础资料', evidence: '服务区域为成都高新区', status: 'active' },
    { id: 'direct', dimension: '表达方式', label: '先结论后解释', weight: 38, confidence: 34, source: '偏好问卷', evidence: '2 次选择结论优先', status: 'active' },
    { id: 'scene', dimension: '证据偏好', label: '真实场景证明', weight: 36, confidence: 30, source: '基础资料', evidence: '缺少历史作品交叉验证', status: 'active' },
  ],
  events: [],
};

export const calibratedProfile = {
  maturity: 74,
  stage: '可用于任务路由',
  updatedAt: '刚刚 · 模拟校准完成',
  tags: [
    { id: 'family', dimension: '专业能力', label: '家庭用车需求拆解', weight: 86, confidence: 91, source: '基础资料＋历史内容', evidence: '18 条历史内容中 11 条围绕家庭空间、安全与补能', status: 'active' },
    { id: 'local', dimension: '地域场景', label: '成都本地补能', weight: 78, confidence: 88, source: '历史内容＋服务区域', evidence: '7 条内容涉及高新区通勤及成都补能路线', status: 'active' },
    { id: 'direct', dimension: '表达方式', label: '先结论后解释', weight: 82, confidence: 90, source: '语音＋偏好选择', evidence: '60 秒语音中 4 次先给结论，6 组偏好中 5 次选择结论优先', status: 'active' },
    { id: 'scene', dimension: '证据偏好', label: '实车场景证明', weight: 76, confidence: 84, source: '历史内容＋编辑行为', evidence: '历史脚本高频保留实测镜头，删除空泛形容词', status: 'active' },
    { id: 'compare', dimension: '内容形式', label: '问题拆解与对比', weight: 69, confidence: 79, source: '历史内容表现', evidence: '问题拆解类内容平均收藏率高于账号均值 21%（模拟）', status: 'active' },
    { id: 'family-user', dimension: '目标用户', label: '家庭增换购用户', weight: 73, confidence: 82, source: '评论与线索', evidence: '历史高意向评论主要关注空间、补能与老人儿童乘坐', status: 'active' },
    { id: 'conversion', dimension: '转化能力', label: '试驾问题承接', weight: 61, confidence: 72, source: '跟进记录', evidence: '擅长把场景问题转为到店实测邀请（模拟）', status: 'active' },
  ],
  events: [
    { time: '首次校准', type: '显式信息', detail: '完成基础资料与 6 组偏好选择' },
    { time: '首次校准', type: '历史证据', detail: '模拟解析 18 条历史内容及修改痕迹' },
    { time: '首次校准', type: '表达证据', detail: '模拟解析 60 秒语音节奏与句式' },
  ],
};

export const brandKnowledge = [
  {
    id: 'l60-price', model: '新乐道 L60', field: '整车购买起售价', value: '19.28 万元起',
    source: '乐道官网｜2026-06-11 新乐道 L60 上市信息', sourceUrl: 'https://www.onvo.cn/news/20260611001',
    checkedAt: '2026-07-19', validUntil: '2026-08-31', status: '有效',
  },
  {
    id: 'l60-size', model: '乐道 L60', field: '车身尺寸与轴距', value: '4828×1930×1616mm，轴距 2950mm',
    source: '乐道 L60 官方用户手册', sourceUrl: 'https://cdn-up-public.onvo.cn/www-alps-cn/user-instructions/L60/index.html',
    checkedAt: '2026-07-19', validUntil: '2026-12-31', status: '有效',
  },
  {
    id: 'l90-range', model: '2026 款乐道 L90', field: 'CLTC 综合续航', value: '后驱 600km，四驱 570km',
    source: '乐道官网｜2026-04-21 L90 上市信息', sourceUrl: 'https://www.onvo.cn/news/20260421001',
    checkedAt: '2026-07-19', validUntil: '2026-12-31', status: '有效',
  },
  {
    id: 'l90-safety', model: '乐道 L90', field: '第三排安全结构', value: '全铝后部防护体系，全车标配 9 个安全气囊',
    source: '乐道 L90 官方车型页', sourceUrl: 'https://www.onvo.cn/l90',
    checkedAt: '2026-07-19', validUntil: '2026-12-31', status: '有效',
  },
];

export const historicVideos = [
  {
    id: 'v-l90-space', model: 'L90', title: '三排都坐人时，后备箱还能装下一家人的周末行李吗？',
    publishedAt: '07-16 18:32', duration: '01:12',
    metrics: { views: 86320, likes: 4286, comments: 386, shares: 741, favorites: 1250, completion: 43.6 },
  },
  {
    id: 'v-l60-charge', model: 'L60', title: '没有家充先别急着劝退：成都通勤一周补能怎么安排',
    publishedAt: '07-13 12:08', duration: '00:58',
    metrics: { views: 61480, likes: 3017, comments: 274, shares: 438, favorites: 987, completion: 47.2 },
  },
  {
    id: 'v-l90-third-row', model: 'L90', title: '老人坐第三排难不难？看上下车、坐姿和晕车感受',
    publishedAt: '07-09 20:16', duration: '01:26',
    metrics: { views: 47560, likes: 2189, comments: 211, shares: 396, favorites: 654, completion: 39.8 },
  },
];

export const commentSamples = [
  { id: 'c01', user: '西门通勤族', videoId: 'v-l60-charge', text: '住成都西门，小区装不了家充，每天来回 42 公里，L60 一周补几次比较现实？', likes: 82, time: '18分钟前' },
  { id: 'c02', user: '二胎爸爸阿诚', videoId: 'v-l90-space', text: '两个安全座椅加老人，一家六口周末出门，L90 第三排长期坐会不会累？', likes: 66, time: '31分钟前' },
  { id: 'c03', user: '锦城小周', videoId: 'v-l90-space', text: '我在高新区，这周六想带家里人试驾 L90，能不能重点试一下第三排？', likes: 51, time: '42分钟前' },
  { id: 'c04', user: '理性买车人', videoId: 'v-l60-charge', text: '别只说三分钟换电，想看工作日晚高峰到底排不排队。', likes: 48, time: '1小时前' },
  { id: 'c05', user: '小满妈妈', videoId: 'v-l90-space', text: '这种把行李真的装进去的视频比念参数有用，收藏等下次去店里看。', likes: 37, time: '1小时前' },
  { id: 'c06', user: '德阳陈先生', videoId: 'v-l60-charge', text: '下个月换车，L60 和同价位增程还没决定，成都周边补能方便吗？', likes: 28, time: '2小时前' },
  { id: 'c07', user: '路过看看', videoId: 'v-l90-space', text: '现在车还能开，先了解一下，明年再考虑。', likes: 5, time: '3小时前' },
  { id: 'c08', user: '安全第一', videoId: 'v-l90-third-row', text: '第三排离车尾近，发生追尾时有什么结构保护？希望别只讲空间。', likes: 44, time: '4小时前' },
];

export const topicCatalog = [
  {
    id: 'topic-charge-week', title: '没有家充的成都通勤家庭，一周补能路线实测',
    model: 'L60', need: '补能与日常通勤', profileTags: ['成都本地补能', '先结论后解释', '实车场景证明'],
    matrixGap: '工作日晚高峰实测', value: 93,
  },
  {
    id: 'topic-third-row', title: '六口之家坐满 L90：第三排舒适与安全一起测',
    model: 'L90', need: '家庭空间与第三排安全', profileTags: ['家庭用车需求拆解', '实车场景证明', '问题拆解与对比'],
    matrixGap: '老人上下车＋第三排安全', value: 91,
  },
  {
    id: 'topic-budget', title: '20 万级家庭纯电怎么选：把固定支出和补能条件先列清楚',
    model: 'L60', need: '预算与使用条件', profileTags: ['先结论后解释', '问题拆解与对比', '家庭增换购用户'],
    matrixGap: '家庭决策清单', value: 84,
  },
];

export const matrixSamples = [
  { id: 'm01', account: '区域账号 03', topic: 'L90 三排空间', angle: '一家六口坐满实测', structure: '问题—装载—结论', visual: '门店静态实拍', cta: '评论车型', similarity: 91 },
  { id: 'm02', account: '顾问账号 128', topic: 'L90 三排空间', angle: '第三排成年人体验', structure: '开门见山—乘坐—结论', visual: '第三排定机位', cta: '预约试驾', similarity: 78 },
  { id: 'm03', account: '顾问账号 364', topic: '成都补能', angle: '没有家充怎么办', structure: '痛点—站点—建议', visual: '补能地图', cta: '私信路线', similarity: 64 },
];

export const postPublishComments = [
  { id: 'p01', user: '成都阿南', text: '我在高新区，每天通勤 35 公里，没有家充，这周日可以约 L60 试驾顺便看看换电吗？', likes: 17, time: '刚刚' },
  { id: 'p02', user: '橙子汽水', text: '把晚高峰排队时间拍出来很真实，路线先收藏了。', likes: 11, time: '1分钟前' },
  { id: 'p03', user: '德阳小陈', text: '下个月计划换车，公司能充但家里不能装，L60 适合吗？', likes: 8, time: '2分钟前' },
  { id: 'p04', user: '等等看', text: '先看看，明年充换电站更多一点再说。', likes: 3, time: '4分钟前' },
];

export const implementationGuides = {
  dashboard: {
    title: 'AI 内容团队与低负担工作台', simulated: '今日任务、节省时间、互动和线索均为连续的模拟经营数据。',
    sources: '正式版由飞书任务、内容台账、抖音获授权指标与 CRM 结果汇总。', components: '飞书 Aily、机器人卡片、多维表格、定时工作流。',
    processing: '每天定时生成少量任务，把顾问操作压缩为补素材、轻改和确认。', boundary: 'AI 不代替顾问承诺价格、权益或联系客户。',
  },
  profile: {
    title: '动态顾问画像', simulated: '模拟完成 8 道基础题、2—4 道自适应追问和 1 道短文表达题。',
    sources: '正式版只读取顾问主动填写的身份与问卷答案，并记录每个画像词的题目和答案证据。', components: 'Web/飞书问卷卡片、OneKOS 规则引擎、多维表格与可选模型提炼。',
    processing: '规则计算选择题画像词，短文题优先由模型提炼并在不可用时本地降级；采用、修改和拒绝持续更新权重。', boundary: '画像词可删除、降低或锁定；不推断敏感属性，最终结果必须由顾问确认。',
  },
  topics: {
      title: '机会雷达与一题千解', simulated: '本地模式读取可写入 Repository 的画像、内容任务、评论线索和历史内容，不再展示预设热度与模拟矩阵数量。',
      sources: '生产模式从飞书多维表格读取总部任务、顾问画像、获授权评论线索与内容成果。', components: 'OneKOS 服务、可解释评分规则、多维表格与顾问决策接口。',
      processing: '按画像匹配 45%、需求证据 30%、矩阵空白 25% 实时重算；接受或拒绝均写回任务，拒绝同时生成待确认反馈事件。', boundary: '只推荐当前仓库中可用的真实业务记录；无数据时明确显示空状态，不生成虚假趋势。',
  },
  studio: {
    title: '脚本与剪辑准备', simulated: '脚本、分镜、字幕、封面和时间轴由本地规则生成。',
    sources: '正式版从有效品牌知识、顾问原话和待补真实素材生成结构化内容包。', components: 'Aily、大模型、飞书知识库、文档与机器人卡片。',
    processing: '事实核负责参数与政策，人格壳负责语言、经历和目标用户表达。', boundary: '不得编造顾问经历；视频渲染需另接剪辑工具，顾问确认后才发布。',
  },
  quality: {
    title: '四重质检与回声室治理', simulated: '矩阵相似度和空白场景来自 36 个模拟账号、近 14 天 214 条内容。',
    sources: '正式版读取总部内容台账、脚本、封面标签和已发布内容指纹。', components: '知识检索、合规规则、多维表格、语义向量与工作流门禁。',
    processing: '联合检查事实、合规、人设、选题、观点、结构、视觉和 CTA；撞题时重新路由。', boundary: '过期知识或高风险表述阻止发布；最终判断由品牌运营和顾问确认。',
  },
  comments: {
    title: '抖音评论与风向', simulated: '评论、点赞、分享、收藏及回复建议均为模拟数据。',
    sources: '正式版需账号授权并申请抖音互动管理和视频数据权限。', components: '抖音开放平台、飞书机器人、多维表格、Aily 分类与抽取。',
    processing: '完成主题聚类、情绪、问题、风险和意图识别，再生成回复和选题建议。', boundary: '接口中断显示最后同步时间；收藏取决于平台可用字段；高风险回复人工确认。',
  },
  leads: {
    title: '线索识别与策略学习', simulated: '线索由模拟评论逐字段抽取，并保留原句证据和置信度。',
    sources: '正式版使用获授权评论/私信、顾问确认和 CRM/试驾结果。', components: 'Aily 信息抽取、多维表格、飞书提醒、CRM API/Webhook。',
    processing: '按城市、家庭、车型、时间和试驾意愿评分，结果反哺画像与选题。', boundary: '低置信度字段留空；AI 不自动联系用户；高意向必须由顾问接管。',
  },
  feishu: {
    title: '飞书推荐架构与可配置交付包', simulated: '本页展示的是可配置架构和本地演示状态，当前没有连接用户的飞书租户。',
    sources: '仓库提供七张多维表格导入数据、Aily 五技能系统提示词、四条工作流和两张机器人卡片。', components: '飞书多维表格、Aily、机器人卡片、知识库、工作流；外部系统通过授权 API 或 Webhook 接入。',
    processing: '多维表格保存事实与状态，Aily 进行结构化判断和生成，卡片承载顾问少量决策，反馈事件持续写回。', boundary: '抖音与 CRM 输入仍为模拟；未获授权前不读取真实账号，不自动发布，不自动触达客户。',
  },
};
