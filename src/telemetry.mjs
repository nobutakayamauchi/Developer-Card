export const FUNNEL_EVENTS = Object.freeze([
  'page_view',
  'github_loaded',
  'generate_success',
  'card_saved',
  'post_text_copied'
]);

export const TELEMETRY_NAMESPACE = 'nobutakayamauchi.github.io-developer-card-fv1';
export const TELEMETRY_ACTION = 'funnel';

const memorySent = new Set();
const pendingPixels = new Set();

export function shouldTrackCreatorFunnel(locationLike = globalThis.location) {
  const params = new URLSearchParams(String(locationLike?.search || ''));
  if (params.get('telemetry') === '1') return false;
  if (params.has('r') || params.has('report')) return false;
  if (params.get('view') === 'json') return false;
  return true;
}

export function isTelemetryDashboardLocation(locationLike = globalThis.location) {
  return new URLSearchParams(String(locationLike?.search || '')).get('telemetry') === '1';
}

export function trackFunnel(event, {sessionStorageLike = globalThis.sessionStorage} = {}) {
  if (!FUNNEL_EVENTS.includes(event)) return false;
  const storageKey = `dc:fv1:funnel:${event}`;

  try {
    if (sessionStorageLike?.getItem(storageKey) === '1') return false;
    sessionStorageLike?.setItem(storageKey, '1');
  } catch {
    if (memorySent.has(event)) return false;
  }

  if (memorySent.has(event)) return false;
  memorySent.add(event);

  if (typeof Image === 'undefined') return true;
  const pixel = new Image(1, 1);
  pendingPixels.add(pixel);
  const done = () => pendingPixels.delete(pixel);
  pixel.onload = done;
  pixel.onerror = done;
  pixel.referrerPolicy = 'no-referrer';
  pixel.src = buildPixelUrl(event);
  return true;
}

export async function readFunnelCounts(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
  const rows = await Promise.all(FUNNEL_EVENTS.map(async event => {
    try {
      const res = await fetchImpl(buildReadUrl(event), {cache:'no-store', credentials:'omit'});
      if (!res.ok) return [event, 0];
      const json = await res.json();
      return [event, Number(json?.value) || 0];
    } catch {
      return [event, 0];
    }
  }));
  return Object.fromEntries(rows);
}

export function initTelemetryDashboard({documentLike = globalThis.document, locationLike = globalThis.location} = {}) {
  if (!isTelemetryDashboardLocation(locationLike)) return false;
  if (!documentLike) return true;
  queueMicrotask(() => renderTelemetryDashboard(documentLike));
  return true;
}

async function renderTelemetryDashboard(documentLike) {
  const shell = documentLike.querySelector?.('.shell');
  if (!shell) return;

  let panel = documentLike.getElementById?.('telemetryDashboard');
  if (!panel) {
    panel = documentLike.createElement('section');
    panel.id = 'telemetryDashboard';
    panel.className = 'panel';
    panel.innerHTML = `
      <p class="eyebrow">FV Reality</p>
      <h2 style="margin:.25em 0 .5em">Developer Card ファネル</h2>
      <p class="micro">集計のみ / 1セッションにつき各イベント1回 / GitHub名・repo名・端末IDは送信しません。</p>
      <div id="telemetryRows" style="display:grid;gap:10px;margin:18px 0"></div>
      <button id="telemetryRefresh" type="button">計測値を更新</button>
      <p class="micro">公開Counter APIを使ったFV用の概算値です。厳密な課金・監査用途には使いません。</p>`;
    shell.prepend(panel);
    panel.querySelector('#telemetryRefresh')?.addEventListener('click', () => fillTelemetryRows(panel));
  }
  await fillTelemetryRows(panel);
}

async function fillTelemetryRows(panel) {
  const root = panel.querySelector('#telemetryRows');
  if (!root) return;
  root.textContent = '読込中…';
  const counts = await readFunnelCounts();
  const labels = {
    page_view:'① ページ訪問',
    github_loaded:'② GitHub読込成功',
    generate_success:'③ Generate成功',
    card_saved:'④ Xカード保存/共有成功',
    post_text_copied:'⑤ 投稿文コピー'
  };
  const base = Math.max(0, counts.page_view || 0);
  let previous = 0;
  root.innerHTML = FUNNEL_EVENTS.map((event, index) => {
    const value = Math.max(0, counts[event] || 0);
    const fromBase = base ? Math.round(value / base * 100) : 0;
    const fromPrev = index === 0 ? 100 : previous ? Math.round(value / previous * 100) : 0;
    previous = value;
    return `<div style="padding:12px 14px;border:1px solid #2d385c;border-radius:12px;background:#0a1020;display:flex;justify-content:space-between;gap:12px;align-items:center"><span>${labels[event]}</span><strong>${value}<small style="display:block;color:#8491b3;font-size:11px;font-weight:600">訪問比 ${fromBase}%${index ? ` / 前段 ${fromPrev}%` : ''}</small></strong></div>`;
  }).join('');
}

function buildPixelUrl(event) {
  const url = new URL('https://counterapi.com/pixel.gif');
  url.searchParams.set('ns', TELEMETRY_NAMESPACE);
  url.searchParams.set('action', TELEMETRY_ACTION);
  url.searchParams.set('key', event);
  url.searchParams.set('trackOnly', 'true');
  url.searchParams.set('_', String(Date.now()));
  return url.toString();
}

function buildReadUrl(event) {
  const ns = encodeURIComponent(TELEMETRY_NAMESPACE);
  const action = encodeURIComponent(TELEMETRY_ACTION);
  const key = encodeURIComponent(event);
  return `https://counterapi.com/api/${ns}/${action}/${key}?readOnly=true`;
}
