import {AUTH, normalizeRepo, diagnose, extractGitHubUser} from './diagnosis.mjs';
import {enrichReposWithEvidence} from './evidence.mjs';
import {buildShareCardModel, renderShareCardDom, exportShareCardPng} from './share-card.mjs';
import {buildDeveloperCardReportV1, buildMachineReportUrl, serializeMachineReport} from './public-report.mjs';

const $ = id => document.getElementById(id);
let repos = [];
let avatarData = '';
let lastResult = null;
let lastCardModel = null;
let publicRepoCount = 0;

$('avatar')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 4_000_000) return setStatus('画像は4MB以下にしてください');
  const reader = new FileReader();
  reader.onload = () => avatarData = String(reader.result || '');
  reader.readAsDataURL(file);
});

$('load')?.addEventListener('click', async () => {
  const user = extractGitHubUser($('github').value);
  if (!user) return setStatus('GitHub URL / usernameを確認してください');
  setStatus('GitHubを読み込み中…');
  $('load').disabled = true;
  try {
    const data = await fetchGitHubRepos(user);
    const publicRepos = data.filter(r => !r.private);
    publicRepoCount = publicRepos.length;
    repos = publicRepos.slice(0, 30).map(r => normalizeRepo(r));
    if (!repos.length) throw new Error('NO_PUBLIC_REPOS');
    renderRepos();
    $('repoStep').classList.remove('hidden');
    setStatus(`${repos.length}件の公開repoを取得しました${publicRepoCount > repos.length ? `（先頭${repos.length}件を表示）` : ''}`);
  } catch (e) {
    setStatus(`取得できませんでした: ${friendlyGitHubError(e)}`);
  } finally {
    $('load').disabled = false;
  }
});

async function fetchGitHubRepos(user) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        setStatus(`GitHub接続を再試行中… (${attempt}/3)`);
        await sleep(700 * attempt);
      }
      const qs = new URLSearchParams({per_page:'100', sort:'updated', type:'owner', _:String(Date.now())});
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?${qs}`, {
        method:'GET', mode:'cors', cache:'no-store', credentials:'omit',
        headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
      });
      if (!res.ok) {
        const err = new Error(`GITHUB_${res.status}`);
        err.status = res.status;
        err.rateRemaining = res.headers.get('x-ratelimit-remaining');
        throw err;
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      if (e?.status && e.status < 500) break;
    }
  }
  throw lastError || new Error('GITHUB_LOAD_FAILED');
}

function friendlyGitHubError(e) {
  if (e?.status === 403 && e?.rateRemaining === '0') return 'GitHub APIの無料枠上限に達しました。少し待って再試行してください';
  if (e?.status === 404) return 'GitHubユーザーが見つかりません';
  if (e?.status === 403) return 'GitHub APIに拒否されました。少し待って再試行してください';
  if (e?.status >= 500) return 'GitHub側が一時的に不安定です。少し待って再試行してください';
  if (e?.message === 'NO_PUBLIC_REPOS') return '公開repoが見つかりません';
  if (/Load failed|Failed to fetch|NetworkError|GITHUB_LOAD_FAILED/i.test(String(e?.message || e))) return 'GitHubへの接続が一時的に失敗しました。自動再試行でも復旧しませんでした';
  return e?.message || 'UNKNOWN_ERROR';
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function renderRepos() {
  $('repos').innerHTML = '';
  repos.forEach((repo, i) => {
    const row = document.createElement('div');
    row.className = 'repo';
    const meta = document.createElement('div');
    meta.innerHTML = `<strong>${escapeHtml(repo.name)}</strong><br><small>${escapeHtml(repo.language || 'Language unknown')} · updated ${escapeHtml((repo.updated_at || '').slice(0,10))}</small>`;
    const select = document.createElement('select');
    [[AUTH.SHOWCASE_AND_EVALUATE,'見せる＋評価'],[AUTH.EVALUATE_ONLY,'評価だけ'],[AUTH.EXCLUDE,'除外']].forEach(([value,label]) => {
      const option = document.createElement('option');
      option.value = value; option.textContent = label; select.append(option);
    });
    select.addEventListener('change', () => repos[i].authorization = select.value);
    row.append(meta, select); $('repos').append(row);
  });
}

$('confirm')?.addEventListener('click', () => {
  const counts = repos.reduce((a,r)=>(a[r.authorization]=(a[r.authorization]||0)+1,a),{});
  $('confirmText').textContent = `見せる＋評価 ${counts[AUTH.SHOWCASE_AND_EVALUATE]||0}件 / 評価だけ ${counts[AUTH.EVALUATE_ONLY]||0}件 / 除外 ${counts[AUTH.EXCLUDE]||0}件。次に各repoの実ファイル構造Evidenceを取得して解析します。よいですか？`;
  $('confirmDialog').showModal();
});

$('generate')?.addEventListener('click', async e => {
  e.preventDefault();
  $('generate').disabled = true;
  try {
    const authorizedCount = repos.filter(r => r.authorization !== AUTH.EXCLUDE).length;
    setStatus(`Evidence取得を開始します… 0/${authorizedCount}`);
    await enrichReposWithEvidence(repos, {
      onProgress: ({completed,total,repo,status,error}) => {
        const suffix = status === 'cached' ? '（cache）' : status === 'error' ? `（${error}）` : status === 'skipped' ? '（上限のため省略）' : '';
        setStatus(`実ファイル構造Evidenceを取得中… ${completed}/${total} ${repo?.name || ''}${suffix}`);
      }
    });
    lastResult = diagnose(repos);
    await renderResult(lastResult);
    $('confirmDialog').close();
    $('result').classList.remove('hidden');
    const missing = Math.max(0, lastResult.evaluated_count - lastResult.evidence_count);
    setStatus(`Evidence解析完了: ${lastResult.evidence_count}/${lastResult.evaluated_count} repo${missing ? `（未取得 ${missing}件はメタデータのみ）` : ''}`);
    window.dispatchEvent(new CustomEvent('dc:report-ready', {detail:lastCardModel?.publicPayload || window.__DC_PUBLIC_REPORT__}));
    $('result').scrollIntoView({behavior:'smooth'});
  } catch (err) {
    setStatus(`生成できませんでした: ${err.message}`);
    $('confirmDialog').close();
  } finally {
    $('generate').disabled = false;
  }
});

async function renderResult(result) {
  const user = extractGitHubUser($('github').value);
  const handle = $('handle').value.trim() || user || 'Developer';
  const avatarSrc = avatarData || `https://github.com/${encodeURIComponent(user)}.png?size=320`;
  lastCardModel = await buildShareCardModel({result, repos, handle, githubUser:user, avatarSrc, publicRepoCount:publicRepoCount || repos.length});
  lastCardModel.evidence_count = result.evidence_count;
  lastCardModel.evidence_coverage = result.evidence_coverage;
  lastCardModel.evidence_summary = result.evidence_summary;
  lastCardModel.detail = {
    ...(lastCardModel.detail || {}),
    evidence:{
      analyzed_repos:result.evidence_count,
      evaluated_repos:result.evaluated_count,
      coverage:result.evidence_coverage,
      signatures:result.evidence_summary?.signatures || [],
      repos_with_tests:result.evidence_summary?.repos_with_tests || 0,
      repos_with_ci:result.evidence_summary?.repos_with_ci || 0,
      strong_architecture_repos:result.evidence_summary?.strong_architecture_repos || 0
    }
  };
  lastCardModel.publicPayload = buildDeveloperCardReportV1(lastCardModel);
  lastCardModel.machine_url = buildMachineReportUrl(lastCardModel.publicPayload);
  window.__DC_PUBLIC_REPORT__ = lastCardModel.publicPayload;
  window.__DC_LAST_CARD_MODEL__ = lastCardModel;
  renderShareCardDom(lastCardModel);
  $('recommended').innerHTML = result.recommended.length
    ? `<p class="micro">実ファイル構造Evidence: ${result.evidence_count}/${result.evaluated_count} repo</p><h3>おすすめrepo</h3>` + result.recommended.map(r=>`<p><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.reason)}${r.evidence_available ? ' <small>Evidence済</small>' : ' <small>metadataのみ</small>'}</p>`).join('')
    : '<p>公開候補repoは選択されていません。</p>';
  $('curiosity').innerHTML = result.curiosity.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
}

