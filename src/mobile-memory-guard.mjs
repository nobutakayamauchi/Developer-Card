const input = document.getElementById('avatar');

if (input) {
  input.addEventListener('change', async event => {
    if (input.dataset.dcCompressed === '1') {
      input.dataset.dcCompressed = '';
      return;
    }
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    try {
      const compressed = await downscaleImage(file, 512, 512, 0.86);
      if (!compressed) throw new Error('IMAGE_DOWNSCALE_FAILED');
      const dt = new DataTransfer();
      dt.items.add(new File([compressed], safeName(file.name, compressed.type), {type: compressed.type || 'image/webp'}));
      input.files = dt.files;
      input.dataset.dcCompressed = '1';
      input.dispatchEvent(new Event('change', {bubbles:true}));
      const status = document.getElementById('status');
      if (status) {
        const reduction = file.size > compressed.size * 1.35 ? ` (${Math.round(file.size/1024)}KB → ${Math.round(compressed.size/1024)}KB)` : '';
        status.textContent = `表示画像をカード向けに軽量化・背景透過・余白トリミングしました${reduction}`;
      }
    } catch {
      input.value = '';
      const status = document.getElementById('status');
      if (status) status.textContent = '画像の軽量化に失敗しました。別の画像を選んでください';
    }
  }, true);
}

async function downscaleImage(file,maxW,maxH,quality){
  const url=URL.createObjectURL(file);
  try{
    const img=await loadImage(url);
    const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
    const w=Math.max(1,Math.round(img.naturalWidth*scale));
    const h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    removeConnectedLightBackground(ctx,w,h);

    const cropped = cropTransparentMargins(canvas, 0.08);
    const output = cropped || canvas;
    let blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',quality));
    if(!blob) blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
    if(cropped){cropped.width=1;cropped.height=1;}
    canvas.width=1;canvas.height=1;
    return blob;
  }finally{URL.revokeObjectURL(url);}
}

function cropTransparentMargins(canvas,paddingRatio=0.08){
  const w=canvas.width,h=canvas.height;
  if(w<2||h<2)return null;
  const ctx=canvas.getContext('2d',{alpha:true});
  const image=ctx.getImageData(0,0,w,h);
  const d=image.data;
  let minX=w,minY=h,maxX=-1,maxY=-1,visible=0;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const a=d[(y*w+x)*4+3];
      if(a<=12)continue;
      visible++;
      if(x<minX)minX=x;if(x>maxX)maxX=x;
      if(y<minY)minY=y;if(y>maxY)maxY=y;
    }
  }
  if(!visible||maxX<minX||maxY<minY)return null;
  const bw=maxX-minX+1,bh=maxY-minY+1;
  // If almost the whole canvas is visible (ordinary photo), cropping adds no value.
  if(bw>=w*0.94&&bh>=h*0.94)return null;
  const pad=Math.max(4,Math.round(Math.max(bw,bh)*paddingRatio));
  const sx=Math.max(0,minX-pad),sy=Math.max(0,minY-pad);
  const ex=Math.min(w,maxX+pad+1),ey=Math.min(h,maxY+pad+1);
  const sw=Math.max(1,ex-sx),sh=Math.max(1,ey-sy);
  const out=document.createElement('canvas');out.width=sw;out.height=sh;
  const outCtx=out.getContext('2d',{alpha:true});outCtx.clearRect(0,0,sw,sh);outCtx.drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);
  return out;
}

function removeConnectedLightBackground(ctx,w,h){
  if(w<2||h<2)return;
  const image=ctx.getImageData(0,0,w,h);
  const d=image.data;
  let lightBorder=0,border=0;
  const borderPixel=(x,y)=>{border++;if(isBackground(d,(y*w+x)*4))lightBorder++;};
  for(let x=0;x<w;x++){borderPixel(x,0);borderPixel(x,h-1);}
  for(let y=1;y<h-1;y++){borderPixel(0,y);borderPixel(w-1,y);}
  if(!border||lightBorder/border<0.55)return;

  const seen=new Uint8Array(w*h);
  const queue=new Int32Array(w*h);
  let head=0,tail=0;
  const push=index=>{if(seen[index])return;const p=index*4;if(!isBackground(d,p))return;seen[index]=1;queue[tail++]=index;};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=1;y<h-1;y++){push(y*w);push(y*w+w-1);}
  while(head<tail){
    const i=queue[head++],x=i%w,y=(i/w)|0,p=i*4;
    d[p+3]=0;
    if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);
  }
  ctx.putImageData(image,0,0);
}

function isBackground(d,p){
  const a=d[p+3],r=d[p],g=d[p+1],b=d[p+2];
  if(a<20)return true;
  const min=Math.min(r,g,b),max=Math.max(r,g,b);
  return min>=238 && max-min<=16;
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function safeName(name,type){const base=String(name||'avatar').replace(/\.[^.]+$/,'').slice(0,80)||'avatar';return `${base}-dc.${type==='image/png'?'png':'webp'}`;}
