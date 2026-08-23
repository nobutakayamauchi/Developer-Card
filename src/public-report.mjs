export const REPORT_SCHEMA = 'developer-card-report';
export const REPORT_SCHEMA_VERSION = 1;

export function buildDeveloperCardReportV1(payload = {}) {
  const recommended = safeArray(payload.recommended).map(item => ({
    name: text(item?.name),
    reason: text(item?.reason)
  })).filter(item => item.name);
  const publicNames = new Set(recommended.map(item => item.name));
  const detail = sanitizeDetail(payload.detail, publicNames);

  return {
    schema: REPORT_SCHEMA,
    schema_version: REPORT_SCHEMA_VERSION,
    v: 1,
    public_safe: true,
    evidence_scope: 'public-safe-aggregate',
    handle: text(payload.handle),
    github_user: text(payload.github_user),
    avatar_url: safeHttpUrl(payload.avatar_url),
    type: text(payload.type),
    type_description: text(payload.type_description),
    tagline: text(payload.tagline),
    public_repo_count: numberOrZero(payload.public_repo_count),
    evaluated_count: numberOrZero(payload.evaluated_count),
    showcase_count: numberOrZero(payload.showcase_count),
    evidence_count: numberOrZero(payload.evidence_count),
    evidence_coverage: boundedPercent(payload.evidence_coverage),
    evidence_summary: sanitizeEvidenceSummary(payload.evidence_summary),
    main_languages: text(payload.main_languages),
    latest_at: nullableText(payload.latest_at),
    recommended,
    curiosity: safeArray(payload.curiosity).map(text).filter(Boolean).slice(0, 8),
    detail
  };
}

export function encodePublicReport(payload) {
  const json = JSON.stringify(buildDeveloperCardReportV1(payload));
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodePublicReport(token) {
  if (!token) return null;
  try {
    const base64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (payload?.schema === REPORT_SCHEMA && Number(payload?.schema_version) === REPORT_SCHEMA_VERSION) {
      return buildDeveloperCardReportV1(payload);
    }
    if (payload?.v === 1) return buildDeveloperCardReportV1(payload);
    return null;
  } catch {
    return null;
  }
}

export function buildPublicReportUrl(payload, href = globalThis.location?.href || '') {
  return buildReportUrl(payload, href, 'human');
}

export function buildMachineReportUrl(payload, href = globalThis.location?.href || '') {
  return buildReportUrl(payload, href, 'json');
}

export function serializeMachineReport(payload, space = 2) {
  return JSON.stringify(buildDeveloperCardReportV1(payload), null, space);
}

export function readPublicReportFromLocation(locationLike = globalThis.location) {
  const search = String(locationLike?.search || '');
  const queryToken = new URLSearchParams(search).get('report');
  if (queryToken) return decodePublicReport(queryToken);

  const hash = String(locationLike?.hash || '').replace(/^#/, '');
  if (hash.startsWith('report=')) return decodePublicReport(hash.slice('report='.length));
  return null;
}

export function isMachineReportLocation(locationLike = globalThis.location) {
  return new URLSearchParams(String(locationLike?.search || '')).get('view') === 'json';
}

function buildReportUrl(payload, href, view) {
  const url = new URL(href || 'https://example.invalid/');
  url.hash = '';
  url.search = '';
  url.searchParams.set('report', encodePublicReport(payload));
  if (view === 'json') url.searchParams.set('view', 'json');
  return url.toString();
}

function sanitizeDetail(detail, publicNames) {
  const d = detail && typeof detail === 'object' ? detail : {};
  return {
    axes: tupleList(d.axes, 6),
    language_shares: safeArray(d.language_shares).slice(0, 8).map(item => ({name:text(item?.name), value:numberOrZero(item?.value)})).filter(item => item.name),
    activity: tripleList(d.activity, 8),
    activity_label: text(d.activity_label),
    recommended: safeArray(d.recommended).filter(item => publicNames.has(text(item?.name))).slice(0, 3).map(item => ({
      name: text(item?.name),
      reason: text(item?.reason),
      language: text(item?.language),
      updated_at: nullableText(item?.updated_at)
    })),
    traits: tupleList(d.traits, 8),
    strengths: safeArray(d.strengths).map(text).filter(Boolean).slice(0, 6),
    growth: safeArray(d.growth).map(text).filter(Boolean).slice(0, 6),
    evidence: sanitizeDetailEvidence(d.evidence)
  };
}

function sanitizeEvidenceSummary(value) {
  const e = value && typeof value === 'object' ? value : {};
  return {
    signatures:safeArray(e.signatures).map(text).filter(Boolean).slice(0,12),
    strong_architecture_repos:numberOrZero(e.strong_architecture_repos),
    repos_with_tests:numberOrZero(e.repos_with_tests),
    repos_with_ci:numberOrZero(e.repos_with_ci)
  };
}

function sanitizeDetailEvidence(value) {
  const e = value && typeof value === 'object' ? value : {};
  return {
    analyzed_repos:numberOrZero(e.analyzed_repos),
    evaluated_repos:numberOrZero(e.evaluated_repos),
    coverage:boundedPercent(e.coverage),
    signatures:safeArray(e.signatures).map(text).filter(Boolean).slice(0,12),
    repos_with_tests:numberOrZero(e.repos_with_tests),
    repos_with_ci:numberOrZero(e.repos_with_ci),
    strong_architecture_repos:numberOrZero(e.strong_architecture_repos)
  };
}

function tupleList(value, limit) {
  return safeArray(value).slice(0, limit).map(item => [text(item?.[0]), numberOrZero(item?.[1])]).filter(item => item[0]);
}
function tripleList(value, limit) {
  return safeArray(value).slice(0, limit).map(item => [text(item?.[0]), numberOrZero(item?.[1]), numberOrZero(item?.[2])]).filter(item => item[0]);
}
function safeArray(value) { return Array.isArray(value) ? value : []; }
function text(value) { return value == null ? '' : String(value).slice(0, 500); }
function nullableText(value) { const v = text(value); return v || null; }
function numberOrZero(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function boundedPercent(value) { return Math.max(0, Math.min(100, numberOrZero(value))); }
function safeHttpUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.toString() : '';
  } catch { return ''; }
}
