import {readPublicReportFromLocation, isMachineReportLocation, serializeMachineReport} from './public-report.mjs';

const $ = id => document.getElementById(id);
const result = $('result');
const sharedPayload = readPublicReportFromLocation();

if (sharedPayload) {
  if (isMachineReportLocation()) renderMachineReport(sharedPayload);
  else renderSharedReport(sharedPayload);
} else {
  window.addEventListener('dc:report-ready', event => {
    const payload = event.detail || window.__DC_PUBLIC_REPORT__;
    if (payload) renderTwoLayerReport(payload);
  });
}

function renderMachineReport(payload) {
  const json = serializeMachineReport(payload);
  document.title = `${payload.handle || 'Developer'} — DeveloperCardReport v1 JSON`;
  document.documentElement.dataset.developerCardSchema = payload.schema || 'developer-card-report';
  document.documentElement.dataset.developerCardSchemaVersion = String(payload.schema_version || 1);
  document.body.innerHTML = `<main style="max-width:960px;margin:0 auto;padding:24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#eaf0ff;background:#07101f;min-height:100vh"><h1 style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif">DeveloperCardReport v1</h1><p style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;color:#9aa8c8">Machine-readable public-safe JSON view. FVでは静的GitHub Pages上でブラウザ実行により復元します。</p><pre id="machineReport" data-schema="${escAttr(payload.schema)}" data-schema-version="${Number(payload.schema_version)||1}" style="white-space:pre-wrap;overflow-wrap:anywhere;background:#0c1730;border:1px solid #293c67;border-radius:12px;padding:18px">${esc(json)}</pre></main>`;
}

function renderSharedReport(payload) {
  document.querySelector('.hero')?.classList.add('hidden');
  document.querySelector('.input-panel')?.classList.add('hidden');
  $('repoStep')?.classList.add('hidden');
  $('confirmDialog')?.close?.();
  result?.classList.remove('hidden');
  $('xcard')?.classList.add('hidden');
  const action = result?.querySelector('.action-panel');
  if (action) {
    const cleanUrl = new URL(location.href); cleanUrl.hash = ''; cleanUrl.search = '';
    action.innerHTML = `<h2>自分も診断する</h2><p>このレポートは公開安全な集約データから再現されています。</p><a class="action-link" href="${escAttr(cleanUrl.toString())}">Developer Cardを試す</a>`;
  }
  renderTwoLayerReport(payload, false);
  document.title = `${payload.handle || 'Developer'} — Developer Card Report`;
}

function renderTwoLayerReport(payload, showTopLabel = true) {
  $('detailReport')?.remove();
  const xcard = $('xcard');
  const summaryPanel = result?.querySelector('.action-panel');
  if (!result || !summaryPanel) return;

  if (showTopLabel && xcard && !result.querySelector('.section-kicker')) {
    const topLabel = document.createElement('div');
    topLabel.className = 'section-kicker';
    topLabel.textContent = 'Xカード（シェア用・単体）';
    result.insertBefore(topLabel, xcard);
  }

  const detail = document.createElement('section');
  detail.id = 'detailReport';
  detail.className = 'detail-report';
  detail.innerHTML = `
    <div class="detail-head">
      <div class="detail-profile"><img id="detailAvatar" alt=""><div><strong id="detailHandle"></strong><small>GitHub Evidence Report</small></div></div>
      <div class="detail-type"><small>開発タイプ</small><strong id="detailType"></strong><span id="detailTypeCopy"></span></div>
    </div>
    <div class="detail-grid">
      <article class="report-card radar-card"><h3>能力バランス</h3><canvas id="radar" width="520" height="390"></canvas><p class="micro">FVは公開メタデータ由来。能力の絶対評価ではありません。</p></article>
      <article class="report-card"><h3>開発アクティビティ</h3><div id="activityBars" class="metric-list"></div><div class="peak-box"><small>現在の傾向</small><strong id="activityLabel"></strong></div></article>
      <article class="report-card"><h3>言語・技術スタック</h3><div id="languageBars" class="metric-list"></div><div id="techTags" class="tags"></div></article>
      <article class="report-card repos-card"><h3>注目リポジトリ TOP3</h3><div id="detailRepos"></div></article>
      <article class="report-card"><h3>開発スタイルの特徴</h3><div id="styleTraits" class="trait-list"></div></article>
      <article class="report-card"><h3>あなたの強み TOP3</h3><ol id="strengths" class="number-list"></ol></article>
      <article class="report-card"><h3>伸ばすとさらに強くなるポイント</h3><ul id="growthPoints" class="spark-list"></ul></article>
      <article class="report-card cta-card"><h3>もっと深く掘る</h3><p>研究余地・事業化余地・公開リスク・次に作るべきものまで、Deep解析で確認できます。</p><button type="button" disabled>Deep解析は近日公開</button></article>
    </div>
    <div class="detail-foot"><span>Developer Card</span><span>あなたのGitHubが、あなたの価値を語っている。</span></div>`;

  result.insertBefore(detail, summaryPanel);
  hydrateDetail(payload);
}

