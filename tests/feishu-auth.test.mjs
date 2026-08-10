import assert from 'node:assert/strict';
import test from 'node:test';

import { FeishuOAuthClient, FeishuSessionStore } from '../src/feishu-auth.mjs';

test('飞书授权地址包含应用、回调地址和一次性 state', () => {
  const client = new FeishuOAuthClient({
    appId: 'cli_test', appSecret: 'secret', redirectUri: 'https://onekos.example/auth/feishu/callback',
  });
  const url = new URL(client.authorizeUrl('state-001'));
  assert.equal(url.searchParams.get('app_id'), 'cli_test');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://onekos.example/auth/feishu/callback');
  assert.equal(url.searchParams.get('state'), 'state-001');
});

test('一次性授权 state 与飞书用户会话可创建和恢复', () => {
  const store = new FeishuSessionStore({ random: () => 'fixed-token' });
  const state = store.createState('/');
  assert.equal(store.consumeState(state), '/');
  assert.equal(store.consumeState(state), null);
  const sessionId = store.createSession({ openId: 'ou_001', name: '顾问小林' });
  assert.deepEqual(store.getSession(sessionId), { openId: 'ou_001', name: '顾问小林' });
});
