import fs from 'node:fs/promises'
import path from 'node:path'
import {unified} from 'unified'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

const repositoryRoot = path.resolve(
  process.env.WORKSHOP_ROOT || process.env.INIT_CWD || path.join(process.cwd(), '..'),
)
const stepsDirectory = path.join(repositoryRoot, 'steps')
const renderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeStringify, {allowDangerousHtml: true})

export async function readStepIndex() {
  const value = await fs.readFile(path.join(stepsDirectory, '.order.json'), 'utf8')
  return JSON.parse(value)
}

async function renderFragment(stepName, filename) {
  const markdown = await fs.readFile(
    path.join(stepsDirectory, stepName, filename),
    'utf8',
  )
  return String(await renderer.process(markdown))
}

export async function readRenderedStep(entry) {
  const [mentorBefore, student, mentorAfter] = await Promise.all([
    renderFragment(entry.name, 'mentor-before.md'),
    renderFragment(entry.name, 'student.md'),
    renderFragment(entry.name, 'mentor-after.md'),
  ])

  return {...entry, mentorBefore, student, mentorAfter}
}
