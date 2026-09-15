# Working on the LLM minigames

This guide applies to `2026/llm/` and its descendants. It describes the source inspected on 2026-09-14. Recheck the relevant implementation before changing a contract; deployed service availability was not verified.

## Required API boundary

**All minigame model/API calls must go through the shared Cloudflare Worker** at `https://minigames-backend.llmminigamesback.workers.dev`. Games use its public endpoint URLs only. Do not call model providers or upstream gateways directly from the browser, and do not add alternate Flask/direct-provider fallback routes.

**Do not use, request, configure, or embed `LLM_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, provider tokens, or provider `Authorization` headers to create, modify, or run a minigame.** Upstream authentication is the server's responsibility. Existing server credential code described below is an implementation finding, not permission or a setup requirement for game development. If the Worker lacks a needed capability, implement the capability there within the task's scope; do not bypass it in the game. For local checks, use the existing Worker or mocked responses without provider credentials.

Known exceptions in the current source that violate this rule (do not copy these patterns):

- `next-token-prediction/index.html` embeds a Groq credential and actively sends a browser request to `https://api.groq.com/openai/v1/chat/completions` using `Authorization: Bearer ...`. This must be migrated to the shared Worker; the exposed credential should be revoked/rotated by its owner. Its value must not be reproduced in documentation or reports.
- `jailbreak-old/index.html` includes an optional direct-provider branch using `CONFIG.apiUrl` and `CONFIG.apiKey` on non-HTTPS pages, plus a port-5000 `/chat` branch. Both bypass the required Worker. The checked-in `config.js` only sets `workerRoot`, so the direct-provider branch is not enabled by that configuration. These legacy alternatives should be removed when migrating the game, not enabled for development.

The documentation records these exceptions; it does not mean the game implementations have already been fixed.

## Scope and structure

- The Git repository root is two directories above this directory. Run `rtk git status --short` before editing and preserve unrelated changes. Follow the personal shell instructions in `/home/ali/.codex/RTK.md`: prefix shell commands with `rtk` (`rtk proxy <command>` passes through commands without filtering).
- This is a local, static website project. TAPSI JupyterHub is unrelated to ordinary work here.
- Games are independent directories, usually with `index.html`. Most contain inline CSS and JavaScript; some have separate assets. There is no shared frontend framework, root package manifest, bundler, router, or global frontend build.
- `minigames-backend/src/index.js` is the entire shared backend: an ES-module Cloudflare Worker exporting `fetch(request, env)`. It proxies model requests, selects educational behavior, and normalizes responses. There is no database, account system, durable conversation store, or server-side scoring in this source.
- `llm2.html` is a large workshop page containing a `states` data array, embedded images, and iframe media. Its iframe renderer uses `sandbox="allow-scripts allow-same-origin"`. Avoid dumping or reformatting the whole file. Inspect the relevant state/media entry if a task includes workshop integration; a standalone game does not need registration in a central router.
- Keep existing URL spellings and capitalization, notably `Dimensions/`, `contexual-embedding/`, `wordembedding/`, and `word-embedding/`. Similar names are distinct games, not aliases.

## Choose the closest existing example

| Area | Relevant files and behavior |
| --- | --- |
| Base, SFT, aligned chat | `pretrained-llm/`, `sft-llm/`, `rlhf-llm/`: single-page chat, public `config.js`, local fallback, stop/clear controls and simulated typing |
| Comparing model stages | `model-lab/`: three tabs with separate display histories; raw generation is local, other tabs call the Worker |
| Random language | `random-llm/` and shared `random-generator.js`; exposes `window.RandomPersianModel.generatePieces(limit)` and `.generateText(limit)`, also consumed by `model-lab/` |
| Security challenge | `jailbreak/`: current three-level challenge; `jailbreak-old/`: separate legacy version with different backend behavior |
| Hallucination | `hallucination/`: two-level model experiment with an offline simulation |
| Next-word prediction | `next-token-prediction/`: includes a direct Groq call that violates the required API boundary; `next-token-prediction2/`: live model estimates through the Worker's `/jailbreak` route |
| Word placement | `word-in-line/`, `word-in-space/`: `index.html`, `style.css`, `words.js`, `app.js`; the latter has `vectors.html`, `vectors.css`, `vectors.js` |
| Embeddings and dimensions | `wordembedding/`, `word-embedding/`, `contexual-embedding/`, `words-and-vectors/`, `Dimensions/1-line.html`, `2-plane.html`, `3-space.html`, `dimensionality-reduction/` |
| Transformer concepts | `attention/`, `pretraining-box/`; `transformer/encoder.html` and `decoder.html` share `transformer-viz.js` and `.css` |
| Word-space dataset | `words-world/app.js` imports `data.js` and `word-data.js`; `persian_embeddings_3d.py` is an optional offline fastText/t-SNE data preparation script, not a web backend |

