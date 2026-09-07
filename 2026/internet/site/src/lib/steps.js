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
const gamesDirectory = path.join(repositoryRoot, 'games')
const gameVersionsPath = path.join(
  repositoryRoot,
  'site',
  'public',
  'game-entry-versions.json',
)
const questionMark = '❓'
const questionMarkClass = 'important-question-mark'

function highlightImportantQuestionMarks() {
  return (tree) => {
    function visit(node) {
      if (!node.children || ['code', 'pre', 'script', 'style'].includes(node.tagName)) {
        return
      }

      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text' || !child.value.includes(questionMark)) {
          visit(child)
          return child
        }

        return child.value.split(questionMark).flatMap((part, index, parts) => {
          const nodes = part ? [{type: 'text', value: part}] : []
          if (index < parts.length - 1) {
            nodes.push({
              type: 'element',
              tagName: 'span',
              properties: {
                className: [questionMarkClass],
                role: 'img',
                ariaLabel: 'سؤال مهم',
              },
              children: [{type: 'text', value: questionMark}],
            })
          }
          return nodes
        })
      })
    }

    visit(tree)
  }
}

function createRenderer({highlightQuestions = false} = {}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {allowDangerousHtml: true})

  if (highlightQuestions) processor.use(highlightImportantQuestionMarks)

  return processor.use(rehypeStringify, {allowDangerousHtml: true})
}

const renderer = createRenderer()
const studentRenderer = createRenderer({highlightQuestions: true})

export async function renderStudentMarkdown(markdown) {
  return String(await studentRenderer.process(markdown))
}

export async function readStepIndex() {
  const value = await fs.readFile(path.join(stepsDirectory, '.order.json'), 'utf8')
  return JSON.parse(value)
}

function displayNameFromSlug(slug) {
  return slug.replaceAll('-', ' ').replaceAll('_', ' ')
}

async function readGameEntryVersions() {
  try {
    return JSON.parse(await fs.readFile(gameVersionsPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export function versionGameEntryUrls(html, versions) {
  return html.replace(
    /(src="(?:\.\.\/)+games\/([^"?#]+)\/index\.html)(?:\?[^"#]*)?(#[^"]*)?"/g,
    (match, url, gamePath, fragment = '') => {
      const version = versions[gamePath]
      return version ? `${url}?v=${version}${fragment}"` : match
    },
  )
}

export function wrapMiniGameIframes(html) {
  return html.replace(
    /(<iframe\b(?=[^>]*\bclass="[^"]*\bmini-game\b[^"]*")[^>]*><\/iframe>)/gi,
    '<div class="mini-game-shell">$1</div>',
  )
}

export async function readGameIndex() {
  const versions = await readGameEntryVersions()
  let entries
  try {
    entries = await fs.readdir(gamesDirectory, {withFileTypes: true})
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const games = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const gameDirectory = path.join(gamesDirectory, entry.name)
    const candidates = [
      path.join(gameDirectory, 'dist', 'index.html'),
      path.join(gameDirectory, 'index.html'),
    ]
    let html
    for (const candidate of candidates) {
      try {
        html = await fs.readFile(candidate, 'utf8')
        break
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    if (!html) continue

    const documentTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim()
    games.push({
      name: entry.name,
      title: documentTitle || displayNameFromSlug(entry.name),
      version: versions[entry.name] || null,
    })
  }

  return games.sort((first, second) =>
    first.title.localeCompare(second.title, 'fa'),
  )
}

async function renderFragment(stepName, filename, processor = renderer) {
  const markdown = await fs.readFile(
    path.join(stepsDirectory, stepName, filename),
    'utf8',
  )
  return String(await processor.process(markdown))
}

export async function readRenderedStep(entry) {
  const [mentorBefore, student, mentorAfter, versions] = await Promise.all([
    renderFragment(entry.name, 'mentor-before.md'),
    renderFragment(entry.name, 'student.md', studentRenderer),
    renderFragment(entry.name, 'mentor-after.md'),
    readGameEntryVersions(),
  ])

  return {
    ...entry,
    mentorBefore: wrapMiniGameIframes(versionGameEntryUrls(mentorBefore, versions)),
    student: wrapMiniGameIframes(versionGameEntryUrls(student, versions)),
    mentorAfter: wrapMiniGameIframes(versionGameEntryUrls(mentorAfter, versions)),
  }
}
