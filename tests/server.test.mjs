import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppServer } from '../server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function withServer(run) {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('服务器返回首页与正确内容类型', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /千面·OneKOS/);
  });
});

test('服务器可返回业务模块并拒绝目录穿越', async () => {
  await withServer(async (baseUrl) => {
    const moduleResponse = await fetch(`${baseUrl}/src/engine.mjs`);
    assert.equal(moduleResponse.status, 200);
    assert.match(moduleResponse.headers.get('content-type'), /javascript/);

    const unsafeResponse = await fetch(`${baseUrl}/..%2Fpackage.json`);
    assert.equal(unsafeResponse.status, 403);
  });
});

test('生产入口默认监听云平台可访问的网络接口', async () => {
  const source = await readFile(path.join(root, 'server.mjs'), 'utf8');

  assert.match(source, /server\.listen\(port, process\.env\.HOST \|\| '0\.0\.0\.0'/);
});
