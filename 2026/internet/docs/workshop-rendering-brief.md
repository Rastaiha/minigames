## Handoff brief for the web-rendering agent

You are building a system that turns filled instances of `step-template.md` into interactive Persian web pages for a high-school workshop.

### Workshop overview

The workshop is called «اینترنت چطور کار می‌کند؟» and lasts roughly three hours. It teaches simplified computer-networking ideas through problem-solving rather than lectures or presentations.

Students work in groups of about three. Each group has a mentor. The workshop consists of a sequence of «گام‌ها» (steps), where each گام is a web page that may contain:

- Conversational Persian text
- Images, diagrams, or videos
- Physical activity instructions
- Questions and design problems
- Simulations, minigames, or other interactive tools
- A point where students call their mentor and present a solution

Different topics—encoding, framing, addressing, routing, etc.—may contain multiple گام‌ها.

### Instructional philosophy

Each topic is designed as a “failure ladder”:

1. Students encounter a problem.
2. They propose a natural solution.
3. They test it.
4. A limitation or counterexample becomes visible.
5. They revise their solution.
6. Eventually they independently reach an important insight.

A گام groups one or more consecutive rungs of this ladder. It should normally end at a stable, explainable result that a mentor can check.

The central principle is:

> The page creates the path to discovery, but does not reveal the discovery in advance.

The interactive page must not behave like a graphical lecture or a quiz that teaches the official answer. It should let students propose and test their own ideas. Feedback should expose consequences, contradictions, edge cases, or ambiguity—not simply say what the correct solution is.

### Student–mentor loop

Every گام follows this loop:

1. Students read the page and interact with its materials.
2. They discuss the problem and try different ideas.
3. They can ask their mentor questions, but the mentor should not reveal the main insight prematurely.
4. Once they have a solution, they call the mentor and present or demonstrate it.
5. If the mentor rejects it, students may receive one controlled hint and return to the problem.
6. If the mentor accepts it, the mentor gives a short final explanation:
   - Connects the students’ solution to the step’s key insight
   - Gives the official or real-world name of the idea
   - Explains its real networking equivalent
   - May add an interesting fact
7. Students proceed to the next گام.

The mentor is therefore a human gate. The website should assist this flow, not replace the mentor with automatic grading.

### The “key insight”

Each گام has a «نکتهٔ کلیدی», similar to an `aha moment`.

It is a claim or belief students should leave with—not merely the question they were asked.

For example:

- Problem: «چرا مسیرهای ایستا با تغییر شبکه مشکل دارن؟»
- Key insight: «مسیرهای ایستا برای شبکهٔ ثابت جواب می‌دن، ولی نمی‌تونن خودکار به تغییر واکنش نشون بدن.»

Sometimes the insight concerns a solution. Sometimes it concerns the existence or nature of a failure mode.

The key insight is mentor-only until students have completed the intended discovery.

## Understanding `step-template.md`

The template contains three major regions.

### 1. Authoring guidance

Yellow blockquotes beginning with `🟨` are instructions for the people writing the گام.

They are not runtime content and must not appear in the student or mentor application.

This includes:

- Definition of a گام
- Explanation of the student–mentor loop
- Instructions about writing each section
- The sample content about mathematical order of operations

The sample topic exists only to demonstrate how the template should be filled. Do not render sample content if it remains in an actual filled document accidentally.

### 2. Mentor-only content

There are two top-level headings beginning with:

- `# 🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام`
- `# 🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن`

Everything under these headings is confidential mentor material. Students must not be able to reveal it through the normal student interface, page source shortcuts, hidden DOM elements, accessibility text, or client-side state.

The first mentor section is a compact cheat sheet containing:

- What students already know when entering
- What they should understand by the end
- The thought and intended path behind the گام
- Expected time and timing notes

It should be quickly readable when a student group first calls the mentor.

The second mentor section contains:

- Common wrong turns
- What each wrong turn may indicate
- Suggested mentor response
- Productive struggle that should be allowed to continue
- A tiered hint ladder
- Information that must not be revealed early
- What students must demonstrate for acceptance
- The final mentor explanation

The final explanation is only used after acceptance.

### 3. Student-facing content

Everything under:

`# 🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه`

is intended for the student page, except yellow `🟨` authoring guidance.

The student content does not have a rigid fixed schema. A filled step may contain:

- A memorable title
- A narrative hook
- Minimal prerequisite information
- One or more missions or questions
- Interleaved text, images, videos, and interactions
- Several rounds of observation and experimentation
- A final “call your mentor” instruction

Headings inside this area are genuine student-facing headings.

The current sample demonstrates a useful rhythm:

1. Playful or intriguing setup
2. A visible disagreement or problem
3. Only the information needed to begin
4. An open mission
5. Test cases or adversarial examples
6. An interaction that evaluates the students’ proposed rule
7. A clear point for calling the mentor

Do not assume every filled گام uses exactly these headings or this order.

## Rendering requirements

### Language and direction

- The application is primarily Persian and must use `dir="rtl"`.
- The writing style is friendly, direct, and conversational—not academic or bureaucratic.
- Mathematical expressions, code, IP addresses, bit strings, English technical terms, and formulas may require isolated LTR rendering.
- Mixed RTL/LTR punctuation needs careful testing.
- Use a legible Persian UI font with strong numeral and Latin-character support.

### Student experience

- Keep text in short, readable chunks.
- Alternate explanation with observation, discussion, or action.
- Avoid long lecture-like walls of text.
- Images should clarify structure, comparison, change, or consequences—not merely decorate.
- Support image, video, diagram, downloadable material, and physical-prop placeholders.
- Preserve the playful titles and scenarios written by the authors.
- Clearly indicate when students should call their mentor and what they should be ready to present.
- Do not reveal acceptance criteria, hints, answers, official terminology, or final explanations.

### Interactive tools

Interactions vary by گام. The renderer should support embedded custom components rather than expecting a single question type.

Possible interactions include:

- Manipulating a simulated network
- Constructing an encoding rule
- Moving cards or graph nodes
- Editing tables
- Sending packets through a topology
- Running an algorithm round by round
- Testing a proposal against adversarial cases
- Observing failure after a topology change
- Small games or physical-activity companions

An interaction should generally expose what happens when students apply their idea. It should not silently replace their idea with the official algorithm.

Neutral feedback is preferable:

- “These two receivers produced different outputs.”
- “This route has not stabilized after 15 rounds.”
- “This bit sequence was decoded incorrectly.”

Avoid prematurely revealing labels such as “routing loop,” “count to infinity,” or “Manchester encoding.” Official names often belong in the mentor’s final explanation after discovery.

Not every گام needs a digital interaction. A legitimate گام may rely on text, images, physical materials, discussion, or a handwritten design.

### Mentor experience

A mentor view should prioritize speed:

1. Compact cheat sheet
2. Common wrong turns
3. Productive struggle
4. Hint ladder
5. Acceptance criterion
6. Final explanation

Useful controls could include:

- Record that a group requested help
- Reveal one hint at a time to the mentor
- Mark the proposal rejected or accepted
- Record brief notes
- Unlock or mark the next گام after acceptance

These controls should support the human decision, not automate it.

### State and progression

- A student group may make several attempts before acceptance.
- Preserve their work between attempts.
- A گام may carry an artifact into the next one: a table, topology, encoding rule, converged state, or design.
- The output of one گام should be available to the next when the filled documents specify such continuity.
- The next گام introduces its own problem; the previous page does not need an artificial narrative teaser.

### Parsing cautions

Do not rely solely on visual Markdown styling.

Use these structural signals:

- Top-level audience headings determine student versus mentor content.
- Yellow `🟨` blockquotes are authoring guidance and should be removed.
- Markdown headings under the student region are runtime headings.
- Markdown tables in mentor sections often encode common mistakes and responses.
- Bracketed notes such as `[تصویر: ...]` or `[ابزار: ...]` are production specifications, not necessarily literal text to show students.
- Italics are currently used for sample/fillable content in the template, but a filled document may legitimately use italics. Do not remove all italic content automatically.
- Authors may add or rename student-facing subsections, so the student renderer should remain flexible.

### Quality bar

The final experience should feel like a guided scientific-engineering investigation:

- Playful but not childish
- Clear without overexplaining
- Interactive without becoming a superficial game
- Visually engaging without distracting from the problem
- Structured enough that students know what to do
- Open enough that the solution still feels like theirs
- Designed around human mentor interaction, not automated completion

The source of truth for the current structure is [step-template.md](./templates/step-template.md).