$('download')?.addEventListener('click', async () => {
  if (!lastCardModel) return setStatus('先にGenerateしてください');
  try {
    const blob = await exportShareCardPng(lastCardModel);
    const file = new File([blob], 'developer-card-x.png', {type:'image/png'});
    if (navigator.canShare?.({files:[file]}) && navigator.share) {
      try {
        await navigator.share({files:[file], title:'Developer Card'});
        setStatus('共有シートから「画像を保存」で写真へ保存できます');
      } catch (e) {
        if (String(e?.name || '') === 'AbortError') return;
        throw e;
      }
      return;
    }
    downloadBlob(blob, 'developer-card-x.png');
    setStatus('正本Xカード（1200×675 PNG）を書き出しました');
  } catch (e) {
    setStatus(`Xカードを書き出せませんでした: ${e.message}`);
  }
});

$('share')?.addEventListener('click', async () => {
  if (!lastCardModel) return setStatus('先にGenerateしてください');
  const text = `GitHub解析で開発スタイル診断してみた。\n「${lastCardModel.type}」\n${lastCardModel.detail_url}\n#DeveloperCard診断 #個人開発 #DeveloperCard`;
  try {
    await copyText(text);
    setStatus('X投稿文と詳細レポートURLをコピーしました');
    flashButton($('share'), 'コピーしました ✓');
  } catch {
    setStatus('コピーできませんでした。長押しコピーを試してください');
  }
});

$('machineDownload')?.addEventListener('click', () => {
  if (!lastCardModel?.publicPayload) return setStatus('先にGenerateしてください');
  const json = serializeMachineReport(lastCardModel.publicPayload);
  const blob = new Blob([json], {type:'application/json;charset=utf-8'});
  downloadBlob(blob, 'developer-card-report-v1.json');
  setStatus('DeveloperCardReport v1 JSONを書き出しました');
});

$('machineCopy')?.addEventListener('click', async () => {
  if (!lastCardModel?.machine_url) return setStatus('先にGenerateしてください');
  try {
    await copyText(lastCardModel.machine_url);
    setStatus('Machine-readable Report URLをコピーしました');
    flashButton($('machineCopy'), 'コピーしました ✓');
  } catch {
    setStatus('Machine URLをコピーできませんでした');
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function flashButton(btn, label) {
  if (!btn) return;
  const old = btn.textContent; btn.textContent = label;
  setTimeout(()=>btn.textContent=old,1400);
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.append(ta); ta.select();
  const ok=document.execCommand('copy'); ta.remove(); if(!ok) throw new Error('COPY_FAILED');
}
function setStatus(s){const el=$('status');if(el)el.textContent=s;}
function escapeHtml(s){return String(s??'').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
