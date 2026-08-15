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
    this.upsertQueues = new Map();
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
    let response;
    const retryable = authenticated === false || (options.method || 'GET').toUpperCase() === 'GET';
    const attempts = retryable ? 3 : 1;
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        response = await this.fetchImpl(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(this.timeoutMs) });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
    if (!response) throw new FeishuOpenApiError(`飞书请求失败：${lastError?.message || 'unknown error'}`, { details: lastError });

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
    const queueKey = `${tableId}\u0000${keyField}\u0000${String(keyValue)}`;
    const previous = this.upsertQueues.get(queueKey) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const existing = await this.findRecordByField(tableId, keyField, keyValue);
      if (existing) {
        const record = await this.updateRecord(tableId, existing.record_id, { ...fields, [keyField]: keyValue });
        return { action: 'updated', record };
      }
      const record = await this.createRecord(tableId, { ...fields, [keyField]: keyValue });
      return { action: 'created', record };
    });
    this.upsertQueues.set(queueKey, operation);
    try {
      return await operation;
    } finally {
      if (this.upsertQueues.get(queueKey) === operation) this.upsertQueues.delete(queueKey);
    }
  }

  fieldsUrl(tableId) {
    return `${this.apiBaseUrl}/bitable/v1/apps/${encodeURIComponent(this.appToken)}/tables/${encodeURIComponent(tableId)}/fields`;
  }

  async listFields(tableId) {
    const body = await this.requestJson(`${this.fieldsUrl(tableId)}?page_size=100`, { method: 'GET' });
    return body.data?.items || [];
  }

  async createField(tableId, { name, type = 1, property = null }) {
    const body = await this.requestJson(this.fieldsUrl(tableId), {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ field_name: name, type, ...(property ? { property } : {}) }),
    });
    return body.data?.field;
  }

  async uploadMedia({ fileName, mimeType, bytes }) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!data.byteLength) throw new FeishuOpenApiError('不能上传空文件');
    if (data.byteLength > 100 * 1024 * 1024) throw new FeishuOpenApiError('单个素材不能超过 100MB');

    if (data.byteLength > 20 * 1024 * 1024) return this.uploadMediaMultipart({ fileName, mimeType, data });

    const form = new FormData();
    form.set('file_name', fileName);
    form.set('parent_type', 'bitable_file');
    form.set('parent_node', this.appToken);
    form.set('size', String(data.byteLength));
    form.set('file', new Blob([data], { type: mimeType || 'application/octet-stream' }), fileName);
    const body = await this.requestJson(`${this.apiBaseUrl}/drive/v1/medias/upload_all`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(Math.max(this.timeoutMs, 60_000)),
    });
    const fileToken = body.data?.file_token;
    if (!fileToken) throw new FeishuOpenApiError('飞书未返回文件 Token', { details: body });
    return { fileToken };
  }

  async uploadMediaMultipart({ fileName, mimeType, data }) {
    const prepare = await this.requestJson(`${this.apiBaseUrl}/drive/v1/medias/upload_prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ file_name: fileName, parent_type: 'bitable_file', parent_node: this.appToken, size: data.byteLength }),
      signal: AbortSignal.timeout(Math.max(this.timeoutMs, 60_000)),
    });
    const uploadId = prepare.data?.upload_id;
    const blockSize = Number(prepare.data?.block_size) || 4 * 1024 * 1024;
    const blockNum = Number(prepare.data?.block_num) || Math.ceil(data.byteLength / blockSize);
    if (!uploadId || !blockNum) throw new FeishuOpenApiError('飞书未返回有效的分片上传策略', { details: prepare });

    for (let seq = 0; seq < blockNum; seq += 1) {
      const start = seq * blockSize;
      const part = data.subarray(start, Math.min(start + blockSize, data.byteLength));
      const form = new FormData();
      form.set('upload_id', uploadId);
      form.set('seq', String(seq));
      form.set('size', String(part.byteLength));
      form.set('file', new Blob([part], { type: mimeType || 'application/octet-stream' }), `${fileName}.part-${seq}`);
      await this.requestJson(`${this.apiBaseUrl}/drive/v1/medias/upload_part`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(Math.max(this.timeoutMs, 60_000)),
      });
      if (seq < blockNum - 1) await new Promise((resolve) => setTimeout(resolve, 220));
    }

    const finish = await this.requestJson(`${this.apiBaseUrl}/drive/v1/medias/upload_finish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ upload_id: uploadId, block_num: blockNum }),
      signal: AbortSignal.timeout(Math.max(this.timeoutMs, 60_000)),
    });
    const fileToken = finish.data?.file_token;
    if (!fileToken) throw new FeishuOpenApiError('飞书完成分片上传后未返回文件 Token', { details: finish });
    return { fileToken };
  }

  async downloadMedia(fileToken) {
    if (!fileToken) throw new FeishuOpenApiError('下载素材必须提供文件 Token');
    const url = `${this.apiBaseUrl}/drive/v1/medias/${encodeURIComponent(fileToken)}/download`;
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${await this.getTenantAccessToken()}` },
          signal: AbortSignal.timeout(Math.max(this.timeoutMs, 60_000)),
        });
        if (response.ok) break;
        const details = await response.text().catch(() => '');
        throw new FeishuOpenApiError(`飞书素材下载失败（HTTP ${response.status}）`, { status: response.status, details });
      } catch (error) {
        lastError = error;
        response = null;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (!response) {
      if (lastError instanceof FeishuOpenApiError) throw lastError;
      throw new FeishuOpenApiError(`飞书素材下载失败：${lastError?.message || 'unknown error'}`, { details: lastError });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new FeishuOpenApiError('飞书返回了空素材');
    return {
      bytes,
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      contentDisposition: response.headers.get('content-disposition') || '',
    };
  }
}
