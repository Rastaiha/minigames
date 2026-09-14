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

Current checks pass after installing dependencies with `npm ci`:

```
npm run check
```

This runs ESLint, Prettier check, the browser API-boundary scan, JavaScript syntax checks, and the Worker tests. ESLint and the API-boundary/syntax scripts exclude archived material and backend-specific paths where appropriate; Prettier checks repository Markdown, including this file. Generated embedding data remains checked as JavaScript, with the existing `words.js` unused-variable override. `AGENTS.md` is tracked repository guidance.

The legacy `jailbreak-old`, `next-token-prediction`, and `llm2.html` entries are preserved unchanged under `archive/`; they are no longer active minigame entry points or part of the cleanup backlog.

Remaining work continues with the visual/accessibility work itemized in the game table below. The Worker policy and per-game handler split is complete. Do not undo existing URL spellings, storage keys, or the direct-provider removals.

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
- **Complete for the current contract:** Add mocked unit tests for malformed input, success/error paths, CORS, rate limits, adapters, structured output, and sensitive-error redaction. Upstream timeout/fallback-chain coverage and README/example refresh remain follow-up work; never add credentials or hardcoded fallbacks.

## Visual and interaction migration

Use short Persian labels, one primary action per state, an explicit status line, and a single reset/help affordance. Preserve each game's URL, storage key, educational distinction, and core interaction. Replace remote fonts with local assets where possible, make pointer interactions keyboard/touch accessible, pause animation when hidden, and support reduced motion.

## Individual game backlog

| Game                         | Main problems                                                                               | Planned cleanup                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dimensions/`                | Three near-copy pages and duplicated CSS/JS                                                 | **Complete:** shared `dimensionality-engine.js` plus 1D/2D/3D configs; uppercase URL preserved.                                                                                                                   |
| `attention/`                 | Pointer-only tokens, fixed layout, remote font, no reduced motion                           | **Complete:** semantic buttons, responsive board, local font, stage tokens, and reduced-motion support.                                                                                                           |
| `bpe-tree/`                  | English metadata/controls, dense long lines, unreadable default graph, modal focus gaps     | **Complete:** Persian RTL copy, local typography, responsive zoom/layout, focus-trapped modal, and keyboard-operable graph nodes.                                                                                 |
| `contexual-embedding/`       | Mouse-only drag, fixed 100vh, inaccessible modal, remote font                               | Pointer Events plus keyboard movement, responsive canvas/modal, local font; preserve typo URL.                                                                                                                    |
| `dimensionality-reduction/`  | CDN-only Three.js, random non-reproducible data, English UI, broken 1D navigation           | Seeded data, shared Three controller, staged loading/error state, reduced motion and correct navigation.                                                                                                          |
| `hallucination/`             | Duplicate latest user message, weak validation, silent simulation fallback                  | Shared chat client/request builder, response schema checks, explicit simulation badge, reset-safe aborts.                                                                                                         |
| `jailbreak/`                 | Stale URL, browser-owned policy/model knobs, stale-response risk, checklist field mismatch  | Server-owned policy, shared lifecycle/client, canonical checklist fields, current Worker config.                                                                                                                  |
| `model-lab/`                 | Duplicated chat client, stale URL, dead local helpers                                       | Shared client/shell; retain tab histories; remove dead generation/token code.                                                                                                                                     |
| `next-token-prediction2/`    | Uses jailbreak as token API, exposes model/system/temp, weak probability validation, alerts | Dedicated structured Worker operation, server-owned settings, sum/range validation, cancellable UI and estimates label.                                                                                           |
| `pretrained-llm/`            | Duplicated API/chat code, stale fallback URL, silent local fallback, IME gaps               | Shared shell/client, canonical config, visible local/remote source, fixtures and IME-safe submit.                                                                                                                 |
| `sft-llm/`                   | Same duplication and safety-fixture drift                                                   | Same migration; align fixtures with Worker policy and label simulation.                                                                                                                                           |
| `rlhf-llm/`                  | Same duplication; ambiguous SFT naming                                                      | Shared migration; rename visible copy to aligned/helpful while keeping route.                                                                                                                                     |
| `random-llm/`                | ~732KB unused tokenizer blob; prompt semantics unclear                                      | **Complete:** remove the dead tokenizer implementation, keep the shared random generator, explain the offline simulation, and retain accessible reset/stop/IME-safe controls.                                     |
| `pretraining-box/`           | Every probability row tagged “real token”; no cumulative learning                           | **Complete:** only the target row is tagged, simulation status is explicit, pure learning math is modular, and deterministic state tests cover reset behavior.                                                    |
| `transformer/`               | Shared files but untranslated reset and weak state explanation                              | Shared controller/status, Persian controls, live step narration and manual-step accessibility.                                                                                                                    |
| `word-embedding/`            | Large monolith, inline handlers, duplicated Three code, unsafe storage                      | Split state/render/data modules, reuse dimensionality engine, guarded storage, preserve hash/state.                                                                                                               |
| `wordembedding/`             | Older dense overlap, custom pointer/touch code                                              | Keep unique arithmetic as compatibility mode or redirect; shared interaction helpers and accessible controls.                                                                                                     |
| `word-in-line/`              | Best baseline but minified CSS/inline handlers and no tests                                 | **Complete:** preserve storage key, add touch-sized controls, reduced-motion support, and layout/schema tests.                                                                                                    |
| `word-in-space/`             | Best visual reference but remote font/minified CSS/no tests                                 | **Complete:** use the local font, touch-sized reset control, reduced-motion support, and layout/schema tests; preserve `vazhechin-layout-v2`.                                                                     |
| `word-in-space/vectors.html` | Limited help/return and shared-layout assumptions                                           | **Complete:** add clear back/help state and read-only schema tests; never write the main layout.                                                                                                                  |
| `words-and-vectors/`         | Static, cramped four-column mobile view, unclear illustrative dimensions                    | **Complete:** responsive card stage, local typography, concise dimension explanation, and a visible color legend.                                                                                                 |
| `words-world/`               | Dark visual outlier, dense app, always-running animation, generated JS/CSV drift            | **Complete:** compatible tokens/local font, hidden-tab animation pause, scene/data modules, and deterministic CSV/nearest-neighbor tests; the reproducible Python pipeline is documented in its module docstring. |

## Delivery sequence

1. Land this plan and repository tooling/boundary guard. **Complete.**
2. Remove direct-provider and alternate-server branches; migrate legacy model clients to the shared compatibility client. **Complete for active model-backed pages.**
3. Add Worker `/api/respond`, tests, and refreshed documentation. **Complete:** contract/tests, HTTP/routing/gateway/validation split, and policy/per-game-handler split.
4. Migrate the chat family, then challenge/next-token, then visual families using the shared shell and tokens.
5. Refactor duplicated dimensionality/transformer/embedding engines and workshop assets.
6. Run browser smoke tests at desktop/mobile widths, keyboard/touch checks, mocked API failure tests, hooks, and final diff review.

## Definition of done

- No provider URL, provider credential, or browser `Authorization` header remains in a game directory.
- Every model call goes through the shared client and documented Worker endpoint.
- Every entry page uses the shared visual tokens and one of the three shells, with RTL/keyboard/touch/reduced-motion support.
- ESLint/Prettier/pre-commit/JS syntax/API-boundary checks pass; Worker contract tests cover all routes and the new operation.
- Existing URLs, storage schemas, educational distinctions, and workshop iframe behavior remain compatible or have an explicit redirect/migration note.
