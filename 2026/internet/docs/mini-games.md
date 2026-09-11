# Mini-game design and development guide

This guide defines how to create, split, restyle, and refactor mini-games for the
Rasta Internet Workshop. It applies to new simulations, single-file HTML prototypes,
and existing multi-file games.

Mini-games are small, student-facing interactive systems. They may be exploratory
simulations, goal-oriented games or puzzles, or a hybrid of both. Their job is to make
an idea visible and manipulable so students can form a hypothesis, try it, and observe
the consequences. They are not illustrated lectures, and completing one does not
replace mentor acceptance of the workshop step.

## Product purpose

Each mini-game should give students a focused system to explore or master:

1. A concept is represented spatially, over time, or through a visible state change.
2. Students directly manipulate the variables and objects that define the problem.
3. The game responds promptly and makes consequences easy to compare.
4. Students use their observations and attempts to discuss and propose an
   explanation or strategy.

The interaction may expose a contradiction, ambiguity, trade-off, edge case, or
failure mode. It must not reveal the intended conceptual solution, the workshop
step's mentor-only acceptance criteria, official term, or final explanation before
mentor acceptance. A puzzle's own operational goal and rules should be visible. The
mentor remains the human acceptance gate.

A puzzle may set an explicit operational goal, such as scheduling message
transmissions to minimize delay, keeping congestion below a limit, routing around
failures, or encoding data within a budget. It may expose several adjustable
variables and may be deliberately difficult to beat. It may also calculate a score,
show whether the operational target was reached, and let students compare attempts.
That feedback evaluates the state of the puzzle, not whether students understand the
step's key insight; conceptual acceptance still belongs to the mentor.

Difficulty is useful when it comes from interacting constraints, trade-offs, and the
concept being taught. Do not manufacture difficulty through unclear rules, awkward
controls, slow animations, excessive typing, hidden state, or destructive resets.

