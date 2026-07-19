export const advisor = {
  id: 'advisor-001',
  name: '林一凡',
  avatar: '林',
  city: '成都',
  store: '高新区体验中心',
  role: '新能源产品顾问',
  experience: '6年汽车顾问经验',
  strengths: ['家庭用车', '充电规划', '真实车主', '新能源政策'],
  identities: ['二胎爸爸', '露营爱好者', '成都本地人'],
  voice: '理性、真诚、先给结论',
  audience: '25—40岁成都家庭用户',
  signature: '不堆参数，把车放回真实生活里讲。',
};
const videoBlueprints = [
  {
    id: 'video-space',
    title: '预算25万，二胎家庭选纯电SUV先看这三个空间',
    cover: '二胎家庭\n空间实测',
    publishedAt: '07月16日 18:30',
    duration: '01:18',
    metrics: { views: 128430, likes: 7421, favorites: 2310, shares: 844, comments: 683, completion: 42.8 },
    trend: '+28%',
  },
  {
    id: 'video-charging',
    title: '没有家充，成都开纯电车真的方便吗？',
    cover: '没有家充\n能买吗？',
    publishedAt: '07月13日 12:10',
    duration: '00:56',
    metrics: { views: 96380, likes: 5186, favorites: 1894, shares: 623, comments: 512, completion: 48.3 },
    trend: '+19%',
  },
  {
    id: 'video-range',
    title: '成都到川西，高速续航到底要打几折？',
    cover: '川西实测\n高速续航',
    publishedAt: '07月09日 20:05',
    duration: '01:32',
    metrics: { views: 71120, likes: 3632, favorites: 1017, shares: 548, comments: 394, completion: 39.6 },
    trend: '+11%',
  },
];

const commentSeeds = {
  'video-space': [
    ['蓉城奶爸', '成都二胎家庭，第三排能不能坐成年人？这周六想来试驾A7。', 86],
    ['小鹿妈妈', '后排空间看起来不错，安全座椅装两个还够坐人吗？', 64],
    ['阿杰在成都', '预算25万，A7和B6怎么选？月底准备定。', 51],
    ['川A小王', '后备箱放婴儿车之后还能装露营装备吗？', 43],
    ['理性买车人', '讲得很实用，不只念参数，这种真实空间测试多来点。', 38],
    ['陈先生', '第三排看着还是有点挤，成年人长途会不会难受？', 34],
    ['糖糖爸爸', '我在绵阳，一家五口，想看A7，最近能预约试驾吗？', 31],
    ['木子李', '二排纯平吗？老人上下车方便不方便？', 26],
    ['小周同学', '价格和空间都合适的话，下个月考虑换车。', 21],
    ['风从西边来', '这个角度拍得清楚，终于知道第二排到底有多大了。', 18],
    ['白日梦想家', '全家出行最怕储物不够，能不能专门拍一期储物空间？', 16],
    ['路人甲', '先了解一下，明年再考虑换车。', 8],
  ],
  'video-charging': [
    ['南门租客', '小区不能装家充，成都公共充电一周要跑几次？', 91],
    ['通勤40公里', '每天来回40公里，没有家充能买吗？最担心排队。', 73],
    ['阿哲', '高新区哪个充电站晚上不排队？想看A7，这周能试驾。', 61],
    ['小满', '讲得靠谱，租房用户终于有人认真回答了。', 44],
    ['电车观察员', '快充到80%到底要多久？冬天会不会明显变慢？', 39],
    ['老成都', '公共充电价格现在多少，和油车比一年省多少？', 35],
    ['琪琪妈', '接送孩子一天30公里，商场补能能覆盖吗？', 29],
    ['夜航船', '节假日充电排队才是问题，希望讲真实情况。', 27],
    ['小陈', '我在德阳，下个月换车，没有固定车位，求建议。', 24],
    ['橙子汽水', '能不能做个成都充电地图，收藏了等更新。', 19],
    ['彭先生', '公司楼下能充，家里不能装，适合买纯电还是增程？', 17],
    ['等等党', '先看看，明年充电桩多一点再说。', 7],
  ],
  'video-range': [
    ['川西摄影师', '冬天去四姑娘山续航打几折？返程哪里补能？', 88],
    ['周末出逃', '成都到康定满载开空调，A7能不能一次到？', 67],
    ['高原咖啡', '高速120和100的能耗差多少，想看真实对比。', 56],
    ['山海之间', '这种实测很有用，比只说CLTC靠谱多了。', 47],
    ['安全第一', '低温掉电太快的话不敢买，能不能连续测三天？', 41],
    ['阿南', '我在成都，经常带父母去川西，这个月想试驾A7。', 36],
    ['元气少女', '服务区快充多吗？女生一个人开会不会焦虑？', 31],
    ['老杨', '满载和空载差别应该不小，希望把测试条件说清楚。', 28],
    ['程序员小何', '数据很清楚，建议加上海拔和气温曲线。', 23],
    ['赵先生', '预算27万，A7和C9纠结，三个月内换车。', 18],
    ['林间风', '川西景色好看，路线和补能点求一份。', 15],
    ['慢慢看车', '目前油车还能开，明年再研究。', 5],
  ],
};

