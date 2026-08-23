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
  setStatus('GitHubを読み込み中…'); $('load').disabled = true;
  try {
    const data = await fetchGitHubRepos(user);
    repos = data.filter(r => !r.private).slice(0, 30).map(r => normalizeRepo(r));
    if (!repos.length) throw new Error('NO_PUBLIC_REPOS');
    renderRepos(); $('repoStep').classList.remove('hidden');
    setStatus(`${repos.length}件の公開repoを取得しました`);
  } catch (e) { setStatus(`取得できませんでした: ${friendlyGitHubError(e)}`); }
  finally { $('load').disabled = false; }
});

async function fetchGitHubRepos(user) {
  let lastError;
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      if (attempt>1) { setStatus(`GitHub接続を再試行中… (${attempt}/3)`); await sleep(700*attempt); }
      const qs = new URLSearchParams({per_page:'100',sort:'updated',type:'owner',_:String(Date.now())});
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?${qs}`, {method:'GET',mode:'cors',cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
      if (!res.ok) { const err=new Error(`GITHUB_${res.status}`); err.status=res.status; err.rateRemaining=res.headers.get('x-ratelimit-remaining'); throw err; }
      return await res.json();
    } catch(e) { lastError=e; if(e?.status&&e.status<500) break; }
  }
  throw lastError || new Error('GITHUB_LOAD_FAILED');
}

function friendlyGitHubError(e){
  if(e?.status===403&&e?.rateRemaining==='0') return 'GitHub APIの無料枠上限に達しました。少し待って再試行してください';
  if(e?.status===404) return 'GitHubユーザーが見つかりません';
  if(e?.status===403) return 'GitHub APIに拒否されました。少し待って再試行してください';
  if(e?.status>=500) return 'GitHub側が一時的に不安定です。少し待って再試行してください';
  if(e?.message==='NO_PUBLIC_REPOS') return '公開repoが見つかりません';
  if(/Load failed|Failed to fetch|NetworkError|GITHUB_LOAD_FAILED/i.test(String(e?.message||e))) return 'GitHubへの接続が一時的に失敗しました。自動再試行でも復旧しませんでした';
  return e?.message||'UNKNOWN_ERROR';
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function renderRepos(){
  $('repos').innerHTML='';
  repos.forEach((repo,i)=>{
    const row=document.createElement('div'); row.className='repo';
    const meta=document.createElement('div'); meta.innerHTML=`<strong>${escapeHtml(repo.name)}</strong><br><small>${escapeHtml(repo.language||'Language unknown')} · updated ${escapeHtml((repo.updated_at||'').slice(0,10))}</small>`;
    const select=document.createElement('select');
    [[AUTH.SHOWCASE_AND_EVALUATE,'見せる＋評価'],[AUTH.EVALUATE_ONLY,'評価だけ'],[AUTH.EXCLUDE,'除外']].forEach(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);});
    select.addEventListener('change',()=>repos[i].authorization=select.value); row.append(meta,select); $('repos').append(row);
  });
}

$('confirm').addEventListener('click',()=>{
  const counts=repos.reduce((a,r)=>(a[r.authorization]=(a[r.authorization]||0)+1,a),{});
  $('confirmText').textContent=`見せる＋評価 ${counts[AUTH.SHOWCASE_AND_EVALUATE]||0}件 / 評価だけ ${counts[AUTH.EVALUATE_ONLY]||0}件 / 除外 ${counts[AUTH.EXCLUDE]||0}件。このEvidenceで解析してよいですか？`;
  $('confirmDialog').showModal();
});

$('generate').addEventListener('click',e=>{
  e.preventDefault();
  try{ lastResult=diagnose(repos); renderResult(lastResult); $('confirmDialog').close(); $('result').classList.remove('hidden'); $('result').scrollIntoView({behavior:'smooth'}); }
  catch(err){ setStatus(`生成できませんでした: ${err.message}`); $('confirmDialog').close(); }
});

function renderResult(result){
  const user=extractGitHubUser($('github').value);
  $('cardHandle').textContent=$('handle').value.trim()||user||'Developer'; $('cardType').textContent=result.type;
  $('cardAvatar').src=avatarData||`https://github.com/${encodeURIComponent(user)}.png?size=240`;
  $('cardHighlights').innerHTML=result.highlights.slice(0,3).map(x=>`<div class="stat">${escapeHtml(x)}</div>`).join('');
  $('recommended').innerHTML=result.recommended.length?'<h3>おすすめrepo</h3>'+result.recommended.map(r=>`<p><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.reason)}</p>`).join(''):'<p>公開候補repoは選択されていません。</p>';
  $('curiosity').innerHTML=result.curiosity.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
}