The interactive explanations in [Bartosz Ciechanowski's GPS
article](https://ciechanow.ski/gps/) are a useful reference: they turn abstract
relationships into objects that can be dragged, animated, and compared. Workshop
games should usually be more compact than a full article demo, but they do not need
to be more minimal than those individual simulations. A small amount of contextual
text or a short hint is welcome when the interaction would otherwise be unclear.

Before implementation, be able to answer these questions:

- What concept should become visible?
- What can students change?
- What consequence should they notice?
- Is this primarily an open simulation, a puzzle with an objective, or a hybrid?
- If it is a puzzle, what goal, constraints, score, and retry loop should be visible?
- What insight must the game deliberately avoid stating?
- What should remain for the group to explain to the mentor?

If those answers are unclear, improve the learning interaction before polishing the
interface.

## Interaction principles

- Prefer direct manipulation: drag a node, move a slider, toggle a connection, place
  an item, or scrub time.
- Keep the system itself visually dominant. A complex puzzle may need several
  controls, variables, status indicators, or planning tools; organize them around the
  play area instead of imposing an arbitrary limit.
- Use the fewest interface elements that preserve the intended strategy space. Do not
  remove a meaningful variable merely to make the page look sparse. Remove
  decorative, duplicate, and rarely useful actions.
- Avoid typing. If a constrained choice, draggable object, slider, or tap can express
  the same idea, do not use a text field.
- Do not require instructions to be memorized before interaction. Put a very short
  cue next to the relevant object or reveal it only when needed.
- Give immediate, reversible feedback. Students should be able to try again quickly
  without a reset ceremony.
- Preserve the current attempt after an unsuccessful outcome. Do not wipe student
  work merely because a state is incomplete or problematic.
- In an exploratory simulation, prefer showing consequences over displaying
  “correct” or “wrong.” A puzzle may clearly show success, failure, score, or distance
  from its stated operational goal, while avoiding disclosure of the intended
  strategy or a step's conceptual answer.
- Let students inspect, revise, replay, and compare difficult attempts. If an optimal
  solution exists, do not reveal it before the learning design calls for it.
- Keep the game usable by touch, mouse, and keyboard where the interaction permits.
  Do not hide essential behavior behind hover.
- Color must not be the only carrier of meaning. Pair it with position, shape,
  motion, pattern, a compact symbol, or a short label.

Use p5.js when a canvas, continuous animation, particle system, geometry, or custom
drag interaction is materially simpler with it. Plain DOM, SVG, or Canvas APIs are
often better for small discrete systems. If p5.js is used, install it as a local npm
dependency and import it through Vite; do not depend on a CDN being reachable during
the workshop.

## Language and terminology

All student-visible mini-game language must be Persian. This includes page titles,
headings, instructions, buttons, labels, scores, status messages, errors, hints,
tooltips, empty states, image alternatives, canvas fallbacks, and accessibility names.
Do not leave English placeholder copy or untranslated library-generated UI in the
finished game.

Use an English word only when it is specific networking terminology with no common,
natural Persian equivalent for these students. Prefer the established Persian term
whenever one exists; do not use English merely because it is common in source code or
technical documentation. For example:

| Avoid in student UI | Use |
|---|---|
| `packet` | `بسته` |
| `message` | `پیام` |
| `routing` | `مسیریابی` |

Terms such as `switch` may remain when the workshop's content treats them as the
specific technical name and no equally common Persian equivalent is expected. Match
the vocabulary already used in the relevant step so the game and surrounding page do
not name the same concept differently.

English remains appropriate inside source code, filenames, package metadata, and
developer-only diagnostics. Protocol names, acronyms, addresses, formulas, code, and
other inherently Latin fragments may also remain Latin, but isolate them as LTR so
they do not disrupt Persian punctuation and reading order.

Standard scientific and technical symbols are not English interface copy and should
keep their conventional Latin form. Do not translate or transliterate symbols such as
`V` for voltage, `s` or `ms` for time, `Hz`, `bps`, or variable names used in a
formula. Add a short Persian label when context is needed—for example `ولتاژ (V)` or
`زمان (s)`—and keep the Latin fragment LTR.

## Look and feel

The interface should feel bright, modest, clean, and precise.

- Use a light, near-white background. A faint warm paper tone is preferred to pure
  white, but it must be noticeably lighter and less saturated than the event poster.
- Use only two to four colors in one game, including the background and primary text
  color. Opacity and lighter/darker values of those colors are allowed; introducing a
  new hue is not.
- Choose one bright-but-desaturated theme color for the main interactive state and,
  only when it conveys a separate meaning, one secondary accent.
- Use square corners for panels, controls, cards, and buttons (`border-radius: 0`). A
  circle is still appropriate when it represents a concept such as a node, radio
  wave, range, clock, or packet endpoint; it should not become generic UI decoration.
- Prefer thin rules, spacing, and contrast over card-heavy layouts, shadows, bevels,
  gradients, or ornamental frames.
- Keep labels short and follow the Persian terminology rules above. Set the page to
  `lang="fa"` and `dir="rtl"`; isolate code, addresses, bit strings, and formulas as
  LTR where necessary.
- Make the simulation responsive inside the workshop iframe and in fullscreen. It
  must also work as a standalone page.

### Event palette

The event website and the artwork in `temp/` use Persian poster and tile references
with warm paper, crimson, gold, navy, sky blue, turquoise, and deep green. The event
site currently exposes these source colors:

| Source role | Source color |
|---|---|
| Paper | `#FBF3DF` |
| Deep paper | `#F3E7CA` |
| Ink | `#2C2318` |
| Soft ink | `#6B5D4A` |
| Crimson | `#A6161C` |
| Deep crimson | `#6E0F14` |
| Gold | `#E0A31E` |
| Navy | `#16243F` |
| Sky | `#93C2DC` |

These are source references, not a palette to copy wholesale into every game. Start
with one of these quieter sets and adjust contrast only when needed:

| Set | Background | Ink | Primary | Optional accent |
|---|---|---|---|---|
| Warm | `#FCFAF4` | `#332F2A` | `#9B6264` | `#C1A564` |
| Turquoise | `#FCFAF4` | `#283438` | `#639AA3` | `#6F8876` |
| Navy and sky | `#FCFAF4` | `#29364F` | `#7FA8B8` | `#B8A06A` |

Use one row per game, not all three. In a simple game, background + ink + primary is
usually enough. Reuse the same hue with opacity, hatching, or stroke weight for extra
states rather than adding more colors. Verify text and controls have readable
contrast.

### Motion

- Animate state changes so cause and effect are legible, not merely for decoration.
- Keep control feedback immediate. Most UI transitions should finish in roughly
  120–250 ms; never make a student wait for an animation before trying the next idea.
- Continuous simulation motion may run longer when time or movement is the concept,
  but provide pause, reset, or scrubbing when it helps comparison.
- Avoid layout jumps, long entrances, repeated attention-seeking motion, and effects
  that obscure the object being manipulated.
- Respect `prefers-reduced-motion` and provide a clear static state when animation is
  reduced.

## Repository location and automatic inclusion

Put each independent game project in:

```text
games/<project-name>/
```

Use a lowercase kebab-case project name. Every new game, including a vanilla
HTML/CSS/JavaScript game, must use Vite so built asset filenames are content-hashed.
Commit both `package.json` and `package-lock.json`. The minimum scripts are:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^8.0.13"
  }
}
```

Keep the Vite version aligned with the other game projects when the repository
upgrades it.

Set Vite's base to a relative path:

```js
import {defineConfig} from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

The repository handles inclusion automatically:

1. `npm run dev` and `npm run build` run `scripts/prepare-site.js` first.
2. The preparer finds each `games/*/package.json` with a `build` script, installs its
   locked dependencies, and runs its build.
3. The game must produce `dist/index.html`. The complete `dist/` directory is copied
   to `site/public/games/<project-name>/`.
4. Every nested `index.html` entry receives a short content version in the staged
   site, so step iframes load a fresh entry page after changes. Vite supplies hashed
   filenames for CSS, JavaScript, and imported assets.
5. The workshop home page automatically lists one item per top-level game project.
   Its label comes from the root page's `<title>`, and it opens
   `/games/<project-name>/index.html`.

