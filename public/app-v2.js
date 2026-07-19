import {
  advisorSeed,
  onboardingSources,
  initialProfile,
  brandKnowledge,
  historicVideos,
  commentSamples,
  matrixSamples,
  implementationGuides,
} from '/src/data-v2.mjs';
import {
  calibrateProfile,
  adjustProfileTag,
  learnFromOutcome,
  analyzeSignals,
  routeTopics,
  createContentPackage,
  inspectMatrix,
  runFourChecks,
  simulatePublication,
  extractSalesLeads,
} from '/src/engine-v2.mjs';

const PAGE_META = {
  dashboard: ['AI 内容工作台', 'AI 内容团队'],
  profile: ['动态顾问画像', '首次校准与持续学习'],
  topics: ['机会雷达与选题', '一题千解路由'],
  studio: ['内容创作室', '事实核＋人格壳'],
  quality: ['矩阵调度与质检', '四重质检＋回声室治理'],
  comments: ['评论运营中心', '风向、回复与选题反哺'],
  leads: ['线索与策略学习', '人工接管与效果反馈'],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function initialState() {
  return {
    page: 'dashboard',
    profile: clone(initialProfile),
    calibrated: false,
    topics: [],
    selectedTopic: null,
    content: null,
    materialsConfirmed: false,
    matrixResolved: false,
    matrix: null,
    quality: null,
    publication: null,
    leads: [],
    leadStatuses: {},
  };
}

let state = initialState();
let toastTimer;
const app = document.querySelector('#app');
const pageTitle = document.querySelector('#page-title');
const breadcrumb = document.querySelector('#breadcrumb');
const drawer = document.querySelector('#guide-drawer');
const drawerMask = document.querySelector('#drawer-mask');
const toast = document.querySelector('#toast');

const fmt = (value) => new Intl.NumberFormat('zh-CN').format(value);
const compact = (value) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : fmt(value);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function showToast(message, tone = '') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${tone}`;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2400);
}

function header(kicker, title, description, action = '') {
  return `<div class="section-head"><div><span>${kicker}</span><h2>${title}</h2><p>${description}</p></div>${action}</div>`;
}

function simulationNote(text) {
  return `<div class="simulation-note"><b>SIMULATION</b><span>${text}</span></div>`;
}

function metric(label, value, detail, tone = 'blue') {
  return `<article class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function renderDashboard() {
  const progress = [state.calibrated, state.topics.length, state.content, state.matrixResolved, state.publication, state.leads.length].filter(Boolean).length;
  return `
    ${simulationNote('顾问、任务、互动和线索均为贴近真实业务的生成数据，不对应任何真实员工或用户。')}
    <section class="hero">
      <div><span class="hero-kicker">ONE ADVISOR · ONE AI CONTENT TEAM</span><h2>让一名顾问拥有一支随时待命的内容团队</h2><p>AI 主动完成机会发现、选题、脚本、剪辑规划、评论风向与线索筛选。顾问每天只需补素材、轻改、确认和接管高意向客户。</p><div class="actions"><button class="primary light" data-page="profile">从 10 分钟首次校准开始 →</button><button class="ghost light" data-action="open-guide">为什么真实可行</button></div></div>
      <div class="hero-score"><small>本轮闭环进度</small><strong>${progress}<em>/6</em></strong><span>${progress ? 'AI 团队正在协作' : '等待顾问首次校准'}</span></div>
    </section>
    <section class="metrics four">
      ${metric('内容准备时间', '18 分钟', '试点目标：下降 70%', 'blue')}
      ${metric('轻改采用率', '64%', '试点目标：≥60%', 'purple')}
      ${metric('矩阵近重复率', '8.7%', '试点目标：＜10%', 'green')}
      ${metric('合格线索/千次曝光', '0.61', '试点目标：提升 30%', 'orange')}
    </section>
    <div class="layout two-one">
      <section class="card">
        ${header('TODAY', '今日由 AI 团队主动完成', '不是给顾问新增一套复杂平台，而是把完整创作压缩为少量决策。')}
        <div class="team-flow">
          ${[
            ['机会雷达', '评论、品牌任务和矩阵空白', state.topics.length ? '已完成' : '待开始'],
            ['选题 Agent', '每天仅推荐 1—3 个任务', state.topics.length ? '已分配' : '等待画像'],
            ['创作 Agent', '脚本、分镜、素材与剪辑时间轴', state.content ? '已交付' : '等待选题'],
            ['质检 Agent', '事实、合规、人设与矩阵', state.matrixResolved ? '已通过' : '等待内容'],
            ['评论 Agent', '风向、回复建议与问题沉淀', state.publication ? '监听中' : '等待发布'],
            ['线索 Agent', '意向识别与人工接管', state.leads.length ? '已识别' : '等待互动'],
          ].map(([role, detail, status], index) => `<div class="team-row"><b>${index + 1}</b><div><strong>${role}</strong><span>${detail}</span></div><em>${status}</em></div>`).join('')}
        </div>
      </section>
      <aside class="card low-burden">
        <span class="eyebrow">LOW BURDEN</span><h3>顾问今天只做 4 件事</h3>
        <ol><li><b>1</b>补 3 段真实素材</li><li><b>2</b>轻改不自然的原话</li><li><b>3</b>确认事实与发布</li><li><b>4</b>接管高意向线索</li></ol>
        <div class="time-save"><span>预计投入</span><strong>8–12 分钟</strong><small>完整创作流程由 AI 准备</small></div>
      </aside>
    </div>
    <section class="card evidence-chain">
      ${header('EVIDENCE CHAIN', 'MVP 不是概念页，而是一条可追溯证据链', '每一步都能回看使用的数据、得出的判断和正式落地方式。')}
      <div>${['认识顾问','理解需求','分配任务','生成内容','治理同质化','承接互动','学习成交'].map((item, index) => `<span><b>${index + 1}</b>${item}</span>`).join('<i>→</i>')}</div>
    </section>`;
}

function renderProfile() {
  const p = state.profile;
  return `
    ${simulationNote('本页模拟授权导入过程；不读取真实历史内容、语音或个人资料。')}
    ${header('STEP 01 · KNOW ME', '先让 Agent 正确认识顾问，再谈个性化', '10 分钟首次校准＋持续行为学习＋证据可解释＋顾问可纠偏。', state.calibrated ? '<button class="secondary" data-page="topics">进入机会雷达 →</button>' : '<button class="primary" data-action="calibrate">完成模拟校准 →</button>')}
    <section class="calibration-grid">
      ${onboardingSources.map((source, index) => `<article class="source-card ${state.calibrated ? 'done' : ''}"><div><b>${index + 1}</b><em>${state.calibrated ? '✓' : '待授权'}</em></div><h3>${source.label}<span>${source.count}</span></h3><p>${source.detail}</p></article>`).join('')}
    </section>
    <div class="profile-layout">
      <section class="card profile-main">
        <div class="profile-head"><div class="profile-avatar">17</div><div><span>${advisorSeed.disclosure}</span><h2>${advisorSeed.name}</h2><p>${advisorSeed.city} · ${advisorSeed.experience} · ${advisorSeed.target}</p></div><div class="maturity"><small>画像成熟度</small><strong>${p.maturity}%</strong><em>${p.stage}</em></div></div>
        <div class="tag-head"><div><span class="eyebrow">DYNAMIC TAGS</span><h3>动态标签不是固定“人设类型”</h3></div><small>${p.updatedAt}</small></div>
        <div class="tag-list">${p.tags.map((tag) => `<article class="tag-row"><div class="tag-meta"><span>${tag.dimension}</span><strong>${tag.label}</strong><small>${tag.source} · 置信度 ${tag.confidence}%</small></div><div class="weight"><div><i style="width:${tag.weight}%"></i></div><b>${tag.weight}</b></div><p>证据：${tag.evidence}</p><div class="tag-actions"><button data-action="lower-tag" data-tag-id="${tag.id}">降低</button><button data-action="lock-tag" data-tag-id="${tag.id}">${tag.status === 'locked' ? '已锁定' : '锁定'}</button></div></article>`).join('')}</div>
      </section>
      <aside class="card memory-card">
        <span class="eyebrow">MEMORY LAYERS</span><h3>四层记忆持续更新</h3>
        ${[
          ['稳定记忆','专长、地域、经历','低频'],['表达记忆','语言、节奏、结构','中频'],['兴趣记忆','近期主题与拒绝','高频'],['效果记忆','互动、线索、成交','持续'],
        ].map(([title, detail, freq], index) => `<div class="memory-row"><b>${index + 1}</b><div><strong>${title}</strong><span>${detail}</span></div><em>${freq}</em></div>`).join('')}
        <h4>最近学习证据</h4><div class="event-list">${p.events.length ? p.events.slice(0, 5).map((event) => `<div><span>${event.time}</span><strong>${event.type}</strong><p>${event.detail}</p></div>`).join('') : '<p class="empty-copy">完成首次校准后，将在这里记录每次画像变化的证据。</p>'}</div>
      </aside>
    </div>`;
}

function renderTopics() {
  const analysis = analyzeSignals(commentSamples);
  return `
    ${simulationNote('品牌任务、评论热度、平台趋势与矩阵覆盖均为生成的演示输入。')}
    ${header('STEP 02 · ROUTE', '一题千解：把不同问题分给最适合的人', '不是把同一篇文案改写上千次，而是根据画像、需求和矩阵空白分配内容领地。', `<button class="primary" data-action="route-topics">${state.topics.length ? '重新计算路由' : '生成今日 1—3 个任务'} →</button>`)}
    <section class="radar-grid">
      <article class="signal-card"><span>品牌任务</span><strong>2</strong><p>L60 家庭通勤、L90 三排安全</p></article>
      <article class="signal-card"><span>真实问题</span><strong>${analysis.total}</strong><p>${analysis.themes[0].label}最集中</p></article>
      <article class="signal-card"><span>平台趋势</span><strong>+18%</strong><p>真实实测与决策清单（模拟）</p></article>
      <article class="signal-card"><span>矩阵空白</span><strong>3</strong><p>晚高峰补能、老人上下车、安全结构</p></article>
    </section>
    <div class="layout topic-layout">
      <section class="card demand-card"><span class="eyebrow">USER DEMAND</span><h3>评论区真正想知道什么</h3>${analysis.themes.map((theme) => `<div class="demand-row"><div><strong>${theme.label}</strong><span>${theme.count} 条信号</span></div><i style="width:${Math.max(12, theme.count / Math.max(1, analysis.total) * 100)}%"></i><p>${theme.examples[0] || '当前样本未出现'}</p></div>`).join('')}<blockquote>${analysis.direction}</blockquote></section>
      <section class="topics-panel">
        ${state.topics.length ? state.topics.map((topic, index) => `<article class="topic-card ${state.selectedTopic?.id === topic.id ? 'selected' : ''}"><div class="topic-top"><span>推荐 ${index + 1}</span><b>${topic.score} 匹配分</b></div><h3>${topic.title}</h3><p>${topic.need}</p><div class="chips">${topic.matched.map((tag) => `<span>${tag}</span>`).join('')}</div><div class="reason"><strong>为什么推荐</strong><p>${topic.why}</p>${topic.notChosen ? `<small>相对弱项：${topic.notChosen}</small>` : ''}</div><button data-action="select-topic" data-topic-id="${topic.id}">${state.selectedTopic?.id === topic.id ? '已选择' : '选择这个任务'}</button></article>`).join('') : `<section class="card empty-state"><span>✦</span><h3>等待任务路由</h3><p>先完成顾问校准，再把品牌任务、评论需求和矩阵空白组合成 1—3 个任务。</p><button class="primary" data-action="route-topics">快速生成演示任务</button></section>`}
      </section>
    </div>
    ${state.selectedTopic ? `<div class="sticky-next"><div><span>已选择</span><strong>${state.selectedTopic.title}</strong></div><button class="primary" data-action="generate-content">交给创作 Agent →</button></div>` : ''}`;
}

function renderStudio() {
  if (!state.content) return `<section class="card empty-state"><span>▤</span><h2>还没有内容任务</h2><p>进入机会雷达选择任务后，创作 Agent 会一次性交付完整内容包。</p><button class="primary" data-page="topics">前往机会雷达</button></section>`;
  const c = state.content;
  return `
    ${simulationNote('内容由本地确定性规则生成；顾问真实经历和拍摄素材均显示为“待补充”，不会由 AI 编造。')}
    ${header('STEP 03 · CREATE', '从选题到可拍摄内容包，一次交付', '事实核保证品牌信息统一，人格壳保留顾问的原话、经历与目标用户表达。', '<button class="secondary" data-action="copy-content">复制内容包</button>')}
    <div class="content-layout">
      <section class="card script-card"><div class="content-title"><span>标题</span><h2>${c.title}</h2><div class="chips">${c.usedProfile.map((item) => `<span>${item}</span>`).join('')}</div></div><article class="script-block hook"><span>前 5 秒开场</span><p>${c.hook}</p></article><article class="script-block"><span>完整口播</span><p>${c.body}</p></article><article class="script-block cta"><span>评论区转化动作</span><p>${c.cta}</p></article></section>
      <aside class="card fact-card"><span class="eyebrow">FACT CORE</span><h3>事实核与来源门禁</h3>${c.facts.map((fact) => `<div class="fact-line"><i>✓</i><span>${fact}</span></div>`).join('')}<hr>${brandKnowledge.slice(0, 2).map((item) => `<div class="knowledge-item"><strong>${item.model} · ${item.field}</strong><span>${item.value}</span><small>${item.source}<br>核验 ${item.checkedAt} · 有效至 ${item.validUntil}</small></div>`).join('')}</aside>
    </div>
    <section class="card storyboard"><div class="card-head"><div><span class="eyebrow">STORYBOARD</span><h3>分镜＋字幕＋剪辑时间轴</h3></div><span class="pill">竖屏 9:16 · 约 65 秒</span></div><div class="shot-grid">${c.storyboard.map((shot, index) => `<article><b>0${index + 1}</b><span>${shot.time}</span><strong>${shot.shot}</strong><p>字幕：${shot.subtitle}</p></article>`).join('')}</div><div class="timeline">${c.editTimeline.map((item) => `<span>${item}</span>`).join('')}</div></section>
    <div class="layout two-one">
      <section class="card material-card"><div class="card-head"><div><span class="eyebrow">MATERIALS</span><h3>顾问只需补充这些真实素材</h3></div><button class="secondary" data-action="confirm-materials">${state.materialsConfirmed ? '✓ 已模拟补齐' : '模拟一键补齐'}</button></div>${c.materials.map((item) => `<div class="material-row"><i>${state.materialsConfirmed || item.status.includes('系统') ? '✓' : '+'}</i><div><strong>${item.label}</strong><span>${state.materialsConfirmed ? '已模拟补充' : item.status}</span></div></div>`).join('')}</section>
      <aside class="card cover-card"><span>封面建议</span><strong>${c.cover}</strong><small>大字不超过 10 个字，保留真实车辆或门店画面</small><h4>评论预案</h4>${c.replyPlan.map((item) => `<p>• ${item}</p>`).join('')}</aside>
    </div>
    <div class="sticky-next"><div><span>顾问操作负担</span><strong>${state.materialsConfirmed ? '素材已补齐，可直接确认' : '补 3 段素材＋必要轻改'}</strong></div><button class="primary" data-page="quality">进入四重质检 →</button></div>`;
}

function scoreCard(label, value, detail) {
  const tone = value >= 90 ? 'good' : value >= 70 ? 'warn' : 'bad';
  return `<article class="score-card ${tone}"><div><strong>${value}</strong><span>分</span></div><h3>${label}</h3><p>${detail}</p></article>`;
}

function renderQuality() {
  if (!state.content) return `<section class="card empty-state"><span>✓</span><h2>等待待检内容</h2><p>先完成选题和内容生成。</p><button class="primary" data-page="topics">前往机会雷达</button></section>`;
  const matrix = state.matrix || inspectMatrix(state.content, state.matrixResolved);
  const quality = state.quality || runFourChecks(state.content, matrix);
  return `
    ${simulationNote('矩阵样本来自 36 个模拟账号、近 14 天 214 条模拟内容；正式版由总部内容台账生成指纹。')}
    ${header('STEP 04 · GOVERN', '不是改几个词，而是主动治理内容领地', '四重质检同时检查单条内容和整个账号矩阵；角度拥挤时直接调度到空白场景。')}
    <section class="scores">${scoreCard('事实', quality.fact, '来源、版本与有效期')}${scoreCard('合规', quality.compliance, '承诺、价格与风险表达')}${scoreCard('人设', quality.persona, '画像证据与真实素材')}${scoreCard('矩阵', quality.matrix, '选题、观点、结构、视觉与 CTA')}</section>
    <div class="layout matrix-layout">
      <section class="card matrix-main"><div class="matrix-alert ${state.matrixResolved ? 'resolved' : ''}"><div><span>${state.matrixResolved ? 'LOW RISK' : 'ECHO ROOM ALERT'}</span><h2>${state.matrixResolved ? '已补位矩阵空白场景' : '发现内容角度过度拥挤'}</h2><p>${matrix.action}</p></div><strong>${matrix.score}%<small>近似度</small></strong></div><div class="fingerprint">${Object.entries(matrix.fingerprint).map(([key, value]) => `<div><span>${({topic:'选题',viewpoint:'观点',structure:'结构',wording:'措辞',visual:'视觉',cta:'CTA'})[key]}</span><div><i style="width:${value}%"></i></div><b>${value}%</b></div>`).join('')}</div><div class="route-result"><span>系统识别的空白场景</span><strong>${matrix.gap}</strong><p>新标题：${state.matrixResolved ? matrix.title : '等待重新路由'}</p></div><button class="primary full" data-action="resolve-matrix" ${state.matrixResolved ? 'disabled' : ''}>${state.matrixResolved ? '✓ 已完成空白补位' : '自动调度至空白场景'}</button></section>
      <aside class="card matrix-samples"><span class="eyebrow">MATRIX SAMPLE</span><h3>撞题证据不是黑箱分数</h3>${matrixSamples.map((item) => `<article><div><strong>${item.account}</strong><em>${item.similarity}%</em></div><p>${item.topic} · ${item.angle}</p><small>${item.structure} / ${item.visual} / ${item.cta}</small></article>`).join('')}</aside>
    </div>
    <section class="card publish-gate"><div><span class="eyebrow">PUBLISH GATE</span><h3>${quality.passed ? '事实、合规、人设和矩阵检查均通过' : '发布门禁仍处于关闭状态'}</h3><p>${quality.issues.length ? quality.issues.join('；') : '顾问补充真实素材并确认后，可以进入本地模拟发布。'}</p></div><button class="primary" data-action="publish" ${quality.passed ? '' : 'disabled'}>${quality.passed ? '确认并模拟发布 →' : '先完成矩阵补位'}</button></section>`;
}

function intentTag(text) {
  if (/试驾|这周|周日/.test(text)) return ['高意向', 'intent'];
  if (/担心|别只|会不会|排不排/.test(text)) return ['质疑', 'risk'];
  if (/收藏|真实|有用/.test(text)) return ['正向', 'positive'];
  return ['咨询', 'neutral'];
}

function renderComments() {
  const comments = state.publication?.comments || commentSamples;
  const analysis = analyzeSignals(comments);
  return `
    ${simulationNote(state.publication ? '以下为模拟发布后生成的新评论，不连接真实抖音账号。' : '以下评论和互动来自生成的历史样本，不连接真实抖音账号。')}
    ${header('STEP 05 · LISTEN', state.publication ? '发布后，评论风向开始反哺内容与线索' : '先从评论中听见真实问题', 'AI 先识别问题、风险与意向，再建议回复；不会自动冒充顾问联系客户。', state.publication ? '<button class="primary" data-action="extract-leads">识别销售线索 →</button>' : '<button class="primary" data-page="topics">用评论生成选题 →</button>')}
    <section class="platform-bar"><div class="douyin">抖</div><div><strong>抖音数据连接器 · 演示模式</strong><span>评论管理：正式版需账号授权与 video.comment 权限</span></div><em>${state.publication ? '模拟实时回流' : '历史样本'}</em></section>
    <section class="metrics four">${metric('评论样本', analysis.total, '全部为模拟数据')}${metric('高意向信号', analysis.intentCount, '需人工确认', 'green')}${metric('质疑与风险', analysis.concernCount, '优先生成解释内容', 'orange')}${metric('高频主题', analysis.themes[0]?.label || '无', '语义聚类结果', 'purple')}</section>
    <div class="layout comment-layout">
      <section class="card comments-list"><div class="card-head"><div><span class="eyebrow">COMMENTS</span><h3>评论与 AI 建议</h3></div><span class="pill">最近同步：刚刚（模拟）</span></div>${comments.map((comment) => { const [label, tone] = intentTag(comment.text); return `<article class="comment-row"><div class="comment-avatar">${comment.user[0]}</div><div><strong>${comment.user}<span>${comment.time}</span></strong><p>${comment.text}</p><small>♡ ${comment.likes}</small><div class="reply"><b>AI 建议：</b>${tone === 'intent' ? '先确认城市、门店和时间，再由顾问人工接管。' : tone === 'risk' ? '承认问题成立，给出可验证的实拍或官方来源。' : '感谢反馈，并邀请补充真实用车条件。'}</div></div><em class="comment-tag ${tone}">${label}</em></article>`; }).join('')}</section>
      <aside class="card wind-panel"><span class="eyebrow">WIND DIRECTION</span><h3>评论区风向</h3><blockquote>${analysis.direction}</blockquote><h4>主题聚类</h4>${analysis.themes.map((theme) => `<div class="theme-row"><span>${theme.label}</span><div><i style="width:${theme.count / Math.max(1, analysis.total) * 100}%"></i></div><b>${theme.count}</b></div>`).join('')}<h4>对下一轮内容的影响</h4><p>提高“${analysis.themes[0]?.label}”相关任务权重；质疑问题进入事实核待回答清单。</p><button class="secondary full" data-page="topics">加入下一轮选题池</button></aside>
    </div>`;
}

function renderLeads() {
  if (!state.leads.length) return `<section class="card empty-state"><span>◎</span><h2>等待评论转线索</h2><p>完成模拟发布后，AI 才会从回流评论中提取城市、车型、购车时间和试驾意愿。</p><button class="primary" data-page="comments">前往评论运营中心</button></section>`;
  const count = (grade) => state.leads.filter((lead) => lead.grade === grade).length;
  return `
    ${simulationNote('以下线索全部由模拟评论提取，不包含真实个人信息，也不会自动触达客户。')}
    ${header('STEP 06 · LEARN', 'AI 筛线索，顾问做最后的销售判断', '每个字段保留原评论证据和置信度；高意向必须由顾问人工接管。')}
    <section class="metrics four">${metric('A级线索', count('A'), '立即人工接管', 'green')}${metric('B级线索', count('B'), '补问关键条件', 'blue')}${metric('C级线索', count('C'), '长期内容培育', 'purple')}${metric('画像成熟度', `${state.profile.maturity}%`, state.profile.stage, 'orange')}</section>
    <section class="card lead-table-wrap"><table><thead><tr><th>原评论证据</th><th>城市/车型</th><th>购车时间</th><th>试驾意愿</th><th>等级</th><th>下一步</th><th>操作</th></tr></thead><tbody>${state.leads.map((lead) => `<tr><td><div class="lead-source"><strong>${lead.user}</strong><p>${lead.sourceComment}</p><small>抽取置信度 ${lead.confidence}%</small></div></td><td><strong>${lead.city}</strong><small>${lead.model} · ${lead.family}</small></td><td>${lead.purchaseWindow}</td><td>${lead.testDrive}</td><td><span class="grade grade-${lead.grade.toLowerCase()}">${lead.grade}</span><small>${lead.score} 分</small></td><td>${lead.nextAction}</td><td><button class="takeover ${state.leadStatuses[lead.id] ? 'done' : ''}" data-action="takeover" data-lead-id="${lead.id}">${state.leadStatuses[lead.id] ? '✓ 已接管并学习' : '人工接管'}</button></td></tr>`).join('')}</tbody></table></section>
    <section class="learning-loop"><div>${['内容','互动','试驾','成交','策略学习'].map((item) => `<span>${item}</span>`).join('<i>→</i>')}</div><h2>结果不是报表终点，而是下一轮画像和选题的证据</h2><p>接管 A 级线索后，“成都本地补能”相关标签权重会提高，画像成熟度和下一轮推荐解释同步变化。</p><button class="primary light" data-page="profile">查看画像如何变化 →</button></section>`;
}

function renderGuide() {
  const guide = implementationGuides[state.page];
  drawer.innerHTML = `<div class="drawer-head"><div><span>REAL IMPLEMENTATION</span><h2>${guide.title}</h2></div><button data-action="close-guide">×</button></div><div class="guide-disclaimer"><b>当前是模拟演示</b><p>${guide.simulated}</p></div>${[
    ['1','正式数据来源',guide.sources],['2','承载组件',guide.components],['3','核心处理逻辑',guide.processing],['4','权限与人工边界',guide.boundary],
  ].map(([index, title, copy]) => `<article class="guide-step"><b>${index}</b><div><h3>${title}</h3><p>${copy}</p></div></article>`).join('')}<div class="feasible"><strong>为什么可行</strong><p>该能力可由现有飞书组件、获授权的官方平台接口、结构化大模型输出和明确的人工门禁组合实现；MVP 不把尚未接入的能力伪装成实时功能。</p></div>`;
}

function render() {
  const [title, trail] = PAGE_META[state.page];
  pageTitle.textContent = title;
  breadcrumb.textContent = `OneKOS / ${trail}`;
  document.title = `${title}｜千面·OneKOS`;
  document.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === state.page));
  const views = { dashboard: renderDashboard, profile: renderProfile, topics: renderTopics, studio: renderStudio, quality: renderQuality, comments: renderComments, leads: renderLeads };
  app.innerHTML = views[state.page]();
  renderGuide();
}

