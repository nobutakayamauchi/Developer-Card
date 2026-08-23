const CACHE_PREFIX = 'developer-card:evidence:v1:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const SOURCE_EXT = new Set(['js','jsx','ts','tsx','py','rs','go','java','kt','kts','rb','php','cs','cpp','cc','cxx','c','h','hpp','swift','dart','vue','svelte','scala','sh','sql']);
const CONFIG_NAMES = new Set(['package.json','pyproject.toml','requirements.txt','poetry.lock','pipfile','cargo.toml','go.mod','pom.xml','build.gradle','build.gradle.kts','gemfile','composer.json','dockerfile','docker-compose.yml','docker-compose.yaml','compose.yml','compose.yaml','terraform.tf','vercel.json','netlify.toml']);

export async function enrichReposWithEvidence(repos, {onProgress, maxRepos = 30} = {}) {
  const targets = repos.filter(r => r.authorization !== 'EXCLUDE').slice(0, maxRepos);
  let completed = 0;
  let rateLimited = false;

  for (const repo of targets) {
    if (rateLimited) {
      repo.evidence = unavailable('RATE_LIMIT_SKIPPED');
      completed++;
      onProgress?.({completed,total:targets.length,repo,status:'skipped'});
      continue;
    }

    const cached = readCache(repo);
    if (cached) {
      repo.evidence = cached;
      completed++;
      onProgress?.({completed,total:targets.length,repo,status:'cached'});
      continue;
    }

    try {
      const evidence = await fetchRepoTreeEvidence(repo);
      repo.evidence = evidence;
      writeCache(repo, evidence);
      completed++;
      onProgress?.({completed,total:targets.length,repo,status:'ok'});
    } catch (err) {
      const code = evidenceErrorCode(err);
      repo.evidence = unavailable(code);
      if (code === 'RATE_LIMIT') rateLimited = true;
      completed++;
      onProgress?.({completed,total:targets.length,repo,status:'error',error:code});
    }
  }

  return repos;
}

export async function fetchRepoTreeEvidence(repo) {
  const [owner, name] = String(repo.full_name || '').split('/');
  if (!owner || !name) throw new Error('INVALID_REPO_IDENTITY');
  const ref = repo.default_branch || 'main';
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const res = await fetch(url, {
    method:'GET', mode:'cors', cache:'no-store', credentials:'omit',
    headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
  });
  if (!res.ok) {
    const err = new Error(`GITHUB_TREE_${res.status}`);
    err.status = res.status;
    err.rateRemaining = res.headers.get('x-ratelimit-remaining');
    throw err;
  }
  const data = await res.json();
  return analyzeTree(data.tree || [], {truncated:Boolean(data.truncated)});
}