$('download').addEventListener('click',()=>shareCard(false));
$('share').addEventListener('click',()=>shareCard(true));

async function shareCard(withText){
  if(!lastResult) return setStatus('先にGenerateしてください');
  try{
    const blob=await renderPngCard(lastResult); const file=new File([blob],'developer-card.png',{type:'image/png'});
    const text=`GitHub開発スタイル診断やってみた。\n${lastResult.type}\n#個人開発 #DeveloperCard`;
    if(navigator.canShare?.({files:[file]})){
      try{ await navigator.share(withText?{files:[file],text,title:'Developer Card'}:{files:[file],title:'Developer Card'}); }
      catch(e){ if(isShareCancelled(e)) return; throw e; }
      return;
    }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='developer-card.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
    if(withText) await navigator.clipboard?.writeText(text); setStatus(withText?'PNGを書き出し、投稿文をコピーしました':'16:9 PNGカードを書き出しました');
  }catch(e){if(isShareCancelled(e))return;setStatus(`カードを書き出せませんでした: ${e.message}`);}
}

function isShareCancelled(e){return String(e?.name||'')==='AbortError'||/abort|cancel/i.test(String(e?.message||e||''));}

function cardStats(){
  const active=repos.filter(r=>r.authorization!==AUTH.EXCLUDE);
  const now=Date.now(); const recent=active.filter(r=>r.updated_at&&(now-Date.parse(r.updated_at))/86400000<=90).length;
  const langs=new Set(active.map(r=>r.language).filter(Boolean)).size;
  const originals=active.filter(r=>!r.fork).length;
  const large=active.filter(r=>Number(r.size_kb||0)>=500).length;
  const showcase=active.filter(r=>r.authorization===AUTH.SHOWCASE_AND_EVALUATE).length;
  const n=Math.max(active.length,1);
  return [
    ['活動量',Math.min(100,Math.round(recent/n*100))],
    ['技術横断',Math.min(100,langs*22)],
    ['実装規模',Math.min(100,Math.round(large/n*180))],
    ['オリジナル',Math.min(100,Math.round(originals/n*100))],
    ['公開適性',Math.min(100,Math.round(showcase/n*100))]
  ];
}

