import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractStudentTitle,
  splitAndNormalizeStep,
  stringifyMdast,
} from '../scripts/lib/normalize-step.js'

const text = (value) => ({type: 'text', value})
const heading = (value) => ({type: 'heading', depth: 1, children: [text(value)]})
const paragraph = (...children) => ({type: 'paragraph', children})

test('splits the three audience regions without retaining sentinel headings', () => {
  const root = {
    type: 'root',
    children: [
      heading('عنوان گام'),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام'),
      paragraph(text('قبل')),
      heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه'),
      paragraph(text('دانش‌آموز')),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن'),
      paragraph(text('بعد')),
    ],
  }

  const {sections} = splitAndNormalizeStep(root)
  assert.equal(stringifyMdast(sections.mentorBefore), 'قبل\n')
  assert.equal(stringifyMdast(sections.student), 'دانش‌آموز\n')
  assert.equal(stringifyMdast(sections.mentorAfter), 'بعد\n')
})

test('turns a standalone http://games link into a relative iframe', () => {
  const root = {
    type: 'root',
    children: [
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام'),
      paragraph(text('قبل')),
      heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه'),
      paragraph({
        type: 'link',
        url: 'http://games/router/',
        children: [text('بازی روتر')],
      }),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن'),
      paragraph(text('بعد')),
    ],
  }

  const {sections} = splitAndNormalizeStep(root)
  const markdown = stringifyMdast(sections.student)
  assert.match(markdown, /<iframe class="mini-game"/)
  assert.match(markdown, /src="\.\.\/\.\.\/games\/router\/index\.html"/)
  assert.match(markdown, /title="بازی روتر"/)
})

test('splits an inline game link into its own iframe block', () => {
  const root = {
    type: 'root',
    children: [
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام'),
      paragraph(text('قبل')),
      heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه'),
      paragraph(
        text('متن قبل از بازی'),
        {type: 'break'},
        {
          type: 'strong',
          children: [{
            type: 'link',
            url: 'http://games/router/',
            children: [text('بازی روتر')],
          }],
        },
        {type: 'break'},
        text('متن بعد از بازی'),
      ),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن'),
      paragraph(text('بعد')),
    ],
  }

  const {sections, warnings} = splitAndNormalizeStep(root)
  assert.deepEqual(
    sections.student.children.map((node) => node.type),
    ['paragraph', 'html', 'paragraph'],
  )
  assert.equal(warnings.length, 0)

  const markdown = stringifyMdast(sections.student)
  assert.match(markdown, /متن قبل از بازی/)
  assert.match(markdown, /<iframe class="mini-game"/)
  assert.match(markdown, /متن بعد از بازی/)
  assert.doesNotMatch(markdown, /http:\/\/games\/router/)
})

test('strips trailing horizontal rules from every audience section', () => {
  const horizontalRule = () => ({type: 'thematicBreak'})
  const root = {
    type: 'root',
    children: [
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام'),
      paragraph(text('قبل')),
      horizontalRule(),
      heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه'),
      paragraph(text('دانش‌آموز')),
      paragraph(text('---')),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن'),
      paragraph(text('بعد')),
      horizontalRule(),
      paragraph(text('---')),
    ],
  }

  const {sections} = splitAndNormalizeStep(root)
  assert.equal(stringifyMdast(sections.mentorBefore), 'قبل\n')
  assert.equal(stringifyMdast(sections.student), 'دانش‌آموز\n')
  assert.equal(stringifyMdast(sections.mentorAfter), 'بعد\n')
})

test('does not treat a similar public hostname as a game reference', () => {
  const root = {
    type: 'root',
    children: [
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - قبل از شروع گام'),
      paragraph(text('قبل')),
      heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه'),
      paragraph({
        type: 'link',
        url: 'https://games.example.com/router/',
        children: [text('لینک عادی')],
      }),
      heading('🧑‍🏫 پشت‌صحنهٔ منتور - وقتی صداتون می‌کنن'),
      paragraph(text('بعد')),
    ],
  }

  const {sections} = splitAndNormalizeStep(root)
  const markdown = stringifyMdast(sections.student)
  assert.doesNotMatch(markdown, /<iframe/)
  assert.match(markdown, /https:\/\/games\.example\.com\/router\//)
})

test('rejects documents missing an audience region', () => {
  const root = {
    type: 'root',
    children: [heading('🧑‍🎓 صفحه‌ای که دانش‌آموز می‌بینه')],
  }
  assert.throws(() => splitAndNormalizeStep(root), /Missing mentorBefore section/)
})

test('extracts and removes the first level-two student heading as its title', () => {
  const studentSection = {
    type: 'root',
    children: [
      paragraph(text('مقدمه')),
      {type: 'heading', depth: 3, children: [text('عنوان فرعی')]},
      {type: 'heading', depth: 2, children: [text('عنوان اصلی گام')]},
      {type: 'heading', depth: 2, children: [text('عنوان بعدی')]},
    ],
  }

  assert.equal(extractStudentTitle(studentSection), 'عنوان اصلی گام')
  assert.equal(
    stringifyMdast(studentSection),
    'مقدمه\n\n### عنوان فرعی\n\n## عنوان بعدی\n',
  )
})

test('rejects a student section without a level-two title heading', () => {
  const studentSection = {
    type: 'root',
    children: [{type: 'heading', depth: 3, children: [text('فقط عنوان فرعی')]}],
  }

  assert.throws(
    () => extractStudentTitle(studentSection),
    /must contain a level-two heading/,
  )
})
