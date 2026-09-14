# LLM Minigames cleanup plan

## Goals

1. Make every minigame predictable to maintain: one formatting/linting workflow, small modules, explicit tests, and no hidden provider credentials.
2. Give the games one visual language based on the `word-in-space` workbench: a calm paper surface, compact controls, short Persian copy, clear status, and touch/keyboard support.
3. Give every model-backed game one browser API client and one versioned Worker contract. Browser code must never call a provider directly or send provider credentials.

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

- Add `pyproject.toml` with Ruff format/lint configuration, a narrow Python target, and exclusions for generated data.
- Add `.pre-commit-config.yaml` with Ruff (format and check), standard whitespace/YAML checks, and the API-boundary scan. Add an `.editorconfig` for UTF-8, LF, two-space web files, and four-space Python.
- Add a root `package.json` script set for boundary checks, JavaScript syntax checks, and game smoke checks. Keep game-local package scripts working.
- Run hooks in CI and before deployment; report `ruff check`, `ruff format --check`, `node --check`, boundary scan, and `git diff --check` results. Do not regenerate large datasets as part of normal checks.
- Add small fixture tests for Worker request validation, route adapters, response normalization, CORS, rate limits, cancellation, and next-token structured output.

## Shared frontend/API work

- Implement one classic-browser `shared/api/client.js` and `shared/config.js`. It owns the Worker root, stable client id, JSON/status validation, timeout and abort handling, normalized learner-safe errors, and request-generation guards so stale responses cannot update a reset game.
- Add shared UI tokens and a shell with three compact archetypes: workspace (word-in-space), chat, and visual stage. Use local Vazir/B Kamran fonts, `#f7f8fc` paper, white surfaces, slate ink, indigo action, visible focus, 44px touch targets, RTL by default, and `prefers-reduced-motion`.
- Migrate every model-backed page to the client, remove direct provider URLs, provider `Authorization` headers, API keys, and alternate Flask/direct-provider fallbacks. Keep local simulations clearly labelled and only as deliberate offline fallbacks.
- Add a status/source badge, retry/stop/reset behavior, IME-safe submit, and consistent empty/error/loading states to all chat-like games.

## Backend work

- Split `minigames-backend/src/index.js` into routing, validation, gateway, policy, and per-game handlers while preserving the six compatibility routes.
- Add `/api/respond` with strict content type, payload size, message-schema, level/mode validation, CORS, client-id validation, and rate limiting on every model-backed operation.
- Keep model/system/temperature/reasoning settings server-owned. Add a dedicated structured next-token operation and preserve the level-2 jailbreak checklist shape.
- Add mocked unit tests for malformed input, all success/error paths, upstream timeouts, fallback chains, CORS, and sensitive-error redaction. Refresh README and examples to match the active Worker contract; never add credentials or hardcoded fallbacks.

## Visual and interaction migration

Use short Persian labels, one primary action per state, an explicit status line, and a single reset/help affordance. Preserve each game's URL, storage key, educational distinction, and core interaction. Replace remote fonts with local assets where possible, make pointer interactions keyboard/touch accessible, pause animation when hidden, and support reduced motion.

## Individual game backlog