async function renderPngCard(result){
  const c=document.createElement('canvas'); c.width=1200;c.height=675; const ctx=c.getContext('2d');
  ctx.fillStyle='#050712';ctx.fillRect(0,0,1200,675);
  const bg=ctx.createLinearGradient(0,0,1200,675);bg.addColorStop(0,'#17103a');bg.addColorStop(.52,'#101a3a');bg.addColorStop(1,'#062339');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,675);
  const glow=ctx.createRadialGradient(180,330,0,180,330,310);glow.addColorStop(0,'rgba(135,91,255,.30)');glow.addColorStop(1,'rgba(135,91,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,520,675);
  ctx.strokeStyle='rgba(155,116,255,.75)';ctx.lineWidth=2;roundRect(ctx,28,28,1144,619,28);ctx.stroke();

  const handle=$('handle').value.trim()||extractGitHubUser($('github').value)||'Developer';
  ctx.fillStyle='rgba(255,255,255,.045)';roundRect(ctx,48,52,300,548,24);ctx.fill();
  ctx.fillStyle='#10152c';ctx.beginPath();ctx.arc(198,205,108,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f4f6ff';ctx.beginPath();ctx.arc(198,205,94,0,Math.PI*2);ctx.fill();
  if(avatarData){try{const img=await loadImage(avatarData);ctx.save();ctx.beginPath();ctx.arc(198,205,88,0,Math.PI*2);ctx.clip();drawImageCover(ctx,img,110,117,176,176);ctx.restore();}catch{drawInitialAt(ctx,handle,198,205);}}
  else drawInitialAt(ctx,handle,198,205);

  ctx.fillStyle='#9fa9d3';ctx.font='700 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('DEVELOPER CARD · FV',82,342);
  ctx.fillStyle='#fff';ctx.font='900 38px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trimText(ctx,handle,235),82,388);
  ctx.fillStyle='#b792ff';ctx.font='900 27px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trimText(ctx,result.type,240),82,428);
  ctx.fillStyle='rgba(183,146,255,.14)';roundRect(ctx,82,451,222,38,19);ctx.fill();ctx.fillStyle='#d8c5ff';ctx.font='700 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(`${result.evaluated_count} repo analyzed`,105,476);

  ctx.fillStyle='#fff';ctx.font='900 25px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('開発ステータス',386,85);
  const stats=cardStats(); stats.forEach(([label,val],i)=>{const y=122+i*55;ctx.fillStyle='#aeb7d8';ctx.font='700 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(label,386,y);ctx.fillStyle='rgba(255,255,255,.08)';roundRect(ctx,485,y-15,250,14,7);ctx.fill();const gg=ctx.createLinearGradient(485,0,735,0);gg.addColorStop(0,'#7c5cff');gg.addColorStop(1,'#46d7ff');ctx.fillStyle=gg;roundRect(ctx,485,y-15,250*val/100,14,7);ctx.fill();ctx.fillStyle='#dce4ff';ctx.font='800 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(String(val),748,y-2);});

  ctx.fillStyle='#fff';ctx.font='900 25px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('注目repo TOP3',800,85);
  result.recommended.slice(0,3).forEach((r,i)=>{const y=115+i*92;ctx.fillStyle='rgba(255,255,255,.055)';roundRect(ctx,792,y,340,76,16);ctx.fill();ctx.fillStyle=i===0?'#d3b9ff':'#f0f3ff';ctx.font='900 19px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(`${i+1}. ${trimText(ctx,r.name,240)}`,812,y+29);ctx.fillStyle='#8996bd';ctx.font='600 14px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trimText(ctx,r.reason,290),812,y+55);});

  ctx.fillStyle='rgba(78,215,255,.07)';roundRect(ctx,386,430,746,116,20);ctx.fill();ctx.strokeStyle='rgba(78,215,255,.28)';ctx.stroke();ctx.fillStyle='#7de4ff';ctx.font='900 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('✦ まだカードに出していないシグナル',410,463);ctx.fillStyle='#dce5ff';ctx.font='700 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';result.curiosity.slice(0,2).forEach((x,i)=>ctx.fillText('• '+trimText(ctx,x,650),420,495+i*28));

  ctx.fillStyle='#7f8bb0';ctx.font='600 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('GitHub Evidenceから現在の開発スタイルを可視化',386,595);ctx.fillStyle='#c9b4ff';ctx.font='900 17px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('Developer Card',1000,595);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG_ENCODE_FAILED')),'image/png',.95));
}

function drawImageCover(ctx,img,x,y,w,h){const s=Math.max(w/img.width,h/img.height),sw=w/s,sh=h/s,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
function drawInitialAt(ctx,handle,x,y){ctx.fillStyle='#171b33';ctx.beginPath();ctx.arc(x,y,88,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7c5cff';ctx.font='900 64px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.fillText((handle||'D').slice(0,1).toUpperCase(),x,y+22);ctx.textAlign='left';}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
function trimText(ctx,text,maxWidth){let out=String(text??'');if(ctx.measureText(out).width<=maxWidth)return out;while(out.length&&ctx.measureText(out+'…').width>maxWidth)out=out.slice(0,-1);return out+'…';}
function setStatus(s){$('status').textContent=s;}
function escapeHtml(s){return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
