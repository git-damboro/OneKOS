import { randomUUID } from 'node:crypto';

export class FeishuOAuthClient {
  constructor({ appId, appSecret, redirectUri, authBaseUrl = 'https://accounts.feishu.cn', apiBaseUrl = 'https://open.feishu.cn/open-apis', fetchImpl = globalThis.fetch }) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.redirectUri = redirectUri;
    this.authBaseUrl = authBaseUrl.replace(/\/$/, '');
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  authorizeUrl(state) {
    const url = new URL(`${this.authBaseUrl}/open-apis/authen/v1/authorize`);
    url.searchParams.set('app_id', this.appId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code) {
    const response = await this.fetch(`${this.apiBaseUrl}/authen/v2/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: this.appId, client_secret: this.appSecret, redirect_uri: this.redirectUri }),
    });
    const body = await response.json();
    if (!response.ok || body.code) throw new Error(body.msg || '飞书登录授权失败');
    return body;
  }

  async getUser(accessToken) {
    const response = await this.fetch(`${this.apiBaseUrl}/authen/v1/user_info`, { headers: { authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok || body.code) throw new Error(body.msg || '无法读取飞书用户信息');
    const data = body.data || body;
    return { openId: data.open_id, userId: data.user_id || '', name: data.name || data.en_name || '飞书顾问', avatarUrl: data.avatar_url || '' };
  }
}

export class FeishuSessionStore {
  constructor({ random = () => randomUUID() } = {}) { this.random = random; this.states = new Map(); this.sessions = new Map(); }
  createState(returnTo = '/') { const state = this.random(); this.states.set(state, returnTo); return state; }
  consumeState(state) { const returnTo = this.states.get(state) || null; this.states.delete(state); return returnTo; }
  createSession(user) { const id = this.random(); this.sessions.set(id, { ...user }); return id; }
  getSession(id) { const user = this.sessions.get(id); return user ? { ...user } : null; }
}
