# Mini-game design and development guide

This is the product and implementation contract for student-facing workshop
mini-games. Publishing details live in `## قراردادن بازی‌ها` in
[`docs/development.md`](development.md).

## Learning contract

A mini-game is a focused simulation, puzzle, or hybrid that makes a networking idea
visible and manipulable. Students should form a hypothesis, try it, and observe the
consequences.

- Do not reveal the intended insight, official solution, mentor hints, acceptance
  criteria, or final explanation.
- A score or win state may evaluate the puzzle, but only the mentor accepts conceptual
  understanding.
- Preserve student work after incomplete or unsuccessful attempts.
- Make difficulty come from the concept and its trade-offs, not hidden state, unclear
  rules, slow feedback, excessive typing, or awkward controls.
- Prefer direct, reversible manipulation and prompt visual feedback. Keep every
  variable or planning tool that contributes to the intended strategy space.
- Do not place a visible title or static explanatory introduction above a game. The
  initial state, affordances, labels, constraints, motion, and feedback should explain
  how to begin. Keep an HTML `<title>` for metadata.
- Short contextual labels, changing status text, and just-in-time hints are allowed
  when the interaction would otherwise be unclear.
- Pair color with a label, shape, position, pattern, line style, symbol, or motion so
  color is never the only carrier of meaning.

The root page of a multi-page project is a discovery hub rather than a game screen,
so it may name the collection. Embedded game pages must not link to the hub, sibling
games, or next/previous pages.

## Student UI

- Use Persian for every student-visible string, including metadata, controls,
  feedback, scores, errors, hints, tooltips, fallbacks, alternative text, and
  accessibility names.
- Prefer `بسته`, `پیام`, and `مسیریابی` over `packet`, `message`, and `routing`.
  Keep a specialist English term only when the relevant workshop step uses it and no
  common Persian equivalent is suitable.
- Keep standard Latin protocol names, formulas, addresses, variables, and units such
  as `V`, `s`, `ms`, `Hz`, and `bps`; isolate mixed-direction fragments as LTR.
- Set `lang="fa"` and `dir="rtl"`. Use Vazirmatn for Persian DOM, SVG, and Canvas text
  and load it locally through Vite. Wait for the font before measuring Canvas text.
- Support the workshop iframe, fullscreen, narrow screens, touch, mouse, and
  reasonable keyboard operation. Essential behavior must not depend on hover.
- Animate cause and effect without delaying interaction and respect
  `prefers-reduced-motion`.

## Visual system

Use the following finalized values. Foundation colors do not count toward the four or
five functional colors.

| Foundation role | Color | Use |
|---|---|---|
| Canvas | `#FCFAF4` | Main page and play field |
| Paper | `#FBF3DF` | Secondary region |
| Deep paper | `#F3E7CA` | Stronger adjacent region |
| Ink | `#2C2318` | Primary text and neutral structure |
| Soft ink | `#6B5D4A` | Secondary text and subdued structure |

| Functional role | Base | Soft surface | Text on base |
|---|---|---|---|
| Crimson | `#B82A31` | `#F9E9E9` | White |
| Gold | `#E8B33A` | `#FFF4D8` | Ink |
| Turquoise | `#35AFB8` | `#E5F6F6` | Ink |
| Green | `#185A3A` | `#E7F3EC` | White |
| Violet, optional fifth | `#7A4E9D` | `#F1EAF5` | White |

Use crimson, gold, turquoise, and green by default. Add violet only when five
simultaneous functional categories are genuinely necessary. Give each color one
stable meaning within a game and use the listed foreground on a solid base; use ink
on every soft surface.

### Contrast requirements

- Keep the exact base values. Do not darken turquoise or lighten green: their
  lightness separation is intentional.
- Turquoise and green bases provide at least `3:1` contrast against each other. When
  they touch or encode similar objects, use the bases or a base-colored marker, line,
  or edge—not their pale surfaces alone.
- Turquoise and green soft surfaces are not sufficiently distinct to be the sole cue.
  Separate them with ink or canvas, and add a label, shape, pattern, or position cue.
- Check all color mappings in a color-vision-deficiency simulation and at the actual
  iframe size on a low-contrast display or projector.
- Verify WCAG AA for text against its actual background. Do not infer readability
  from the palette name.

### Surfaces and emphasis

- Build large backgrounds from canvas, paper, and deep paper. Use a functional soft
  surface only when the whole region carries that color's meaning; never use it as
  unrelated decoration.
- Adjacent regions must differ visibly in hue or lightness. Spacing and a thin rule
  may reinforce the boundary; a shadow alone is insufficient.
- Prefer a soft tint or translucent halo plus one modest outline for hover, focus,
  selection, and active states. Avoid stacked thick outlines and oversized frames.
- Use small corner radii for rectangular controls and interactive objects. Avoid pill
  shapes unless the represented object is naturally pill-shaped.
- Prefer thin structure and spacing over card-heavy layouts, gradients, bevels,
  ornamental frames, and strong shadows.

## Project shape

Put each project in `games/<project-name>/` using a lowercase kebab-case name.

- Use Vite, including for vanilla HTML/CSS/JavaScript.
- Commit `package.json` and `package-lock.json`; include `dev`, `build`, and `preview`
  scripts.
- Set Vite's `base` to `./` and build to `dist/`. A game must produce
  `dist/index.html`.
- Install runtime dependencies locally. Do not rely on a CDN during the workshop.
- Use p5.js only when its Canvas and animation model materially simplifies the game.
- Do not edit or commit generated files under `site/public/games/` or `site/dist/`.

### Multiple pages

Use one root `index.html` hub and one `<version>/index.html` per independently embedded
version. Share logic and styles through modules rather than combining versions as
modes inside one page.

- Register the root and every nested HTML file in `build.rollupOptions.input`.
- Preserve `dist/index.html` and every `dist/<version>/index.html`.
- Link from the hub with an explicit relative target such as
  `./<version>/index.html`.
- Keep version pages isolated: no hub, sibling, breadcrumb, home, or next/previous
  navigation.
- Use relative imports and assets that work from the final nested path.

## Step integration

In Google Docs content, use:

```text
http://games/<project-name>
http://games/<project-name>/<version-name>
```

The importer converts these authoring links to versioned iframes. Use the root path
only for a single-page game; a multi-page step must target a version directly. In
committed Markdown, use a relative iframe source ending explicitly in `index.html`.

## Existing games

When refactoring an existing game:

1. Inventory its versions, interactions, inputs, outputs, goals, constraints, scoring,
   and important state transitions.
2. Preserve useful behavior while separating independently embedded versions and
   extracting shared code.
3. Add the required Vite build shape and apply this interaction, language, and visual
   contract. Do not introduce a framework without a concrete need.
4. Confirm that the refactor does not expose the intended insight or turn mechanical
   success into conceptual grading.

## Verification

Before finishing:

- Exercise the initial state, success/failure feedback, retry loop, and preservation
  of student work.
- Confirm there is no visible title, static introduction, premature solution, or
  mentor-only information.
- Search student-visible and accessibility strings for accidental English and confirm
  Persian text uses locally loaded Vazirmatn.
- Confirm colors use the exact palette, keep stable meanings, and have non-color cues.
- Specifically inspect turquoise and green together; preserve their base-value
  separation and never distinguish them only with pale surfaces.
- Check foreground contrast, adjacent regions, iframe size, narrow layout, touch,
  keyboard operation, reduced motion, and a low-contrast projector view.
- Run the game build and confirm every required `dist/**/index.html` exists.
- Test imports, assets, and explicit `index.html` links from the final nested paths.
- Run the repository tests and build.