| Game | Main problems | Planned cleanup |
| --- | --- | --- |
| `Dimensions/` | Three near-copy pages and duplicated CSS/JS | Extract one dimensionality engine plus 1D/2D/3D configs; keep uppercase URL. |
| `attention/` | Pointer-only tokens, fixed layout, remote font, no reduced motion | Semantic buttons/keyboard focus, responsive board, local font, shared stage shell. |
| `bpe-tree/` | English metadata/controls, dense long lines, unreadable default graph, modal focus gaps | Persian RTL copy, formatted modules, responsive zoom, focus-trapped modal and graph keyboard alternatives. |
| `contexual-embedding/` | Mouse-only drag, fixed 100vh, inaccessible modal, remote font | Pointer Events plus keyboard movement, responsive canvas/modal, local font; preserve typo URL. |
| `dimensionality-reduction/` | CDN-only Three.js, random non-reproducible data, English UI, broken 1D navigation | Seeded data, shared Three controller, staged loading/error state, reduced motion and correct navigation. |
| `hallucination/` | Duplicate latest user message, weak validation, silent simulation fallback | Shared chat client/request builder, response schema checks, explicit simulation badge, reset-safe aborts. |
| `jailbreak/` | Stale URL, browser-owned policy/model knobs, stale-response risk, checklist field mismatch | Server-owned policy, shared lifecycle/client, canonical checklist fields, current Worker config. |
| `jailbreak-old/` | Direct Flask/provider branches, duplicate message, silent fallback, legacy UX | Remove bypasses; redirect/archive to current challenge while preserving URL compatibility. |
| `model-lab/` | Duplicated chat client, stale URL, dead local helpers | Shared client/shell; retain tab histories; remove dead generation/token code. |
| `next-token-prediction/` | Exposed Groq credential/direct fetch, unsafe `innerHTML`, duplicate newer game | Immediate Worker migration, text-safe rendering, move useful presets to v2, then thin compatibility page. |
| `next-token-prediction2/` | Uses jailbreak as token API, exposes model/system/temp, weak probability validation, alerts | Dedicated structured Worker operation, server-owned settings, sum/range validation, cancellable UI and estimates label. |
| `pretrained-llm/` | Duplicated API/chat code, stale fallback URL, silent local fallback, IME gaps | Shared shell/client, canonical config, visible local/remote source, fixtures and IME-safe submit. |
| `sft-llm/` | Same duplication and safety-fixture drift | Same migration; align fixtures with Worker policy and label simulation. |
| `rlhf-llm/` | Same duplication; ambiguous SFT naming | Shared migration; rename visible copy to aligned/helpful while keeping route. |
| `random-llm/` | ~732KB unused tokenizer blob; prompt semantics unclear | Remove dead blob, keep deterministic seeded generator, explain “random generation” and reuse shared stage shell. |
| `pretraining-box/` | Every probability row tagged “real token”; no cumulative learning | Correct tag logic, make simulation explicit, add deterministic reset/state tests. |
| `transformer/` | Shared files but untranslated reset and weak state explanation | Shared controller/status, Persian controls, live step narration and manual-step accessibility. |
| `word-embedding/` | Large monolith, inline handlers, duplicated Three code, unsafe storage | Split state/render/data modules, reuse dimensionality engine, guarded storage, preserve hash/state. |
| `wordembedding/` | Older dense overlap, custom pointer/touch code | Keep unique arithmetic as compatibility mode or redirect; shared interaction helpers and accessible controls. |
| `word-in-line/` | Best baseline but minified CSS/inline handlers and no tests | Preserve storage key; format modules, remove inline handlers, add layout/schema tests. |
| `word-in-space/` | Best visual reference but remote font/minified CSS/no tests | Make it the canonical workbench; local fonts, tokens, schema tests, preserve `vazhechin-layout-v2`. |
| `word-in-space/vectors.html` | Limited help/return and shared-layout assumptions | Add clear back/help state and read-only schema tests; never write the main layout. |
| `words-and-vectors/` | Static, cramped four-column mobile view, unclear illustrative dimensions | Responsive stage, concise explanation/caption, shared visual tokens. |
| `words-world/` | Dark visual outlier, dense app, always-running animation, generated JS/CSV drift | Adopt compatible tokens, pause hidden animation, split modules, document reproducible data pipeline and test it. |
| `llm2.html` | 1.77MB workshop monolith, base64 assets, absolute iframe URLs | Split state/content/media manifest, relative canonical URLs, preserve sandbox and workshop behavior. |

## Delivery sequence

1. Land this plan and repository tooling/boundary guard.
2. Remove direct-provider and alternate-server branches; migrate legacy model clients to the shared compatibility client.
3. Add Worker `/api/respond`, tests, and refreshed documentation.
4. Migrate the chat family, then challenge/next-token, then visual families using the shared shell and tokens.
5. Refactor duplicated dimensionality/transformer/embedding engines and workshop assets.
6. Run browser smoke tests at desktop/mobile widths, keyboard/touch checks, mocked API failure tests, hooks, and final diff review.

## Definition of done

- No provider URL, provider credential, or browser `Authorization` header remains in a game directory.
- Every model call goes through the shared client and documented Worker endpoint.
- Every entry page uses the shared visual tokens and one of the three shells, with RTL/keyboard/touch/reduced-motion support.
- Ruff/pre-commit/JS syntax/API-boundary checks pass; Worker contract tests cover all routes and the new operation.
- Existing URLs, storage schemas, educational distinctions, and workshop iframe behavior remain compatible or have an explicit redirect/migration note.
