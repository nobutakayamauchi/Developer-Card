export const AUTH = Object.freeze({
  SHOWCASE_AND_EVALUATE: 'SHOWCASE_AND_EVALUATE',
  EVALUATE_ONLY: 'EVALUATE_ONLY',
  EXCLUDE: 'EXCLUDE'
});

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
const daysSince = (iso, now = Date.now()) => iso ? Math.max(0, (now - Date.parse(iso)) / 86400000) : 9999;

export function normalizeRepo(repo, authorization = AUTH.SHOWCASE_AND_EVALUATE) {
  return {
    full_name: repo.full_name || repo.name || 'unknown/unknown',
    name: repo.name || String(repo.full_name || '').split('/').pop(),
    html_url: repo.html_url || '#',
    description: repo.description || '',
    language: repo.language || null,
    size_kb: Number(repo.size || 0),
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    open_issues: Number(repo.open_issues_count || 0),
    updated_at: repo.updated_at || null,
    default_branch: repo.default_branch || 'main',
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    authorization,
    evidence: repo.evidence || null
  };
}

export function scoreRepo(repo, now = Date.now()) {
  if (repo.authorization === AUTH.EXCLUDE) return null;
  const recency = clamp(100 - daysSince(repo.updated_at, now) / 3.65);
  const sizeSignal = clamp(Math.log10(repo.size_kb + 1) * 24);
  const social = clamp(Math.log10(repo.stars + repo.forks + 1) * 28);
  const ownership = repo.fork ? 35 : 100;
  const active = repo.archived ? 25 : 100;
  const description = repo.description ? 75 : 35;
  const ev = repo.evidence?.available ? repo.evidence : null;
  const structural = ev ? clamp(ev.architecture_score) : null;
  const evidenceStrength = ev ? clamp(ev.evidence_strength) : 0;

  // Showcase remains a presentation signal. Structural Evidence is used only when it was actually fetched.
  const metadataBase = recency * 0.30 + sizeSignal * 0.20 + social * 0.10 + ownership * 0.15 + active * 0.15 + description * 0.10;
  const showcase = ev
    ? clamp(metadataBase * 0.72 + structural * 0.18 + evidenceStrength * 0.10)
    : clamp(metadataBase);

  return { showcase, recency, sizeSignal, social, ownership, active, description, structural, evidenceStrength };
}

