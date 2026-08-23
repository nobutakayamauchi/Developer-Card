import {buildPublicReportUrl} from './public-report.mjs';

const TYPE_COPY = {
  'システム構築型': ['構造と実装を積み上げる設計・構築タイプ', 'コードは、黙っていても設計思想を語る。'],
  '横断オーケストレーター型': ['複数領域を束ねて価値へ変える統合タイプ', '複数領域を束ねる力が、GitHubに残っている。'],
  '高速ビルダー型': ['高い更新密度で形にしていく実行タイプ', '動き続けた履歴そのものが、開発力のEvidenceになる。'],
  'プロトタイプ探索型': ['小さく試しながら答えを探す探索タイプ', '小さな実験の連続が、次の強みを作っている。']
};

export async function buildShareCardModel({result, repos, handle, githubUser, avatarSrc, publicRepoCount}) {
  const active = repos.filter(r => r.authorization !== 'EXCLUDE');
  const showcase = repos.filter(r => r.authorization === 'SHOWCASE_AND_EVALUATE');
  const latest = active.map(r => r.updated_at).filter(Boolean).sort().at(-1) || null;
  const typeCopy = TYPE_COPY[result.type] || ['GitHub Evidenceから見える現在の開発傾向', 'あなたのGitHubが、あなたの強みを語っている。'];
  const languageText = result.topLanguages?.length ? result.topLanguages.slice(0,2).map(x => x.name).join(' / ') : '—';
  const publicAvatar = `https://github.com/${encodeURIComponent(githubUser || '')}.png?size=320`;
  const detail = buildDetailSnapshot({result, repos});
  const payload = {
    v: 1,
    handle,
    github_user: githubUser,
    avatar_url: publicAvatar,
    type: result.type,
    type_description: typeCopy[0],
    tagline: typeCopy[1],
    public_repo_count: publicRepoCount,
    evaluated_count: result.evaluated_count,
    showcase_count: result.showcase_count,
    main_languages: languageText,
    latest_at: latest,
    recommended: result.recommended.map(r => ({name:r.name, reason:r.reason})),
    curiosity: result.curiosity,
    detail
  };
  const detailUrl = buildPublicReportUrl(payload);
  let qrDataUrl = '';
  let qrError = null;
  try {
    qrDataUrl = await makeQr(detailUrl);
  } catch (err) {
    qrError = String(err?.message || err || 'QR_GENERATION_FAILED');
  }
  return {
    ...payload,
    avatar_src: avatarSrc || publicAvatar,
    detail_url: detailUrl,
    qr_data_url: qrDataUrl,
    qr_error: qrError,
    metrics: [
      ['公開repo', String(publicRepoCount)],
      ['評価対象', String(result.evaluated_count)],
      ['主な言語', languageText],
      ['最終更新', formatLatest(latest)]
    ]
  };
}

