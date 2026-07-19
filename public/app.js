import {
  advisor,
  videos,
  comments,
  knowledgeBase,
  dashboardMetrics,
} from '/src/data.mjs';
import {
  analyzeComments,
  rankTopics,
  generateScript,
  runQualityCheck,
  simulatePublish,
  extractLeads,
  canPublish,
} from '/src/engine.mjs';

const PAGE_META = {
  dashboard: ['运营驾驶舱', '工作台'],
  comments: ['抖音评论洞察', '内容增长链路 / 第一步'],
  topics: ['智能选题', '内容增长链路 / 第二步'],
  script: ['脚本工作台', '内容增长链路 / 第三步'],
  quality: ['四重质检', '内容增长链路 / 第四步'],
  publish: ['模拟发布', '内容增长链路 / 第五步'],
  leads: ['评论转线索', '内容增长链路 / 第六步'],
};

const PAGE_STEP = { dashboard: 0, comments: 1, topics: 2, script: 3, quality: 4, publish: 5, leads: 6 };

function createInitialState() {
  const selectedVideoId = videos[0].id;
  return {
    page: 'dashboard',
    selectedVideoId,
    analysis: analyzeComments(comments[selectedVideoId]),
    topics: [],
    selectedTopic: null,
    originalScript: null,
    script: null,
    quality: null,
    qualityAfter: null,
    optimizedApplied: false,
    publication: null,
    leads: [],
    leadStatuses: {},
    loading: '',
  };
}

let state = createInitialState();
let toastTimer;

const appContent = document.querySelector('#app-content');
const pageTitle = document.querySelector('#page-title');
const breadcrumb = document.querySelector('#breadcrumb');
const flowDot = document.querySelector('#flow-dot');
const flowLabel = document.querySelector('#flow-label');
const toast = document.querySelector('#toast');

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(value);
const formatCompact = (value) => value >= 10000 ? `${(value / 10000).toFixed(value >= 100000 ? 1 : 2)}万` : formatNumber(value);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function maxCompletedStep() {
  if (state.leads.length) return 6;
  if (state.publication) return 5;
  if (state.quality) return 4;
  if (state.script) return 3;
  if (state.topics.length) return 2;
  if (state.page === 'comments') return 1;
  return 0;
}

