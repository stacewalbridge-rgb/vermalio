# Judge AI

Judge AI is Vamalio's multi-model AI supervisor.

## Purpose
A single ChatGPT-style interface dispatches a task to multiple configured AI providers, gets independent diagnoses, and uses a lead "Judge" model to reconcile the result.

## Providers
- OpenAI
- Anthropic / Claude
- Google Gemini
- OpenRouter (optional bridge to additional models)

## Shared tools
Judge AI is designed around central tool credentials. Models do not receive raw GitHub/Firebase credentials. The Judge AI worker owns the secrets and exposes only approved tool operations.

Current tool gateway in this branch:
- GitHub read
- GitHub recent workflow runs
- Repository allow-list

Next tool operations to enable after credentials are present:
- branch creation + guarded writes
- workflow dispatch/build inspection
- Firebase Admin gateway
- automatic repair/test/retry loop

## Required Cloudflare secrets/vars
Secrets:
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- GEMINI_API_KEY
- OPENROUTER_API_KEY (optional)
- JUDGE_GITHUB_TOKEN

Variables:
- JUDGE_OPENAI_MODEL
- JUDGE_ANTHROPIC_MODEL
- JUDGE_GEMINI_MODEL
- JUDGE_OPENROUTER_MODEL (optional)
- JUDGE_GITHUB_REPOS (comma-separated owner/repo allow-list)
- JUDGE_FIREBASE_PROJECT_ID
- JUDGE_FIREBASE_API_KEY or JUDGE_FIREBASE_SERVICE_TOKEN

No provider key is sent to the browser.