export function diagnose(repos, now = Date.now()) {
  const evaluated = repos
    .filter(r => r.authorization !== AUTH.EXCLUDE)
    .map(r => ({ repo: r, score: scoreRepo(r, now) }))
    .filter(Boolean);

  if (!evaluated.length) throw new Error('NO_AUTHORIZED_REPOSITORIES');

  const evidenceRows = evaluated.filter(x => x.repo.evidence?.available);
  const evidenceCoverage = Math.round(evidenceRows.length / evaluated.length * 100);
  const showcase = evaluated
    .filter(x => x.repo.authorization === AUTH.SHOWCASE_AND_EVALUATE)
    .sort((a, b) => b.score.showcase - a.score.showcase);

  const languages = new Map();
  for (const { repo } of evaluated) {
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
  }
  const topLanguages = [...languages.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,count])=>({name,count}));
  const recentCount = evaluated.filter(x => x.score.recency >= 70).length;
  const originalCount = evaluated.filter(x => !x.repo.fork).length;

  const signatures = new Set();
  for (const x of evidenceRows) for (const s of x.repo.evidence.signatures || []) signatures.add(s);
  const strongArchitectureCount = evidenceRows.filter(x => (x.repo.evidence.architecture_score || 0) >= 62).length;
  const testBearingCount = evidenceRows.filter(x => (x.repo.evidence.test_file_count || 0) > 0).length;
  const ciBearingCount = evidenceRows.filter(x => (x.repo.evidence.workflow_file_count || 0) > 0).length;

  let type = 'プロトタイプ探索型';
  if (recentCount >= Math.ceil(evaluated.length * 0.6) && evaluated.length >= 4) type = '高速ビルダー型';
  if (topLanguages.length >= 3 && evaluated.length >= 5) type = '横断オーケストレーター型';
  if (evidenceRows.length >= 2 && strongArchitectureCount >= 2 && originalCount >= 3) type = 'システム構築型';
  if (evidenceRows.length >= 3 && signatures.size >= 5) type = '横断オーケストレーター型';

  const highlights = [
    `${evaluated.length} repoを評価対象として解析`,
    evidenceRows.length ? `実ファイル構造Evidenceを${evidenceRows.length}/${evaluated.length} repoで取得` : '実ファイル構造Evidenceは未取得',
    topLanguages.length ? `主要言語: ${topLanguages.map(x=>x.name).join(' / ')}` : '言語情報は限定的'
  ];

  const curiosity = [];
  if (evidenceRows.some(x => (x.repo.evidence.architecture_score || 0) >= 70)) curiosity.push('構造Evidence上、さらに掘る価値が高いrepoがあります');
  if (signatures.size >= 4) curiosity.push(`実ファイル構造から${signatures.size}種類以上の技術シグナルが見えます`);
  if (testBearingCount || ciBearingCount) curiosity.push(`test/CI Evidenceがあるrepoを${Math.max(testBearingCount,ciBearingCount)}件確認しました`);
  if (!curiosity.length && showcase[0]?.score.showcase >= 65) curiosity.push('メタデータ上、詳細解析候補になりそうなrepoがあります');
  if (!curiosity.length) curiosity.push('詳細解析で強みの根拠と伸ばし方を確認できます');

  return {
    type,
    highlights,
    topLanguages,
    recommended: showcase.slice(0,3).map(x => ({
      name: x.repo.name,
      full_name: x.repo.full_name,
      url: x.repo.html_url,
      showcase_score: x.score.showcase,
      evidence_available: Boolean(x.repo.evidence?.available),
      evidence: publicEvidenceSummary(x.repo.evidence),
      reason: recommendationReason(x)
    })),
    curiosity: curiosity.slice(0,3),
    evaluated_count: evaluated.length,
    showcase_count: showcase.length,
    evidence_count: evidenceRows.length,
    evidence_coverage: evidenceCoverage,
    evidence_summary: {
      signatures:[...signatures].slice(0,12),
      strong_architecture_repos:strongArchitectureCount,
      repos_with_tests:testBearingCount,
      repos_with_ci:ciBearingCount
    }
  };
}

function publicEvidenceSummary(ev) {
  if (!ev?.available) return null;
  return {
    source:ev.source,
    file_count:ev.file_count,
    source_file_count:ev.source_file_count,
    test_file_count:ev.test_file_count,
    docs_file_count:ev.docs_file_count,
    workflow_file_count:ev.workflow_file_count,
    config_file_count:ev.config_file_count,
    architecture_score:ev.architecture_score,
    evidence_strength:ev.evidence_strength,
    signatures:(ev.signatures || []).slice(0,8),
    truncated:Boolean(ev.truncated)
  };
}

function recommendationReason(x) {
  const reasons = [];
  const ev = x.repo.evidence?.available ? x.repo.evidence : null;
  if (ev?.architecture_score >= 65) reasons.push('構造Evidenceが強い');
  if (ev?.test_file_count > 0 && ev?.workflow_file_count > 0) reasons.push('test/CIあり');
  if (ev?.signatures?.length >= 3) reasons.push('技術構成が多層');
  if (x.score.recency >= 70) reasons.push('最近も更新');
  if (x.score.ownership >= 90) reasons.push('オリジナルrepo');
  if (x.repo.description) reasons.push('目的が読み取りやすい');
  return reasons.slice(0,2).join('・') || '公開候補として比較的まとまりが良い';
}

export function extractGitHubUser(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9-]+$/.test(raw)) return raw;
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (!/github\.com$/i.test(u.hostname)) return '';
    return u.pathname.split('/').filter(Boolean)[0] || '';
  } catch { return ''; }
}
