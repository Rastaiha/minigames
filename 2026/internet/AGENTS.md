# Project instructions

## Required context

Before changing the step renderer, student UI, mentor UI, content parser,
or progression system, read:

- `docs/workshop-rendering-brief.md`
- `docs/step-template.md`

Treat these files as the product and content-model specification.

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