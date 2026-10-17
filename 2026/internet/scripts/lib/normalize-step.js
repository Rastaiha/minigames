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

function gameIframe(link, gamePath) {
  if (gamePath.split('/').some((part) => part === '..')) {
    throw new Error(`Unsafe or empty game path: ${link.url}`)
  }

  const label = plainText(link).trim() || gamePath
  return {
    type: 'html',
    value:
      `<iframe class="mini-game" src="../../games/${escapeHtml(gamePath)}/index.html" ` +
      `title="${escapeHtml(label)}" loading="lazy" allowfullscreen></iframe>`,
  }
}

function mergeInlineSegments(segments) {
  const merged = []
  for (const segment of segments) {
    const previous = merged.at(-1)
    if (segment.kind === 'inline' && previous?.kind === 'inline') {
      previous.nodes.push(...segment.nodes)
    } else {
      merged.push(segment)
    }
  }
  return merged
}

function splitInlineNode(node) {
  if (node.type === 'link') {
    const gamePath = gamePathFromReference(node.url)
    if (gamePath) return [{kind: 'game', node: gameIframe(node, gamePath)}]
  }

  if (!Array.isArray(node.children)) {
    return [{kind: 'inline', nodes: [node]}]
  }

  const childSegments = mergeInlineSegments(node.children.flatMap(splitInlineNode))
  if (!childSegments.some((segment) => segment.kind === 'game')) {
    return [{kind: 'inline', nodes: [node]}]
  }

  return childSegments.map((segment) => {
    if (segment.kind === 'game') return segment
    return {
      kind: 'inline',
      nodes: [{...node, children: segment.nodes}],
    }
  })
}

function hasVisibleInlineContent(nodes) {
  return nodes.some((node) => node.type === 'image' || plainText(node).trim())
}

function splitParagraphAtGameLinks(paragraph) {
  const segments = mergeInlineSegments(paragraph.children.flatMap(splitInlineNode))
  if (!segments.some((segment) => segment.kind === 'game')) return [paragraph]

  return segments.flatMap((segment) => {
    if (segment.kind === 'game') return [segment.node]
    if (!hasVisibleInlineContent(segment.nodes)) return []
    return [{...paragraph, children: segment.nodes}]
  })
}

function transformGameLinks(parent) {
  const transformed = []
  for (const node of parent.children) {
    if (node.type === 'paragraph') {
      transformed.push(...splitParagraphAtGameLinks(node))
      continue
    }

    if (node.type === 'blockquote' || node.type === 'listItem') {
      transformGameLinks(node)
    } else if (node.type === 'list') {
      for (const item of node.children) transformGameLinks(item)
    }
    transformed.push(node)
  }
  parent.children = transformed
}

function isHorizontalRule(node) {
  if (node?.type === 'thematicBreak') return true
  if (node?.type !== 'paragraph') return false
  return /^-{3,}$/.test(plainText(node).replace(/\s/g, ''))
}

function stripTrailingHorizontalRules(root) {
  while (isHorizontalRule(root.children.at(-1))) {
    root.children.pop()
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
    transformGameLinks(sections[name])
    stripTrailingHorizontalRules(sections[name])
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

export function extractStudentTitle(studentSection) {
  const titleIndex = studentSection.children.findIndex(
    (node) => node.type === 'heading' && node.depth === 2,
  )
  const titleHeading = studentSection.children[titleIndex]
  const title = titleHeading ? plainText(titleHeading).trim() : ''

  if (!title) {
    throw new Error(
      'Student section must contain a level-two heading (##) to use as the step title',
    )
  }

  studentSection.children.splice(titleIndex, 1)
  return title
}
