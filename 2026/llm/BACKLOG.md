# LLM minigames backlog

No open audit issues remain after the 2026-09-15 fix and re-audit cycle. The archived `bpe-tree` game is intentionally excluded. The two larger embedding refactors that are still planned are tracked as partial work in `CLEANUP_PLAN.md`, not as regressions from this audit.

## Resolved in the post-audit fix

### GitHub checks workflow

- **Original problem:** Pre-commit launched local hooks from the Git root, while their npm package and scripts live under `2026/llm/`.
- **Resolution:** Hook commands now use root-independent `2026/llm` paths. The GitHub workflow also runs the Chromium smoke suite after repository and pre-commit checks.

### Transformer mobile overlap

- **Original problem:** At 390 × 844, the reset button covered the input poem in both Transformer pages.
- **Resolution:** The three mobile controls now remain in one responsive row. Automated checks confirm zero toolbar/poem overlap at 320px, 390px, and 560px.

### `word-embedding` mobile hub clipping

- **Original problem:** Centering overflowing flex content placed the heading above the reachable scroll area.
- **Resolution:** Safe flex spacing centers the hub only when room exists and starts it at the top when it overflows. The smoke test checks the heading and reset action at 320 × 568 and 390 × 844.

### Contextual embedding mobile canvas

- **Original problem:** A fixed 280px sidebar left only 110px for the placement canvas on a 390px viewport.
- **Resolution:** Mobile now uses a full-width canvas above a compact, scrollable word tray. Responsive geometry and keyboard placement are covered at short and standard mobile sizes.

### 44px touch targets

- **Original problem:** Controls in Dimensions, chat composers, jailbreak, placement games, attention, and the older embedding page fell below the 44px project target.
- **Resolution:** Shared and page-specific minimum hit areas now cover buttons, interactive tiles, selectors, ranges, and composer fields. The browser suite rejects any visible mobile control below 44 × 44px; its first follow-up run found additional 40–42px chat/jailbreak controls, which were fixed before the clean pass.

### Cleanup-plan drift

- **Original problem:** The summary, game table, backend section, browser limitation, and CI status contradicted one another.
- **Resolution:** `CLEANUP_PLAN.md` now has one synchronized status, records current backend/browser coverage, and leaves only the two genuine embedding refactors marked partial.

### Game fixture tests omitted from the root quality gate

- **Original problem:** Six existing game fixture files (13 tests) passed when invoked directly but were not included in the root `npm run check`, so CI only exercised the Worker contract tests.
- **Resolution:** The root package now exposes `test:games` and runs it before `test:worker`, keeping the deterministic generator, learning logic, placement schemas, touch interaction, and word-world data checks in the required CI path.

## Audit correction

The initial audit incorrectly reported a duplicate probability label in `next-token-prediction2`. Source review confirmed that the two identical labels belong to mutually exclusive user-guess and model-choice result panels. No product change was appropriate.

## Verification

- All 24 active pages pass the browser smoke suite at desktop and mobile viewports.
- Targeted Transformer, `word-embedding`, and contextual-embedding responsive assertions pass.
- The second full automated pass and fresh manual screenshot review found no further actionable UI regression.
- Repository checks, all 13 game tests, all 12 Worker contract tests, and root-level pre-commit hooks pass locally.
