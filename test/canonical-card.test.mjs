import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {encodePublicReport, decodePublicReport, buildPublicReportUrl} from '../src/public-report.mjs';

test('public report URL round-trips UTF-8 without leaking excluded repo identities', () => {
  const payload = {v:1,handle:'アルティメット',type:'システム構築型',recommended:[{name:'public-one'}],detail:{axes:[['活動量',80]]}};
  const token = encodePublicReport(payload);
  assert.deepEqual(decodePublicReport(token), payload);
  const url = buildPublicReportUrl(payload, 'https://example.com/Developer-Card/?old=1#x');
  assert.match(url, /^https:\/\/example\.com\/Developer-Card\/#report=/);
  assert.doesNotMatch(url, /old=1/);
});

test('canonical X-card preview and PNG export use the same renderer contract', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const share = await readFile(new URL('../src/share-card.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(app, /renderShareCardDom\(lastCardModel\)/);
  assert.match(app, /exportShareCardPng\(lastCardModel\)/);
  assert.doesNotMatch(app, /function renderPngCard/);
  assert.match(share, /GitHub解析でわかる/);
  assert.match(share, /開発スタイル診断/);
  assert.match(share, /詳細レポートはこちら/);
  assert.match(html, /id="detailQr"/);
});

test('share actions are intentionally different', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="download">Xカードを保存/);
  assert.match(html, /id="share">投稿文をコピー/);
  assert.doesNotMatch(app, /navigator\.share/);
});
