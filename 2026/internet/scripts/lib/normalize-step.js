import {unified} from 'unified'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import {plainText} from './google-doc-content.js'

const serializer = unified().use(remarkGfm).use(remarkStringify, {
  bullet: '-',
  fences: true,
  listItemIndent: 'one',
})

function normalizeComparableText(value) {
  return value
    .normalize('NFC')
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[–—−\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedHeadingText(node) {
  return normalizeComparableText(plainText(node))
}

function audienceForHeading(node) {
  if (node.type !== 'heading') return null
  const text = normalizedHeadingText(node)

  if (text.includes(normalizeComparableText('صفحه‌ای که دانش‌آموز می‌بینه'))) {
    return 'student'
  }
  if (
    text.includes(normalizeComparableText('پشت‌صحنهٔ منتور')) &&
    text.includes('قبل از شروع گام')
  ) {
    return 'mentorBefore'
  }
  if (
    text.includes(normalizeComparableText('پشت‌صحنهٔ منتور')) &&
    text.includes(normalizeComparableText('وقتی صداتون می‌کنن'))
  ) {
    return 'mentorAfter'
  }
  return null
}

function gameLinkFromChildren(children) {
  const meaningful = children.filter(
    (child) => child.type !== 'text' || child.value.trim() !== '',
  )
  if (meaningful.length !== 1) return null

  const only = meaningful[0]
  if (only.type === 'link') return only
  if (
    ['strong', 'emphasis', 'delete'].includes(only.type) &&
    Array.isArray(only.children)
  ) {
    return gameLinkFromChildren(only.children)
  }
  return null
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function gamePathFromReference(reference) {
  let url
  try {
    url = new URL(reference)
  } catch {
    return null
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.hostname !== 'games' ||
    url.port ||
    url.username ||
    url.password
  ) {
    return null
  }

  const gamePath = url.pathname.replace(/^\/+|\/+$/g, '')
  return gamePath || null
}

function transformGameLinks(root, warnings) {
  root.children = root.children.map((node) => {
    if (node.type !== 'paragraph') return node
    const link = gameLinkFromChildren(node.children)
    if (!link) return node

    const gamePath = gamePathFromReference(link.url)
    if (!gamePath) return node
    if (gamePath.split('/').some((part) => part === '..')) {
      throw new Error(`Unsafe or empty game path: ${link.url}`)
    }

    const label = plainText(link).trim() || gamePath
    const normalizedPath = gamePath.endsWith('/') ? gamePath : `${gamePath}/`
    return {
      type: 'html',
      value:
        `<iframe class="mini-game" src="../../games/${escapeHtml(normalizedPath)}" ` +
        `title="${escapeHtml(label)}" loading="lazy" allowfullscreen></iframe>`,
    }
  })

  const inlineGameLinks = []
  const inspect = (node) => {
    if (node.type === 'link' && gamePathFromReference(node.url)) {
      inlineGameLinks.push(node.url)
    }
    for (const child of node.children ?? []) inspect(child)
  }
  inspect(root)
  for (const url of inlineGameLinks) {
    warnings.push(`Game link must be in its own paragraph to become an iframe: ${url}`)
  }
}

export function splitAndNormalizeStep(root) {
  const sections = {
    mentorBefore: {type: 'root', children: []},
    student: {type: 'root', children: []},
    mentorAfter: {type: 'root', children: []},
  }
  const found = new Set()
  const warnings = []
  let currentAudience = null

  for (const node of root.children) {
    const audience = audienceForHeading(node)
    if (audience) {
      if (found.has(audience)) throw new Error(`Duplicate ${audience} section`)
      found.add(audience)
      currentAudience = audience
      continue
    }
    if (currentAudience) sections[currentAudience].children.push(node)
  }

  for (const name of Object.keys(sections)) {
    if (!found.has(name)) throw new Error(`Missing ${name} section`)
    transformGameLinks(sections[name], warnings)
  }

  const guideCount = Object.values(sections).reduce((count, section) => {
    return count + section.children.filter((node) => plainText(node).includes('🟨')).length
  }, 0)
  if (guideCount) {
    warnings.push(
      `${guideCount} top-level block(s) still contain 🟨 authoring guidance; they were preserved`,
    )
  }

  return {sections, warnings}
}

export function stringifyMdast(root) {
  return `${serializer.stringify(root).trim()}\n`
}

export function studentTitleFromSection(studentSection) {
  const titleHeading = studentSection.children.find(
    (node) => node.type === 'heading' && node.depth === 2,
  )
  const title = titleHeading ? plainText(titleHeading).trim() : ''

  if (!title) {
    throw new Error(
      'Student section must contain a level-two heading (##) to use as the step title',
    )
  }

  return title
}
