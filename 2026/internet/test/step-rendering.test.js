import assert from 'node:assert/strict'
import test from 'node:test'
import {renderStudentMarkdown} from '../site/src/lib/steps.js'

test('marks important student questions without changing code examples', async () => {
  const rendered = await renderStudentMarkdown(
    '**❓سؤال مهم**\n\n`❓`',
  )

  assert.match(
    rendered,
    /<strong><span class="important-question-mark" role="img" aria-label="سؤال مهم">❓<\/span>سؤال مهم<\/strong>/,
  )
  assert.match(rendered, /<code>❓<\/code>/)
  assert.equal(rendered.match(/class="important-question-mark"/g)?.length, 1)
})
