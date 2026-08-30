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
const renderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeStringify, {allowDangerousHtml: true})

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

async function renderFragment(stepName, filename) {
  const markdown = await fs.readFile(
    path.join(stepsDirectory, stepName, filename),
    'utf8',
  )
  return String(await renderer.process(markdown))
}

export async function readRenderedStep(entry) {
  const [mentorBefore, student, mentorAfter, versions] = await Promise.all([
    renderFragment(entry.name, 'mentor-before.md'),
    renderFragment(entry.name, 'student.md'),
    renderFragment(entry.name, 'mentor-after.md'),
    readGameEntryVersions(),
  ])

  return {
    ...entry,
    mentorBefore: versionGameEntryUrls(mentorBefore, versions),
    student: versionGameEntryUrls(student, versions),
    mentorAfter: versionGameEntryUrls(mentorAfter, versions),
  }
}
