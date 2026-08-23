import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('copied X post includes the Developer Card diagnosis hashtag', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /#DeveloperCard診断/);
  assert.match(app, /#DeveloperCard診断 #個人開発 #DeveloperCard/);
});