export function analyzeTree(tree, {truncated = false} = {}) {
  const blobs = tree.filter(x => x?.type === 'blob' && typeof x.path === 'string');
  const paths = blobs.map(x => x.path);
  const lower = paths.map(x => x.toLowerCase());
  const dirs = new Set();
  const extensions = new Map();
  let maxDepth = 0;
  let sourceFiles = 0;
  let testFiles = 0;
  let docsFiles = 0;
  let workflowFiles = 0;
  let configFiles = 0;
  let totalBlobBytes = 0;

  for (let i=0;i<paths.length;i++) {
    const path = paths[i];
    const p = lower[i];
    const parts = path.split('/');
    maxDepth = Math.max(maxDepth, parts.length - 1);
    if (parts.length > 1) dirs.add(parts[0]);
    const base = parts.at(-1).toLowerCase();
    const ext = base.includes('.') ? base.split('.').at(-1) : '';
    if (ext) extensions.set(ext, (extensions.get(ext) || 0) + 1);
    if (SOURCE_EXT.has(ext)) sourceFiles++;
    if (/(^|\/)(test|tests|spec|specs|__tests__)(\/|$)/i.test(path) || /(^|\.)(test|spec)\.[^.]+$/i.test(base) || /_test\.py$/i.test(base)) testFiles++;
    if (/(^|\/)(docs?|documentation)(\/|$)/i.test(path) || /^readme(\.|$)/i.test(base) || /\.(md|mdx|rst)$/i.test(base)) docsFiles++;
    if (/^\.github\/workflows\//i.test(path)) workflowFiles++;
    if (CONFIG_NAMES.has(base) || /(^|\/)(tsconfig[^/]*\.json|vite\.config\.|next\.config\.|tailwind\.config\.|eslint\.config\.|\.eslintrc|\.prettierrc)/i.test(p)) configFiles++;
    totalBlobBytes += Number(blobs[i].size || 0);
  }

  const signatures = detectSignatures(lower);
  const manifests = lower.filter(p => isManifest(p)).slice(0, 24);
  const topExtensions = [...extensions.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
  const architectureScore = structuralScore({fileCount:blobs.length, sourceFiles, testFiles, docsFiles, workflowFiles, configFiles, maxDepth, signatures:signatures.length, topLevelDirs:dirs.size});
  const evidenceStrength = Math.min(100, Math.round(
    20 + Math.min(25, Math.log10(blobs.length + 1) * 14) +
    (sourceFiles ? 15 : 0) + (manifests.length ? 12 : 0) +
    (testFiles ? 10 : 0) + (workflowFiles ? 8 : 0) + (docsFiles ? 5 : 0) +
    Math.min(5, signatures.length)
  ));

  return {
    available:true,
    source:'github_recursive_tree',
    truncated,
    file_count:blobs.length,
    source_file_count:sourceFiles,
    test_file_count:testFiles,
    docs_file_count:docsFiles,
    workflow_file_count:workflowFiles,
    config_file_count:configFiles,
    top_level_dir_count:dirs.size,
    max_depth:maxDepth,
    total_blob_bytes:totalBlobBytes,
    manifests,
    signatures,
    top_extensions:topExtensions,
    architecture_score:architectureScore,
    evidence_strength:evidenceStrength
  };
}

function detectSignatures(paths) {
  const checks = [
    ['Next.js', p=>/(^|\/)next\.config\.(js|mjs|ts)$/.test(p)],
    ['Vite', p=>/(^|\/)vite\.config\.(js|mjs|ts)$/.test(p)],
    ['React', p=>/package\.json$/.test(p) && paths.some(x=>/\.(jsx|tsx)$/.test(x))],
    ['FastAPI/Python API', p=>/(^|\/)(main|app)\.py$/.test(p) && paths.some(x=>/(requirements\.txt|pyproject\.toml)$/.test(x))],
    ['Docker', p=>/(^|\/)(dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/.test(p)],
    ['GitHub Actions', p=>/^\.github\/workflows\//.test(p)],
    ['Supabase', p=>/(^|\/)supabase\//.test(p)],
    ['Prisma', p=>/(^|\/)prisma\/schema\.prisma$/.test(p)],
    ['Terraform', p=>/\.tf$/.test(p)],
    ['Rust', p=>/(^|\/)cargo\.toml$/.test(p)],
    ['Go', p=>/(^|\/)go\.mod$/.test(p)],
    ['Java/Maven', p=>/(^|\/)pom\.xml$/.test(p)],
    ['Gradle', p=>/(^|\/)(build\.gradle|build\.gradle\.kts)$/.test(p)],
    ['Node package', p=>/(^|\/)package\.json$/.test(p)],
    ['Python package', p=>/(^|\/)(pyproject\.toml|setup\.py|requirements\.txt)$/.test(p)]
  ];
  const found=[];
  for (const [name,fn] of checks) if (paths.some(fn)) found.push(name);
  return [...new Set(found)].slice(0,16);
}

function isManifest(path) {
  const base = path.split('/').at(-1);
  return CONFIG_NAMES.has(base) || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|cargo\.lock|go\.sum|prisma\/schema\.prisma)$/.test(path);
}

function structuralScore(x) {
  let s = 15;
  s += Math.min(20, Math.log10(x.fileCount + 1) * 12);
  s += Math.min(14, Math.log10(x.sourceFiles + 1) * 10);
  s += Math.min(10, x.topLevelDirs * 2);
  s += Math.min(10, x.maxDepth * 1.5);
  s += x.testFiles ? 8 : 0;
  s += x.workflowFiles ? 8 : 0;
  s += x.configFiles ? 8 : 0;
  s += Math.min(7, x.signatures * 1.5);
  return Math.min(100, Math.round(s));
}

function unavailable(error) {
  return {available:false, source:'github_recursive_tree', error};
}

function evidenceErrorCode(err) {
  if (err?.status === 403 && err?.rateRemaining === '0') return 'RATE_LIMIT';
  if (err?.status === 404) return 'TREE_NOT_FOUND';
  if (err?.status === 409) return 'EMPTY_REPOSITORY';
  if (/Load failed|Failed to fetch|NetworkError/i.test(String(err?.message || err))) return 'NETWORK';
  return err?.message || 'EVIDENCE_FETCH_FAILED';
}

function cacheKey(repo) {
  return `${CACHE_PREFIX}${repo.full_name}:${repo.updated_at || ''}:${repo.default_branch || ''}`;
}
function readCache(repo) {
  try {
    const raw = localStorage.getItem(cacheKey(repo));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.saved_at || Date.now() - parsed.saved_at > CACHE_TTL_MS) return null;
    return parsed.evidence || null;
  } catch { return null; }
}
function writeCache(repo, evidence) {
  try { localStorage.setItem(cacheKey(repo), JSON.stringify({saved_at:Date.now(), evidence})); } catch {}
}
