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
import { oneKosApi } from './api-client.js';

const PAGE_META = {
  dashboard: ['AI 内容工作台', 'AI 内容团队'],
  profile: ['动态顾问画像', '首次校准与持续学习'],
  topics: ['机会雷达与选题', '一题千解路由'],
  studio: ['内容创作室', '事实核＋人格壳'],
  quality: ['矩阵调度与质检', '四重质检＋回声室治理'],
  comments: ['评论运营中心', '风向、回复与选题反哺'],
  leads: ['线索与策略学习', '人工接管与效果反馈'],
  feishu: ['飞书落地中心', '多维表格＋Aily＋机器人卡片'],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const ONBOARDING_STORAGE_KEY = 'onekos:onboarding-session';

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
    feedbackByLead: {},
    runtime: null,
    backendState: null,
    apiError: '',
    busy: '',
    currentAdvisorId: 'ADV-017',
    currentTaskId: 'TASK-001',
    onboarding: {
      advisors: [],
      selectedAdvisorId: '',
      session: null,
      candidates: [],
      result: null,
      error: '',
    },
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
const runtimeStatus = document.querySelector('#runtime-status');

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
  const onboarding = state.onboarding;
  const session = onboarding.session;
  const storedSessionId = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  const advisorOptions = onboarding.advisors.map((advisor) => `
    <button class="advisor-option ${onboarding.selectedAdvisorId === advisor.advisorId ? 'selected' : ''}" data-action="select-advisor" data-advisor-id="${escapeHtml(advisor.advisorId)}">
      <strong>${escapeHtml(advisor.displayName || advisor.advisorId)}</strong><span>${escapeHtml(advisor.city || '城市待补充')} · ${escapeHtml(advisor.initializationStatus || '待初始化')}</span>
    </button>`).join('');
  const candidateTags = onboarding.candidates.map((tag, index) => `
    <article class="candidate-tag ${tag.locked ? 'locked' : ''}" data-candidate-index="${index}">
      <div class="candidate-tag-head"><span>${escapeHtml(tag.dimension)}</span><small>置信度 ${tag.confidence}%</small></div>
      <label>标签<input data-onboarding-label value="${escapeHtml(tag.label)}"></label>
      <label>权重 <b>${tag.weight}</b><input type="range" min="0" max="100" value="${tag.weight}" data-onboarding-weight></label>
      <p><b>来源</b>${escapeHtml(tag.source)}</p><p><b>证据</b>${escapeHtml(tag.evidence)}</p>
      <div class="candidate-actions"><button data-action="remove-onboarding-tag" data-index="${index}">删除候选</button><button data-action="lower-onboarding-tag" data-index="${index}">降低权重</button><button data-action="lock-onboarding-tag" data-index="${index}">${tag.locked ? '已锁定' : '锁定标签'}</button></div>
    </article>`).join('');
  return `
    ${simulationNote('仅处理顾问主动填写或明确授权的资料；历史内容与语音转写均为可选输入。')}
    ${header('STEP 01 · KNOW ME', '3 分钟画像初始化', '先采集最小资料，再生成带来源、证据和置信度的候选画像，由顾问确认后生效。', state.calibrated ? '<button class="secondary" data-page="topics">进入机会雷达 →</button>' : '')}
    <section class="card onboarding-shell">
      <div class="onboarding-progress"><span class="active">1 选择身份</span><span class="${session ? 'active' : ''}">2 填写资料</span><span class="${onboarding.candidates.length ? 'active' : ''}">3 确认候选</span></div>
      <div class="advisor-picker"><div><span class="eyebrow">ADVISOR IDENTITY</span><h3>选择已有顾问</h3><p>可继续已有身份，也可创建模拟顾问完成比赛演示。</p></div><div class="advisor-options">${advisorOptions || '<span class="empty-copy">正在读取顾问列表…</span>'}</div></div>
      ${storedSessionId && !session ? `<div class="resume-card"><div><strong>发现未完成的初始化</strong><span>${escapeHtml(storedSessionId)}</span></div><button class="secondary" data-action="resume-onboarding">恢复上次进度</button></div>` : ''}
      <form class="onboarding-form" id="onboarding-form">
        <div class="form-title"><div><span class="eyebrow">MINIMUM INPUT</span><h3>创建模拟顾问</h3></div><small>带 * 为必填；示例数据可直接验证闭环</small></div>
        <div class="form-grid">
          <label>顾问 ID *<input name="advisorId" value="${escapeHtml(session?.input?.advisorId || onboarding.selectedAdvisorId || `ADV-DEMO-${String(Date.now()).slice(-6)}`)}" required></label>
          <label>展示名称 *<input name="displayName" value="${escapeHtml(session?.input?.displayName || '顾问小林')}" required></label>
          <label>城市 *<input name="city" value="${escapeHtml(session?.input?.city || '成都')}" required></label>
          <label>门店 *<input name="store" value="${escapeHtml(session?.input?.store || '成都模拟门店')}" required></label>
          <label>从业年限<input name="experienceYears" type="number" min="0" max="50" value="${session?.input?.experienceYears ?? 3}"></label>
          <label>目标车型<input name="targetModel" value="${escapeHtml(session?.input?.targetModel || '乐道 L60')}"></label>
          <label class="wide">目标用户 *<input name="targetAudience" value="${escapeHtml(session?.input?.targetAudience || '城市通勤家庭')}" required></label>
          <label class="wide">擅长问题 *<input name="specialties" value="${escapeHtml((session?.input?.specialties || ['补能路线']).join('，'))}" placeholder="多个问题用逗号分隔" required></label>
          <label>开场偏好 *<select name="openingStyle"><option>先结论后解释</option><option>真实故事开场</option><option>问题开场</option></select></label>
          <label>证据偏好 *<select name="evidencePreference"><option>实车场景证明</option><option>数据对比证明</option><option>用户案例证明</option></select></label>
          <label>表达语气 *<select name="tone"><option>专业克制</option><option>亲切直接</option><option>轻松幽默</option></select></label>
          <label class="wide">历史内容<textarea name="historyContents" placeholder="可选，每行一条">${escapeHtml((session?.input?.historyContents || []).join('\n'))}</textarea></label>
          <label class="wide">语音转写<textarea name="voiceTranscript" placeholder="可选，粘贴顾问真实口述转写">${escapeHtml(session?.input?.voiceTranscript || '')}</textarea></label>
          <label class="wide">禁用表达<input name="forbiddenExpressions" value="${escapeHtml((session?.input?.forbiddenExpressions || []).join('，'))}" placeholder="多个表达用逗号分隔"></label>
        </div>
        <div class="form-consent"><span>授权范围：仅使用顾问主动提供的资料生成画像候选，不读取未授权账号。</span><button class="primary" type="button" data-action="start-onboarding">${session ? '更新并新建会话' : '保存资料并开始'}</button></div>
      </form>
      ${session ? `<section class="candidate-board"><div class="candidate-board-head"><div><span class="eyebrow">CANDIDATE PROFILE</span><h3>候选画像</h3><p>每条标签都必须保留来源与证据；低置信度只作为候选。</p></div><button class="secondary" data-action="generate-onboarding">${onboarding.candidates.length ? '重新生成候选' : '生成候选画像'}</button></div>${candidateTags ? `<div class="candidate-grid">${candidateTags}</div><div class="confirm-bar"><span>已保留 ${onboarding.candidates.length} 条候选，可编辑标签和权重后确认。</span><button class="primary" data-action="confirm-onboarding">确认画像 V1</button></div>` : '<div class="candidate-empty">资料已保存，点击“生成候选画像”继续。</div>'}</section>` : ''}
      ${onboarding.error ? `<p class="onboarding-error">${escapeHtml(onboarding.error)}</p>` : ''}
    </section>
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
    ${simulationNote(state.content.generator === 'external-llm' ? '内容候选由外部兼容模型生成，并由 OneKOS 服务执行事实、合规、人设、矩阵质检；真实素材仍由顾问补充。' : '内容由本地确定性规则生成；顾问真实经历和拍摄素材均显示为“待补充”，不会由 AI 编造。')}
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

function runtimeCopy() {
  if (!state.runtime) return { label: '检测连接…', detail: '正在读取服务状态', tone: 'checking' };
  if (state.runtime.mode === 'live') return { label: 'LIVE · 飞书＋模型', detail: '飞书 Base 与外部模型均已配置', tone: 'live' };
  if (state.runtime.mode === 'hybrid') return { label: 'HYBRID · 飞书已连接', detail: '飞书 Base 实时读写，内容由本地确定性生成器完成', tone: 'hybrid' };
  return { label: 'SIMULATION · 本地演示', detail: '使用仓库内模拟数据与本地确定性生成器', tone: 'simulation' };
}

function updateRuntimeBadge() {
  const copy = runtimeCopy();
  runtimeStatus.textContent = copy.label;
  runtimeStatus.title = state.apiError || copy.detail;
  runtimeStatus.className = `sim-pill runtime-${state.apiError ? 'error' : copy.tone}`;
}

function apiQualityToLegacy(quality) {
  return {
    fact: quality.fact.score,
    compliance: quality.compliance.score,
    persona: quality.persona.score,
    matrix: quality.matrix.score,
    passed: quality.passed,
    issues: quality.issues,
  };
}

function apiMatrixToLegacy(quality, content) {
  const similarity = Math.round((quality.matrix.similarity || 0) * 100);
  return {
    risk: quality.matrix.risk,
    score: similarity,
    action: quality.matrix.risk === '高' ? '停止发布并重新路由至矩阵空白' : '已通过矩阵近重复检查',
    fingerprint: { topic: similarity, viewpoint: Math.max(8, similarity - 7), structure: Math.max(12, similarity + 4), wording: Math.max(6, similarity - 12), visual: 18, cta: 16 },
    gap: state.backendState?.task?.matrixGap || '工作日晚高峰真实等待时间',
    title: content.title,
  };
}

function apiContentToLegacy(content) {
  const tagMap = new Map((state.backendState?.profileTags || []).map((tag) => [tag.tagId, tag.label]));
  return {
    ...content,
    id: content.contentId,
    topicId: content.taskId,
    body: content.script,
    usedProfile: content.profileRefs.map((id) => tagMap.get(id) || id),
    facts: content.factRefs.length
      ? content.factRefs.map((id) => `已引用有效品牌知识：${id}`)
      : ['本选题缺少直接相关的补能品牌事实，所有结果数字均等待顾问实拍补充。'],
    storyboard: content.storyboard.map((shot, index) => ({ time: `${index * 10}—${Math.min(60, index * 10 + 10)} 秒`, shot, subtitle: '以真实拍摄画面为准' })),
    materials: content.materials.map((label) => ({ label, status: '待顾问补充' })),
    cover: content.title.slice(0, 14),
    editTimeline: content.storyboard.map((shot, index) => `${index * 10}—${Math.min(60, index * 10 + 10)} 秒：${shot}`),
  };
}

function apiLeadToLegacy(lead, sourceUser = '模拟用户') {
  return {
    ...lead,
    id: lead.leadId,
    user: sourceUser,
    sourceComment: lead.originalComment,
    family: lead.familyStructure,
    purchaseWindow: lead.purchaseWindow,
    testDrive: lead.testDriveIntent,
    confidence: Math.min(98, lead.score + 10),
  };
}

function splitList(value, pattern = /[，,\n]/) {
  return String(value || '').split(pattern).map((item) => item.trim()).filter(Boolean);
}

function readOnboardingForm() {
  const form = document.querySelector('#onboarding-form');
  if (!form?.reportValidity()) return null;
  const data = new FormData(form);
  return {
    advisorId: data.get('advisorId'),
    displayName: data.get('displayName'),
    city: data.get('city'),
    store: data.get('store'),
    experienceYears: Number(data.get('experienceYears')) || 0,
    targetAudience: data.get('targetAudience'),
    targetModel: data.get('targetModel'),
    specialties: splitList(data.get('specialties')),
    preferences: {
      openingStyle: data.get('openingStyle'),
      evidencePreference: data.get('evidencePreference'),
      tone: data.get('tone'),
    },
    historyContents: splitList(data.get('historyContents'), /\n/),
    voiceTranscript: data.get('voiceTranscript'),
    forbiddenExpressions: splitList(data.get('forbiddenExpressions')),
    identitySource: 'demo',
    authorizationStatus: '仅使用顾问主动提供的资料',
  };
}

function onboardingTagsToProfile(result) {
  return {
    maturity: 62,
    stage: '画像 V1 · 待持续学习',
    updatedAt: new Date().toLocaleString('zh-CN'),
    tags: result.tags.map((tag) => ({
      id: tag.tagId,
      dimension: tag.dimension,
      label: tag.label,
      weight: tag.weight,
      confidence: tag.confidence,
      source: tag.source,
      evidence: tag.evidence,
      status: tag.status === '锁定' ? 'locked' : 'active',
    })),
    events: [{ time: new Date().toLocaleString('zh-CN'), type: '画像初始化', detail: `已确认 ${result.tags.length} 条带证据标签，并创建首条内容任务。` }],
  };
}

async function loadAdvisors() {
  try {
    const payload = await oneKosApi.listAdvisors();
    state.onboarding.advisors = payload.data || [];
    if (state.page === 'profile') render();
  } catch (error) {
    state.onboarding.error = `顾问列表读取失败：${error.message}`;
    if (state.page === 'profile') render();
  }
}

async function resumeOnboardingSession(sessionId = localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
  if (!sessionId) return;
  try {
    const payload = await oneKosApi.getOnboardingSession(sessionId);
    state.onboarding.session = payload.data;
    state.onboarding.candidates = clone(payload.data.candidates || []).map((tag) => ({ ...tag, locked: tag.status === '锁定' }));
    state.onboarding.selectedAdvisorId = payload.data.advisorId;
    state.currentAdvisorId = payload.data.advisorId;
    state.onboarding.error = '';
    if (state.page === 'profile') render();
  } catch (error) {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    state.onboarding.error = `无法恢复初始化进度：${error.message}`;
    if (state.page === 'profile') render();
  }
}

async function refreshBackendState({ notify = false } = {}) {
  try {
    const payload = await oneKosApi.getDemoState(state.currentAdvisorId, state.currentTaskId);
    state.runtime = payload.runtime;
    state.backendState = payload.data;
    state.apiError = '';
    if (notify) showToast(`服务状态已刷新：${runtimeCopy().label}`);
  } catch (error) {
    state.runtime = { mode: 'simulation', simulation: true, warnings: ['服务接口不可用，界面保留本地模拟能力'] };
    state.apiError = error.message;
    if (notify) showToast(error.message, 'warning');
  }
  updateRuntimeBadge();
  if (state.page === 'feishu') render();
}

function renderFeishuImplementation() {
  const runtime = runtimeCopy();
  const warnings = state.runtime?.warnings || [];
  const tables = [
    ['顾问档案', '授权、成熟度与流程状态'], ['画像标签', '权重、置信度、来源与证据'],
    ['品牌知识', '版本、来源、有效期与状态'], ['内容任务', '问题、角度、路由分与矩阵空白'],
    ['内容成果', '脚本、素材、引用与质检'], ['评论线索', '字段证据、等级与人工接管'],
    ['反馈事件', '采用、修改、线索和成交反馈'],
  ];
  const skills = [
    ['profile_calibration', '首次校准与动态画像更新'], ['daily_topic_route', '一题千解与每日任务路由'],
    ['content_package_generate', '完整可拍摄内容包'], ['quality_and_matrix_check', '四重质检与回声室治理'],
    ['comment_to_lead', '评论风向、字段提取与线索分级'],
  ];
  const workflows = [
    ['WF-01', '新顾问校准', '顾问档案 → Aily → 画像标签 → 确认卡片'],
    ['WF-02', '选题与内容生成', '待生成任务 → 内容包写回 → 素材确认'],
    ['WF-03', '质检与发布门禁', '内容成果 → 四重质检 → 通过或重路由'],
    ['WF-04', '评论到策略学习', '新评论 → 线索分级 → 人工接管 → 反馈事件'],
  ];
  return `
    ${simulationNote(state.runtime?.mode === 'live' ? '当前 Web 服务已配置飞书 Base 与外部模型；抖音和 CRM 仍使用模拟输入。' : state.runtime?.mode === 'hybrid' ? '当前已连接飞书 Base，内容生成暂由本地确定性引擎完成；抖音和 CRM 为模拟输入。' : '当前使用本地模拟数据；填写 .env 后可切换到飞书 Base 与外部兼容模型。')}
    ${header('FEISHU IMPLEMENTATION', '推荐架构已经拆成可导入、可配置、可演示的交付包', '飞书多维表格负责数据与状态，Aily 负责理解和决策，机器人卡片负责顾问低负担交互。')}
    <section class="card runtime-board ${runtime.tone}"><div><span class="eyebrow">RUNTIME STATUS</span><h3>${runtime.label}</h3><p>${state.apiError || runtime.detail}</p></div><div class="runtime-connections"><span class="${state.runtime?.feishu?.configured ? 'connected' : ''}">飞书 Base ${state.runtime?.feishu?.configured ? '已配置' : '未配置'}</span><span class="${state.runtime?.llm?.configured ? 'connected' : ''}">外部模型 ${state.runtime?.llm?.configured ? '已配置' : '未配置'}</span><button class="secondary" data-action="refresh-runtime">刷新连接</button></div>${warnings.length ? `<small>${warnings.map(escapeHtml).join(' · ')}</small>` : ''}</section>
    <section class="implementation-architecture">
      <article><span>01 · DATA</span><strong>飞书多维表格</strong><p>七张数据表保存事实、证据、任务、线索和反馈状态。</p><em>业务数据底座</em></article>
      <i>→</i><article><span>02 · AGENT</span><strong>Aily＋OneKOS 服务</strong><p>Aily 承担飞书内顾问交互；Web 服务通过外部兼容模型完成结构化生成，并共享同一 Base。</p><em>双入口智能决策层</em></article>
      <i>→</i><article><span>03 · ACTION</span><strong>机器人卡片</strong><p>顾问只做选题、补素材、确认和接管线索四类动作。</p><em>低负担交互层</em></article>
      <i>→</i><article><span>04 · LEARN</span><strong>工作流写回</strong><p>采用、拒绝、互动和销售结果变成反馈事件，更新下一轮内容 DNA。</p><em>策略学习闭环</em></article>
    </section>
    <section class="metrics four">
      ${metric('七张数据表', '7', '稳定 ID＋跨表证据链')}
      ${metric('五项 Agent 技能', '5', '统一 JSON 输入输出', 'purple')}
      ${metric('四条工作流', '4', '触发、分支、写回与异常', 'green')}
      ${metric('顾问日常动作', '4', '选题、补素材、确认、接管', 'orange')}
    </section>
    <div class="implementation-columns">
      <section class="card implementation-list"><span class="eyebrow">BITABLE</span><h3>七张数据表</h3>${tables.map(([name, detail], index) => `<div><b>${index + 1}</b><strong>${name}</strong><span>${detail}</span></div>`).join('')}</section>
      <section class="card implementation-list"><span class="eyebrow">AILY SKILLS</span><h3>五项 Agent 技能</h3>${skills.map(([name, detail], index) => `<div><b>${index + 1}</b><strong>${name}</strong><span>${detail}</span></div>`).join('')}<div class="asset-callout"><strong>统一门禁</strong><span>低置信度保持为空；过期事实阻断；高意向与最终发布人工确认。</span></div></section>
    </div>
    <section class="card workflow-board"><div class="card-head"><div><span class="eyebrow">WORKFLOWS</span><h3>四条工作流把 Agent 输出写回业务</h3></div><span class="pill">可先跑通 WF-02 与 WF-04</span></div><div>${workflows.map(([id, name, flow]) => `<article><b>${id}</b><strong>${name}</strong><p>${flow}</p></article>`).join('')}</div></section>
    <section class="boundary-grid">
      <article class="card real-boundary"><span>REAL</span><h3>真实实现</h3><p>数据模型、稳定主键、状态机、Aily JSON 契约、工作流读写规则、机器人卡片和人工门禁均已形成可配置文件。</p><ul><li>七份 CSV＋一份 Excel 导入包</li><li>Aily 五技能系统提示词</li><li>四条工作流配置清单</li><li>今日任务与 A 级线索卡片</li></ul></article>
      <article class="card simulation-boundary"><span>SIMULATION</span><h3>模拟输入</h3><p>顾问资料、历史内容、抖音评论与互动、CRM 跟进结果均为生成数据，不能描述成实时正式接入。</p><ul><li>外部平台保留授权状态与同步时间</li><li>未授权时不读取真实账号</li><li>不自动联系客户或承诺价格权益</li><li>正式接入只替换数据输入节点</li></ul></article>
    </section>
    <section class="card package-path"><div><span class="eyebrow">DELIVERY PACKAGE</span><h3>仓库内的飞书搭建包</h3><p>从 <code>feishu/bitable</code> 导入七表，从 <code>feishu/aily</code> 复制 Agent 与工作流，从 <code>feishu/cards</code> 配置机器人卡片；完整步骤见 <code>docs/OneKOS-飞书落地操作手册.md</code>。</p></div><button class="secondary" data-action="open-guide">查看实施边界</button></section>`;
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
  const views = { dashboard: renderDashboard, profile: renderProfile, topics: renderTopics, studio: renderStudio, quality: renderQuality, comments: renderComments, leads: renderLeads, feishu: renderFeishuImplementation };
  app.innerHTML = views[state.page]();
  renderGuide();
  updateRuntimeBadge();
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
  } else if (action === 'select-advisor') {
    const advisor = state.onboarding.advisors.find((item) => item.advisorId === target.dataset.advisorId);
    if (!advisor) return;
    state.onboarding.selectedAdvisorId = advisor.advisorId;
    state.currentAdvisorId = advisor.advisorId;
    if (advisor.initializationStatus === 'active') state.calibrated = true;
    render();
    showToast(`已选择顾问：${advisor.displayName || advisor.advisorId}`);
  } else if (action === 'resume-onboarding') {
    await resumeOnboardingSession();
    showToast(state.onboarding.session ? '已恢复上次画像初始化进度' : '没有可恢复的初始化进度', state.onboarding.session ? '' : 'warning');
  } else if (action === 'start-onboarding') {
    const input = readOnboardingForm();
    if (!input) return;
    state.busy = 'onboarding';
    state.onboarding.error = '';
    showToast('正在保存顾问资料并创建初始化会话…');
    try {
      await oneKosApi.createAdvisor(input);
      const payload = await oneKosApi.createOnboardingSession(input);
      state.onboarding.session = payload.data.session;
      state.onboarding.candidates = [];
      state.onboarding.selectedAdvisorId = input.advisorId.toUpperCase();
      state.currentAdvisorId = input.advisorId.toUpperCase();
      localStorage.setItem(ONBOARDING_STORAGE_KEY, payload.data.session.sessionId);
      render();
      showToast('资料已保存，可继续生成候选画像');
    } catch (error) {
      state.onboarding.error = error.message;
      render();
      showToast(`初始化会话创建失败：${error.message}`, 'warning');
    } finally {
      state.busy = '';
    }
  } else if (action === 'generate-onboarding') {
    if (!state.onboarding.session) return;
    state.busy = 'onboarding';
    showToast('正在生成带证据的候选画像…');
    try {
      const payload = await oneKosApi.generateOnboardingCandidates(state.onboarding.session.sessionId);
      state.onboarding.session = payload.data.session;
      state.onboarding.candidates = clone(payload.data.session.candidates || []).map((tag) => ({ ...tag, locked: false }));
      state.onboarding.error = '';
      render();
      showToast(`已生成 ${state.onboarding.candidates.length} 条候选画像`);
    } catch (error) {
      state.onboarding.error = error.message;
      render();
      showToast(`候选生成失败：${error.message}`, 'warning');
    } finally {
      state.busy = '';
    }
  } else if (action === 'remove-onboarding-tag') {
    state.onboarding.candidates.splice(Number(target.dataset.index), 1);
    render();
  } else if (action === 'lower-onboarding-tag') {
    const tag = state.onboarding.candidates[Number(target.dataset.index)];
    if (tag) tag.weight = Math.max(0, tag.weight - 10);
    render();
  } else if (action === 'lock-onboarding-tag') {
    const tag = state.onboarding.candidates[Number(target.dataset.index)];
    if (tag) tag.locked = !tag.locked;
    render();
  } else if (action === 'confirm-onboarding') {
    const acceptedTags = [...document.querySelectorAll('.candidate-tag')].map((row) => {
      const index = Number(row.dataset.candidateIndex);
      const tag = state.onboarding.candidates[index];
      return { tagId: tag.tagId, label: row.querySelector('[data-onboarding-label]').value, weight: Number(row.querySelector('[data-onboarding-weight]').value), locked: tag.locked };
    });
    if (!acceptedTags.length) {
      showToast('至少保留一条候选画像', 'warning');
      return;
    }
    state.busy = 'onboarding';
    showToast('正在确认画像并创建首条内容任务…');
    try {
      const sessionId = state.onboarding.session.sessionId;
      const payload = await oneKosApi.confirmOnboardingSession(sessionId, acceptedTags, `WEB-${sessionId}`);
      state.onboarding.result = payload.data;
      state.profile = onboardingTagsToProfile(payload.data);
      state.calibrated = true;
      state.currentAdvisorId = payload.data.advisor.advisorId;
      state.currentTaskId = payload.data.task.taskId;
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      render();
      showToast('画像 V1 已生效，首条内容任务已创建');
    } catch (error) {
      state.onboarding.error = error.message;
      render();
      showToast(`画像确认失败，可稍后重试：${error.message}`, 'warning');
    } finally {
      state.busy = '';
    }
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
    state.busy = 'content';
    showToast('正在读取画像、任务与品牌知识并生成内容…');
    try {
      const payload = await oneKosApi.generateContent({ advisorId: state.currentAdvisorId, taskId: state.currentTaskId, contentId: 'CONTENT-WEB-DEMO-001' });
      state.runtime = payload.runtime;
      state.content = apiContentToLegacy(payload.data.content);
      state.quality = apiQualityToLegacy(payload.data.quality);
      state.matrix = apiMatrixToLegacy(payload.data.quality, state.content);
      state.matrixResolved = payload.data.quality.matrix.risk !== '高';
      state.apiError = '';
      navigate('studio');
      showToast(`内容包已生成并${payload.data.write.action === 'created' ? '新建' : '更新'}写回，生成器：${payload.data.generator}`);
    } catch (error) {
      state.apiError = error.message;
      state.content = createContentPackage(state.selectedTopic, state.profile);
      state.matrixResolved = false;
      state.matrix = inspectMatrix(state.content, false);
      state.quality = runFourChecks(state.content, state.matrix);
      navigate('studio');
      showToast(`服务调用失败，已明确回退本地演示：${error.message}`, 'warning');
    } finally {
      state.busy = '';
      updateRuntimeBadge();
    }
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
    const comments = state.publication?.comments || [];
    showToast('正在抽取评论字段、计算线索等级并写回反馈事件…');
    try {
      const results = await Promise.all(comments.map((comment, index) => oneKosApi.analyzeComment({
        advisorId: state.currentAdvisorId, contentId: state.content?.contentId || 'CONTENT-WEB-DEMO-001',
        commentId: comment.id || `COMMENT-WEB-${index + 1}`, text: comment.text,
        platform: '抖音（模拟）', likes: comment.likes || 0,
        leadId: `LEAD-WEB-${index + 1}`, eventId: `EVENT-WEB-${index + 1}`,
      })));
      state.leads = results.map((payload, index) => {
        const lead = apiLeadToLegacy(payload.data.lead, comments[index]?.user);
        state.feedbackByLead[lead.id] = payload.data.feedbackEvent.eventId;
        state.runtime = payload.runtime;
        return lead;
      });
      state.apiError = '';
      navigate('leads');
      showToast(`已识别并写回 ${state.leads.length} 条模拟线索；A级线索等待人工接管`);
    } catch (error) {
      state.apiError = error.message;
      state.leads = extractSalesLeads(comments);
      navigate('leads');
      showToast(`服务调用失败，已明确回退本地识别：${error.message}`, 'warning');
    }
  } else if (action === 'takeover') {
    const lead = state.leads.find((item) => item.id === target.dataset.leadId);
    const feedbackEventId = state.feedbackByLead[target.dataset.leadId];
    try {
      if (feedbackEventId) await oneKosApi.confirmFeedback(feedbackEventId);
      state.leadStatuses[target.dataset.leadId] = true;
      if (lead?.grade === 'A') {
        state.profile = learnFromOutcome(state.profile, { tagId: 'local', detail: 'A级试驾线索验证“成都本地补能＋真实路线”内容有效' });
      }
      render();
      showToast(feedbackEventId ? '顾问已人工接管，反馈确认后已更新画像权重' : '顾问已人工接管，本地演示已记录结果');
    } catch (error) {
      state.apiError = error.message;
      showToast(`反馈确认失败：${error.message}`, 'warning');
    }
  } else if (action === 'refresh-runtime') {
    await refreshBackendState({ notify: true });
  } else if (action === 'reset') {
    const runtime = state.runtime;
    const backendState = state.backendState;
    state = initialState();
    state.runtime = runtime;
    state.backendState = backendState;
    navigate('dashboard');
    showToast('全部模拟状态已重置');
  }
});

render();
refreshBackendState();
loadAdvisors();
resumeOnboardingSession();
