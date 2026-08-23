import {AUTH, normalizeRepo, diagnose, extractGitHubUser} from './diagnosis.mjs';

const $ = id => document.getElementById(id);
let repos = [];
let avatarData = '';

$('avatar').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 4_000_000) return setStatus('画像は4MB以下にしてください');
  const reader = new FileReader();
  reader.onload = () => avatarData = String(reader.result || '');
  reader.readAsDataURL(file);
});

$('load').addEventListener('click', async () => {
  const user = extractGitHubUser($('github').value);
  if (!user) return setStatus('GitHub URL / usernameを確認してください');
  setStatus('GitHubを読み込み中…');
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error(`GITHUB_${res.status}`);
    const data = await res.json();
    repos = data.filter(r => !r.private).slice(0, 30).map(r => normalizeRepo(r));
    if (!repos.length) throw new Error('NO_PUBLIC_REPOS');
    renderRepos();
    $('repoStep').classList.remove('hidden');
    setStatus(`${repos.length}件の公開repoを取得しました`);
  } catch (e) {
    setStatus(`取得できませんでした: ${e.message}`);
  }
});

function renderRepos() {
  $('repos').innerHTML = '';
  for (const [i, repo] of repos.entries()) {
    const row = document.createElement('div'); row.className = 'repo';
    const meta = document.createElement('div');
    meta.innerHTML = `<strong>${escapeHtml(repo.name)}</strong><br><small>${escapeHtml(repo.language || 'Language unknown')} · updated ${escapeHtml((repo.updated_at || '').slice(0,10))}</small>`;
    const select = document.createElement('select');
    for (const [value,label] of [[AUTH.SHOWCASE_AND_EVALUATE,'見せる＋評価'],[AUTH.EVALUATE_ONLY,'評価だけ'],[AUTH.EXCLUDE,'除外']]) {
      const option = document.createElement('option'); option.value=value; option.textContent=label; select.append(option);
    }
    select.addEventListener('change', () => repos[i].authorization = select.value);
    row.append(meta, select); $('repos').append(row);
  }
}

$('confirm').addEventListener('click', () => {
  const counts = repos.reduce((a,r)=>(a[r.authorization]=(a[r.authorization]||0)+1,a),{});
  $('confirmText').textContent = `見せる＋評価 ${counts[AUTH.SHOWCASE_AND_EVALUATE]||0}件 / 評価だけ ${counts[AUTH.EVALUATE_ONLY]||0}件 / 除外 ${counts[AUTH.EXCLUDE]||0}件。このEvidenceで解析してよいですか？`;
  $('confirmDialog').showModal();
});

$('generate').addEventListener('click', e => {
  e.preventDefault();
  try {
    const result = diagnose(repos);
    renderResult(result);
    $('confirmDialog').close();
    $('result').classList.remove('hidden');
    $('result').scrollIntoView({behavior:'smooth'});
  } catch (err) { setStatus(`生成できませんでした: ${err.message}`); $('confirmDialog').close(); }
});

function renderResult(result) {
  $('cardHandle').textContent = $('handle').value.trim() || extractGitHubUser($('github').value) || 'Developer';
  $('cardType').textContent = result.type;
  $('cardAvatar').src = avatarData || `https://github.com/${encodeURIComponent(extractGitHubUser($('github').value))}.png?size=240`;
  $('cardHighlights').innerHTML = result.highlights.slice(0,3).map(x=>`<div class="stat">${escapeHtml(x)}</div>`).join('');
  $('recommended').innerHTML = result.recommended.length ? '<h3>おすすめrepo</h3>'+result.recommended.map(r=>`<p><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.reason)}</p>`).join('') : '<p>公開候補repoは選択されていません。</p>';
  $('curiosity').innerHTML = result.curiosity.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
}

$('share').addEventListener('click', async () => {
  const text = `GitHub開発スタイル診断やってみた。\n${$('cardType').textContent}\n#個人開発 #DeveloperCard`;
  if (navigator.share) return navigator.share({text}).catch(()=>{});
  await navigator.clipboard?.writeText(text); setStatus('X投稿用テキストをコピーしました');
});

$('download').addEventListener('click', () => {
  // V1 zero-dependency fallback: print/save the exact 16:9 card. PNG renderer is a follow-up.
  window.print();
});

function setStatus(s){ $('status').textContent=s; }
function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
