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
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    authorization
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

  // FV intentionally avoids pretending this is an objective ability score.
  const showcase = clamp(
    recency * 0.30 + sizeSignal * 0.20 + social * 0.10 + ownership * 0.15 + active * 0.15 + description * 0.10
  );
  return { showcase, recency, sizeSignal, social, ownership, active, description };
}

export function diagnose(repos, now = Date.now()) {
  const evaluated = repos
    .filter(r => r.authorization !== AUTH.EXCLUDE)
    .map(r => ({ repo: r, score: scoreRepo(r, now) }))
    .filter(Boolean);

  if (!evaluated.length) throw new Error('NO_AUTHORIZED_REPOSITORIES');

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
  const largeCount = evaluated.filter(x => x.repo.size_kb >= 500).length;

  let type = 'プロトタイプ探索型';
  if (recentCount >= Math.ceil(evaluated.length * 0.6) && evaluated.length >= 4) type = '高速ビルダー型';
  if (topLanguages.length >= 3 && evaluated.length >= 5) type = '横断オーケストレーター型';
  if (largeCount >= 2 && originalCount >= 3) type = 'システム構築型';

  const highlights = [
    `${evaluated.length} repoを評価対象として解析`,
    recentCount ? `最近も動いているrepoが${recentCount}件` : '長期蓄積型の開発履歴',
    topLanguages.length ? `主要言語: ${topLanguages.map(x=>x.name).join(' / ')}` : '言語情報は限定的'
  ];

  const curiosity = [];
  if (showcase[0]?.score.showcase >= 65) curiosity.push('カード以上に掘る価値がありそうなrepoがあります');
  if (topLanguages.length >= 3) curiosity.push('複数領域をまたぐ開発パターンが見えます');
  if (evaluated.some(x => x.repo.size_kb < 100 && x.score.showcase >= 55)) curiosity.push('小規模でも見せ方次第で光るrepo候補があります');
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
      reason: recommendationReason(x)
    })),
    curiosity: curiosity.slice(0,3),
    evaluated_count: evaluated.length,
    showcase_count: showcase.length
  };
}

function recommendationReason(x) {
  const reasons = [];
  if (x.score.recency >= 70) reasons.push('最近も更新');
  if (x.score.sizeSignal >= 55) reasons.push('実装量の手掛かりあり');
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