## Frontend conventions and integration

1. Create a descriptive game directory with `index.html`; use plain HTML/CSS/JavaScript unless the task requires otherwise. Preserve an existing game's organization when modifying it.
2. Most experiences use Persian text and RTL layout. Set `lang="fa"` and appropriate direction for new Persian pages; isolate equations, coordinates, Latin identifiers, and code with LTR direction as needed. Preserve Persian characters and zero-width non-joiners.
3. Use relative asset paths so pages work under `/minigames/2026/llm/<game>/` on GitHub Pages and in workshop iframes. Local fonts available here are `fonts/vazir.ttf` and `fonts/bkamran.otf`. Some existing games use remote fonts, and `dimensionality-reduction/` imports Three.js through a CDN import map; those pages are not fully offline.
4. Public Worker URL configuration belongs in the game's `config.js`, loaded before the game script. All model/API requests must use the shared Worker. Never use provider credentials in a game or add direct-provider/alternate-server fallbacks; follow the required API boundary above.
5. Render prompts/model text using `textContent` or a deliberately safe renderer. Model output is untrusted, including JSON-looking content. Check HTTP status, parse the response, validate required fields, and handle empty output.
6. Preserve loading, stop, retry/error, reset, and level/tab-switch behavior. Cancel outstanding requests and typing animations when appropriate; prevent stale responses from updating a reset game or another level. The Worker returns complete JSON; visible typing animations are client-side, not streaming from the Worker.
7. Keep mouse, touch, keyboard focus, mobile sizing, and iframe layout usable. Preserve existing pointer and keyboard interactions when changing placement games.
8. Give new games their own storage keys. `word-in-line` uses `word-in-line-layout-v1`. `word-in-space/app.js` writes `vazhechin-layout-v2` (`positions` and `camera`) and migrates `vazhechin-layout-v1`; `vectors.js` reads those layouts without writing them. Both pages must run at the same origin. Do not break this shared schema or erase another game's storage.
9. Treat local simulations, scripted model behaviors, and model-estimated probabilities as educational approximations. These pages do not actually train base/SFT/RLHF models. The next-token API does not expose logits or calibrated token probabilities.

### Existing public configuration contracts

The checked-in public Worker root is `https://minigames-backend.llmminigamesback.workers.dev`. Treat it as configuration, not proof that the deployment matches local source.

| Consumer | Global in `config.js` | Value shape / appended route |
| --- | --- | --- |
| `pretrained-llm` | `window.PRETRAINED_MODEL_API_URL` | Complete URL ending in `/generate` |
| `sft-llm` | `window.PRETRAINED_MODEL_API_URL` | Complete URL ending in `/generate-sft` |
| `rlhf-llm` | `window.PRETRAINED_MODEL_API_URL` | Complete URL ending in `/generate-aligned` |
| `model-lab` | `window.MODEL_API_ROOT` | Root only; game chooses the three generation routes |
| `jailbreak` | `window.JAILBREAK_CONFIG.workerRoot` | Root only; appends `/jailbreak` |
| `jailbreak-old` | `window.JAILBREAK_CONFIG.workerRoot` | Root only; appends `/jailbreak-old` |
| `hallucination` | `window.HALLUCINATION_CONFIG.workerRoot` | Root only; appends `/hallucination` |
| `next-token-prediction2` | `window.NEXT_TOKEN_CONFIG.workerRoot` | Root only; appends `/jailbreak` |

Some HTML files have their own fallback URLs, and some script URLs use `?v=...`. Inspect both HTML and configuration when diagnosing stale configuration or changing an endpoint.

## Worker HTTP contract

All six routes accept `POST` and return JSON. Send `Content-Type: application/json`. There is no `/chat`, `/health`, `/models`, root API, or token-probabilities endpoint in this Worker.

