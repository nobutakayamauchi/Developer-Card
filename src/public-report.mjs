export const REPORT_SCHEMA = 'developer-card-report';
export const REPORT_SCHEMA_VERSION = 1;
export const COMPACT_SHARE_VERSION = 2;

const TYPE_COPY = {
  'システム構築型': ['構造と実装を積み上げる設計・構築タイプ', 'コードは、黙っていても設計思想を語る。'],
  '横断オーケストレーター型': ['複数領域を束ねて価値へ変える統合タイプ', '複数領域を束ねる力が、GitHubに残っている。'],
  '高速ビルダー型': ['高い更新密度で形にしていく実行タイプ', '動き続けた履歴そのものが、開発力のEvidenceになる。'],
  'プロトタイプ探索型': ['小さく試しながら答えを探す探索タイプ', '小さな実験の連続が、次の強みを作っている。']
};
const AXIS_LABELS = ['活動量','技術横断','Evidence量','公開適性','選択性','継続性'];
const ACTIVITY_LABELS = ['最近90日以内','評価対象repo','公開候補repo'];
const TRAIT_LABELS = ['活動継続','技術横断','公開選別','Evidence蓄積'];

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
  return encodeBase64Url(JSON.stringify(buildDeveloperCardReportV1(payload)));
}

export function decodePublicReport(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(token));
    if (payload?.schema === REPORT_SCHEMA && Number(payload?.schema_version) === REPORT_SCHEMA_VERSION) {
      return buildDeveloperCardReportV1(payload);
    }
    if (payload?.v === 1) return buildDeveloperCardReportV1(payload);
    return null;
  } catch {
    return null;
  }
}

export function encodeCompactShareReport(payload) {
  const r = buildDeveloperCardReportV1(payload);
  const d = r.detail || {};
  const e = d.evidence || {};
  const compact = [
    COMPACT_SHARE_VERSION,
    clip(r.handle, 40),
    clip(r.github_user, 60),
    clip(r.type, 40),
    numberOrZero(r.public_repo_count),
    r.latest_at ? clip(r.latest_at, 32) : null,
    safeArray(d.recommended).slice(0,3).map(x => [clip(x.name,80),clip(x.reason,100),clip(x.language,40),x.updated_at ? clip(x.updated_at,32) : null]),
    safeArray(d.axes).slice(0,6).map(x => boundedPercent(x?.[1])),
    safeArray(d.language_shares).slice(0,5).map(x => [clip(x?.name,32),boundedPercent(x?.value)]),
    safeArray(d.activity).slice(0,3).map(x => [numberOrZero(x?.[1]),numberOrZero(x?.[2])]),
    clip(d.activity_label,30),
    safeArray(d.traits).slice(0,4).map(x => boundedPercent(x?.[1])),
    safeArray(d.strengths).slice(0,3).map(x => clip(x,100)),
    safeArray(d.growth).slice(0,3).map(x => clip(x,120)),
    [
      numberOrZero(e.analyzed_repos || r.evidence_count),
      numberOrZero(e.evaluated_repos || r.evaluated_count),
      boundedPercent(e.coverage || r.evidence_coverage),
      safeArray(e.signatures || r.evidence_summary?.signatures).slice(0,8).map(x => clip(x,32)),
      numberOrZero(e.repos_with_tests || r.evidence_summary?.repos_with_tests),
      numberOrZero(e.repos_with_ci || r.evidence_summary?.repos_with_ci),
      numberOrZero(e.strong_architecture_repos || r.evidence_summary?.strong_architecture_repos)
    ]
  ];
  return encodeBase64Url(JSON.stringify(compact));
}

