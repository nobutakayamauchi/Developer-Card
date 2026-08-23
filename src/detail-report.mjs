const $ = id => document.getElementById(id);

const result = $('result');
if (result) {
  const observer = new MutationObserver(() => {
    if (!result.classList.contains('hidden')) renderTwoLayerReport();
  });
  observer.observe(result, {attributes:true, attributeFilter:['class']});
}

function renderTwoLayerReport(){
  if ($('detailReport')) return;
  const xcard = $('xcard');
  const summaryPanel = result.querySelector('.panel');
  if (!xcard || !summaryPanel) return;

  xcard.classList.add('share-card-preview');
  const topLabel = document.createElement('div');
  topLabel.className = 'section-kicker';
  topLabel.textContent = 'Xカード（シェア用・単体）';
  result.insertBefore(topLabel, xcard);

  const detail = document.createElement('section');
  detail.id = 'detailReport';
  detail.className = 'detail-report';
  detail.innerHTML = `
    <div class="detail-head">
      <div class="detail-profile">
        <img id="detailAvatar" alt="">
        <div><strong id="detailHandle"></strong><small>GitHub Evidence Report</small></div>
      </div>
      <div class="detail-type"><small>開発タイプ</small><strong id="detailType"></strong><span>現在のGitHub Evidenceから見える傾向</span></div>
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
  summaryPanel.classList.add('action-panel');
  summaryPanel.querySelector('h2')?.replaceChildren(document.createTextNode('共有・次のアクション'));
  hydrateDetail();
}

function hydrateDetail(){
  const avatar = $('cardAvatar');
  $('detailAvatar').src = avatar?.src || '';
  $('detailHandle').textContent = $('cardHandle')?.textContent || 'Developer';
  $('detailType').textContent = $('cardType')?.textContent || '';

  const repoRows = [...document.querySelectorAll('#repos .repo')].map(row => {
    const strong = row.querySelector('strong')?.textContent?.trim() || '';
    const small = row.querySelector('small')?.textContent?.trim() || '';
    const state = row.querySelector('select')?.value || '';
    const lang = small.split(' · ')[0]?.replace('Language unknown','Unknown') || 'Unknown';
    const updated = small.match(/updated\s+([0-9-]+)/)?.[1] || '';
    return {name:strong, lang, updated, state};
  }).filter(x=>x.name);
  const active = repoRows.filter(x=>!x.state.includes('EXCLUDE'));
  const showcase = repoRows.filter(x=>x.state.includes('SHOWCASE'));
  const langs = count(active.map(x=>x.lang).filter(x=>x && x!=='Unknown'));
  const n = Math.max(active.length,1);
  const recent = active.filter(x=>days(x.updated)<=90).length;
  const originality = Math.min(100, Math.round((showcase.length/n)*100));
  const diversity = Math.min(100, Object.keys(langs).length*20+20);
  const activity = Math.min(100, Math.round(recent/n*100));
  const evidence = Math.min(100, 45 + Math.min(45, active.length*2));
  const showcaseFit = Math.min(100, Math.round(showcase.length/n*100));
  const axes = [
    ['活動量',activity],['技術横断',diversity],['Evidence量',evidence],['公開適性',showcaseFit],['選択性',Math.max(35,100-showcaseFit/2)],['継続性',Math.min(100,55+recent*3)]
  ];
  drawRadar($('radar'), axes);

  $('activityBars').innerHTML = metric('最近90日以内', recent, n) + metric('評価対象repo', active.length, Math.max(repoRows.length,1)) + metric('公開候補repo', showcase.length, n);
  $('activityLabel').textContent = activity>=75 ? '高アクティブ' : activity>=45 ? '継続稼働' : '蓄積型';

  const totalLang = Object.values(langs).reduce((a,b)=>a+b,0)||1;
  $('languageBars').innerHTML = Object.entries(langs).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,num])=>bar(name,Math.round(num/totalLang*100))).join('') || '<p class="micro">言語情報は限定的です</p>';
  $('techTags').innerHTML = Object.keys(langs).slice(0,8).map(x=>`<span>${esc(x)}</span>`).join('');

  const recommended = [...document.querySelectorAll('#recommended p')].slice(0,3).map(p=>p.textContent.trim());
  $('detailRepos').innerHTML = recommended.map((text,i)=>{
    const [name,...why]=text.split(' — ');
    const match = active.find(r=>r.name===name);
    return `<div class="detail-repo"><b>${i+1}. ${esc(name)}</b><p>${esc(why.join(' — '))}</p><small>${esc(match?.lang||'')} ${match?.updated?'· '+esc(match.updated):''}</small></div>`;
  }).join('');

  const traitData = [
    ['活動継続',activity],['技術横断',diversity],['公開選別',Math.max(40,showcaseFit)],['Evidence蓄積',evidence]
  ];
  $('styleTraits').innerHTML = traitData.map(([x,v])=>bar(x,v)).join('');

  const strengths=[];
  if(diversity>=60) strengths.push('複数技術をまたいで構成できる');
  if(activity>=60) strengths.push('継続して実装を前へ進める力がある');
  if(evidence>=65) strengths.push('作ったものをEvidenceとして蓄積している');
  if(showcaseFit>=60) strengths.push('外へ見せられる成果物の母数がある');
  while(strengths.length<3) strengths.push('詳細解析で隠れた強みをさらに特定できる');
  $('strengths').innerHTML = strengths.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('');

  const curiosity=[...document.querySelectorAll('#curiosity li')].map(x=>x.textContent.trim());
  $('growthPoints').innerHTML = (curiosity.length?curiosity:['注目repoの構造をDeep解析すると次の方向性が見えます']).slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('');
}

function drawRadar(canvas, axes){
  const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2+6,r=135,N=axes.length;
  ctx.clearRect(0,0,w,h); ctx.font='600 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.textAlign='center';
  for(let level=1;level<=5;level++){
    ctx.beginPath();
    axes.forEach((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/N,rr=r*level/5,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.strokeStyle='rgba(140,120,255,.18)';ctx.stroke();
  }
  axes.forEach(([label],i)=>{const a=-Math.PI/2+i*2*Math.PI/N;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.strokeStyle='rgba(100,150,255,.16)';ctx.stroke();ctx.fillStyle='#b9c3e6';ctx.fillText(label,cx+Math.cos(a)*(r+34),cy+Math.sin(a)*(r+34)+5);});
  ctx.beginPath();axes.forEach(([,v],i)=>{const a=-Math.PI/2+i*2*Math.PI/N,rr=r*v/100,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);g.addColorStop(0,'rgba(155,90,255,.55)');g.addColorStop(1,'rgba(50,180,255,.45)');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#8d70ff';ctx.lineWidth=2;ctx.stroke();
}
function metric(label,num,total){return bar(`${label} ${num}/${total}`,Math.round(num/Math.max(total,1)*100));}
function bar(label,val){return `<div class="metric"><div><span>${esc(label)}</span><b>${val}%</b></div><i><em style="width:${Math.max(4,Math.min(100,val))}%"></em></i></div>`;}
function count(arr){return arr.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{});}
function days(date){if(!date)return 9999;return Math.max(0,(Date.now()-Date.parse(date))/86400000);}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
