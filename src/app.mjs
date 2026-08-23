import {AUTH, normalizeRepo, diagnose, extractGitHubUser} from './diagnosis.mjs';

const $ = id => document.getElementById(id);
let repos = [];
let avatarData = '';
let lastResult = null;

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
  $('load').disabled = true;
  try {
    const data = await fetchGitHubRepos(user);
    repos = data.filter(r => !r.private).slice(0, 30).map(r => normalizeRepo(r));
    if (!repos.length) throw new Error('NO_PUBLIC_REPOS');
    renderRepos();
    $('repoStep').classList.remove('hidden');
    setStatus(`${repos.length}件の公開repoを取得しました`);
  } catch (e) {
    const message = friendlyGitHubError(e);
    setStatus(`取得できませんでした: ${message}`);
  } finally {
    $('load').disabled = false;
  }
});

async function fetchGitHubRepos(user) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        setStatus(`GitHub接続を再試行中… (${attempt}/3)`);
        await sleep(700 * attempt);
      }
      const qs = new URLSearchParams({per_page:'100', sort:'updated', type:'owner', _:String(Date.now())});
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?${qs}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      if (!res.ok) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        const err = new Error(`GITHUB_${res.status}`);
        err.status = res.status;
        err.rateRemaining = remaining;
        throw err;
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      // HTTP errors are deterministic enough not to hammer GitHub except 5xx.
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

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

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
    lastResult = diagnose(repos);
    renderResult(lastResult);
    $('confirmDialog').close();
    $('result').classList.remove('hidden');
    $('result').scrollIntoView({behavior:'smooth'});
  } catch (err) { setStatus(`生成できませんでした: ${err.message}`); $('confirmDialog').close(); }
});

function renderResult(result) {
  const user = extractGitHubUser($('github').value);
  $('cardHandle').textContent = $('handle').value.trim() || user || 'Developer';
  $('cardType').textContent = result.type;
  $('cardAvatar').src = avatarData || `https://github.com/${encodeURIComponent(user)}.png?size=240`;
  $('cardHighlights').innerHTML = result.highlights.slice(0,3).map(x=>`<div class="stat">${escapeHtml(x)}</div>`).join('');
  $('recommended').innerHTML = result.recommended.length ? '<h3>おすすめrepo</h3>'+result.recommended.map(r=>`<p><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.reason)}</p>`).join('') : '<p>公開候補repoは選択されていません。</p>';
  $('curiosity').innerHTML = result.curiosity.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
}

$('share').addEventListener('click', async () => {
  const text = `GitHub開発スタイル診断やってみた。\n${$('cardType').textContent}\n#個人開発 #DeveloperCard`;
  if (navigator.share) return navigator.share({text}).catch(()=>{});
  await navigator.clipboard?.writeText(text); setStatus('X投稿用テキストをコピーしました');
});

$('download').addEventListener('click', async () => {
  if (!lastResult) return setStatus('先にGenerateしてください');
  try {
    const blob = await renderPngCard(lastResult);
    const file = new File([blob], 'developer-card.png', {type:'image/png'});
    if (navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file], title:'Developer Card'});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'developer-card.png'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
    setStatus('16:9 PNGカードを書き出しました');
  } catch (e) {
    setStatus(`カードを書き出せませんでした: ${e.message}`);
  }
});

async function renderPngCard(result) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 675;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#070916'; ctx.fillRect(0,0,c.width,c.height);
  const g = ctx.createLinearGradient(0,0,1200,675); g.addColorStop(0,'rgba(111,76,255,.22)'); g.addColorStop(1,'rgba(0,212,255,.08)'); ctx.fillStyle=g; ctx.fillRect(0,0,1200,675);
  ctx.strokeStyle='rgba(131,105,255,.55)'; ctx.lineWidth=2; roundRect(ctx,35,35,1130,605,28); ctx.stroke();

  const handle = $('handle').value.trim() || extractGitHubUser($('github').value) || 'Developer';
  const avatarSrc = avatarData;
  if (avatarSrc) {
    try { const img = await loadImage(avatarSrc); ctx.save(); ctx.beginPath(); ctx.arc(115,125,58,0,Math.PI*2); ctx.clip(); ctx.drawImage(img,57,67,116,116); ctx.restore(); }
    catch { drawInitial(ctx, handle); }
  } else drawInitial(ctx, handle);

  ctx.fillStyle='#aeb6d9'; ctx.font='600 20px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('GitHub 開発スタイル診断',205,92);
  ctx.fillStyle='#ffffff'; ctx.font='800 46px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trimText(ctx,handle,620),205,145);
  ctx.fillStyle='#9a7cff'; ctx.font='800 30px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trimText(ctx,result.type,760),205,190);

  const highlights = result.highlights.slice(0,3);
  highlights.forEach((h,i)=>{
    const x=55+i*365, y=250;
    ctx.fillStyle='rgba(255,255,255,.055)'; roundRect(ctx,x,y,335,105,18); ctx.fill();
    ctx.fillStyle='#c8cfea'; ctx.font='600 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; wrapText(ctx,h,x+20,y+34,295,25,3);
  });

  ctx.fillStyle='#ffffff'; ctx.font='800 23px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('注目repo',55,415);
  const top = result.recommended.slice(0,3);
  top.forEach((r,i)=>{
    const y=455+i*48;
    ctx.fillStyle=i===0?'#b9a5ff':'#dce1f5'; ctx.font='700 19px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';
    ctx.fillText(`${i+1}. ${trimText(ctx,r.name,300)}`,65,y);
    ctx.fillStyle='#8f99bd'; ctx.font='500 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trimText(ctx,r.reason,690),390,y);
  });

  ctx.fillStyle='#8f99bd'; ctx.font='500 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('無料版：今のGitHubから見える開発スタイルを可視化',55,605);
  ctx.fillStyle='#b9a5ff'; ctx.font='700 17px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('Developer Card FV',955,605);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG_ENCODE_FAILED')),'image/png',0.95));
}

function drawInitial(ctx, handle){ ctx.fillStyle='#171b33'; ctx.beginPath(); ctx.arc(115,125,58,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#c8baff'; ctx.font='800 46px -apple-system,BlinkMacSystemFont,sans-serif'; ctx.textAlign='center'; ctx.fillText((handle||'D').slice(0,1).toUpperCase(),115,142); ctx.textAlign='left'; }
function loadImage(src){ return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;}); }
function roundRect(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath(); }
function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines){ const chars=[...String(text)]; let line='',lines=0; for(const ch of chars){const test=line+ch;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y+lines*lineHeight);lines++;line=ch;if(lines>=maxLines)return;}else line=test;} if(lines<maxLines)ctx.fillText(line,x,y+lines*lineHeight); }
function trimText(ctx,text,maxWidth){ let out=String(text??''); if(ctx.measureText(out).width<=maxWidth)return out; while(out.length&&ctx.measureText(out+'…').width>maxWidth)out=out.slice(0,-1); return out+'…'; }
function setStatus(s){ $('status').textContent=s; }
function escapeHtml(s){ return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