function showToast(message, tone = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${tone}`;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2600);
}

function loadingMarkup() {
  if (!state.loading) return '';
  return `<div class="loading-layer"><div class="ai-loader"><span></span><span></span><span></span></div><strong>${escapeHtml(state.loading)}</strong><small>模拟 AI 正在处理本地数据</small></div>`;
}

function emptyState(title, description, action, label) {
  return `<section class="empty-state card"><div class="empty-illustration">✦</div><h2>${title}</h2><p>${description}</p><button class="primary-button" data-action="${action}">${label}<span>→</span></button></section>`;
}

function sectionHeader(kicker, title, description, actions = '') {
  return `<div class="section-heading"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function metricCard(label, value, delta, icon, tone = 'blue') {
  return `<article class="metric-card"><div class="metric-icon ${tone}">${icon}</div><div><span>${label}</span><strong>${value}</strong><small class="positive">↗ ${delta}</small></div></article>`;
}

function renderDashboard() {
  const flowItems = [
    ['评论洞察', '读取真实问题'], ['智能选题', '一题千解路由'], ['脚本生成', '事实核＋人格壳'],
    ['四重质检', '安全发布'], ['模拟发布', '互动回流'], ['线索识别', '人工接管'],
  ];
  const maxViews = Math.max(...videos.map((video) => video.metrics.views));
  return `
    <section class="welcome-panel">
      <div>
        <div class="live-pill"><i></i> 今日内容增长任务已就绪</div>
        <h2>下午好，${advisor.name}</h2>
        <p>评论区出现了新的高热需求。系统建议从“家庭空间”切入，预计可形成 <strong>18 条</strong>高意向对话。</p>
        <div class="button-row">
          <button class="primary-button light" data-action="go-comments">开始完整演示 <span>→</span></button>
          <button class="ghost-button light" data-page="topics">查看今日选题</button>
        </div>
      </div>
      <div class="hero-orbit" aria-hidden="true"><div class="orbit one"></div><div class="orbit two"></div><div class="core">AI</div><span class="chip c1">评论</span><span class="chip c2">脚本</span><span class="chip c3">线索</span></div>
    </section>

    <section class="metric-grid dashboard-metrics">
      ${metricCard('内容总曝光', formatCompact(dashboardMetrics.views), '+22.6% 较上周', '◈', 'blue')}
      ${metricCard('互动总量', formatCompact(dashboardMetrics.likes + dashboardMetrics.favorites + dashboardMetrics.shares), '+18.4% 较上周', '♡', 'violet')}
      ${metricCard('评论洞察', formatNumber(dashboardMetrics.comments), '新增 286 条', '◉', 'cyan')}
      ${metricCard('合格销售线索', formatNumber(dashboardMetrics.qualifiedLeads), '+31.2% 较上周', '◎', 'green')}
    </section>

    <section class="card flow-card">
      ${sectionHeader('ONEKOS LOOP', '今日增长闭环', '从评论信号到销售线索，每一步都可解释、可回看。', '<span class="data-note">全链路约 5 分钟</span>')}
      <div class="flow-track">
        ${flowItems.map(([title, desc], index) => `<div class="flow-node ${index === 0 ? 'current' : ''}"><b>${index + 1}</b><strong>${title}</strong><span>${desc}</span></div>${index < flowItems.length - 1 ? '<i>→</i>' : ''}`).join('')}
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="card performance-card">
        ${sectionHeader('CONTENT PULSE', '近期内容表现', '模拟抖音账号近三条视频互动表现。', '<button class="text-button" data-page="comments">查看洞察 →</button>')}
        <div class="video-list">
          ${videos.map((video, index) => `<button class="video-row" data-action="select-dashboard-video" data-video-id="${video.id}"><div class="rank">0${index + 1}</div><div class="mini-cover cover-${index}">${video.cover.replace('\n', '<br>')}</div><div class="video-info"><strong>${video.title}</strong><span>${video.publishedAt} · ${video.duration}</span></div><div class="bar-cell"><div><i style="width:${Math.round(video.metrics.views / maxViews * 100)}%"></i></div><span>${formatCompact(video.metrics.views)} 播放</span></div><em>${video.trend}</em></button>`).join('')}
        </div>
      </section>

      <aside class="card dna-card">
        ${sectionHeader('CONTENT DNA', '顾问内容 DNA', '动态人设决定内容表达，而不只是改写语气。')}
        <div class="dna-profile"><div class="large-avatar">林</div><div><h3>${advisor.name}</h3><p>${advisor.city} · ${advisor.experience}</p></div><span>完整度 92%</span></div>
        <blockquote>“${advisor.signature}”</blockquote>
        <dl><div><dt>专业特长</dt><dd>${advisor.strengths.map((tag) => `<span>${tag}</span>`).join('')}</dd></div><div><dt>生活身份</dt><dd>${advisor.identities.map((tag) => `<span>${tag}</span>`).join('')}</dd></div><div><dt>目标用户</dt><dd>${advisor.audience}</dd></div><div><dt>表达方式</dt><dd>${advisor.voice}</dd></div></dl>
      </aside>
    </div>`;
}

function sentimentTag(text) {
  if (/实用|不错|靠谱|清楚|喜欢|收藏|有用/.test(text)) return ['正向', 'positive'];
  if (/挤|担心|焦虑|不敢|难受|问题/.test(text)) return ['质疑', 'negative'];
  if (/试驾|换车|准备定|预约/.test(text)) return ['高意向', 'intent'];
  return ['咨询', 'neutral'];
}

function renderComments() {
  const video = videos.find((item) => item.id === state.selectedVideoId);
  const analysis = state.analysis;
  const totalSentiment = Math.max(1, analysis.total);
  const positive = Math.round(analysis.sentiment.positive / totalSentiment * 100);
  const neutral = Math.round(analysis.sentiment.neutral / totalSentiment * 100);
  const negative = 100 - positive - neutral;
  const maxNeed = Math.max(1, ...analysis.topNeeds.map((item) => item.count));
  return `
    ${sectionHeader('STEP 01 · SIGNAL', '让评论区决定下一条内容', 'AI 汇总评论语义与互动信号，识别真实问题、争议点和购车意向。', '<button class="primary-button" data-action="generate-topics">生成智能选题 <span>→</span></button>')}
    <div class="notice-bar"><span>抖</span><div><strong>抖音数据连接器 · 演示模式</strong><small>以下评论、点赞、收藏、转发与用户信息均为模拟数据，不连接真实账号。</small></div><b>数据已同步 · 刚刚</b></div>

    <section class="card video-selector-card">
      <label for="video-select">正在分析的视频</label>
      <div class="video-select-wrap"><div class="selected-cover">${video.cover.replace('\n', '<br>')}</div><div><strong>${video.title}</strong><span>${video.publishedAt} · ${video.duration}</span></div><select id="video-select" aria-label="选择视频">${videos.map((item) => `<option value="${item.id}" ${item.id === video.id ? 'selected' : ''}>${item.title}</option>`).join('')}</select></div>
      <div class="inline-metrics"><div><span>播放</span><strong>${formatCompact(video.metrics.views)}</strong></div><div><span>点赞</span><strong>${formatCompact(video.metrics.likes)}</strong></div><div><span>收藏</span><strong>${formatCompact(video.metrics.favorites)}</strong></div><div><span>转发</span><strong>${formatCompact(video.metrics.shares)}</strong></div><div><span>评论</span><strong>${formatCompact(video.metrics.comments)}</strong></div><div><span>完播率</span><strong>${video.metrics.completion}%</strong></div></div>
    </section>

    <div class="insight-grid">
      <section class="card sentiment-card">
        <div class="card-title"><div><span class="eyebrow">SENTIMENT</span><h3>评论区情绪</h3></div><span class="sample-pill">样本 ${analysis.total} 条</span></div>
        <div class="sentiment-layout"><div class="donut" style="--positive:${positive};--neutral:${neutral}"><div><strong>${positive}%</strong><span>积极</span></div></div><div class="legend"><div><i class="pos"></i><span>积极认同</span><strong>${positive}%</strong></div><div><i class="neu"></i><span>理性咨询</span><strong>${neutral}%</strong></div><div><i class="neg"></i><span>质疑担忧</span><strong>${negative}%</strong></div></div></div>
        <p class="risk-line ${analysis.sentiment.negative > analysis.sentiment.positive ? 'warn' : ''}"><b>风向判断</b>${analysis.risk}</p>
      </section>

      <section class="card needs-card">
        <div class="card-title"><div><span class="eyebrow">DEMAND CLUSTERS</span><h3>高频用户需求</h3></div><span class="sample-pill">语义聚类</span></div>
        <div class="need-bars">${analysis.topNeeds.slice(0, 5).map((need, index) => `<div class="need-row"><div><span><b>0${index + 1}</b>${need.label}</span><strong>${need.count}条</strong></div><div><i style="width:${Math.round(need.count / maxNeed * 100)}%"></i></div><small>${need.examples[0] ?? '暂无代表评论'}</small></div>`).join('')}</div>
      </section>

      <aside class="wind-card">
        <span class="eyebrow light">AI DIRECTION</span><h3>评论区风向结论</h3><p>${analysis.direction}</p>
        <div class="wind-stat"><div><span>潜在线索</span><strong>${analysis.intentionCount}</strong></div><div><span>首要需求</span><strong>${analysis.topNeeds[0]?.label ?? '真实用车'}</strong></div></div>
        <div class="ai-advice"><i>✦</i><div><strong>建议下一步</strong><span>围绕“${analysis.topNeeds[0]?.label ?? '真实场景'}”生成差异化选题，并用本地实测回答争议。</span></div></div>
      </aside>
    </div>

    <section class="card comment-stream">
      <div class="card-title"><div><span class="eyebrow">VOICE OF CUSTOMER</span><h3>代表评论与意向信号</h3></div><div class="filter-pills"><span class="active">全部</span><span>高意向</span><span>质疑</span></div></div>
      <div class="comment-list">${comments[video.id].slice(0, 9).map((comment, index) => { const [label, tone] = sentimentTag(comment.text); return `<article class="comment-item"><div class="comment-avatar a${index % 5}">${comment.user.slice(0, 1)}</div><div><strong>${comment.user}<span>${comment.time}</span></strong><p>${comment.text}</p><small>♡ ${comment.likes}</small></div><em class="tag ${tone}">${label}</em></article>`; }).join('')}</div>
    </section>${loadingMarkup()}`;
}

function renderTopics() {
  if (!state.topics.length) return emptyState('先让 AI 读懂评论区', '选择一条模拟抖音视频，完成评论风向与用户需求分析后，即可生成三个个性化选题。', 'go-comments', '前往评论洞察');
  return `
    ${sectionHeader('STEP 02 · ROUTER', '一题千解：把热门问题变成你的内容', '系统按评论热度、顾问 DNA 和矩阵空白度排序，推荐最适合林一凡的三个选题。', state.selectedTopic ? '<button class="primary-button" data-action="generate-script">生成完整脚本 <span>→</span></button>' : '')}
    <section class="dna-ribbon"><div class="large-avatar small">林</div><div><strong>${advisor.name}的内容 DNA 已参与路由</strong><span>${advisor.strengths.join(' · ')} · ${advisor.voice}</span></div><div class="match-capsules"><span>本地场景</span><span>家庭用户</span><span>理性表达</span></div></section>
    <div class="topic-grid">${state.topics.map((topic, index) => `<article class="topic-card ${state.selectedTopic?.id === topic.id ? 'selected' : ''}" data-action="select-topic" data-topic-id="${topic.id}"><div class="topic-top"><span class="topic-rank">推荐 0${index + 1}</span><div class="score-ring" style="--score:${topic.score}"><strong>${topic.score}</strong><small>匹配度</small></div></div><span class="topic-label">${topic.label} · ${topic.format}</span><h3>${topic.title}</h3><p>${topic.reason}</p><div class="topic-signals"><span>评论需求 <b>${topic.demandCount}</b></span><span>互动潜力 <b>${topic.potential}/10</b></span></div><button type="button">${state.selectedTopic?.id === topic.id ? '已选中，生成脚本' : '选择这个选题'} <span>→</span></button></article>`).join('')}</div>
    <section class="card matrix-panel"><div><span class="eyebrow">ECHO ROOM DETECTOR</span><h3>矩阵空白补位</h3><p>过去 14 天同类内容集中在“参数对比”，真实家庭场景覆盖不足。当前推荐优先补位“条件判断”和“本地实测”。</p></div><div class="coverage-map"><span style="--v:88">参数对比</span><span style="--v:65">权益解读</span><span class="gap" style="--v:24">家庭场景</span><span class="gap" style="--v:18">本地补能</span></div></section>${loadingMarkup()}`;
}

function renderScript() {
  if (!state.script) return emptyState('脚本尚未生成', '先从三个推荐选题中选择一个，系统才会把“事实核”和“人格壳”组合为完整交付件。', state.topics.length ? 'go-topics' : 'go-comments', state.topics.length ? '选择选题' : '从评论洞察开始');
  const script = state.script;
  return `
    ${sectionHeader('STEP 03 · CREATION', '事实核 × 人格壳：生成可直接拍摄的脚本', '脚本由知识库事实、顾问真实表达和评论区需求共同驱动。', '<button class="secondary-button" data-action="copy-script">复制脚本</button><button class="primary-button" data-action="run-quality">执行四重质检 <span>→</span></button>')}
    <div class="script-layout">
      <section class="card script-main">
        <div class="script-meta"><span>建议时长 ${script.duration}</span><span>目标人群 ${script.target}</span><span class="draft-status">AI 初稿 · 待质检</span></div>
        <label>推荐标题</label><h2>${script.title}</h2>
        <div class="hook-box"><span>0—5s 开场钩子</span><p>“${script.hook}”</p></div>
        <label>完整口播</label><div class="body-copy">${script.body}</div>
        <div class="demo-risk"><i>!</i><div><strong>演示用待检句</strong><span>这套方案保证所有家庭都满意，现在价格只有19.98万元。</span></div></div>
        <label>评论区转化动作</label><div class="cta-copy">${script.cta}</div>
      </section>
      <aside class="script-side">
        <section class="card facts-card"><div class="card-title"><h3>事实核</h3><span class="verified-pill">✓ 知识库可追溯</span></div>${knowledgeBase.slice(0, 3).map((fact) => `<div class="fact-item"><strong>${fact.field}</strong><span>${fact.value}</span><small>${fact.source} · 有效至${fact.validUntil}</small></div>`).join('')}</section>
        <section class="card persona-card"><div class="card-title"><h3>人格壳</h3><span class="verified-pill purple">DNA 92%</span></div><div class="persona-quote">“${advisor.signature}”</div><div class="persona-tags">${[...advisor.identities, ...advisor.strengths.slice(0, 2)].map((item) => `<span>${item}</span>`).join('')}</div></section>
      </aside>
    </div>
    <section class="card storyboard-card"><div class="card-title"><div><span class="eyebrow">SHOT LIST</span><h3>分镜与素材清单</h3></div><span class="sample-pill">共 ${script.shots.length} 镜</span></div><div class="shot-list">${script.shots.map((shot, index) => `<article><b>${String(index + 1).padStart(2, '0')}</b><div><span>${shot.time}</span><strong>${shot.frame}</strong><p>${shot.line}</p></div><em>${shot.asset}</em></article>`).join('')}</div><div class="material-row">${script.materials.map((item) => `<span>□ ${item}</span>`).join('')}</div></section>
    <section class="card comment-plan"><div><span class="eyebrow">COMMENT PLAN</span><h3>评论区预案</h3></div>${script.commentPlan.map((item, index) => `<div><b>0${index + 1}</b><span>${item}</span></div>`).join('')}</section>${loadingMarkup()}`;
}

function qualityScoreCard(label, score, description, tone) {
  return `<article class="quality-score"><div class="score-ring large ${tone}" style="--score:${score}"><strong>${score}</strong><small>分</small></div><div><h3>${label}</h3><p>${description}</p><span>${score >= 90 ? '表现优秀' : '建议优化'}</span></div></article>`;
}

function renderQuality() {
  if (!state.quality) return emptyState('等待脚本质检', '生成脚本后，系统会从事实、合规、人设和矩阵四个维度检查风险。', state.script ? 'run-quality' : 'go-script', state.script ? '立即执行质检' : '前往脚本工作台');
  const displayed = state.qualityAfter ?? state.quality;
  const publishReady = canPublish(state.qualityAfter);
  const scores = displayed.scores;
  return `
    ${sectionHeader('STEP 04 · GUARDRAIL', '发布前四重质检', '每一条事实都可追溯，每一句表达都保持合规、人设一致和矩阵差异。', publishReady ? '<button class="primary-button" data-page="publish">进入发布确认 <span>→</span></button>' : '<button class="primary-button" data-action="apply-optimization">应用 AI 安全改写 <span>→</span></button>')}
    ${publishReady ? '<div class="success-banner"><i>✓</i><div><strong>优化已应用，四重质检通过</strong><span>无来源价格和绝对化表达已替换，脚本可进入模拟发布。</span></div><b>READY</b></div>' : `<div class="warning-banner"><i>!</i><div><strong>仍有 ${displayed.issues.length} 项待优化内容</strong><span>质检结果尚未满足发布门禁，必须完成安全改写并通过二次质检。</span></div><b>NEEDS REVIEW</b></div>`}
    <div class="quality-grid">
      ${qualityScoreCard('事实核验', scores.fact, '参数、权益与时效来源', 'blue')}
      ${qualityScoreCard('合规表达', scores.compliance, '绝对化与承诺性表达', 'green')}
      ${qualityScoreCard('人设一致', scores.persona, '顾问经历与表达习惯', 'purple')}
      ${qualityScoreCard('矩阵差异', scores.matrix, '选题、结构与语义重复', 'orange')}
    </div>
    <div class="quality-detail-grid">
      <section class="card issue-panel"><div class="card-title"><div><span class="eyebrow">ISSUE LIST</span><h3>风险定位</h3></div><span class="sample-pill">${state.quality.issues.length} 项</span></div>${state.quality.issues.map((issue, index) => `<article class="issue-item"><span class="issue-index">${index + 1}</span><div><strong><em>${issue.type}</em>${issue.text}</strong><p>${issue.suggestion}</p></div><b>${issue.severity}风险</b></article>`).join('') || '<div class="all-clear">✓ 未发现高风险内容</div>'}</section>
      <section class="card compare-panel"><div class="card-title"><div><span class="eyebrow">BEFORE / AFTER</span><h3>修改前后对照</h3></div><span class="verified-pill purple">AI 建议</span></div><div class="compare-copy before"><span>修改前</span><p>这套方案<span>保证所有家庭都满意</span>，现在价格只有<span>19.98万元</span>。</p></div><div class="compare-arrow">↓</div><div class="compare-copy after"><span>安全改写</span><p>${state.quality.optimized.body.slice(-85)}</p></div></section>
    </div>
    <section class="card matrix-check"><div><span class="eyebrow">MATRIX CHECK</span><h3>回声室探测器</h3><p>与近 14 天矩阵内容进行文字、语义、结构、视觉与选题覆盖比对。</p></div><div class="matrix-scores"><span>文字重复 <b>6%</b></span><span>语义近似 <b>9%</b></span><span>结构重复 <b>8%</b></span><span>选题空白补位 <b class="good">高</b></span></div></section>${loadingMarkup()}`;
}

function renderPublish() {
  if (!state.script) return emptyState('还没有可发布内容', '完成脚本生成和四重质检后，才能进入模拟发布与互动回流。', 'go-script', '前往脚本工作台');
  if (!canPublish(state.qualityAfter)) return emptyState('发布前必须通过四重质检', '当前脚本尚未通过二次质检，模拟发布门禁已阻止继续操作。', state.quality ? 'go-quality' : 'run-quality', state.quality ? '返回四重质检' : '立即执行质检');
  if (!state.publication) return `
    ${sectionHeader('STEP 05 · PUBLISH', '确认内容并模拟发布到抖音', '本演示不会连接真实抖音账号，也不会产生任何外部发布行为。')}
    <div class="publish-preview">
      <section class="phone-frame"><div class="phone-top">9:41 <span>● ●</span></div><div class="phone-video"><div class="video-gradient"><span>千面·OneKOS 模拟内容</span><strong>${state.script.hook}</strong><i>▶</i></div><div class="douyin-actions"><b>林</b><span>♡<small>2.3k</small></span><span>◉<small>286</small></span><span>☆<small>920</small></span><span>↗<small>430</small></span></div><div class="video-caption"><strong>@林一凡说新能源</strong><p>${state.script.title}</p><span>♫ 原声 · 林一凡</span></div></div></section>
      <section class="card publish-confirm"><span class="eyebrow">PUBLISH CHECK</span><h2>发布确认</h2><div class="confirm-item done"><i>✓</i><div><strong>四重质检</strong><span>${state.optimizedApplied ? '已通过，优化内容已应用' : '演示模式：建议先应用安全改写'}</span></div></div><div class="confirm-item done"><i>✓</i><div><strong>顾问真实素材</strong><span>已模拟补充口播、实车和门店场景</span></div></div><div class="confirm-item done"><i>✓</i><div><strong>抖音发布设置</strong><span>竖屏 1080×1920 · 评论开放 · 同城可见</span></div></div><div class="simulation-warning"><strong>演示安全边界</strong><p>点击后仅生成本地模拟发布结果，不会访问抖音或任何外部系统。</p></div><button class="primary-button full" data-action="simulate-publish">确认并模拟发布 <span>↗</span></button></section>
    </div>${loadingMarkup()}`;
  const p = state.publication;
  return `
    ${sectionHeader('STEP 05 · FEEDBACK', '模拟发布成功，互动信号开始回流', 'AI 持续读取评论和互动变化，为下一轮脚本与销售跟进提供信号。', '<button class="primary-button" data-action="extract-leads">识别高意向线索 <span>→</span></button>')}
    <div class="publish-success"><div class="success-orbit"><i>✓</i></div><div><span>SIMULATED PUBLISH</span><h2>${p.status}</h2><p>${p.publishedAt} · @林一凡说新能源 · 不产生真实外部行为</p></div><b>正在监听新互动 <i></i></b></div>
    <section class="metric-grid publish-metrics">${metricCard('预测播放', formatCompact(p.predicted.views), '+16% 同类均值', '▶', 'blue')}${metricCard('预测点赞', formatCompact(p.predicted.likes), '+12% 同类均值', '♡', 'violet')}${metricCard('预测收藏', formatCompact(p.predicted.favorites), '+28% 同类均值', '☆', 'cyan')}${metricCard('合格线索', p.predicted.qualifiedLeads, '+30% 千次曝光', '◎', 'green')}</section>
    <div class="feedback-grid"><section class="card live-comments"><div class="card-title"><div><span class="eyebrow">LIVE FEEDBACK</span><h3>新评论回流</h3></div><span class="live-badge"><i></i> 实时模拟</span></div>${p.newComments.map((comment, index) => `<article class="comment-item"><div class="comment-avatar a${index}">${comment.user[0]}</div><div><strong>${comment.user}<span>${comment.time}</span></strong><p>${comment.text}</p><small>♡ ${comment.likes}</small></div>${/试驾|买车|换车/.test(comment.text) ? '<em class="tag intent">意向信号</em>' : '<em class="tag positive">内容反馈</em>'}</article>`).join('')}</section><aside class="learning-card"><span class="eyebrow light">STRATEGY LEARNING</span><h3>策略学习</h3><p>${p.learning}</p><div><span>收藏率预测</span><strong>2.38%</strong><i style="width:78%"></i></div><div><span>线索/千次曝光</span><strong>0.54</strong><i style="width:66%"></i></div><button data-action="extract-leads">进入线索工作台 →</button></aside></div>${loadingMarkup()}`;
}

function renderLeads() {
  if (!state.leads.length) return emptyState('等待评论转线索', '模拟发布并接收新评论后，AI 将抽取城市、家庭、车型、购车时间和试驾意愿。', state.publication ? 'extract-leads' : 'go-publish', state.publication ? '立即识别线索' : '先完成模拟发布');
  const gradeCount = (grade) => state.leads.filter((lead) => lead.grade === grade).length;
  return `
    ${sectionHeader('STEP 06 · CONVERSION', '从评论信号到销售线索', 'AI 只做识别、分级与建议；高意向客户由顾问人工接管。', '<button class="secondary-button" data-action="reset-demo">重置演示</button>')}
    <div class="lead-summary"><article class="grade-card grade-a"><span>A</span><div><strong>${gradeCount('A')} 条</strong><small>高意向 · 立即接管</small></div></article><article class="grade-card grade-b"><span>B</span><div><strong>${gradeCount('B')} 条</strong><small>明确需求 · 补充信息</small></div></article><article class="grade-card grade-c"><span>C</span><div><strong>${gradeCount('C')} 条</strong><small>长期关注 · 内容培育</small></div></article><article class="grade-card total"><span>◎</span><div><strong>${state.leads.length} 条</strong><small>本轮识别线索</small></div></article></div>
    <section class="card lead-table-card"><div class="card-title"><div><span class="eyebrow">LEAD WORKBENCH</span><h3>评论线索工作台</h3></div><div class="filter-pills"><span class="active">全部</span><span>A级</span><span>待跟进</span></div></div><div class="table-scroll"><table class="lead-table"><thead><tr><th>用户与原评论</th><th>城市 / 家庭</th><th>关注车型</th><th>购车时间</th><th>试驾意愿</th><th>线索等级</th><th>下一步建议</th><th>操作</th></tr></thead><tbody>${state.leads.sort((a, b) => b.score - a.score).map((lead) => `<tr><td><div class="lead-user"><div>${lead.user[0]}</div><span><strong>${lead.user}</strong><small>${lead.sourceComment}</small></span></div></td><td><strong>${lead.city}</strong><small>${lead.family}</small></td><td>${lead.model}</td><td>${lead.purchaseWindow}</td><td><span class="intent-dot ${lead.testDriveIntent}">${lead.testDriveIntent}</span></td><td><span class="grade grade-${lead.grade.toLowerCase()}">${lead.grade}</span><small>${lead.score}分</small></td><td><span class="next-action">${lead.nextAction}</span></td><td><button class="takeover-button ${state.leadStatuses[lead.id] ? 'done' : ''}" data-action="takeover-lead" data-lead-id="${lead.id}">${state.leadStatuses[lead.id] ? '已接管' : '人工接管'}</button></td></tr>`).join('')}</tbody></table></div></section>
    <section class="closed-loop"><div><span>内容</span><i>→</i><span>互动</span><i>→</i><span>试驾</span><i>→</i><span>成交</span><i>→</i><span>策略学习</span></div><h3>OneKOS 增长闭环已完整走通</h3><p>本轮从评论洞察中形成选题，经脚本、质检和发布回流，最终识别 ${state.leads.length} 条可跟进线索。</p><button class="primary-button light" data-action="reset-demo">重新演示 <span>↻</span></button></section>${loadingMarkup()}`;
}

function updateChrome() {
  const [title, trail] = PAGE_META[state.page];
  pageTitle.textContent = title;
  breadcrumb.textContent = `千面·OneKOS / ${trail}`;
  document.title = `${title}｜千面·OneKOS`;
  document.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === state.page));
  const completed = maxCompletedStep();
  flowDot.textContent = completed;
  flowLabel.textContent = completed ? `${completed}/6 已完成` : '准备开始';
}

