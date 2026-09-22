const PROVIDERS = ["openai","anthropic","gemini","openrouter"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function configured(env) {
  return {
    openai: Boolean(env.OPENAI_API_KEY && env.JUDGE_OPENAI_MODEL),
    anthropic: Boolean(env.ANTHROPIC_API_KEY && env.JUDGE_ANTHROPIC_MODEL),
    gemini: Boolean(env.GEMINI_API_KEY && env.JUDGE_GEMINI_MODEL),
    openrouter: Boolean(env.OPENROUTER_API_KEY && env.JUDGE_OPENROUTER_MODEL),
    github: Boolean(env.JUDGE_GITHUB_TOKEN),
    firebase: Boolean(env.JUDGE_FIREBASE_PROJECT_ID && (env.JUDGE_FIREBASE_API_KEY || env.JUDGE_FIREBASE_SERVICE_TOKEN))
  };
}

async function callOpenAI(env, system, prompt) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{"authorization":`Bearer ${env.OPENAI_API_KEY}`,"content-type":"application/json"},
    body:JSON.stringify({model:env.JUDGE_OPENAI_MODEL,instructions:system,input:prompt})
  });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${body?.error?.message || "request failed"}`);
  return cleanText(body.output_text || body?.output?.flatMap?.(x=>x.content||[]).map?.(x=>x.text||x.output_text||"").join("\n"));
}

async function callAnthropic(env, system, prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"x-api-key":env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({model:env.JUDGE_ANTHROPIC_MODEL,max_tokens:4000,system,messages:[{role:"user",content:prompt}]})
  });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`Claude ${r.status}: ${body?.error?.message || "request failed"}`);
  return cleanText((body.content||[]).map(x=>x.text||"").join("\n"));
}

async function callGemini(env, system, prompt) {
  const model = encodeURIComponent(env.JUDGE_GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const r = await fetch(endpoint, {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:"user",parts:[{text:prompt}]}]
    })
  });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${body?.error?.message || "request failed"}`);
  return cleanText((body.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("\n"));
}

async function callOpenRouter(env, system, prompt) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:"POST",
    headers:{"authorization":`Bearer ${env.OPENROUTER_API_KEY}`,"content-type":"application/json","x-title":"Judge AI"},
    body:JSON.stringify({model:env.JUDGE_OPENROUTER_MODEL,messages:[{role:"system",content:system},{role:"user",content:prompt}]})
  });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${body?.error?.message || "request failed"}`);
  return cleanText(body.choices?.[0]?.message?.content);
}

async function callProvider(name, env, system, prompt) {
  if (name==="openai") return callOpenAI(env,system,prompt);
  if (name==="anthropic") return callAnthropic(env,system,prompt);
  if (name==="gemini") return callGemini(env,system,prompt);
  if (name==="openrouter") return callOpenRouter(env,system,prompt);
  throw new Error("Unknown provider");
}

function teamPrompt(message, role) {
  return `User task:\n${message}\n\nYou are the ${role} in Judge AI. Inspect the task independently. Identify faults, likely root causes, concrete edits, tests, and risks. Do not merely agree with other agents. Prefer specific file/code/actions when possible.`;
}

async function runTeam(env, message) {
  const ready = configured(env);
  const active = PROVIDERS.filter(p=>ready[p]);
  if (!active.length) throw new Error("No AI provider is configured");
  const roles = ["primary investigator","adversarial reviewer","implementation engineer","test and regression reviewer"];
  const settled = await Promise.all(active.map(async (name,i)=>{
    try {
      const text = await callProvider(name,env,
        "You are one specialist inside Judge AI, a multi-model engineering supervisor. Be concise, technical and independent.",
        teamPrompt(message,roles[i%roles.length]));
      return {provider:name,ok:true,text};
    } catch (e) {
      return {provider:name,ok:false,error:cleanText(e?.message||e)};
    }
  }));
  return settled;
}

async function synthesize(env, message, reports) {
  const ready = configured(env);
  const lead = ["openai","anthropic","gemini","openrouter"].find(p=>ready[p]);
  const digest = reports.map(r=>r.ok?`[${r.provider}]\n${r.text}`:`[${r.provider} FAILED] ${r.error}`).join("\n\n");
  const prompt = `Original task:\n${message}\n\nIndependent specialist reports:\n${digest}\n\nReconcile disagreements. Produce one execution plan or final answer. Explicitly call out unresolved faults. For software repair tasks, require tests before declaring success.`;
  return {provider:lead,text:await callProvider(lead,env,"You are Judge AI, the final supervising judge. Merge evidence; do not average blindly.",prompt)};
}

async function githubRequest(env, path, init={}) {
  if (!env.JUDGE_GITHUB_TOKEN) throw new Error("GitHub tool is not configured");
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers:{
      "authorization":`Bearer ${env.JUDGE_GITHUB_TOKEN}`,
      "accept":"application/vnd.github+json",
      "x-github-api-version":"2022-11-28",
      "user-agent":"Judge-AI",
      ...(init.headers||{})
    }
  });
  const body = await r.json().catch(()=>null);
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${body?.message||"request failed"}`);
  return body;
}

async function githubTool(env, args) {
  const repo = cleanText(args.repo);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid repo");
  const allow = cleanText(env.JUDGE_GITHUB_REPOS).split(",").map(x=>x.trim()).filter(Boolean);
  if (allow.length && !allow.includes(repo)) throw new Error("Repo is not approved for Judge AI");
  if (args.action==="read") {
    const ref = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
    return githubRequest(env,`/repos/${repo}/contents/${String(args.path||"").replace(/^\/+/, "")}${ref}`);
  }
  if (args.action==="workflow-runs") {
    return githubRequest(env,`/repos/${repo}/actions/runs?per_page=10`);
  }
  throw new Error("Unsupported GitHub tool action");
}

async function handleChat(request, env) {
  const body = await request.json().catch(()=>({}));
  const message = cleanText(body.message);
  if (!message) return json({ok:false,error:"message_required"},400);
  const reports = await runTeam(env,message);
  const final = await synthesize(env,message,reports);
  return json({ok:true,judge:final,reports,configured:configured(env)});
}

export async function handleJudgeAI(request, env, url) {
  if (request.method==="GET" && url.pathname==="/api/judge-ai/status") {
    return json({ok:true,name:"Judge AI",configured:configured(env),providers:PROVIDERS});
  }
  if (request.method==="POST" && url.pathname==="/api/judge-ai/chat") {
    try { return await handleChat(request,env); }
    catch (e) { return json({ok:false,error:cleanText(e?.message||e)},500); }
  }
  if (request.method==="POST" && url.pathname==="/api/judge-ai/tools/github") {
    try {
      const args = await request.json().catch(()=>({}));
      return json({ok:true,result:await githubTool(env,args)});
    } catch (e) { return json({ok:false,error:cleanText(e?.message||e)},500); }
  }
  return json({ok:false,error:"judge_ai_route_not_found"},404);
}