export function decodeCompactShareReport(token) {
  if (!token) return null;
  try {
    const c = JSON.parse(decodeBase64Url(token));
    if (!Array.isArray(c) || Number(c[0]) !== COMPACT_SHARE_VERSION) return null;
    const handle = clip(c[1],40);
    const githubUser = clip(c[2],60);
    const type = clip(c[3],40);
    const publicRepoCount = numberOrZero(c[4]);
    const latestAt = c[5] ? clip(c[5],32) : null;
    const rec = safeArray(c[6]).slice(0,3).map(x => ({
      name:clip(x?.[0],80), reason:clip(x?.[1],100), language:clip(x?.[2],40), updated_at:x?.[3] ? clip(x[3],32) : null
    })).filter(x => x.name);
    const axesValues = safeArray(c[7]).slice(0,6);
    const languageShares = safeArray(c[8]).slice(0,5).map(x => ({name:clip(x?.[0],32),value:boundedPercent(x?.[1])})).filter(x=>x.name);
    const activityValues = safeArray(c[9]).slice(0,3);
    const activityLabel = clip(c[10],30);
    const traitValues = safeArray(c[11]).slice(0,4);
    const strengths = safeArray(c[12]).slice(0,3).map(x=>clip(x,100)).filter(Boolean);
    const growth = safeArray(c[13]).slice(0,3).map(x=>clip(x,120)).filter(Boolean);
    const ev = safeArray(c[14]);
    const evidence = {
      analyzed_repos:numberOrZero(ev[0]),
      evaluated_repos:numberOrZero(ev[1]),
      coverage:boundedPercent(ev[2]),
      signatures:safeArray(ev[3]).slice(0,8).map(x=>clip(x,32)).filter(Boolean),
      repos_with_tests:numberOrZero(ev[4]),
      repos_with_ci:numberOrZero(ev[5]),
      strong_architecture_repos:numberOrZero(ev[6])
    };
    const typeCopy = TYPE_COPY[type] || ['GitHub Evidenceから見える現在の開発傾向','あなたのGitHubが、あなたの強みを語っている。'];
    const activity = ACTIVITY_LABELS.map((label,i)=>[label,numberOrZero(activityValues[i]?.[0]),numberOrZero(activityValues[i]?.[1])]);
    const showcaseCount = numberOrZero(activityValues[2]?.[0]);
    const evaluatedCount = evidence.evaluated_repos || numberOrZero(activityValues[1]?.[0]);
    const recommended = rec.map(x=>({name:x.name,reason:x.reason}));
    const report = {
      handle,
      github_user:githubUser,
      avatar_url:githubUser ? `https://github.com/${encodeURIComponent(githubUser)}.png?size=320` : '',
      type,
      type_description:typeCopy[0],
      tagline:typeCopy[1],
      public_repo_count:publicRepoCount,
      evaluated_count:evaluatedCount,
      showcase_count:showcaseCount,
      evidence_count:evidence.analyzed_repos,
      evidence_coverage:evidence.coverage,
      evidence_summary:{
        signatures:evidence.signatures,
        strong_architecture_repos:evidence.strong_architecture_repos,
        repos_with_tests:evidence.repos_with_tests,
        repos_with_ci:evidence.repos_with_ci
      },
      main_languages:languageShares.slice(0,2).map(x=>x.name).join(' / '),
      latest_at:latestAt,
      recommended,
      curiosity:growth,
      detail:{
        axes:AXIS_LABELS.map((label,i)=>[label,boundedPercent(axesValues[i])]),
        language_shares:languageShares,
        activity,
        activity_label:activityLabel,
        recommended:rec,
        traits:TRAIT_LABELS.map((label,i)=>[label,boundedPercent(traitValues[i])]),
        strengths,
        growth,
        evidence
      }
    };
    return buildDeveloperCardReportV1(report);
  } catch {
    return null;
  }
}

export function buildPublicReportUrl(payload, href = globalThis.location?.href || '') {
  const url = cleanBaseUrl(href);
  url.searchParams.set('r', encodeCompactShareReport(payload));
  return url.toString();
}

export function buildMachineReportUrl(payload, href = globalThis.location?.href || '') {
  const url = cleanBaseUrl(href);
  url.searchParams.set('report', encodePublicReport(payload));
  url.searchParams.set('view', 'json');
  return url.toString();
}

export function serializeMachineReport(payload, space = 2) {
  return JSON.stringify(buildDeveloperCardReportV1(payload), null, space);
}

export function readPublicReportFromLocation(locationLike = globalThis.location) {
  const search = String(locationLike?.search || '');
  const params = new URLSearchParams(search);
  const compactToken = params.get('r');
  if (compactToken) {
    const decoded = decodeCompactShareReport(compactToken);
    if (decoded) return decoded;
  }
  const queryToken = params.get('report');
  if (queryToken) return decodePublicReport(queryToken);

  const hash = String(locationLike?.hash || '').replace(/^#/, '');
  if (hash.startsWith('report=')) return decodePublicReport(hash.slice('report='.length));
  return null;
}

export function isMachineReportLocation(locationLike = globalThis.location) {
  return new URLSearchParams(String(locationLike?.search || '')).get('view') === 'json';
}

function cleanBaseUrl(href) {
  const url = new URL(href || 'https://example.invalid/');
  url.hash = '';
  url.search = '';
  return url;
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
function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeBase64Url(token) {
  const base64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function safeArray(value) { return Array.isArray(value) ? value : []; }
function text(value) { return value == null ? '' : String(value).slice(0, 500); }
function clip(value, max) { return value == null ? '' : String(value).slice(0, max); }
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