const suffixes = ['同问', '蹲一个详细回答', '这个问题我也很关注'];

function expandComments(videoId, seeds) {
  const base = seeds.map(([user, text, likes], index) => ({
    id: `${videoId}-${index + 1}`,
    videoId,
    user,
    text,
    likes,
    time: `${Math.max(1, index + 2)}小时前`,
  }));
  const echoes = seeds.slice(0, 12).map(([user, text, likes], index) => ({
    id: `${videoId}-echo-${index + 1}`,
    videoId,
    user: `${user.slice(0, 4)}·${index + 1}`,
    text: `${text.replace(/[？。]$/, '')}，${suffixes[index % suffixes.length]}。`,
    likes: Math.max(2, Math.round(likes / 4)),
    time: `${index + 1}天前`,
  }));
  return [...base, ...echoes];
}

export const comments = Object.fromEntries(
  Object.entries(commentSeeds).map(([videoId, seeds]) => [videoId, expandComments(videoId, seeds)]),
);

export const videos = videoBlueprints.map((video) => ({
  ...video,
  sampleComments: comments[video.id],
}));

export const knowledgeBase = [
  { field: 'A7 CLTC续航', value: '620公里', source: '品牌产品手册 2026款', validUntil: '2026-12-31' },
  { field: 'A7官方指导价', value: '21.98万元起', source: '品牌价格公告', validUntil: '2026-08-31' },
  { field: 'A7快充时间', value: '30%—80%约26分钟', source: '品牌产品手册 2026款', validUntil: '2026-12-31' },
  { field: 'A7后备箱容积', value: '532升', source: '品牌产品手册 2026款', validUntil: '2026-12-31' },
];

export const topicCatalog = [
  {
    id: 'space',
    label: '家庭空间',
    title: '二胎家庭别只看轴距：三个真实装载场景实测',
    strength: '家庭用车',
    format: '场景实测',
    potential: 9,
  },
  {
    id: 'charging',
    label: '充电补能',
    title: '没有家充，纯电车到底能不能买？先算这笔账',
    strength: '充电规划',
    format: '问题拆解',
    potential: 10,
  },
  {
    id: 'range',
    label: '真实续航',
    title: '成都到川西：高速、低温、满载分别掉多少续航',
    strength: '真实车主',
    format: '路线复盘',
    potential: 9,
  },
  {
    id: 'price',
    label: '预算权益',
    title: '预算25万，先把车价之外的三项成本算明白',
    strength: '家庭用车',
    format: '成本清单',
    potential: 8,
  },
  {
    id: 'safety',
    label: '安全配置',
    title: '带孩子出行，我会先检查这四个安全细节',
    strength: '家庭用车',
    format: '清单讲解',
    potential: 7,
  },
  {
    id: 'policy',
    label: '置换政策',
    title: '成都家庭换新能源车，置换前先准备这份材料',
    strength: '新能源政策',
    format: '本地攻略',
    potential: 7,
  },
];

export const dashboardMetrics = {
  contentCount: 12,
  views: 326480,
  likes: 18239,
  favorites: 5621,
  shares: 2015,
  comments: 1967,
  qualifiedLeads: 186,
  adoptionRate: 64,
};

export const publishReplies = {
  space: [
    { id: 'new-space-1', user: '成都陈先生', text: '家里两个孩子，周六想带家人到店试驾A7，可以安排吗？', likes: 14, time: '刚刚' },
    { id: 'new-space-2', user: '柚子妈妈', text: '安全座椅实测很直观，想再看看后备箱。', likes: 9, time: '1分钟前' },
    { id: 'new-space-3', user: '小北', text: '我在重庆，预算25万，下个月准备换车。', likes: 6, time: '2分钟前' },
    { id: 'new-space-4', user: '阿兰', text: '第三排偶尔坐父母，长途舒适性怎么样？', likes: 4, time: '3分钟前' },
  ],
  charging: [
    { id: 'new-charge-1', user: '高新小何', text: '我在成都高新区，没有家充，这周想试驾A7顺便算算补能成本。', likes: 18, time: '刚刚' },
    { id: 'new-charge-2', user: '橙子', text: '成都充电地图太有用了，已收藏。', likes: 11, time: '1分钟前' },
    { id: 'new-charge-3', user: '德阳小陈', text: '公司楼下能充，下个月买车，A7适合吗？', likes: 8, time: '2分钟前' },
    { id: 'new-charge-4', user: '晚风', text: '希望再测一次晚高峰排队时间。', likes: 5, time: '4分钟前' },
  ],
  range: [
    { id: 'new-range-1', user: '川西阿南', text: '成都的，经常一家五口跑川西，这个月能约A7试驾吗？', likes: 16, time: '刚刚' },
    { id: 'new-range-2', user: '山野计划', text: '测试条件交代得很清楚，路线已收藏。', likes: 12, time: '1分钟前' },
    { id: 'new-range-3', user: '赵先生', text: 'A7和C9纠结，三个月内买，想对比高速能耗。', likes: 7, time: '3分钟前' },
    { id: 'new-range-4', user: '小米', text: '女生一个人去川西，补能点安全吗？', likes: 4, time: '5分钟前' },
  ],
};
