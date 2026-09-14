# LLM minigames backlog

Open issues confirmed during the 2026-09-15 repository and UI audit of commit `a198809`. The archived `bpe-tree` game is intentionally excluded.

## P0 — Repair the GitHub checks workflow

- **Problem:** The `LLM minigames checks` workflow fails on `main` during `pre-commit run --all-files`. Pre-commit runs local hooks from the Git worktree root, so the hooks look for `/package.json` and `/scripts/check-api-boundary.mjs` even though both live under `2026/llm/`. The preceding `npm run check` succeeds because the workflow applies `working-directory: 2026/llm` to that step.
- **Proposed solution:** Make every local hook root-independent: use `npm --prefix 2026/llm run lint:check`, `npm --prefix 2026/llm run format:check`, and `node 2026/llm/scripts/check-api-boundary.mjs` (or add a small root-level wrapper). Run the same pre-commit command locally from the repository root and require a green GitHub run before considering the quality gate complete.

## P1 — Stop Transformer controls from covering the input poem on mobile

- **Problem:** At 390 × 844, both `transformer/encoder.html` and `transformer/decoder.html` wrap their three controls into two rows while `.token-strip` remains at `top: 64px`. The 180 × 44 reset button overlaps the poem strip by its full 44px height.
- **Proposed solution:** Give the mobile toolbar a three-column row or derive the poem/stage offset from the wrapped toolbar height. Verify all three controls, the entire poem, and the stage remain visible at 320px, 390px, and 560px widths.

## P1 — Make the `word-embedding` hub start at reachable content

- **Problem:** The scrollable `#hub-view` combines `justify-content: center` with content taller than the viewport. At 390 × 844 its heading begins at `y = -28px`; `scrollTop = 0` is already the upper limit, so the clipped heading cannot be revealed by scrolling.
- **Proposed solution:** Use safe centering (`justify-content: safe center`) or switch to `flex-start` when the hub content overflows. Keep visual centering only on viewports with enough height, and test both the heading and reset action at short mobile heights.

## P1 — Give contextual embedding a usable mobile canvas

- **Problem:** `contexual-embedding` keeps a fixed 280px sidebar at mobile widths. On a 390px viewport the actual placement canvas is only 110px wide, which is too narrow for the core clustering activity even though keyboard placement technically works.
- **Proposed solution:** Below a responsive breakpoint, turn the sidebar into a collapsible drawer or compact horizontal word tray and give the canvas the full viewport width. Recheck drag, keyboard placement/deletion, stage navigation, and modal focus on touch-sized viewports.

## P2 — Remove the duplicate probability label in next-token results

- **Problem:** `next-token-prediction2/index.html` renders `شانس برآوردشده:` twice in the model-choice result block. It appears whenever the guessed word is rejected and the model choice is shown.
- **Proposed solution:** Remove the duplicate `<strong>` and add a small DOM assertion for both result branches: accepted user guess and model-selected replacement.

## P2 — Finish the 44px touch-target migration

- **Problem:** The mobile audit found active controls smaller than the cleanup plan's 44px target. Examples include 32px-high `Dimensions` view buttons, 34px-high `word-in-space` word tiles, 28–38px-wide/34px-high controls in `wordembedding`, 36px-wide chat clear buttons, and narrow tokens in `attention` and `word-in-line`.
- **Proposed solution:** Apply `min-inline-size` and `min-block-size` of 44px to icon buttons and interactive tiles, or provide an equivalent 44px hit area without changing the visual chip size. Add a browser assertion that reports visible interactive elements whose hit boxes are below the project threshold.

## P2 — Reconcile the cleanup plan with the implementation and CI state

- **Problem:** `CLEANUP_PLAN.md` has conflicting status sources. Its newer summary marks contextual dragging, dimensionality loading/motion, model-lab cleanup, seeded random generation, backend timeout tests, and README refresh complete, while the individual table/backend text still calls those items partial or remaining. It also says browser execution is unavailable and current checks pass, despite Chrome now being available and the GitHub pre-commit job failing.
- **Proposed solution:** Make one section authoritative, update the stale rows from the corresponding commits, retain only the two genuine embedding refactors as partial, and replace the old browser limitation with repeatable desktop/mobile smoke-test instructions. Add a lightweight Chromium smoke job after the workflow path issue is fixed so these responsive regressions are caught in CI.
