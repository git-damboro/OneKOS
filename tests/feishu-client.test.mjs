import assert from 'node:assert/strict';
import test from 'node:test';

import { FeishuBitableClient, FeishuOpenApiError } from '../src/feishu-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createQueuedFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch: ${url}`);
    return typeof next === 'function' ? next(url, options) : next;
  };
  return { fetchImpl, calls };
}

const config = {
  appId: 'cli_test',
  appSecret: 'secret',
  appToken: 'base-token',
  apiBaseUrl: 'https://open.test/open-apis',
};

test('tenant token 在有效期内复用', async () => {
  const queue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 0, data: { items: [], has_more: false } }),
    jsonResponse({ code: 0, data: { items: [], has_more: false } }),
  ]);
  const client = new FeishuBitableClient({ ...config, fetchImpl: queue.fetchImpl });

  await client.listRecords('tbl-a');
  await client.listRecords('tbl-b');

  assert.equal(queue.calls.filter((call) => call.url.includes('tenant_access_token')).length, 1);
  assert.equal(queue.calls[1].options.headers.Authorization, 'Bearer token-1');
  assert.equal(queue.calls[2].options.headers.Authorization, 'Bearer token-1');
});

test('分页读取记录并保留全部 items', async () => {
  const queue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 0, data: { items: [{ record_id: 'rec-1', fields: { 顾问ID: 'ADV-017' } }], has_more: true, page_token: 'next' } }),
    jsonResponse({ code: 0, data: { items: [{ record_id: 'rec-2', fields: { 顾问ID: 'ADV-018' } }], has_more: false } }),
  ]);
  const client = new FeishuBitableClient({ ...config, fetchImpl: queue.fetchImpl });
  const records = await client.listRecords('tbl-advisors');

  assert.deepEqual(records.map((item) => item.record_id), ['rec-1', 'rec-2']);
  assert.match(queue.calls[2].url, /page_token=next/);
});

test('upsert 按业务键选择创建或更新', async () => {
  const createQueue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 0, data: { items: [], has_more: false } }),
    jsonResponse({ code: 0, data: { record: { record_id: 'rec-created', fields: { 内容ID: 'CONTENT-1' } } } }),
  ]);
  const createClient = new FeishuBitableClient({ ...config, fetchImpl: createQueue.fetchImpl });
  const created = await createClient.upsertByField('tbl-content', '内容ID', 'CONTENT-1', { 内容ID: 'CONTENT-1' });
  assert.equal(created.action, 'created');
  assert.equal(created.record.record_id, 'rec-created');
  assert.equal(createQueue.calls[2].options.method, 'POST');

  const updateQueue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 0, data: { items: [{ record_id: 'rec-old', fields: { 内容ID: 'CONTENT-1' } }], has_more: false } }),
    jsonResponse({ code: 0, data: { record: { record_id: 'rec-old', fields: { 内容ID: 'CONTENT-1', 状态: '已更新' } } } }),
  ]);
  const updateClient = new FeishuBitableClient({ ...config, fetchImpl: updateQueue.fetchImpl });
  const updated = await updateClient.upsertByField('tbl-content', '内容ID', 'CONTENT-1', { 状态: '已更新' });
  assert.equal(updated.action, 'updated');
  assert.match(updateQueue.calls[2].url, /records\/rec-old$/);
  assert.equal(updateQueue.calls[2].options.method, 'PUT');
});

test('OpenAPI 非零 code 转换为可诊断错误', async () => {
  const queue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 1254302, msg: 'permission denied' }),
  ]);
  const client = new FeishuBitableClient({ ...config, fetchImpl: queue.fetchImpl });

  await assert.rejects(
    () => client.listRecords('tbl-private'),
    (error) => error instanceof FeishuOpenApiError && error.code === 1254302 && error.message.includes('permission denied'),
  );
});

test('素材上传使用 bitable_file 上传点并返回飞书文件 Token', async () => {
  const queue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    jsonResponse({ code: 0, data: { file_token: 'box-file-001' } }),
  ]);
  const client = new FeishuBitableClient({ ...config, fetchImpl: queue.fetchImpl });
  const result = await client.uploadMedia({ fileName: 'opening.mp4', mimeType: 'video/mp4', bytes: new Uint8Array([1, 2, 3]) });

  assert.equal(result.fileToken, 'box-file-001');
  assert.match(queue.calls[1].url, /drive\/v1\/medias\/upload_all$/);
  assert.equal(queue.calls[1].options.body.get('parent_type'), 'bitable_file');
  assert.equal(queue.calls[1].options.body.get('parent_node'), 'base-token');
  assert.equal(queue.calls[1].options.body.get('size'), '3');
});

test('素材下载使用 file_token 获取二进制内容', async () => {
  const queue = createQueuedFetch([
    jsonResponse({ code: 0, tenant_access_token: 'token-1', expire: 7200 }),
    new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { 'content-type': 'video/mp4' } }),
  ]);
  const client = new FeishuBitableClient({ ...config, fetchImpl: queue.fetchImpl });
  const result = await client.downloadMedia('box-file-001');

  assert.deepEqual([...result.bytes], [4, 5, 6]);
  assert.equal(result.mimeType, 'video/mp4');
  assert.match(queue.calls[1].url, /drive\/v1\/medias\/box-file-001\/download$/);
  assert.equal(queue.calls[1].options.headers.Authorization, 'Bearer token-1');
});
