# LLM Minigames cleanup plan

## Goals

1. Make every minigame predictable to maintain: one formatting/linting workflow, small modules, explicit tests, and no hidden provider credentials.
2. Give the games one visual language based on the `word-in-space` workbench: a calm paper surface, compact controls, short Persian copy, clear status, and touch/keyboard support.
3. Give every model-backed game one browser API client and one versioned Worker contract. Browser code must never call a provider directly or send provider credentials.

## Status for the next agent

Completed and pushed:

- `5351ccd`: added the initial cleanup plan, shared API/config foundation, and repository checks.
- `01f354b`: migrated `pretrained-llm`, `sft-llm`, and `rlhf-llm` to the shared Worker client; removed direct provider browser branches before archiving legacy pages.
- `f0ccd1a`: replaced the proposed Ruff setup with ESLint 9, Prettier 3, `.editorconfig`, `.pre-commit-config.yaml`, and npm scripts/configuration.
- `2e42df9`: ran Prettier over all eligible repository HTML/CSS/JavaScript/JSON/Markdown sources and fixed the small ESLint issues found in shared/transformer code.
- `567e1b9`: added the versioned `/api/respond` Worker contract, structured next-token operation, shared client cancellation, and migrated the pretrained/SFT/aligned chat pages.
- `ea440d8`: migrated `model-lab`, `jailbreak`, `hallucination`, and `next-token-prediction2` to the shared client and contract.
- `960f7e8`: added mocked Worker contract tests for validation, CORS, rate limits, adapters, structured output, and safe upstream errors.
- `26640a2`: split Worker HTTP/CORS, routing, gateway, and contract-validation boundaries; removed the embedded gateway credential fallback.
- Follow-up cleanup: extracted `Dimensions/` into one shared dimensionality engine with separate 1D/2D/3D configuration files.
- `a3b144f`: installed the ESLint/Prettier toolchain, fixed the remaining lint/format issues, completed the Worker policy/handler split, and pushed the current checks.
- `e85322f`: archived `bpe-tree` and recorded the repository, GitHub, and browser audit backlog.

Current checks pass after installing dependencies with `npm ci`:

```
npm run check
npm run test:browser
```

The first command runs ESLint, Prettier check, the browser API-boundary scan, JavaScript syntax checks, all 13 game fixture tests, and the 12 Worker contract tests. The second launches a dependency-free headless Chrome smoke pass over all active pages at desktop and mobile sizes, checks runtime/local-resource failures and horizontal overflow, enforces 44px mobile controls, and guards the repaired responsive layouts. Set `BROWSER_SMOKE_SCREENSHOTS=/tmp/llm-ui` to save fresh review captures. ESLint and the API-boundary/syntax scripts exclude archived material and backend-specific paths where appropriate; Prettier checks repository Markdown, including this file. Generated embedding data remains checked as JavaScript, with the existing `words.js` unused-variable override. `AGENTS.md` is tracked repository guidance.

The legacy `bpe-tree`, `jailbreak-old`, `next-token-prediction`, and `llm2.html` entries are preserved under `archive/`; they are no longer active minigame entry points or part of the cleanup backlog.

The status list and synchronized game table below are authoritative. Only the two embedding refactors explicitly marked partial remain. Do not undo existing URL spellings, storage keys, or the direct-provider removals.

## Remaining work verified 2026-09-15

These items are intentionally listed separately from the historical commit log and must not be marked complete until the implementation and the corresponding browser checks are actually finished:

- **Complete:** added `shared/ui/tokens.css`, `shells.css`, and `helpers.js`; all active entry pages consume the shared tokens/shell primitives while retaining page-specific layouts.
- **Complete:** `shared/api/client.js` now exposes `createRequestGuard()` and rejects stale responses before they reach page code; callers can combine its generation-aware options with their existing abort controllers.
- **Complete:** `contexual-embedding/` uses Pointer Events with capture/cancellation for sidebar and canvas dragging, plus Escape-aware modal focus trapping and restoration.
- **Complete:** `dimensionality-reduction/` now has a loading/error surface, documents its intentional jsDelivr dependency, applies reduced motion to dimensional transitions, and its 1D/2D controls retain the staged navigation contract. Browser smoke verification is recorded in the final verification section below.
- **Complete:** `model-lab/` now keeps only the raw local generator and shared Worker path; unused stage-specific local completion fixtures and dispatchers are removed.
- **Partial:** extracted guarded storage/hash parsing into `word-embedding/storage.js` and wired the monolith to it; remaining coupled inline interaction extraction and dimensionality-engine reuse are still required.
- **Partial:** extracted the custom bank tap interaction into `wordembedding/interaction.js` with pointer cancellation and regression fixtures; inline control handlers remain to be extracted.
- **Complete:** `random-generator.js` retains Web Crypto entropy by default and exposes an opt-in seeded mode; `random-generator.test.mjs` covers repeatability, bounds, seed variation, and punctuation metadata.
- **Complete:** refreshed backend README guidance to the active Worker/gateway contract and added mocked timeout, fallback exhaustion, and malformed-message coverage.
- **Complete:** automated desktop/mobile browser smoke checks and a fresh screenshot review cover all 24 active pages; representative local interactions, contextual keyboard placement, responsive layout guards, and mocked model-backed success states pass.
- **Complete:** `.github/workflows/llm-checks.yml` runs repository, root-independent pre-commit, and Chromium smoke checks on pushes/PRs; the Worker deployment credential fallback remains removed.

## Repository-wide target architecture

```
2026/llm/
  shared/
    api/client.js          # timeout, cancellation, client id, JSON/error normalization
    config.js              # public Worker root only
    ui/                    # tokens, shell, status, chat and reset helpers
  scripts/
    check-api-boundary.mjs # fail on provider URLs, auth headers, or credentials in browser code
  <game>/
    index.html
    app.js / styles.css    # external files where practical
```

The compatibility routes remain available while clients migrate, but new code uses a single `POST /api/respond` operation with a discriminated payload, for example `{version: 1, game: "jailbreak", mode: "challenge", level, input}`. The Worker owns model selection, prompts, temperature, rate limiting, and structured output. Responses use `{ok, data, meta, error}`; next-token returns validated `{predictions}` rather than generated JSON prose. Old route adapters can translate to the new handler during the migration.

## Tooling and quality gates

- Add ESLint and Prettier configuration for browser JavaScript, HTML, CSS, and JSON. Keep generated data and third-party/vendor code excluded.
- Add `.pre-commit-config.yaml` with ESLint, Prettier, standard whitespace/YAML checks, and the API-boundary scan. Add an `.editorconfig` for UTF-8, LF, two-space web files, and four-space Python.
- Add a root `package.json` script set for boundary checks, JavaScript syntax checks, and game smoke checks. Keep game-local package scripts working.
- Run hooks in CI and before deployment; report ESLint, Prettier check, `node --check`, boundary scan, and `git diff --check` results. Do not regenerate large datasets as part of normal checks.
- Add small fixture tests for Worker request validation, route adapters, response normalization, CORS, rate limits, cancellation, and next-token structured output.

## Shared frontend/API work

- Implement one classic-browser `shared/api/client.js` and `shared/config.js`. It owns the Worker root, stable client id, JSON/status validation, timeout and abort handling, normalized learner-safe errors, and request-generation guards so stale responses cannot update a reset game.
- Add shared UI tokens and a shell with three compact archetypes: workspace (word-in-space), chat, and visual stage. Use local Vazir/B Kamran fonts, `#f7f8fc` paper, white surfaces, slate ink, indigo action, visible focus, 44px touch targets, RTL by default, and `prefers-reduced-motion`.
- Migrate every model-backed page to the client, remove direct provider URLs, provider `Authorization` headers, API keys, and alternate Flask/direct-provider fallbacks. Keep local simulations clearly labelled and only as deliberate offline fallbacks.
- Add a status/source badge, retry/stop/reset behavior, IME-safe submit, and consistent empty/error/loading states to all chat-like games.

## Backend work