function navigate(page) {
  if (!PAGE_META[page]) return;
  state.page = page;
  document.body.classList.remove('nav-open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', async (event) => {
  const pageTarget = event.target.closest('[data-page]');
  if (pageTarget) {
    navigate(pageTarget.dataset.page);
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'toggle-nav') {
    document.body.classList.toggle('nav-open');
  } else if (action === 'open-guide') {
    renderGuide();
    drawer.classList.add('open');
    drawerMask.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  } else if (action === 'close-guide') {
    drawer.classList.remove('open');
    drawerMask.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  } else if (action === 'calibrate') {
    state.profile = calibrateProfile();
    state.calibrated = true;
    render();
    showToast('模拟校准完成：已形成可解释的动态顾问画像');
  } else if (action === 'lower-tag' || action === 'lock-tag') {
    state.profile = adjustProfileTag(state.profile, target.dataset.tagId, action === 'lower-tag' ? 'lower' : 'lock');
    render();
    showToast('顾问纠偏已记录，后续任务路由将使用新权重');
  } else if (action === 'route-topics') {
    if (!state.calibrated) {
      state.profile = calibrateProfile();
      state.calibrated = true;
      showToast('已自动完成演示校准，再生成任务');
    }
    state.topics = routeTopics(state.profile, commentSamples);
    state.selectedTopic = state.topics[0];
    render();
  } else if (action === 'select-topic') {
    state.selectedTopic = state.topics.find((item) => item.id === target.dataset.topicId);
    render();
    showToast('任务已选择，拒绝或选择行为也会成为画像证据');
  } else if (action === 'generate-content') {
    state.content = createContentPackage(state.selectedTopic, state.profile);
    state.matrixResolved = false;
    state.matrix = inspectMatrix(state.content, false);
    state.quality = runFourChecks(state.content, state.matrix);
    navigate('studio');
    showToast('创作 Agent 已交付脚本、分镜、素材和剪辑时间轴');
  } else if (action === 'confirm-materials') {
    state.materialsConfirmed = true;
    render();
    showToast('已模拟补充真实素材；正式版由顾问上传或勾选现有素材');
  } else if (action === 'copy-content') {
    try {
      await navigator.clipboard.writeText(`${state.content.title}\n\n${state.content.hook}\n\n${state.content.body}\n\n${state.content.cta}`);
      showToast('内容包已复制');
    } catch {
      showToast('浏览器未授予剪贴板权限', 'warning');
    }
  } else if (action === 'resolve-matrix') {
    state.matrixResolved = true;
    state.matrix = inspectMatrix(state.content, true);
    state.content.title = state.matrix.title;
    state.quality = runFourChecks(state.content, state.matrix);
    render();
    showToast('已从拥挤角度调度至矩阵空白场景');
  } else if (action === 'publish') {
    if (!state.quality?.passed) {
      showToast('发布门禁关闭：请先完成矩阵补位', 'warning');
      return;
    }
    state.publication = simulatePublication(state.content);
    navigate('comments');
    showToast('本地模拟发布完成，新评论已回流');
  } else if (action === 'extract-leads') {
    state.leads = extractSalesLeads(state.publication?.comments || []);
    navigate('leads');
    showToast(`已从模拟评论中识别 ${state.leads.length} 条线索`);
  } else if (action === 'takeover') {
    state.leadStatuses[target.dataset.leadId] = true;
    const lead = state.leads.find((item) => item.id === target.dataset.leadId);
    if (lead?.grade === 'A') {
      state.profile = learnFromOutcome(state.profile, { tagId: 'local', detail: 'A级试驾线索验证“成都本地补能＋真实路线”内容有效' });
    }
    render();
    showToast('顾问已人工接管，结果已反哺动态画像');
  } else if (action === 'reset') {
    state = initialState();
    navigate('dashboard');
    showToast('全部模拟状态已重置');
  }
});

render();
