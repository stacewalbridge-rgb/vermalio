const fs = require('fs');

const path = 'src/index.js';
let source = fs.readFileSync(path, 'utf8');

const oldModel = 'const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";';
const newModel = 'const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";';
if (source.includes(oldModel)) source = source.replace(oldModel, newModel);
if (!source.includes(newModel)) throw new Error('Could not set supported Workers AI model');

const generateStart = source.indexOf('async function generateWithAI(input, env) {');
const moderateStart = source.indexOf('async function moderateFinal(front, inside, env) {', generateStart);
if (generateStart < 0 || moderateStart < 0) throw new Error('AI generation function markers not found');

const generateFunction = `async function generateWithAI(input, env) {
  const d = validateGenerationInput(input || {});
  const user = \`Recipient: \${d.recipient}\\nAge: \${d.age || "not supplied"}\\nOccasion: \${d.occasion}\\nRelationship: \${d.relationship || "not supplied"}\\nTone: \${d.tone || "sarcastic"}\\nBrutality: \${d.brutality}/10\\nAmmunition: \${d.ammo || "No specific ammunition supplied"}\\nSomething they say: \${d.quote || "not supplied"}\\nDo not mention: \${d.avoid || "nothing supplied"}\\nCreate all three versions now. Version 1 should sit slightly below the requested brutality, version 2 should match it, version 3 should be the most outrageous version allowed at that requested level.\`;
  const output = await env.AI.run(MODEL, {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          versions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                front: { type: "string" },
                inside: { type: "string" },
              },
              required: ["label", "front", "inside"],
            },
          },
        },
        required: ["versions"],
      },
    },
    max_tokens: 1200,
    temperature: 0.82,
  });
  const raw = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
  if (raw == null) throw new Error("No model output");
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed?.versions) || parsed.versions.length < 3) throw new Error("Incomplete model response");
  return parsed.versions.slice(0, 3).map((v, i) => ({
    label: clean(v.label, 32) || ["THE SAVAGE", "THE BASTARD", "THE MONSTER"][i],
    front: clean(v.front, 180),
    inside: clean(v.inside, 1800),
  }));
}

`;
source = source.slice(0, generateStart) + generateFunction + source.slice(moderateStart);

const newModerateStart = source.indexOf('async function moderateFinal(front, inside, env) {');
const hmacStart = source.indexOf('async function hmacHex(secret, text) {', newModerateStart);
if (newModerateStart < 0 || hmacStart < 0) throw new Error('AI moderation function markers not found');

const moderateFunction = `async function moderateFinal(front, inside, env) {
  const combined = \`Front: \${clean(front, 220)}\\nInside: \${clean(inside, 2200)}\`;
  if (!env.AI) return { allowed: true, reason: "" };
  try {
    const output = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: FINAL_SAFETY_SYSTEM }, { role: "user", content: combined }],
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "object",
          properties: {
            allowed: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["allowed", "reason"],
        },
      },
      max_tokens: 120,
      temperature: 0,
    });
    const raw = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
    if (raw == null) return { allowed: true, reason: "" };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { allowed: parsed?.allowed !== false, reason: clean(parsed?.reason, 180) };
  } catch (error) {
    console.error(JSON.stringify({ event: "final_safety_check_failed", message: String(error?.message || error) }));
    return { allowed: true, reason: "" };
  }
}

`;
source = source.slice(0, newModerateStart) + moderateFunction + source.slice(hmacStart);

if (source.includes('@cf/qwen/qwen3-30b-a3b-fp8')) throw new Error('Old Qwen model reference remains');
if (!source.includes('response_format:')) throw new Error('Structured JSON response format was not installed');

fs.writeFileSync(path, source);
console.log('Built To Offend Workers AI generation upgraded to structured Llama JSON mode.');
