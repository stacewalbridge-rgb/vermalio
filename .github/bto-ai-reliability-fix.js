const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const backendPath = path.join(root, 'src', 'index.js');
const frontendPath = path.join(root, 'public', 'app.js');

function mustRead(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function replaceBetween(source, start, end, replacement, label) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Could not locate ${label}`);
  return source.slice(0, a) + replacement + '\n\n' + source.slice(b);
}

let backend = mustRead(backendPath);

backend = backend.replace(
  'const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";',
  'const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";\nconst AI_MODELS = [MODEL, "@cf/zai-org/glm-4.7-flash"];'
);
if (!backend.includes('const AI_MODELS = [MODEL, "@cf/zai-org/glm-4.7-flash"]')) {
  throw new Error('AI model fallback declaration was not applied');
}

const reliableGenerate = `async function generateWithAI(input, env) {
  const d = validateGenerationInput(input || {});
  const user = \`Recipient: \${d.recipient}\\nAge: \${d.age || "not supplied"}\\nOccasion: \${d.occasion}\\nRelationship: \${d.relationship || "not supplied"}\\nTone: \${d.tone || "sarcastic"}\\nBrutality: \${d.brutality}/10\\nAmmunition: \${d.ammo || "No specific ammunition supplied"}\\nSomething they say: \${d.quote || "not supplied"}\\nDo not mention: \${d.avoid || "nothing supplied"}\\nCreate all three versions now. Version 1 should sit slightly below the requested brutality, version 2 should match it, version 3 should be the most outrageous version allowed at that requested level. Return the requested JSON only, with no reasoning, markdown or commentary.\`;
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
  let lastError = null;

  for (const model of AI_MODELS) {
    try {
      const output = await env.AI.run(model, {
        messages,
        max_tokens: 900,
        temperature: model === MODEL ? 0.86 : 0.8,
      });
      const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
      if (!text) throw new Error("No model output");
      const cleaned = String(text).replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Model response was not JSON");
      const parsed = JSON.parse(cleaned.slice(first, last + 1));
      if (!Array.isArray(parsed.versions) || parsed.versions.length < 3) throw new Error("Incomplete model response");
      const versions = parsed.versions.slice(0, 3).map((v, i) => ({
        label: clean(v.label, 32) || ["THE SAVAGE", "THE BASTARD", "THE MONSTER"][i],
        front: clean(v.front, 180),
        inside: clean(v.inside, 1800),
      }));
      if (versions.some(v => !v.front || !v.inside)) throw new Error("Model returned an empty card panel");
      return versions;
    } catch (error) {
      lastError = error;
      console.error(JSON.stringify({ event: "monster_model_attempt_failed", model, message: String(error?.message || error) }));
    }
  }

  throw new Error(\`All live AI models failed: \${String(lastError?.message || lastError || "unknown error")}\`);
}`;

backend = replaceBetween(
  backend,
  'async function generateWithAI(input, env) {',
  'async function moderateFinal(front, inside, env) {',
  reliableGenerate,
  'generateWithAI'
);

const reliableModeration = `async function moderateFinal(front, inside, env) {
  const combined = \`Front: \${clean(front, 220)}\\nInside: \${clean(inside, 2200)}\`;
  if (!env.AI) return { allowed: false, reason: "AI safety check is temporarily unavailable. Please try again." };
  let lastError = null;

  for (const model of AI_MODELS) {
    try {
      const output = await env.AI.run(model, {
        messages: [{ role: "system", content: FINAL_SAFETY_SYSTEM }, { role: "user", content: combined }],
        max_tokens: 120,
        temperature: 0,
      });
      const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
      const cleaned = String(text || "").replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Safety model response was not JSON");
      const parsed = JSON.parse(cleaned.slice(first, last + 1));
      return { allowed: parsed.allowed !== false, reason: clean(parsed.reason, 180) };
    } catch (error) {
      lastError = error;
      console.error(JSON.stringify({ event: "final_safety_model_attempt_failed", model, message: String(error?.message || error) }));
    }
  }

  console.error(JSON.stringify({ event: "final_safety_check_failed_closed", message: String(lastError?.message || lastError || "unknown error") }));
  return { allowed: false, reason: "AI safety check is temporarily unavailable. Nothing has been ordered or charged. Please try again." };
}`;

backend = replaceBetween(
  backend,
  'async function moderateFinal(front, inside, env) {',
  'async function hmacHex(secret, text) {',
  reliableModeration,
  'moderateFinal'
);

fs.writeFileSync(backendPath, backend);

let frontend = mustRead(frontendPath);

const reliableApiGenerate = `async function apiGenerate(d){
  const r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});
  let j={};
  try{j=await r.json()}catch{}
  if(!r.ok)throw new Error(j.error||\`The Monster AI is temporarily unavailable (\${r.status}). Nothing has been ordered or charged. Please try again.\`);
  if(!Array.isArray(j.versions)||j.versions.length<3)throw new Error('The Monster AI returned an incomplete card. Nothing has been ordered or charged. Please try again.');
  const versions=j.versions.map((v,i)=>({label:sanitizeText(v.label||['THE SAVAGE','THE BASTARD','THE MONSTER'][i]),front:sanitizeText(v.front),inside:sanitizeText(v.inside)}));
  if(versions.some(v=>!v.front||!v.inside))throw new Error('The Monster AI returned an incomplete card. Nothing has been ordered or charged. Please try again.');
  return versions;
}`;

frontend = replaceBetween(
  frontend,
  'async function apiGenerate(d){',
  'function resetLab()',
  reliableApiGenerate,
  'frontend apiGenerate'
);

frontend = frontend.replace(
  "  try{\n    const order=await apiJson('/api/orders'",
  "  try{\n    const liveConfig=await apiJson('/api/config',{headers:{accept:'application/json'}});\n    config={...config,...liveConfig};updatePriceLabels();\n    if(liveConfig.checkoutReady!==true||String(liveConfig.printer||'').toLowerCase()!=='prodigi')throw new Error('Ordering is temporarily unavailable while the print connection is checked. Nothing has been charged.');\n    const order=await apiJson('/api/orders'"
);
if (!frontend.includes("Ordering is temporarily unavailable while the print connection is checked")) {
  throw new Error('Checkout readiness recheck was not applied');
}

const oldHandlers = "form.addEventListener('submit',async e=>{e.preventDefault();const d=getData();lastForm=d;$('#buildBtn').disabled=true;$('#buildBtn').textContent='⚡ CREATING THE MONSTER…';const animation=animateLab(),gen=apiGenerate(d);const [versions]=await Promise.all([gen,animation]);renderCards(versions,d);$('#buildBtn').disabled=false;$('#buildBtn').textContent='⚡ BUILD MY MONSTER'});\n$('#worseBtn').addEventListener('click',()=>{if(!lastForm)return;lastForm.brutality=Math.min(10,lastForm.brutality+2);brutality.value=lastForm.brutality;updateLevel();animateLab().then(()=>renderCards(localGenerate(lastForm),lastForm))});\n$('#softerBtn').addEventListener('click',()=>{if(!lastForm)return;lastForm.brutality=Math.max(1,lastForm.brutality-2);brutality.value=lastForm.brutality;updateLevel();animateLab().then(()=>renderCards(localGenerate(lastForm),lastForm))});";

const newHandlers = `form.addEventListener('submit',async e=>{
  e.preventDefault();
  const d=getData();lastForm=d;
  const btn=$('#buildBtn');btn.disabled=true;btn.textContent='⚡ CREATING THE MONSTER…';
  resetLab();
  try{
    const animation=animateLab();
    const versions=await apiGenerate(d);
    await animation;
    renderCards(versions,d);
  }catch(err){
    labStatus.textContent='Live AI unavailable — nothing ordered or charged.';
    showToast(err.message||'The Monster AI is temporarily unavailable. Nothing has been ordered or charged.');
  }finally{
    btn.disabled=false;btn.textContent='⚡ BUILD MY MONSTER';
  }
});

async function regenerateWithAI(delta){
  if(!lastForm)return;
  lastForm={...lastForm,brutality:Math.max(1,Math.min(10,lastForm.brutality+delta))};
  brutality.value=lastForm.brutality;updateLevel();
  const worse=$('#worseBtn'),softer=$('#softerBtn');
  worse.disabled=true;softer.disabled=true;
  try{
    const animation=animateLab();
    const versions=await apiGenerate(lastForm);
    await animation;
    renderCards(versions,lastForm);
  }catch(err){
    labStatus.textContent='Live AI unavailable — nothing ordered or charged.';
    showToast(err.message||'The Monster AI is temporarily unavailable. Nothing has been ordered or charged.');
  }finally{
    worse.disabled=false;softer.disabled=false;
  }
}
$('#worseBtn').addEventListener('click',()=>regenerateWithAI(2));
$('#softerBtn').addEventListener('click',()=>regenerateWithAI(-2));`;

if (!frontend.includes(oldHandlers)) throw new Error('Could not locate frontend generation handlers');
frontend = frontend.replace(oldHandlers, newHandlers);

if (/Using instant local Monster fallback/.test(frontend)) throw new Error('Local AI fallback remains active');
if (/renderCards\(localGenerate\(lastForm\)/.test(frontend)) throw new Error('Regeneration still bypasses AI');

fs.writeFileSync(frontendPath, frontend);

console.log('Applied Built To Offend AI reliability, AI-only regeneration and pre-payment readiness gates.');
