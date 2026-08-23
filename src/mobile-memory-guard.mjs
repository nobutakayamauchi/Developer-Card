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
      const compressed = await downscaleImage(file, 640, 640, 0.84);
      if (!compressed) throw new Error('IMAGE_DOWNSCALE_FAILED');
      const dt = new DataTransfer();
      dt.items.add(new File([compressed], safeName(file.name, compressed.type), {type: compressed.type || 'image/webp'}));
      input.files = dt.files;
      input.dataset.dcCompressed = '1';
      input.dispatchEvent(new Event('change', {bubbles:true}));
      const status = document.getElementById('status');
      if (status && file.size > compressed.size * 1.35) status.textContent = `表示画像をスマホ向けに軽量化しました (${Math.round(file.size/1024)}KB → ${Math.round(compressed.size/1024)}KB)`;
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
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob) blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    canvas.width=1;canvas.height=1;
    return blob;
  }finally{URL.revokeObjectURL(url);}
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function safeName(name,type){const base=String(name||'avatar').replace(/\.[^.]+$/,'').slice(0,80)||'avatar';return `${base}-dc.${type==='image/png'?'png':'webp'}`;}