function render() {
  updateChrome();
  const views = { dashboard: renderDashboard, comments: renderComments, topics: renderTopics, script: renderScript, quality: renderQuality, publish: renderPublish, leads: renderLeads };
  appContent.innerHTML = views[state.page]();
}

function navigate(page) {
  if (!PAGE_META[page]) return;
  state.page = page;
  document.body.classList.remove('nav-open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  appContent.focus({ preventScroll: true });
}

async function runSimulatedStep(message, action) {
  state.loading = message;
  render();
  await new Promise((resolve) => setTimeout(resolve, 620));
  action();
  state.loading = '';
  render();
}

document.addEventListener('change', (event) => {
  if (event.target.id !== 'video-select') return;
  state.selectedVideoId = event.target.value;
  state.analysis = analyzeComments(comments[state.selectedVideoId]);
  state.topics = [];
  state.selectedTopic = null;
  state.originalScript = null;
  state.script = null;
  state.quality = null;
  state.qualityAfter = null;
  state.optimizedApplied = false;
  state.publication = null;
  state.leads = [];
  state.leadStatuses = {};
  render();
  showToast('已切换视频并重新完成评论分析');
});

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
  } else if (action === 'go-comments') {
    navigate('comments');
  } else if (action === 'select-dashboard-video') {
    state.selectedVideoId = target.dataset.videoId;
    state.analysis = analyzeComments(comments[state.selectedVideoId]);
    navigate('comments');
  } else if (action === 'generate-topics') {
    await runSimulatedStep('正在聚类评论需求并匹配内容 DNA…', () => {
      state.topics = rankTopics(state.analysis, advisor);
      state.selectedTopic = state.topics[0];
      state.page = 'topics';
    });
    showToast('已生成 3 个差异化选题');
  } else if (action === 'select-topic') {
    state.selectedTopic = state.topics.find((topic) => topic.id === target.dataset.topicId);
    render();
    showToast(`已选择：${state.selectedTopic.title}`);
  } else if (action === 'go-topics') {
    navigate('topics');
  } else if (action === 'generate-script') {
    if (!state.selectedTopic) state.selectedTopic = state.topics[0];
    await runSimulatedStep('正在组合事实核、人格壳与评论区问题…', () => {
      const generated = generateScript(state.selectedTopic, advisor);
      generated.body += ' 这套方案保证所有家庭都满意，现在价格只有19.98万元。';
      state.originalScript = structuredClone(generated);
      state.script = generated;
      state.page = 'script';
    });
    showToast('完整拍摄脚本已生成');
  } else if (action === 'go-script') {
    navigate('script');
  } else if (action === 'copy-script') {
    try {
      await navigator.clipboard.writeText(`${state.script.title}\n\n${state.script.hook}\n\n${state.script.body}\n\n${state.script.cta}`);
      showToast('脚本已复制到剪贴板');
    } catch {
      showToast('浏览器未授予剪贴板权限，可直接选中复制', 'warning');
    }
  } else if (action === 'run-quality') {
    await runSimulatedStep('正在执行事实、合规、人设、矩阵四重质检…', () => {
      state.quality = runQualityCheck(state.script, knowledgeBase);
      state.qualityAfter = null;
      state.optimizedApplied = false;
      state.page = 'quality';
    });
    showToast(`质检完成，定位 ${state.quality.issues.length} 项风险`,'warning');
  } else if (action === 'go-quality') {
    navigate('quality');
  } else if (action === 'apply-optimization') {
    await runSimulatedStep('正在应用安全改写并重新质检…', () => {
      state.script = state.quality.optimized;
      state.qualityAfter = runQualityCheck(state.script, knowledgeBase);
      state.optimizedApplied = canPublish(state.qualityAfter);
    });
    showToast(state.optimizedApplied ? '优化已应用，四重质检通过' : '仍有风险项，发布门禁保持关闭', state.optimizedApplied ? 'success' : 'warning');
  } else if (action === 'go-publish') {
    navigate('publish');
  } else if (action === 'simulate-publish') {
    if (!canPublish(state.qualityAfter)) {
      navigate('quality');
      showToast('发布已阻止：请先通过四重质检', 'warning');
      return;
    }
    await runSimulatedStep('正在模拟发布并生成互动回流…', () => {
      state.publication = simulatePublish(state.selectedTopic ?? { id: 'space' });
    });
    showToast('模拟发布成功，新评论正在回流');
  } else if (action === 'extract-leads') {
    await runSimulatedStep('正在抽取城市、家庭、车型与试驾意愿…', () => {
      state.leads = extractLeads(state.publication?.newComments ?? []);
      state.page = 'leads';
    });
    showToast(`已识别 ${state.leads.length} 条销售线索`);
  } else if (action === 'takeover-lead') {
    state.leadStatuses[target.dataset.leadId] = true;
    render();
    showToast('线索已由林一凡人工接管');
  } else if (action === 'reset-demo') {
    state = createInitialState();
    navigate('dashboard');
    showToast('演示数据已重置');
  }
});

render();