- CORS runs before routing. `ALLOWED_ORIGINS` is a comma-separated exact-origin list, defaulting to `https://rastaiha.github.io`. HTTP/HTTPS `localhost` and `127.0.0.1`, with optional ports, are also accepted. LAN IPs, IPv6 localhost, missing `Origin`, and the `null` origin from `file://` are not accepted automatically.
- A rejected origin returns 403. Even command-line requests need an allowed `Origin` header.
- `OPTIONS` from an allowed origin returns 204 for any path. It permits `POST, OPTIONS` and `Content-Type, X-Client-Id`, with a one-day preflight cache and `Vary: Origin`.
- Known routes reject other methods with 405; unknown paths return 404 after the origin/preflight checks. Paths match exactly; trailing slashes are not normalized.
- Expected errors are JSON with `error`; upstream failures generally return 502, sometimes with `details`, `upstreamStatus`, `upstreamDetails`, or `raw`. Do not expose raw diagnostics directly as learner-facing messages or copy them into reports without checking for sensitive data.

### `/generate`, `/generate-sft`, `/generate-aligned`

Request: `{ "prompt": "متن کاربر" }`. The Worker trims the string and requires 1–600 JavaScript string code units. Wrong content type returns 415; invalid JSON, missing/blank prompt, or excessive length returns 400. Client-supplied history, system prompts, model, and temperature are not used here.

When `env.RATE_LIMITER` exists, these three routes call it using `<clientId>:<mode>`. `X-Client-Id` must match `[a-zA-Z0-9-]{10,80}`; otherwise the ID is `anonymous`. Wrangler config specifies **30 requests per 60 seconds**, per key, and denial returns 429. Existing chat pages persist a UUID under `base-model-client-id`, with `browser-session` as a storage-failure fallback. This is not authentication, and omitting the header groups callers under the anonymous key.

| Route | Behavior | Temperature | `max_tokens` |
| --- | --- | --- | --- |
| `/generate` | Persian text continuation using `COMPLETION_INSTRUCTION` and fixed few-shot examples; does not ordinarily execute the prompt as a command | 0.4 | 250 |
| `/generate-sft` | Instruction-following simulation using `SFT_INSTRUCTION`; deliberately illustrates overconfidence and agreement | 0.8 | 500 |
| `/generate-aligned` | Helpful, honest, responsible assistant simulation using `ALIGNED_INSTRUCTION` | 0.55 | 500 |

`controlledSftResponse` and `controlledAlignedResponse` intercept selected Persian patterns after rate limiting and can return scripted responses without an upstream call. They normalize Arabic yeh/kaf variants. Preserve the educational distinction and existing redaction/crisis behavior when editing these fixtures.

Normal success is `{ text, modelUsed }`; scripted success is `{ text }`. `modelUsed` is optional. Each request is independent; fixed few-shot examples in base mode are not user conversation history.

`GEMINI_MODELS_CHAIN` currently contains eight gateway model IDs, in order: `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.8-flash`, `gemini/gemini-3.7-flash`, `gemini/gemini-3.6-flash`, `gemini/gemini-3.1-flash-lite-preview`, `gemini/gemini-2.5-flash`, `gemini/gemma-4-31b-it`, `gemini/gemma-4-26b-it`. These are strings configured in this repository, not verified provider offerings or quotas. Each attempt has a 25-second timeout; HTTP errors, empty output, parsing failures, and exceptions advance the chain. Worst-case latency can span all eight attempts. Requests use `stream: false`. Parsing expects chat-completion JSON, tolerates a trailing `data: [DONE]`, and strips `<think>...</think>` blocks; it is not a general SSE parser.

### `/jailbreak`

Request fields:

- `level`: converted with `Number(value) || 1`; use explicit levels 1, 2, or 3. Other values are not strictly rejected and can produce mismatched rule/model defaults.
- `messages`: array of `{ role, content }`. Truthy user/assistant messages are forwarded with stringified content. The caller supplies conversation history; the server does not store it.
- `prompt`: optional fallback, used only if there are no forwarded user/assistant messages.
- `system_prompt`: optional custom system instruction. A truthy `system` message in `messages` takes precedence. **Overrides are accepted except at level 2.**
- `model`: optional nonblank gateway model ID. Defaults to `cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast` at all three levels.
- `temperature`: numeric override clamped to 0–2; otherwise 0.2 at level 3 and 0.4 elsewhere. Avoid `null`/empty strings unless zero is intended, because numeric coercion accepts them.
- `reasoning_effort`: optional `low`, `medium`, or `high`, forwarded upstream when valid.

The request uses a 60-second timeout and `max_tokens: 512`, with no model fallback. Success returns both `{ text, answer }` containing the same response, plus `checklist` at level 2. Parsing accepts standard chat-completion JSON and buffered SSE `choices[0].delta.content`; it does not strip think blocks like the generation/hallucination handlers.