export function renderShareCardDom(model, root = document) {
  setText(root, 'cardHandle', model.handle);
  setText(root, 'cardType', model.type);
  setText(root, 'cardTypeDescription', model.type_description);
  setText(root, 'shareTagline', model.tagline);
  const avatar = root.getElementById('cardAvatar');
  if (avatar) avatar.src = model.avatar_src;
  const qr = root.getElementById('detailQr');
  const frame = qr?.closest?.('.qr-frame');
  if (qr && model.qr_data_url) {
    qr.hidden = false;
    qr.src = model.qr_data_url;
    frame?.querySelector('.qr-unavailable')?.remove();
  } else if (qr) {
    qr.hidden = true;
    qr.removeAttribute('src');
    if (frame && !frame.querySelector('.qr-unavailable')) {
      const note = document.createElement('span');
      note.className = 'qr-unavailable';
      note.textContent = 'QR生成失敗\n投稿文URLから詳細へ';
      note.style.cssText = 'display:flex;white-space:pre-line;align-items:center;justify-content:center;width:100%;height:100%;color:#111;font-weight:800;font-size:.8em;line-height:1.25;text-align:center';
      frame.append(note);
    }
  }
  const stats = root.getElementById('shareStats');
  if (stats) stats.innerHTML = model.metrics.map(([label,value]) => `<div class="share-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');
}

export async function exportShareCardPng(model) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 675;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0,0,1200,675);
  bg.addColorStop(0,'#071325'); bg.addColorStop(.56,'#090c20'); bg.addColorStop(1,'#16072d');
  ctx.fillStyle = bg; ctx.fillRect(0,0,1200,675);
  const glow = ctx.createRadialGradient(610,255,10,610,255,470);
  glow.addColorStop(0,'rgba(118,72,255,.22)'); glow.addColorStop(1,'rgba(118,72,255,0)');
  ctx.fillStyle=glow; ctx.fillRect(0,0,1200,675);
  ctx.strokeStyle='rgba(114,83,255,.7)'; ctx.lineWidth=2; roundRect(ctx,20,20,1160,635,24); ctx.stroke();

  try {
    const img = await loadImage(model.avatar_src);
    drawContain(ctx,img,18,38,270,580);
  } catch {}

  ctx.fillStyle='#dfe8ff'; ctx.font='800 22px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('GitHub解析でわかる',300,74);
  const titleGrad=ctx.createLinearGradient(300,0,780,0); titleGrad.addColorStop(0,'#65bfff'); titleGrad.addColorStop(1,'#b36cff');
  ctx.fillStyle=titleGrad; ctx.font='900 48px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('開発スタイル診断',300,128);
  ctx.fillStyle='#fff'; ctx.font='800 22px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('あなたの強みと開発パターンを可視化',300,162);
  ctx.fillStyle='#8f6cff'; roundRect(ctx,300,188,120,30,6); ctx.fill();
  ctx.fillStyle='#f0eaff'; ctx.font='800 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('開発タイプ',320,209);
  fitText(ctx,model.type,300,278,555,42,'900');
  ctx.fillStyle='#e7e9f7'; ctx.font='700 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trim(ctx,model.type_description,555),300,310);

  model.metrics.forEach(([label,value],i)=>{
    const x=300+i*142,y=348,w=130,h=110;
    ctx.fillStyle='rgba(7,20,40,.76)'; ctx.strokeStyle=i%2?'rgba(165,82,255,.55)':'rgba(70,190,255,.5)'; roundRect(ctx,x,y,w,h,10); ctx.fill();ctx.stroke();
    ctx.fillStyle='#b9c6df';ctx.font='700 14px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.textAlign='center';ctx.fillText(label,x+w/2,y+36);
    drawMetricValue(ctx,value,x+w/2,y+76,w-14);
    ctx.textAlign='left';
  });
  ctx.fillStyle='#62c9ff';ctx.font='800 17px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trim(ctx,model.tagline,550),300,520);
  ctx.fillStyle='#8592b4';ctx.font='600 14px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(`@${model.handle}`,300,552);

  ctx.fillStyle='rgba(8,16,38,.88)';ctx.strokeStyle='rgba(120,86,255,.72)';roundRect(ctx,900,64,250,475,18);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='900 20px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.textAlign='center';ctx.fillText('詳細レポートはこちら！',1025,105);
  if (model.qr_data_url) {
    try {
      const qr=await loadImage(model.qr_data_url);
      ctx.fillStyle='#fff';roundRect(ctx,938,132,174,174,8);ctx.fill();ctx.imageSmoothingEnabled=false;ctx.drawImage(qr,948,142,154,154);ctx.imageSmoothingEnabled=true;
    } catch {}
  } else {
    ctx.fillStyle='#fff';roundRect(ctx,938,132,174,174,8);ctx.fill();
    ctx.fillStyle='#111';ctx.font='800 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('QR生成失敗',1025,210);ctx.font='700 12px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('投稿文URLから詳細へ',1025,238);
  }
  ctx.fillStyle='#fff';ctx.font='800 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('スキャンして',1025,348);ctx.fillText('詳細Webレポートへ',1025,373);
  ctx.fillStyle='#7e89aa';ctx.font='600 13px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('powered by Developer Card',1025,493);ctx.textAlign='left';
  ctx.fillStyle='#7e8aad';ctx.font='600 14px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText('Developer Card FV · public-safe GitHub Evidence',300,610);
  const blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG_ENCODE_FAILED')),'image/png',.94));
  canvas.width=1;canvas.height=1;
  return blob;
}

function buildDetailSnapshot({result,repos}) {
  const active=repos.filter(r=>r.authorization!=='EXCLUDE');
  const showcase=repos.filter(r=>r.authorization==='SHOWCASE_AND_EVALUATE');
  const recent=active.filter(r=>days(r.updated_at)<=90).length;
  const langs=count(active.map(r=>r.language).filter(Boolean));
  const n=Math.max(active.length,1);
  const languageShares=Object.entries(langs).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,num])=>({name,value:Math.round(num/n*100)}));
  const diversity=Math.min(100,Object.keys(langs).length*20+20);
  const activity=Math.min(100,Math.round(recent/n*100));
  const evidence=Math.min(100,45+Math.min(45,active.length*2));
  const showcaseFit=Math.min(100,Math.round(showcase.length/n*100));
  const axes=[['活動量',activity],['技術横断',diversity],['Evidence量',evidence],['公開適性',showcaseFit],['選択性',Math.max(35,100-showcaseFit/2)],['継続性',Math.min(100,55+recent*3)]];
  const strengths=[];
  if(diversity>=60) strengths.push('複数技術をまたいで構成できる');
  if(activity>=60) strengths.push('継続して実装を前へ進める力がある');
  if(evidence>=65) strengths.push('作ったものをEvidenceとして蓄積している');
  if(showcaseFit>=60) strengths.push('外へ見せられる成果物の母数がある');
  while(strengths.length<3) strengths.push('詳細解析で隠れた強みをさらに特定できる');
  return {
    axes,
    language_shares:languageShares,
    activity:[['最近90日以内',recent,n],['評価対象repo',active.length,Math.max(repos.length,1)],['公開候補repo',showcase.length,n]],
    activity_label:activity>=75?'高アクティブ':activity>=45?'継続稼働':'蓄積型',
    recommended:result.recommended.map(r=>{const repo=active.find(x=>x.name===r.name);return {name:r.name,reason:r.reason,language:repo?.language||'Unknown',updated_at:repo?.updated_at||''};}),
    traits:[['活動継続',activity],['技術横断',diversity],['公開選別',Math.max(40,showcaseFit)],['Evidence蓄積',evidence]],
    strengths:strengths.slice(0,3),
    growth:(result.curiosity?.length?result.curiosity:['注目repoの構造をDeep解析すると次の方向性が見えます']).slice(0,3)
  };
}

async function makeQr(text){
  if (!globalThis.QRCode) throw new Error('QR_RUNTIME_UNAVAILABLE');
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-9999px;top:-9999px;width:220px;height:220px;pointer-events:none';
  document.body.append(host);
  try {
    new globalThis.QRCode(host,{text,width:220,height:220,colorDark:'#050505',colorLight:'#ffffff',correctLevel:globalThis.QRCode.CorrectLevel.L});
    const canvas=host.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
    const img=host.querySelector('img');
    if (img?.src) return img.src;
    throw new Error('QR_RENDER_FAILED');
  } finally {
    host.remove();
  }
}
function drawMetricValue(ctx,value,x,y,maxWidth){
  const text=String(value??'');
  if(text.includes(' / ')){
    const parts=text.split(' / ').slice(0,2);
    ctx.fillStyle='#fff';ctx.font='900 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trim(ctx,parts[0],maxWidth),x,y-8);
    if(parts[1]){ctx.fillStyle='#cdd5eb';ctx.font='800 15px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trim(ctx,parts[1],maxWidth),x,y+15);}
    return;
  }
  ctx.fillStyle='#fff';ctx.font=text.length>13?'800 18px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif':'900 27px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';ctx.fillText(trim(ctx,text,maxWidth),x,y);
}
function formatLatest(iso){if(!iso)return '—';const d=days(iso);if(d<1)return 'Today';return iso.slice(5,10).replace('-','/');}
function days(iso){return iso?Math.max(0,(Date.now()-Date.parse(iso))/86400000):9999;}
function count(arr){return arr.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{});}
function setText(root,id,text){const el=root.getElementById(id);if(el)el.textContent=text??'';}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function drawContain(ctx,img,x,y,w,h){const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh),dw,dh);}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
function trim(ctx,text,max){let s=String(text??'');if(ctx.measureText(s).width<=max)return s;while(s&&ctx.measureText(`${s}…`).width>max)s=s.slice(0,-1);return `${s}…`;}
function fitText(ctx,text,x,y,max,size,weight){let s=size;while(s>24){ctx.font=`${weight} ${s}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`;if(ctx.measureText(text).width<=max)break;s-=2;}ctx.fillStyle='#fff';ctx.fillText(trim(ctx,text,max),x,y);}
