const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const form = $('#monsterForm');
const brutality = $('#brutality');
const brutalityOutput = $('#brutalityOutput');
const brutalityName = $('#brutalityName');
const results = $('#results');
const cardsHost = $('#resultCards');
const toast = $('#toast');
const wakeMonster = $('#wakeMonster');
const aliveStamp = $('#aliveStamp');
const labStatus = $('#labStatus');
let lastForm = null;
let selectedPhoto = '';
let config = { cardPricePence: 499, ukShippingPence: 199, photoAddOnPence: 100, checkoutReady: false, printer: 'approval-pending' };

const levels = ['Cheeky','Snarky','Offensive','Savage','Brutal','Vicious','Merciless','Nuclear','Unhinged','THE MONSTER'];
const money = pence => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format((Number(pence)||0)/100);

async function loadConfig(){
  try{
    const r=await fetch('/api/config',{headers:{accept:'application/json'}});
    if(r.ok) config={...config,...await r.json()};
  }catch{}
  updatePriceLabels();
}

function currentCardPrice(art){return config.cardPricePence + (art==='photo'?config.photoAddOnPence:0)}
function updatePriceLabels(){
  $$('.js-card-price').forEach(el=>el.textContent=money(config.cardPricePence));
  $$('.js-photo-price').forEach(el=>el.textContent=money(config.cardPricePence+config.photoAddOnPence));
  $$('.js-delivery-price').forEach(el=>el.textContent=money(config.ukShippingPence));
  $$('.select-card').forEach(btn=>{const article=btn.closest('.generated-card');const art=article?.dataset.art||lastForm?.art||'monster';btn.textContent=`ORDER THIS ONE — ${money(currentCardPrice(art))}`});
}

function updateLevel(){const n=+brutality.value;brutalityOutput.value=n;brutalityName.textContent=levels[n-1];}
brutality.addEventListener('input', updateLevel);updateLevel();

$('#photo').addEventListener('change', e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  if(f.size>6*1024*1024){showToast('Keep photos under 6MB.');e.target.value='';return}
  const r=new FileReader();
  r.onload=()=>{selectedPhoto=r.result;$('#photoPreview').src=selectedPhoto;$('#photoPreview').style.display='block';document.querySelector('input[name="art"][value="photo"]').checked=true;updateArtworkUI()};
  r.readAsDataURL(f)
});

function updateArtworkUI(){
  const value=$('input[name="art"]:checked')?.value||'monster';
  $('#uploadWrap').style.display=value==='photo'?'inline-block':'none';
  updatePriceLabels();
}
$$('input[name="art"]').forEach(r=>r.addEventListener('change',updateArtworkUI));
updateArtworkUI();

function getData(){return {recipient:$('#recipient').value.trim()||'Your unfortunate recipient',age:$('#age').value.trim(),occasion:$('#occasion').value,relationship:$('#relationship').value,tone:$('#tone').value,ammo:$('#ammo').value.trim(),quote:$('#quote').value.trim(),avoid:$('#avoid').value.trim(),brutality:+brutality.value,art:$('input[name="art"]:checked').value};}
function sanitizeText(s){return String(s||'').replace(/[<>]/g,'').trim();}
function detail(d){if(!d.ammo)return 'the impressive way you continue to exist with such unjustified confidence';return d.ammo.replace(/\.$/,'');}
function ageLine(d){return d.age?`${d.age} years old and still making choices like this`:'another milestone reached with absolutely no evidence of personal growth';}
function quoteLine(d){return d.quote?`And yes, we all remember “${d.quote}”. Unfortunately.`:'';}
function occasionFront(d,intensity){const n=d.recipient.toUpperCase();const map={Birthday:[`HAPPY BIRTHDAY, ${n}.`,`ANOTHER YEAR. STILL ${n}.`,`CONGRATULATIONS ON SURVIVING, ${n}.`],Leaving:[`SORRY YOU'RE LEAVING, ${n}.`,`GOOD NEWS: ${n} IS LEAVING.`,`FINALLY. FUCK OFF, ${n}.`],Retirement:[`HAPPY RETIREMENT, ${n}.`,`THE WORKPLACE HAS SURVIVED ${n}.`,`CONGRATS ON BECOMING SOMEONE ELSE'S PROBLEM.`],Wedding:[`CONGRATULATIONS, ${n}.`,`YOU COULD STILL RUN, ${n}.`,`LOVE IS BLIND. THIS PROVES IT.`],Divorce:[`CONGRATULATIONS ON THE ESCAPE.`,`FREEDOM LOOKS GOOD ON YOU, ${n}.`,`ONE LESS BAD DECISION TO FEED.`],Christmas:[`MERRY FUCKING CHRISTMAS, ${n}.`,`SEASON'S REGRETTINGS, ${n}.`,`ANOTHER CHRISTMAS. STILL RELATED.`]};const arr=map[d.occasion]||[`CONGRATULATIONS, ${n}.`,`WELL, THIS HAPPENED, ${n}.`,`A CARD SEEMED CHEAPER THAN THERAPY.`];return arr[Math.min(intensity,2)];}

