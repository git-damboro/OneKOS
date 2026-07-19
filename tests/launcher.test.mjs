import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Windows 启动脚本使用独立工作目录启动服务器', async () => {
  const launcher = await readFile(path.join(root, '启动演示.bat'), 'utf8');

  assert.match(launcher, /start "OneKOS MVP Server" \/D "%~dp0" cmd \/k node server\.mjs/);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:4173/);
});
