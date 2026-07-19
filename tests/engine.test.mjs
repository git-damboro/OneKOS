import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeComments,
  rankTopics,
  generateScript,
  runQualityCheck,
  simulatePublish,
  extractLeads,
  canPublish,
} from '../src/engine.mjs';

test('评论分析输出情绪、需求和风向', () => {
  const comments = [
    { text: '成都二胎家庭，后排空间怎么样？这周想试驾', likes: 18 },
    { text: '这个讲解很实用，空间看着不错', likes: 9 },
    { text: '后排是不是有点挤，第三排能坐成年人吗', likes: 6 },
  ];

  const result = analyzeComments(comments);

  assert.equal(result.total, 3);
  assert.equal(result.topNeeds[0].key, 'space');
  assert.equal(result.sentiment.positive, 1);
  assert.match(result.direction, /空间/);
});

test('选题按需求热度与顾问匹配度排序', () => {
  const analysis = {
    total: 12,
    topNeeds: [
      { key: 'charging', label: '充电补能', count: 10 },
      { key: 'space', label: '家庭空间', count: 2 },
    ],
  };
  const advisor = { strengths: ['充电规划', '家庭用车'] };

  const topics = rankTopics(analysis, advisor);

  assert.equal(topics.length, 3);
  assert.equal(topics[0].id, 'charging');
  assert.match(topics[0].title, /充电|家充/);
  assert.ok(topics[0].score > topics[1].score);
});

test('脚本包含开场、口播、分镜和转化动作', () => {
  const topic = { id: 'charging', title: '没有家充，纯电车到底能不能买？' };
  const advisor = { name: '林一凡', city: '成都', voice: '理性、真诚、给结论' };

  const script = generateScript(topic, advisor);

  assert.match(script.hook, /家充|充电/);
  assert.match(script.body, /林一凡|成都/);
  assert.ok(script.shots.length >= 4);
  assert.ok(script.materials.length >= 3);
  assert.ok(script.commentPlan.length >= 2);
  assert.match(script.cta, /评论区/);
});

test('质检能发现无来源事实和绝对化表述', () => {
  const result = runQualityCheck(
    {
      title: '全网最低价，闭眼买',
      hook: '这台车续航一定达到700公里。',
      body: '保证所有家庭都满意，现在价格只有19.98万元。',
    },
    [{ field: '指导价', value: '21.98万元', validUntil: '2026-12-31' }],
  );

  assert.ok(result.issues.some((issue) => issue.type === '事实'));
  assert.ok(result.issues.some((issue) => issue.type === '合规'));
  assert.ok(result.scores.fact < 90);
  assert.notEqual(result.optimized.body, '保证所有家庭都满意，现在价格只有19.98万元。');
});

test('事实核验必须精确匹配数值与单位', () => {
  const result = runQualityCheck(
    { title: '空间实测', hook: '后备箱有500升', body: '城市实测只开了20公里。' },
    [
      { field: '续航', value: '620公里', validUntil: '2026-12-31' },
      { field: '后备箱', value: '532升', validUntil: '2026-12-31' },
    ],
  );

  assert.ok(result.issues.some((issue) => issue.text.includes('20公里')));
  assert.ok(result.issues.some((issue) => issue.text.includes('500升')));
});

test('只有二次质检真正通过时才允许发布', () => {
  assert.equal(canPublish(null), false);
  assert.equal(canPublish({ passed: false, issues: [{ type: '合规' }] }), false);
  assert.equal(canPublish({ passed: true, issues: [] }), true);
});

test('模拟发布返回预测指标和回流评论', () => {
  const result = simulatePublish({ id: 'charging', title: '没有家充能买吗' });

  assert.ok(result.predicted.views > 0);
  assert.ok(result.predicted.comments > 0);
  assert.ok(result.newComments.length >= 4);
  assert.ok(result.newComments.some((comment) => /试驾|到店/.test(comment.text)));
});

test('评论可提取为A级试驾线索', () => {
  const comments = [
    {
      id: 'c1',
      user: '阿杰',
      text: '我在成都，二胎家庭，想看A7，这周六能安排试驾吗？',
      likes: 5,
    },
  ];

  const [lead] = extractLeads(comments);

  assert.equal(lead.grade, 'A');
  assert.equal(lead.city, '成都');
  assert.equal(lead.family, '二胎家庭');
  assert.equal(lead.model, 'A7');
  assert.equal(lead.purchaseWindow, '7天内');
  assert.equal(lead.testDriveIntent, '强');
});

test('低意向泛咨询评论分为C级', () => {
  const [lead] = extractLeads([
    { id: 'c2', user: '路人甲', text: '先了解一下，明年再考虑换车', likes: 1 },
  ]);

  assert.equal(lead.grade, 'C');
  assert.equal(lead.purchaseWindow, '长期关注');
  assert.equal(lead.nextAction, '持续内容培育');
});