- **Complete:** Split `minigames-backend/src/index.js` into routing, validation, gateway, policy, and per-game handlers while preserving the six compatibility routes.
- **Complete:** Add `/api/respond` with strict content type, payload size, message-schema, level/mode validation, CORS, client-id validation, and rate limiting on every model-backed operation.
- **Complete:** Keep model/system/temperature/reasoning settings server-owned, add a dedicated structured next-token operation, and preserve the level-2 jailbreak checklist shape.
- **Complete for the current contract:** Mocked unit tests cover malformed input, success/error paths, CORS, rate limits, adapters, structured output, sensitive-error redaction, upstream timeout, and fallback-chain exhaustion. The README/examples describe the active contract; never add credentials or hardcoded fallbacks.

## Visual and interaction migration

Use short Persian labels, one primary action per state, an explicit status line, and a single reset/help affordance. Preserve each game's URL, storage key, educational distinction, and core interaction. Replace remote fonts with local assets where possible, make pointer interactions keyboard/touch accessible, pause animation when hidden, and support reduced motion.

## Individual game backlog

| Game                         | Main problems                                                                               | Planned cleanup                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dimensions/`                | Three near-copy pages and duplicated CSS/JS                                                 | **Complete:** shared `dimensionality-engine.js` plus 1D/2D/3D configs; uppercase URL preserved.                                                                                                                   |
| `attention/`                 | Pointer-only tokens, fixed layout, remote font, no reduced motion                           | **Complete:** semantic buttons, responsive board, local font, stage tokens, and reduced-motion support.                                                                                                           |
| `contexual-embedding/`       | Mouse-only drag, fixed 100vh, inaccessible modal, remote font                               | **Complete:** local typography, full-width mobile canvas with a compact word tray, keyboard placement/movement/deletion, Pointer Events with cancellation, focus-visible tokens, and modal focus containment.     |
| `dimensionality-reduction/`  | CDN-only Three.js, random non-reproducible data, English UI, broken 1D navigation           | **Complete:** seeded data, Persian copy, hidden-tab pause, staged CDN loading/error state, reduced-motion transitions, touch-sized controls, and browser navigation checks.                                       |
| `hallucination/`             | Duplicate latest user message, weak validation, silent simulation fallback                  | **Complete:** shared client/request builder without duplicate turns, validated response text, explicit simulation badge, reset-safe aborts, and IME-safe submit.                                                  |
| `jailbreak/`                 | Stale URL, browser-owned policy/model knobs, stale-response risk, checklist field mismatch  | **Complete:** current Worker config and shared client, server-owned request policy, canonical checklist fields, and abort-safe level switching.                                                                   |
| `model-lab/`                 | Duplicated chat client, stale URL, dead local helpers                                       | **Complete:** shared client, per-tab histories, source status, touch-sized tabs, and only the intentional raw-model local generator remain.                                                                       |
| `next-token-prediction2/`    | Uses jailbreak as token API, exposes model/system/temp, weak probability validation, alerts | **Complete:** dedicated structured Worker operation, server-owned settings, strict five-item/range/sum validation, inline learner-safe errors, estimates labelling, and request cancellation.                     |
| `pretrained-llm/`            | Duplicated API/chat code, stale fallback URL, silent local fallback, IME gaps               | **Complete:** shared client/config, visible Worker/local source, reset-safe fallback, and IME-safe submit.                                                                                                        |
| `sft-llm/`                   | Same duplication and safety-fixture drift                                                   | **Complete:** shared client/config, visible Worker/local source, aligned fallback labelling, and IME-safe submit.                                                                                                 |
| `rlhf-llm/`                  | Same duplication; ambiguous SFT naming                                                      | **Complete:** shared client/config, visible Worker/local source, helpful/aligned framing, and IME-safe submit while keeping the route.                                                                            |
| `random-llm/`                | ~732KB unused tokenizer blob; prompt semantics unclear                                      | **Complete:** dead tokenizer removal, offline explanation, accessible controls, opt-in seeded generation, and deterministic fixtures.                                                                             |
| `pretraining-box/`           | Every probability row tagged “real token”; no cumulative learning                           | **Complete:** only the target row is tagged, simulation status is explicit, pure learning math is modular, and deterministic state tests cover reset behavior.                                                    |
| `transformer/`               | Shared files but untranslated reset and weak state explanation                              | **Complete:** shared controller/status, Persian controls, live step narration, manual stepping, and accessible touch-sized controls.                                                                              |
| `word-embedding/`            | Large monolith, inline handlers, duplicated Three code, unsafe storage                      | **Partial:** typography, focus, reduced motion, guarded storage/hash parsing, and the mobile hub are fixed. Remaining: extract coupled inline interactions and reuse the dimensionality engine.                   |
| `wordembedding/`             | Older dense overlap, custom pointer/touch code                                              | **Partial:** compatibility arithmetic, visible focus, reduced-motion support, and shared pointer/tap interaction fixtures are done. Remaining: extract the page’s inline control handlers.                        |
| `word-in-line/`              | Best baseline but minified CSS/inline handlers and no tests                                 | **Complete:** preserve storage key, add touch-sized controls, reduced-motion support, and layout/schema tests.                                                                                                    |
| `word-in-space/`             | Best visual reference but remote font/minified CSS/no tests                                 | **Complete:** use the local font, touch-sized reset control, reduced-motion support, and layout/schema tests; preserve `vazhechin-layout-v2`.                                                                     |
| `word-in-space/vectors.html` | Limited help/return and shared-layout assumptions                                           | **Complete:** add clear back/help state and read-only schema tests; never write the main layout.                                                                                                                  |
| `words-and-vectors/`         | Static, cramped four-column mobile view, unclear illustrative dimensions                    | **Complete:** responsive card stage, local typography, concise dimension explanation, and a visible color legend.                                                                                                 |
| `words-world/`               | Dark visual outlier, dense app, always-running animation, generated JS/CSV drift            | **Complete:** compatible tokens/local font, hidden-tab animation pause, scene/data modules, and deterministic CSV/nearest-neighbor tests; the reproducible Python pipeline is documented in its module docstring. |

## Delivery sequence

1. Land this plan and repository tooling/boundary guard. **Complete.**
2. Remove direct-provider and alternate-server branches; migrate legacy model clients to the shared compatibility client. **Complete for active model-backed pages.**
3. Add Worker `/api/respond`, tests, and refreshed documentation. **Complete:** contract/tests, HTTP/routing/gateway/validation split, and policy/per-game-handler split.
4. Migrate the chat family, then challenge/next-token, then visual families using the shared shell and tokens. **Complete.**
5. Refactor duplicated dimensionality/transformer/embedding engines and workshop assets. **Partial:** only the two embedding refactors above remain.
6. Run browser smoke tests at desktop/mobile widths, keyboard/touch checks, mocked API checks, hooks, and final diff review. **Complete for the current active pages.**

## Definition of done

- No provider URL, provider credential, or browser `Authorization` header remains in a game directory.
- Every model call goes through the shared client and documented Worker endpoint.
- Every entry page uses the shared visual tokens and one of the three shells, with RTL/keyboard/touch/reduced-motion support.
- ESLint/Prettier/pre-commit/JS syntax/API-boundary/browser checks pass; Worker contract tests cover all routes and the new operation.
- Existing URLs, storage schemas, educational distinctions, and workshop iframe behavior remain compatible or have an explicit redirect/migration note.

## Browser verification

- 2026-09-15: Chrome reviewed all 24 active pages at 1280 × 800 and 390 × 844, plus targeted 320/390/560px layout checks. Automated checks found no horizontal overflow, undersized mobile controls, local-resource failures, or runtime exceptions. Transformer poem/control separation, the `word-embedding` hub edges, contextual full-width canvas and keyboard placement, representative local interactions, and mocked model-backed success states pass. Fresh desktop/mobile screenshots were manually reviewed after the fixes. `npm run check` passes all 13 game tests and 12 Worker tests; `npm run test:browser` and the root-level pre-commit hooks also pass locally.
