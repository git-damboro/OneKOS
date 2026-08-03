import assert from 'node:assert/strict';

import { createAppServer } from '../server.mjs';

const server = createAppServer({ env: {} });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json();
  assert.equal(response.ok, true, `${path}: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true);
  return payload;
}

try {
  const health = await json('/api/health');
  assert.equal(health.runtime.mode, 'simulation');

  const state = await json('/api/demo/state');
  assert.equal(state.data.advisor.advisorId, 'ADV-017');

  const content = await json('/api/content/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-SMOKE-001' }),
  });
  assert.equal(content.data.quality.passed, true);

  const lead = await json('/api/comments/analyze', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      advisorId: 'ADV-017', contentId: 'CONTENT-SMOKE-001', commentId: 'COMMENT-SMOKE-001',
      text: '我在高新区，每天通勤 35 公里，没有家充，这周日可以约 L60 试驾顺便看看换电吗？',
      likes: 17, platform: '抖音（模拟）', leadId: 'LEAD-SMOKE-001', eventId: 'EVENT-SMOKE-001',
    }),
  });
  assert.equal(lead.data.lead.grade, 'A');
  assert.equal(lead.data.lead.automationAllowed, false);

  const feedback = await json('/api/feedback/EVENT-SMOKE-001/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(feedback.data.applied, true);
  console.log('OneKOS smoke passed: state → content → quality → lead → human-confirmed learning');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
