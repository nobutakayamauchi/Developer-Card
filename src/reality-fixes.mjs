const $ = id => document.getElementById(id);

const shareBtn = $('share');
const downloadBtn = $('download');

if (shareBtn) {
  shareBtn.textContent = 'Xへ画像＋文を共有';
  shareBtn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const blob = await renderRealityCard();
      const file = new File([blob], 'developer-card.png', {type:'image/png'});
      const text = `GitHub開発スタイル診断やってみた。\n${$('cardType')?.textContent || ''}\n#個人開発 #DeveloperCard`;
      if (navigator.canShare?.({files:[file]}) && navigator.share) {
        try {
          await navigator.share({files:[file], text, title:'Developer Card'});
        } catch (err) {
          if (!isCancelled(err)) throw err;
        }
        return;
      }
      await navigator.clipboard?.writeText(text);
      setStatus('投稿文をコピーしました。画像を保存してXに添付してください');
    } catch (err) {
      if (!isCancelled(err)) setStatus(`共有できませんでした: ${err?.message || err}`);
    }
  }, true);
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const blob = await renderRealityCard();
      const file = new File([blob], 'developer-card.png', {type:'image/png'});
      if (navigator.canShare?.({files:[file]}) && navigator.share) {
        try { await navigator.share({files:[file], title:'Developer Card'}); }
        catch (err) { if (!isCancelled(err)) throw err; }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='developer-card.png'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    } catch (err) {
      if (!isCancelled(err)) setStatus(`カードを書き出せませんでした: ${err?.message || err}`);
    }
  }, true);
}

async function renderRealityCard() {
  const c = document.createElement('canvas'); c.width=1200; c.height=675;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#070916'; ctx.fillRect(0,0,1200,675);
  const g=ctx.createLinearGradient(0,0,1200,675); g.addColorStop(0,'rgba(111,76,255,.22)'); g.addColorStop(1,'rgba(0,212,255,.08)'); ctx.fillStyle=g; ctx.fillRect(0,0,1200,675);
  ctx.strokeStyle='rgba(131,105,255,.65)'; ctx.lineWidth=2; roundRect(ctx,35,35,1130,605,28); ctx.stroke();

  const handle=$('cardHandle')?.textContent?.trim() || 'Developer';
  const type=$('cardType')?.textContent?.trim() || '';
  const avatarSrc=$('cardAvatar')?.src || '';
  ctx.save(); ctx.beginPath(); ctx.arc(115,125,58,0,Math.PI*2); ctx.clip(); ctx.fillStyle='#ffffff'; ctx.fillRect(57,67,116,116);
  if (avatarSrc) {
    try {
      const img=await loadImage(avatarSrc);
      const scale=Math.min(106/img.width,106/img.height);
      const w=img.width*scale,h=img.height*scale;
      ctx.drawImage(img,115-w/2,125-h/2,w,h);
    } catch {}
  }
  ctx.restore();

  ctx.fillStyle='#aeb6d9'; ctx.font='600 20px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('GitHub 開発スタイル診断',205,92);
  ctx.fillStyle='#fff'; ctx.font='800 46px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trim(ctx,handle,620),205,145);
  ctx.fillStyle='#9a7cff'; ctx.font='800 30px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trim(ctx,type,760),205,190);

  const stats=[...document.querySelectorAll('#cardHighlights .stat')].slice(0,3).map(x=>x.textContent.trim());
  stats.forEach((text,i)=>{
    const x=55+i*365,y=250;
    ctx.fillStyle='rgba(255,255,255,.055)'; roundRect(ctx,x,y,335,105,18); ctx.fill();
    ctx.fillStyle='#c8cfea'; fitBoxText(ctx,text,x+20,y+34,295,58);
  });

  ctx.fillStyle='#fff'; ctx.font='800 23px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('注目repo',55,415);
  const rows=[...document.querySelectorAll('#recommended p')].slice(0,3);
  rows.forEach((row,i)=>{
    const text=row.textContent.trim();
    const parts=text.split(' — ');
    const y=455+i*48;
    ctx.fillStyle=i===0?'#b9a5ff':'#dce1f5'; ctx.font='700 19px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(`${i+1}. ${trim(ctx,parts[0]||'',300)}`,65,y);
    ctx.fillStyle='#8f99bd'; ctx.font='500 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trim(ctx,parts.slice(1).join(' — '),690),390,y);
  });

  ctx.fillStyle='#8f99bd'; ctx.font='500 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('無料版：今のGitHubから見える開発スタイルを可視化',55,605);
  ctx.fillStyle='#b9a5ff'; ctx.font='700 17px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText('Developer Card FV',955,605);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG_ENCODE_FAILED')),'image/png',0.95));
}

function fitBoxText(ctx,text,x,y,maxWidth,maxHeight){
  for(let size=18;size>=14;size--){
    ctx.font=`600 ${size}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`;
    const lines=wrapLines(ctx,text,maxWidth);
    const lineHeight=size+6;
    if(lines.length*lineHeight<=maxHeight){ lines.slice(0,3).forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight)); return; }
  }
  ctx.font='600 14px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif'; ctx.fillText(trim(ctx,text,maxWidth),x,y);
}
function wrapLines(ctx,text,maxWidth){ const words=String(text).split(/(?=[\s\/・])/); const lines=[]; let line=''; for(const w of words){const t=line+w;if(ctx.measureText(t).width>maxWidth&&line){lines.push(line.trim());line=w.trimStart();}else line=t;} if(line)lines.push(line.trim()); return lines; }
function trim(ctx,text,maxWidth){let s=String(text||'');if(ctx.measureText(s).width<=maxWidth)return s;while(s&&ctx.measureText(s+'…').width>maxWidth)s=s.slice(0,-1);return s+'…';}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function isCancelled(e){return String(e?.name||'')==='AbortError'||/abort|cancel/i.test(String(e?.message||e||''));}
function setStatus(s){const el=$('status');if(el)el.textContent=s;}