Do not edit or commit `site/public/games/` or `site/dist/`; both are generated.

To embed a game in imported step content, place a standalone Google Docs link using
the authoring hostname `games`:

```text
http://games/<project-name>
http://games/<project-name>/<version-name>
```

The importer converts these into iframes ending in `index.html`. The hostname is only
an authoring convention; no request is sent to it. In committed Markdown, the
equivalent iframe entry is:

```html
<iframe class="mini-game"
  src="../../games/<project-name>/<version-name>/index.html"
  title="A specific Persian title"
  loading="lazy"
  allowfullscreen></iframe>
```

Use the root project path in a step only for a genuinely single-page game. For a
multi-version project, steps must link directly to one version.

## Multiple versions or related simulations

“Version” means any variant that should appear independently in a step: a different
stage, rule set, dataset, difficulty, or visualization of a shared concept.

Never combine these versions into one large `index.html` with internal modes. Give
each version its own URL and page while sharing code through modules and styles:

```text
games/<project-name>/
├── index.html                 # hub; linked only from the workshop home page
├── home.css
├── shared/
│   ├── simulation.js
│   └── game.css
├── <version-a>/
│   ├── index.html
│   └── main.js
├── <version-b>/
│   ├── index.html
│   └── main.js
├── package.json
├── package-lock.json
└── vite.config.js
```

The root `index.html` is a small hub for discovering all versions from the workshop
home page. It may link to every version. It is not a game screen and must not be
embedded in step pages.

Each version page is intentionally isolated:

- It must not contain “home,” “back to games,” next/previous version, breadcrumbs, or
  any other route to the hub or sibling versions.
- It must work when loaded directly in a step iframe.
- It should contain only the interaction and the minimal context needed for that
  step.
- Shared source code is encouraged; shared navigation is not.

Register the root hub and every version page as Vite build inputs:

```js
import {resolve} from 'node:path'
import {defineConfig} from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        versionA: resolve(import.meta.dirname, 'version-a/index.html'),
        versionB: resolve(import.meta.dirname, 'version-b/index.html'),
      },
    },
  },
})
```

The build must retain this structure:

```text
dist/
├── index.html
├── version-a/index.html
└── version-b/index.html
```

Links from the root hub must be relative and explicitly end in `index.html`:

```html
<a href="./version-a/index.html">…</a>
```

Do not use `/version-a/`, `./version-a/`, or root-relative asset paths. The workshop
may be deployed under a GitHub Pages base path, and directory-index behavior differs
between servers.

## Refactoring an existing game

Large HTML files and existing games are inputs, not exceptions to this guide. Preserve
their useful behavior while bringing their structure and experience into the same
system.

1. Run or inspect the current game and list its distinct student-facing versions,
   interactions, goals, constraints, scoring, inputs, outputs, and important state
   transitions.
2. Separate independent versions into `<version>/index.html` pages. Do not preserve a
   monolithic mode switch merely because the source arrived as one HTML file.
3. Extract inline CSS and JavaScript into focused files. Put only genuinely shared
   behavior in `shared/`; keep version-specific setup close to its page.
4. Add Vite, a lockfile, relative imports, and all HTML build inputs. Replace remote
   runtime dependencies with installed packages where practical.
5. Restyle the game using the interaction and visual rules above. Remove unnecessary
   controls and typing while preserving the simulation or puzzle's conceptual and
   strategic range.
6. Remove navigation from every version page. Create or simplify the root hub for the
   workshop home page.
7. Check that the refactor does not mistake a mechanical score or win state for
   conceptual grading, or expose the intended insight.

Do not rewrite working simulation logic solely to adopt a framework. Vanilla modules
inside Vite are the default when they are sufficient.

## Completion checklist

Before considering a game complete:

- The game visualizes a concept and lets students explore it, solve a related puzzle,
  or both.
- A puzzle has understandable goals, constraints, feedback, and a fast retry loop;
  its difficulty comes from reasoning rather than interface friction.
- The game does not state the intended conceptual solution or replace mentor
  acceptance. A mechanical win state or score is allowed.
- The interaction avoids unnecessary text, elements, typing, and controls without
  removing variables or tools required by the intended challenge.
- The game uses one near-white background and no more than three additional colors.
- UI edges are square; motion is smooth, fast, purposeful, and reduced-motion safe.
- All student-visible and accessibility copy is Persian, except unavoidable specialist
  terms and conventional Latin symbols; common words use the same Persian equivalents
  as the relevant step.
- RTL layout, LTR fragments, touch behavior, keyboard behavior, and narrow layouts
  have been checked.
- `npm run build` succeeds inside the game project.
- `dist/index.html` exists.
- For multiple versions, every `dist/<version>/index.html` exists and was registered
  as a Vite input.
- The hub links use `./<version>/index.html`, while version pages contain no links to
  the hub or other versions.
- All imports and assets work from the final nested `/games/<project-name>/.../`
  location, not only from Vite's dev server.
- The repository-level `npm test` and `npm run build` succeed.
