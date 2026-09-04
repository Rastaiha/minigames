# Project instructions

## Required context

Before changing the step renderer, student UI, mentor UI, content parser,
or progression system, read:

- `docs/workshop-rendering-brief.md`
- `docs/step-template.md`

Treat these files as the product and content-model specification.

Before creating or changing a game, read `## قراردادن بازی‌ها` in
`docs/development.md`, including the multi-page game checklist.

## Core invariants

- The application is Persian-first and RTL.
- Content under «صفحه‌ای که دانش‌آموز می‌بینه» is student-facing.
- Content under «پشت‌صحنهٔ منتور» must never be exposed to students.
- Blockquotes marked with `🟨` are authoring guidance and are not runtime content.
- Interactive tools must let students test their own ideas without revealing
  the intended solution prematurely.
- The mentor is the human acceptance gate; do not replace mentor approval with
  automatic grading.
- Preserve student work across rejected attempts.
- Only reveal the final explanation after mentor acceptance.
- Game-to-game links must be relative and explicitly end in `index.html`.
- A built multi-page game must retain `dist/index.html` and every nested page's
  `dist/<page>/index.html`; register all of them as build inputs.