Level 1 deliberately permits character-by-character disclosure. Level 2 selects strict/unlocked server instructions using `evaluateLevel2Checklist` over the submitted raw user messages: scenario vocabulary must appear; engagement means at least three user messages, or two with a scenario-bearing final message longer than 35 characters; the final message must not match the narrow direct-password-request regex. The returned checklist is `{ isScenario, isEngaged, isJustDirect, unlocked }`. Level 3 has stronger refusal instructions. These are game mechanics, not a real authorization boundary; game passwords are also visible in frontend source. Keep frontend rules, secrets, success checks, and backend rules consistent when changing levels.

**Cross-game dependency:** `next-token-prediction2` uses this route at level 1 with a custom system message, model `gemini/gemini-3.8-flash`, temperature 0, and `reasoning_effort: "high"`. It asks for a JSON array of exactly five `{ word, prob }` predictions. The frontend extracts an array from `answer || text` and validates five nonempty words and finite probabilities in 0–100; the requested total of 100 is not enforced by that validator. Do not remove custom system/model support without updating this consumer.

### `/jailbreak-old`

Accepts `level`, `messages`, fallback `prompt`, and optional `model`, with the same history filtering as `/jailbreak`. It always uses server-owned `JAILBREAK_OLD_SYSTEM_RULES`: submitted system messages are discarded. It ignores requested temperature and reasoning effort. Defaults are Llama 3.1 8B for levels 1–2 and Llama 3.3 70B for level 3; temperature is 0.5 except 0.2 at level 3. Uses 512 output tokens, a 60-second timeout, no fallback model, and returns `{ text, answer }`. No level-2 checklist exists here.

### `/hallucination`

Accepts `level`, `messages`, fallback `prompt`, and optional `temperature`. Only user/assistant history is forwarded; client system messages and model choices are ignored. Temperature initially defaults to 0.7, or 0.2 at level 2; a provided numeric override is clamped to 0.05–1.2. At level 2, a regex on the latest user message then overrides this: asking for explanation/calculation steps selects an explanatory system instruction and temperature 0.2; otherwise it selects a direct-answer instruction and temperature 0.1.

There are four candidate models. Level 2 tries Llama 3.3 70B, Llama 3.1 70B, Mistral Small 3.1 24B, then Llama 3.1 8B; other levels try Mistral first, then the two 70B models and the 8B model. See the exact gateway IDs in `handleHallucination`. Each attempt has a 45-second timeout, `top_p: 0.98`, `max_tokens: 512`, and `stream: false`. Parsing tolerates JSON and buffered SSE, and strips think blocks. Success is `{ text, answer, model, temperature }`; all-candidate failure is 502. Multiple failed attempts can take up to roughly three minutes.

Unlike `/generate*`, the three challenge handlers currently have **no rate-limiter call, strict content-type check, prompt-length cap, or thorough message-schema validation**. Malformed message entries can throw rather than produce a structured 400. Do not assume shared enforcement when reusing a handler; validate explicitly for a new contract.

## Gateway configuration and known drift

- Active model requests use an OpenAI-compatible chat-completions gateway, not the direct Gemini API. `LLM_BASE_URL` must be the complete endpoint URL, including `/v1/chat/completions`; `resolveApiUrl` does not append this path. It rewrites a bare IPv4 hostname to the equivalent `.sslip.io` hostname. The checked-in default uses HTTP.
- Existing server implementation only: `gatewayApiKey(env)` uses trimmed `LLM_API_KEY` if its length exceeds five characters. A hardcoded fallback credential currently exists both there and in `../../.github/workflows/deploy-worker.yml`. Do not reproduce that value or add similar fallbacks. Game developers must not obtain or configure these credentials; games call the public Worker URL. Server credential cleanup/rotation requires coordinating the backend and deployment configuration.
- `minigames-backend/README.md` and `.dev.vars.example` are historical: they refer to `GEMINI_API_KEY`, direct Gemini access, an old directory name, 20 requests/minute, and different token limits. The active code uses `LLM_API_KEY`, 30/60 in Wrangler, and the limits above. `extractGeneratedText` and `buildCompletionContents` are leftover Gemini-format helpers; the active generation path uses `buildBaseOpenAiMessages` and chat-completion JSON.
- `.dev.vars`, `.env`, `.wrangler/`, and `node_modules/` are ignored inside the backend. Keep credentials out of tracked files, browser assets, test output, and logs. The Worker has observability enabled and some upstream error excerpts are logged/returned.

## Failure behavior to preserve or deliberately change