function hydrateDetail(payload) {
  const d = payload.detail || {};
  $('detailAvatar').src = payload.avatar_url || '';
  $('detailHandle').textContent = payload.handle || 'Developer';
  $('detailType').textContent = payload.type || '';
  $('detailTypeCopy').textContent = payload.type_description || '現在のGitHub Evidenceから見える傾向';
  drawRadar($('radar'), d.axes || []);
  $('activityBars').innerHTML = (d.activity || []).map(([label,num,total]) => metric(label,num,total)).join('') || '<p class="micro">活動情報は限定的です</p>';
  $('activityLabel').textContent = d.activity_label || '蓄積型';
  $('languageBars').innerHTML = (d.language_shares || []).map(x => bar(x.name,x.value)).join('') || '<p class="micro">言語情報は限定的です</p>';
  $('techTags').innerHTML = (d.language_shares || []).map(x=>`<span>${esc(x.name)}</span>`).join('');
  $('detailRepos').innerHTML = (d.recommended || []).map((r,i)=>`<div class="detail-repo"><b>${i+1}. ${esc(r.name)}</b><p>${esc(r.reason)}</p><small>${esc(r.language || '')}${r.updated_at ? ' · '+esc(String(r.updated_at).slice(0,10)) : ''}</small></div>`).join('') || '<p class="micro">公開候補repoはありません</p>';
  $('styleTraits').innerHTML = (d.traits || []).map(([label,val])=>bar(label,val)).join('');
  $('strengths').innerHTML = (d.strengths || []).map(x=>`<li>${esc(x)}</li>`).join('');
  $('growthPoints').innerHTML = (d.growth || []).map(x=>`<li>${esc(x)}</li>`).join('');
}

function drawRadar(canvas, axes) {
  if (!canvas || !axes.length) return;
  const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2+6,r=135,N=axes.length;
  ctx.clearRect(0,0,w,h); ctx.font='600 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.textAlign='center';
  for(let level=1;level<=5;level++){
    ctx.beginPath();axes.forEach((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/N,rr=r*level/5,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.strokeStyle='rgba(140,120,255,.18)';ctx.stroke();
  }
  axes.forEach(([label],i)=>{const a=-Math.PI/2+i*2*Math.PI/N;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.strokeStyle='rgba(100,150,255,.16)';ctx.stroke();ctx.fillStyle='#b9c3e6';ctx.fillText(label,cx+Math.cos(a)*(r+34),cy+Math.sin(a)*(r+34)+5);});
  ctx.beginPath();axes.forEach(([,v],i)=>{const a=-Math.PI/2+i*2*Math.PI/N,rr=r*v/100,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);g.addColorStop(0,'rgba(155,90,255,.55)');g.addColorStop(1,'rgba(50,180,255,.45)');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#8d70ff';ctx.lineWidth=2;ctx.stroke();
}
function metric(label,num,total){return bar(`${label} ${num}/${total}`,Math.round(num/Math.max(total,1)*100));}
function bar(label,val){return `<div class="metric"><div><span>${esc(label)}</span><b>${Math.round(val)}%</b></div><i><em style="width:${Math.max(4,Math.min(100,val))}%"></em></i></div>`;}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escAttr(s){return esc(s).replace(/'/g,'&#39;');}
