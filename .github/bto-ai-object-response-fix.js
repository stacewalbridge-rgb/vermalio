const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const backendPath = path.join(root, 'src', 'index.js');
let source = fs.readFileSync(backendPath, 'utf8');

const oldModels = 'const AI_MODELS = [MODEL, "@cf/zai-org/glm-4.7-flash"];';
const newModels = 'const AI_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", MODEL, "@cf/zai-org/glm-4.7-flash"];';
if (!source.includes(oldModels) && !source.includes(newModels)) throw new Error('AI model list not found');
source = source.replace(oldModels, newModels);

const oldGenerateParse = `      const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
      if (!text) throw new Error("No model output");
      const cleaned = String(text).replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Model response was not JSON");
      const parsed = JSON.parse(cleaned.slice(first, last + 1));`;

const newGenerateParse = `      const structured = output?.response ?? output?.result?.response;
      let parsed = null;
      if (structured && typeof structured === "object" && !Array.isArray(structured)) {
        parsed = structured;
      }
      if (!parsed || !Array.isArray(parsed.versions)) {
        const text = typeof structured === "string"
          ? structured
          : (output?.choices?.[0]?.message?.content ?? output?.result?.choices?.[0]?.message?.content);
        if (!text) throw new Error("No model output");
        const cleaned = String(text).replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first < 0 || last <= first) throw new Error("Model response was not JSON");
        parsed = JSON.parse(cleaned.slice(first, last + 1));
      }`;

if (!source.includes(oldGenerateParse) && !source.includes(newGenerateParse)) throw new Error('Generator parser block not found');
source = source.replace(oldGenerateParse, newGenerateParse);

const oldModerationParse = `      const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
      const cleaned = String(text || "").replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Safety model response was not JSON");
      const parsed = JSON.parse(cleaned.slice(first, last + 1));`;

const newModerationParse = `      const structured = output?.response ?? output?.result?.response;
      let parsed = null;
      if (structured && typeof structured === "object" && !Array.isArray(structured)) {
        parsed = structured;
      }
      if (!parsed || typeof parsed.allowed !== "boolean") {
        const text = typeof structured === "string"
          ? structured
          : (output?.choices?.[0]?.message?.content ?? output?.result?.choices?.[0]?.message?.content);
        const cleaned = String(text || "").replace(/<think>[\\s\\S]*?<\\/think>/gi, "").trim();
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first < 0 || last <= first) throw new Error("Safety model response was not JSON");
        parsed = JSON.parse(cleaned.slice(first, last + 1));
      }`;

if (!source.includes(oldModerationParse) && !source.includes(newModerationParse)) throw new Error('Moderation parser block not found');
source = source.replace(oldModerationParse, newModerationParse);

if (!source.includes('@cf/meta/llama-3.3-70b-instruct-fp8-fast')) throw new Error('Fast Llama model was not installed');
if (!source.includes('typeof structured === "object"')) throw new Error('Structured response support was not installed');

fs.writeFileSync(backendPath, source);
console.log('Fixed Workers AI structured JSON parsing and moved fast Llama to primary generation.');