- `pretrained-llm`, `sft-llm`, and `rlhf-llm` fall back to local canned generation on missing configuration or non-abort remote failures. A working-looking response does not prove the API worked.
- `model-lab` contains local completion helpers, but its active request path uses local generation only for the raw tab; remote failures in the other tabs produce an error message rather than invoking those helpers.
- `hallucination` falls back to its local simulation. Its current frontend pushes the user message into history and also appends it in the request builder, duplicating the latest turn. `jailbreak-old` has the same request-construction pattern; do not copy it into new clients.
- `jailbreak-old` retains a port-5000 Flask `/chat` attempt, Worker access, an optional direct API attempt on non-HTTPS pages, and local simulation. No Flask server is present here. The Flask and direct API branches violate the required API boundary: do not use or reproduce them.
- Current `jailbreak` and `next-token-prediction2` rely on the remote request and display errors on failure. Test each game's actual failure path rather than assuming all games fall back.

## Local development and verification

Serve this whole directory to preserve sibling font/script paths:

```sh
# Run from 2026/llm; open http://localhost:5173/<game>/
rtk proxy python3 -m http.server 5173 --bind 127.0.0.1
```

Use HTTP rather than opening files directly for API or ES-module games. `word-in-line` and `word-in-space` also have package-local `npm run dev`/`start` scripts, but serving only a game directory does not expose sibling assets.

Backend installation and syntax verification (only when needed for backend work):

```sh
rtk proxy npm --prefix minigames-backend ci
rtk proxy npm --prefix minigames-backend run check
```

Game development requires no provider keys or `.dev.vars` setup. Keep the game's configuration pointed at the shared public Worker and serve the frontend on localhost, which the Worker permits through CORS. Test unavailable/error cases with mocked responses. For isolated backend development, `npm run dev` starts Wrangler locally, but mock upstream calls and do not configure provider credentials or rely on the existing hardcoded fallback. A local Worker is for backend verification, not an alternate provider connection in game code.

An origin-aware request to the shared server (no credentials required):

```sh
rtk proxy curl -i https://minigames-backend.llmminigamesback.workers.dev/generate \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/json' \
  -H 'X-Client-Id: local-test-client' \
  --data '{"prompt":"من امروز"}'
```

This invokes the configured upstream and may consume quota. For routing, validation, payload construction, and fallback tests, import the Worker's default export in Node and call `worker.fetch(new Request(...), env)` with a mocked global `fetch` and optional mock `RATE_LIMITER`; restore mocks afterward. No automated backend test suite is checked in. `npm run check` only runs `node --check src/index.js`, not behavioral tests or live provider validation.

For a change, verify in proportion to its scope:

- Run backend syntax checking if the Worker changed. `word-in-line` and `word-in-space` each have `npm run check` scripts for their external JS files. For other external files use `rtk proxy node --check <file>`; inline scripts need separate extraction/syntax checking or browser execution. Do not assume checking an HTML file with Node validates its JavaScript.
- For a backend contract change, exercise CORS, malformed/empty inputs, response shape, applicable rate limiting, mock upstream failures, and every frontend consumer of the changed route. Include custom-system next-token requests when changing `/jailbreak`.
- For UI changes, open the actual game over HTTP and check the console/network panel, the main interaction, reset and stop behavior, narrow viewport, keyboard/touch where relevant, and missing-backend behavior. Check iframe use if modifying workshop integration.
- Report whether responses were live, mocked, or local simulations, and distinguish syntax checks from browser/behavioral verification.
- Review `rtk git diff --check` and the final diff. Avoid unrelated formatting, dataset regeneration, dependency changes, or credential/config churn. `words-world/persian_embeddings_3d.py` downloads a large vector dataset and runs t-SNE; it is not a routine validation command.

## Deployment

- `../../.github/workflows/deploy-pages.yml` uploads the repository root directly to GitHub Pages on pushes to `main` or manual dispatch; there is no frontend build step. Keep secrets out of published content.
- `../../.github/workflows/deploy-worker.yml` deploys the Worker on pushes to `main` affecting `2026/llm/minigames-backend/**` or the workflow, or on manual dispatch. It uses `CLOUDFLARE_API_TOKEN`, injects `LLM_API_KEY`, and runs from the backend directory using the latest Wrangler action version.
- Backend package scripts include `deploy` (`wrangler deploy`) and `deploy:first` (`wrangler deploy --secrets-file .dev.vars`). They publish real changes; local verification does not require deployment. A frontend config edit alone does not deploy changed Worker code.