function localGenerate(d){
  const b=d.brutality,ammo=detail(d),q=quoteLine(d);
  const mild=`You've made it to ${ageLine(d)}. We thought we'd mark the occasion with something more sincere than pretending you're easy to tolerate. ${q}`.trim();
  const savage=`${d.recipient}, somehow you have turned ${ammo} into a personality trait. ${ageLine(d)}. That takes a level of confidence normally reserved for people with actual talent. ${q} Still, today is about you — mainly because apparently every other day wasn't enough.`.trim();
  const monster=`${d.recipient}, let's not ruin this with fake sentiment. ${ammo}. That's not a quirky flaw; that's a long-running public service announcement. You're ${d.age?`${d.age} now, which is old enough to know better and apparently far too committed to start`:'old enough to know better and committed enough to disappointment to continue'}. ${q} We bought you a card because hiring a skywriter to spell “FOR FUCK'S SAKE” felt excessive. Barely.`.trim();
  const leavingMonster=`${d.recipient}, we're supposed to say we're sorry you're leaving. We're not. ${ammo}. Somehow another employer looked at all that and thought, “yes, we'll have some of that.” Their recruitment process is now none of our business. ${q} Don't think of this as goodbye. Think of it as the happiest staff-retention event we've had in years. All the best. Actually, fuck that. Just go.`.trim();
  const birthMonster=`Congratulations, ${d.recipient}. You're ${d.age?`${d.age}, meaning you're now officially closer to becoming a cautionary tale than a promising young person`:'another year older and, against all available evidence, still being celebrated'}. ${ammo}. ${q} Another year survived, another card purchased, another annual reminder that apparently “because they're family/friends” is still considered a valid reason to spend money.`.trim();
  const extreme=d.occasion==='Leaving'?leavingMonster:d.occasion==='Birthday'?birthMonster:monster;
  const scale=(text,low,high)=>b<=3?low:b<=7?text:high;
  return [{label:'THE SAVAGE',front:occasionFront(d,0),inside:scale(mild,mild,savage)},{label:'THE BASTARD',front:occasionFront(d,1),inside:scale(savage,mild,savage)},{label:'THE MONSTER',front:occasionFront(d,2),inside:scale(extreme,savage,extreme)}];
}

async function apiGenerate(d){
  try{
    const r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});
    if(!r.ok)throw new Error(`AI ${r.status}`);
    const j=await r.json();
    if(!Array.isArray(j.versions)||j.versions.length<3)throw new Error('Malformed AI response');
    return j.versions.map((v,i)=>({label:sanitizeText(v.label||['THE SAVAGE','THE BASTARD','THE MONSTER'][i]),front:sanitizeText(v.front),inside:sanitizeText(v.inside)}));
  }catch(e){console.info('Using instant local Monster fallback:',e.message);return localGenerate(d)}
}

function resetLab(){$$('.process-list div').forEach(x=>x.classList.remove('active','done'));wakeMonster.classList.remove('awake');aliveStamp.classList.remove('show');labStatus.textContent='Creating something regrettable…';}
function animateLab(){resetLab();const steps=$$('.process-list div');steps.forEach((el,i)=>setTimeout(()=>{if(i){steps[i-1].classList.remove('active');steps[i-1].classList.add('done')}el.classList.add('active')},250+i*430));return new Promise(res=>setTimeout(()=>{steps.at(-1).classList.remove('active');steps.at(-1).classList.add('done');wakeMonster.classList.add('awake');setTimeout(()=>aliveStamp.classList.add('show'),420);labStatus.textContent='Monster complete.';res()},2050))}

function renderCards(versions,d){
  cardsHost.innerHTML='';
  const tpl=$('#resultTemplate');
  versions.slice(0,3).forEach((v,i)=>{
    const node=tpl.content.cloneNode(true),article=$('.generated-card',node);
    article.dataset.art=d.art;
    $('.version-tag',node).textContent=`VERSION ${i+1} — ${v.label}`;
    $('.front-copy',node).textContent=v.front;
    $('.inside-copy',node).textContent=v.inside;
    const art=$('.card-art',node);
    if(d.art==='photo'&&selectedPhoto){article.classList.add('photo-mode');art.style.backgroundImage=`linear-gradient(rgba(0,0,0,.14),rgba(0,0,0,.14)),url(${selectedPhoto})`}
    else if(d.art==='type'){art.style.height='45px';art.style.background=['#8bc70e','#6a238d','#b61755'][i]}
    const select=$('.select-card',node);
    select.textContent=`ORDER THIS ONE — ${money(currentCardPrice(d.art))}`;
    select.addEventListener('click',()=>beginCheckout(article,v,d,select));
    $('.edit-card',node).addEventListener('click',()=>{const inside=$('.inside-copy',article),front=$('.front-copy',article);const on=inside.contentEditable!=='true';inside.contentEditable=on;front.contentEditable=on;inside.classList.toggle('editing',on);front.classList.toggle('editing',on);showToast(on?'Wording unlocked — edit the front or inside directly.':'Wording locked.')});
    cardsHost.append(node);
  });
  results.hidden=false;results.scrollIntoView({behavior:'smooth',block:'start'});
}

function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function wrapLines(ctx,text,maxWidth){
  const words=String(text).split(/\s+/),lines=[];let line='';
  for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}
  if(line)lines.push(line);return lines;
}
function drawWrapped(ctx,text,x,y,maxWidth,lineHeight,maxLines){const lines=wrapLines(ctx,text,maxWidth).slice(0,maxLines);for(const line of lines){ctx.fillText(line,x,y);y+=lineHeight}return y}
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}

async function renderProdigiCardBlob(front,inside,d){
  const W=6118,H=2161;
  const cuts=[0,1529,3059,4588,6118];
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');

  const cover=async(x,w)=>{
    const grad=ctx.createLinearGradient(x,0,x+w,H);grad.addColorStop(0,'#090a0c');grad.addColorStop(.55,'#321047');grad.addColorStop(1,'#7a16a8');ctx.fillStyle=grad;ctx.fillRect(x,0,w,H);
    if(d.art==='photo'&&selectedPhoto){try{const img=await loadImage(selectedPhoto);const scale=Math.max(w/img.width,H/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,(H-dh)/2,dw,dh);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x,0,w,H)}catch{}}
    ctx.fillStyle='#b9ff18';ctx.textAlign='center';ctx.font='900 56px Arial';ctx.fillText('BUILT TO OFFEND',x+w/2,150);
    ctx.fillStyle='#ffffff';ctx.font='900 116px Arial';const lines=wrapLines(ctx,front.toUpperCase(),w-250).slice(0,6);let y=H/2-(lines.length-1)*72;for(const line of lines){ctx.fillText(line,x+w/2,y);y+=145}
    ctx.fillStyle='#b9ff18';ctx.font='700 32px Arial';ctx.fillText('Say what you really mean.',x+w/2,H-145);
  };
  const message=(x,w)=>{
    ctx.fillStyle='#f5f0e3';ctx.fillRect(x,0,w,H);
    ctx.fillStyle='#131313';ctx.textAlign='left';ctx.font='900 48px Arial';ctx.fillText('A MESSAGE FROM THE MONSTER',x+125,190);
    ctx.fillStyle='#6e168f';ctx.fillRect(x+125,230,270,14);
    ctx.fillStyle='#171717';ctx.font='600 46px Arial';drawWrapped(ctx,inside,x+125,365,w-250,67,23);
    ctx.fillStyle='#6d6872';ctx.font='500 25px Arial';ctx.fillText('BUILT TO OFFEND • builttooffend.com',x+125,H-115);
  };

  // Prodigi requires one four-panel image. Duplicate each logical surface
  // across its pair so left/right panel ordering cannot blank the card.
  await cover(cuts[0],cuts[1]-cuts[0]);
  await cover(cuts[1],cuts[2]-cuts[1]);
  message(cuts[2],cuts[3]-cuts[2]);
  message(cuts[3],cuts[4]-cuts[3]);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not render Prodigi print artwork')),'image/jpeg',0.94));
}

async function apiJson(path,options={}){const r=await fetch(path,options);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||`Request failed (${r.status})`);return j}
async function uploadAsset(orderId,token,kind,blob){return apiJson(`/api/order-asset?order_id=${encodeURIComponent(orderId)}&kind=${encodeURIComponent(kind)}`,{method:'PUT',headers:{'content-type':'image/jpeg','x-order-token':token},body:blob})}

async function beginCheckout(article,v,d,button){
  const front=$('.front-copy',article).textContent.trim(),inside=$('.inside-copy',article).textContent.trim();
  const original=button.textContent;button.disabled=true;button.textContent='PREPARING PRINT ARTWORK…';
  try{
    const order=await apiJson('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipient:d.recipient,occasion:d.occasion,brutality:d.brutality,label:v.label,front,inside,art:d.art})});
    const printBlob=await renderProdigiCardBlob(front,inside,d);
    button.textContent='SECURING YOUR MONSTER…';
    await uploadAsset(order.orderId,order.uploadToken,'print',printBlob);
    button.textContent='OPENING SECURE CHECKOUT…';
    const checkout=await apiJson('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.orderId,uploadToken:order.uploadToken})});
    location.href=checkout.checkoutUrl;
  }catch(e){
    showToast(e.message);
    button.disabled=false;button.textContent=original;
  }
}

form.addEventListener('submit',async e=>{e.preventDefault();const d=getData();lastForm=d;$('#buildBtn').disabled=true;$('#buildBtn').textContent='⚡ CREATING THE MONSTER…';const animation=animateLab(),gen=apiGenerate(d);const [versions]=await Promise.all([gen,animation]);renderCards(versions,d);$('#buildBtn').disabled=false;$('#buildBtn').textContent='⚡ BUILD MY MONSTER'});
$('#worseBtn').addEventListener('click',()=>{if(!lastForm)return;lastForm.brutality=Math.min(10,lastForm.brutality+2);brutality.value=lastForm.brutality;updateLevel();animateLab().then(()=>renderCards(localGenerate(lastForm),lastForm))});
$('#softerBtn').addEventListener('click',()=>{if(!lastForm)return;lastForm.brutality=Math.max(1,lastForm.brutality-2);brutality.value=lastForm.brutality;updateLevel();animateLab().then(()=>renderCards(localGenerate(lastForm),lastForm))});
$('#againBtn').addEventListener('click',()=>{results.hidden=true;$('#generator').scrollIntoView({behavior:'smooth'})});
$$('.occasion-row button').forEach(b=>b.addEventListener('click',()=>{const label=$('b',b)?.textContent||'';const option=[...$('#occasion').options].find(o=>o.textContent===label);if(option)$('#occasion').value=label;$('#generator').scrollIntoView({behavior:'smooth'})}));
function showToast(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),4200)}

loadConfig();
