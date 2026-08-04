export class FeishuOpenApiError extends Error {
  constructor(message, { code = null, status = null, details = null } = {}) {
    super(message);
    this.name = 'FeishuOpenApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class FeishuBitableClient {
  constructor({ appId, appSecret, appToken, apiBaseUrl = 'https://open.feishu.cn/open-apis', fetchImpl = globalThis.fetch, timeoutMs = 15_000, now = () => Date.now() }) {
    if (!appId || !appSecret || !appToken) throw new Error('飞书 App ID、App Secret 和 Base App Token 均不能为空');
    this.appId = appId;
    this.appSecret = appSecret;
    this.appToken = appToken;
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.now = now;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async getTenantAccessToken() {
    if (this.token && this.now() < this.tokenExpiresAt) return this.token;

    const body = await this.requestJson(`${this.apiBaseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    }, false);
    if (!body.tenant_access_token) throw new FeishuOpenApiError('飞书未返回 tenant_access_token', { details: body });

    this.token = body.tenant_access_token;
    const expiresInSeconds = Number(body.expire) || 7200;
    this.tokenExpiresAt = this.now() + Math.max(60, expiresInSeconds - 120) * 1000;
    return this.token;
  }

  async requestJson(url, options = {}, authenticated = true) {
    const headers = { ...(options.headers || {}) };
    if (authenticated) headers.Authorization = `Bearer ${await this.getTenantAccessToken()}`;
    const signal = options.signal || AbortSignal.timeout(this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, { ...options, headers, signal });
    } catch (error) {
      throw new FeishuOpenApiError(`飞书请求失败：${error.message}`, { details: error });
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new FeishuOpenApiError(`飞书返回非 JSON 响应（HTTP ${response.status}）`, { status: response.status });
    }
    if (!response.ok || (body.code !== undefined && body.code !== 0)) {
      throw new FeishuOpenApiError(`飞书 OpenAPI 错误：${body.msg || response.statusText || 'unknown error'}`, {
        code: body.code,
        status: response.status,
        details: body,
      });
    }
    return body;
  }

  recordsUrl(tableId, recordId = '') {
    const base = `${this.apiBaseUrl}/bitable/v1/apps/${encodeURIComponent(this.appToken)}/tables/${encodeURIComponent(tableId)}/records`;
    return recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
  }

  async listRecords(tableId, { pageSize = 500 } = {}) {
    const items = [];
    let pageToken = '';
    do {
      const url = new URL(this.recordsUrl(tableId));
      url.searchParams.set('page_size', String(Math.min(pageSize, 500)));
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const body = await this.requestJson(url, { method: 'GET' });
      items.push(...(body.data?.items || []));
      pageToken = body.data?.has_more ? body.data?.page_token || '' : '';
    } while (pageToken);
    return items;
  }

  async findRecordByField(tableId, fieldName, value) {
    const records = await this.listRecords(tableId);
    return records.find((record) => record.fields?.[fieldName] === value) || null;
  }

  async createRecord(tableId, fields) {
    const body = await this.requestJson(this.recordsUrl(tableId), {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ fields }),
    });
    return body.data?.record;
  }

  async updateRecord(tableId, recordId, fields) {
    const body = await this.requestJson(this.recordsUrl(tableId, recordId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ fields }),
    });
    return body.data?.record;
  }

  async upsertByField(tableId, keyField, keyValue, fields) {
    const existing = await this.findRecordByField(tableId, keyField, keyValue);
    if (existing) {
      const record = await this.updateRecord(tableId, existing.record_id, { ...fields, [keyField]: keyValue });
      return { action: 'updated', record };
    }
    const record = await this.createRecord(tableId, { ...fields, [keyField]: keyValue });
    return { action: 'created', record };
  }
}
