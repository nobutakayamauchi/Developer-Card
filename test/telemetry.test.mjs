import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  FUNNEL_EVENTS,
  TELEMETRY_NAMESPACE,
  shouldTrackCreatorFunnel,
  trackFunnel
} from '../src/telemetry.mjs';

test('FV funnel has exactly five coarse aggregate stages', () => {
  assert.deepEqual([...FUNNEL_EVENTS], [
    'page_view',
    'github_loaded',
    'generate_success',
    'card_saved',
    'post_text_copied'
  ]);
  assert.match(TELEMETRY_NAMESPACE, /developer-card-fv1/);
});

test('shared reports, machine reports and telemetry dashboard do not enter creator funnel', () => {
  assert.equal(shouldTrackCreatorFunnel({search:''}), true);
  assert.equal(shouldTrackCreatorFunnel({search:'?utm_source=x'}), true);
  assert.equal(shouldTrackCreatorFunnel({search:'?r=abc'}), false);
  assert.equal(shouldTrackCreatorFunnel({search:'?report=abc'}), false);
  assert.equal(shouldTrackCreatorFunnel({search:'?view=json'}), false);
  assert.equal(shouldTrackCreatorFunnel({search:'?telemetry=1'}), false);
});

test('each funnel event is counted at most once per session', () => {
  const bag = new Map();
  const storage = {
    getItem:key => bag.get(key) || null,
    setItem:(key,value) => bag.set(key,value)
  };
  assert.equal(trackFunnel('page_view', {sessionStorageLike:storage}), true);
  assert.equal(trackFunnel('page_view', {sessionStorageLike:storage}), false);
  assert.equal(trackFunnel('not-an-event', {sessionStorageLike:storage}), false);
});

test('telemetry hooks observe existing success signals without touching diagnosis payloads', async () => {
  const telemetry = await readFile(new URL('../src/telemetry.mjs', import.meta.url), 'utf8');
  const hooks = await readFile(new URL('../src/telemetry-hooks.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /telemetry-hooks\.mjs/);
  for (const event of FUNNEL_EVENTS) assert.match(`${telemetry}\n${hooks}`, new RegExp(event));
  assert.match(hooks, /dc:report-ready/);
  assert.match(hooks, /件の公開repoを取得しました/);
  assert.match(hooks, /X投稿文と詳細レポートURLをコピーしました/);

  assert.doesNotMatch(telemetry, /github_user|repo_names|avatar_url|handle:/);
  assert.doesNotMatch(telemetry, /userId|campaign|ref=/);
  assert.match(telemetry, /referrerPolicy = 'no-referrer'/);
});
