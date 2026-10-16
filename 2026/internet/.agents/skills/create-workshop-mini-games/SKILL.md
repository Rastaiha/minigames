---
name: create-workshop-mini-games
description: >-
  Create, split, restyle, or refactor student-facing simulations, games, and puzzles
  for the Rasta Internet Workshop using its Persian RTL, discovery-learning, visual,
  Vite, and multi-page conventions.
---

# Create Workshop Mini-games

Before changing a game, read:

- [`docs/mini-games.md`](../../../docs/mini-games.md) for the product, interaction,
  visual, architecture, and verification contract.
- `## قراردادن بازی‌ها` in
  [`docs/development.md`](../../../docs/development.md) for publishing details.
- [`docs/workshop-rendering-brief.md`](../../../docs/workshop-rendering-brief.md) and
  [`docs/step-template.md`](../../../docs/step-template.md) only when the game is tied
  to a workshop step or learning progression.

## Design the interaction

Define the concept, what students may change, what consequences they can observe, and
what insight must remain unstated. A puzzle may expose goals, constraints, scores, and
mechanical success, but the mentor remains the conceptual acceptance gate.

Favor direct, reversible manipulation and prompt feedback. Preserve work after failed
or incomplete attempts. Keep meaningful variables and planning tools; remove only
accidental complexity. Do not reveal mentor content, intended strategy, official
answer, or final explanation.

## Build the game

- Put the project in `games/<project-name>/` and use Vite with a committed lockfile,
  relative base, local dependencies, and `dist/index.html` output.
- For multiple versions, create a root hub plus one `<version>/index.html` per version,
  register every HTML input, preserve every nested path in `dist/`, and use explicit
  relative links ending in `index.html`.
- Share modules, not navigation. Embedded version pages must not link to the hub or
  sibling versions.
- Preserve useful behavior when refactoring; do not add a framework without a
  concrete need.

## Apply the student UI contract

Do not render a visible title or static introduction above a game. Make the initial
state and affordances explain how to begin. Use Persian for all student-visible and
accessibility copy, match the terminology of the relevant step, set RTL direction,
and load Vazirmatn locally. Keep standard Latin technical symbols and isolate LTR
fragments.

Use the exact finalized palette in `docs/mini-games.md`. Default to crimson, gold,
turquoise, and green; add violet only when five simultaneous categories are needed.
Keep every color's meaning stable and pair it with a non-color cue.

Preserve the specified turquoise and green base values and their lightness contrast.
Never distinguish those categories with their pale surfaces alone or shift the hues
toward each other. When both appear, inspect them together under color-vision
simulation and on a low-contrast projector.

Use warm foundation surfaces for layout. A functional tint belongs only to a region
with that meaning. Keep adjacent regions visibly distinct, use restrained halos and
outlines for active states, and keep the system readable in the iframe, fullscreen,
on narrow screens, and with reduced motion.

## Verify

Build every page and confirm the required `dist/**/index.html` files, relative imports,
assets, and links. Exercise the interaction and retry loop; confirm student work is
preserved and mentor-only or final-answer content is absent. Check Persian copy,
Vazirmatn, color mappings—especially turquoise versus green—foreground contrast,
touch, keyboard, responsive layout, and reduced motion. Then run the repository tests
and build, and report the changed paths and observed results.
