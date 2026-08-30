import fs from 'node:fs/promises'
import path from 'node:path'

const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
])

export function flattenTabs(tabs, depth = 0, result = []) {
  for (const tab of tabs ?? []) {
    result.push({tab, depth})
    flattenTabs(tab.childTabs, depth + 1, result)
  }
  return result
}

function textNodes(value) {
  const normalized = value.replace(/\n$/, '')
  if (!normalized) return []

  return normalized.split('\n').flatMap((part, index, parts) => {
    const nodes = part ? [{type: 'text', value: part}] : []
    if (index < parts.length - 1) nodes.push({type: 'break'})
    return nodes
  })
}

function wrapTextStyle(nodes, style = {}) {
  let wrapped = nodes
  const wrap = (type, properties = {}) => {
    if (wrapped.length) wrapped = [{type, ...properties, children: wrapped}]
  }

  if (style.bold) wrap('strong')
  if (style.italic) wrap('emphasis')
  if (style.strikethrough) wrap('delete')
  if (style.link?.url) wrap('link', {url: style.link.url})
  return wrapped
}

function sanitizeObjectId(objectId) {
  return objectId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '')
}

async function downloadInlineImage({
  objectId,
  documentTab,
  assetsDirectory,
  auth,
  imageCache,
}) {
  if (imageCache.has(objectId)) return imageCache.get(objectId)

  const embeddedObject =
    documentTab.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject
  const image = embeddedObject?.imageProperties
  const description = embeddedObject?.description ?? embeddedObject?.title ?? ''

  if (!image?.contentUri) {
    if (image?.sourceUri) {
      const node = {type: 'image', url: image.sourceUri, alt: description}
      imageCache.set(objectId, node)
      return node
    }
    throw new Error(`Inline image ${objectId} has no downloadable content URI`)
  }

  const requestHeaders = await auth.getRequestHeaders(image.contentUri)
  const response = await fetch(image.contentUri, {headers: requestHeaders})
  if (!response.ok) {
    throw new Error(
      `Could not download inline image ${objectId}: ${response.status} ${response.statusText}`,
    )
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]
  const extension = MIME_EXTENSIONS.get(mimeType) ?? 'bin'
  const filename = `inline-${sanitizeObjectId(objectId) || 'image'}.${extension}`
  await fs.mkdir(assetsDirectory, {recursive: true})
  await fs.writeFile(
    path.join(assetsDirectory, filename),
    Buffer.from(await response.arrayBuffer()),
  )

  const node = {type: 'image', url: `assets/${filename}`, alt: description}
  imageCache.set(objectId, node)
  return node
}

async function paragraphChildren(paragraph, context) {
  const children = []

  for (const element of paragraph.elements ?? []) {
    if (element.textRun) {
      children.push(
        ...wrapTextStyle(
          textNodes(element.textRun.content ?? ''),
          element.textRun.textStyle,
        ),
      )
      continue
    }

    if (element.inlineObjectElement?.inlineObjectId) {
      children.push(
        await downloadInlineImage({
          objectId: element.inlineObjectElement.inlineObjectId,
          ...context,
        }),
      )
      continue
    }

    if (element.horizontalRule) {
      children.push({type: 'text', value: '---'})
      continue
    }

    if (element.equation?.suggestedInsertionIds?.length) {
      children.push({type: 'text', value: '[equation]'})
    }
  }

  return children
}

function headingDepth(namedStyleType) {
  const match = /^HEADING_([1-6])$/.exec(namedStyleType ?? '')
  return match ? Number(match[1]) : null
}

function orderedListFor(paragraph, documentTab) {
  const bullet = paragraph.bullet
  if (!bullet) return null

  const nestingLevel = bullet.nestingLevel ?? 0
  const definition = documentTab.lists?.[bullet.listId]?.listProperties
  const level = definition?.nestingLevels?.[nestingLevel]
  return Boolean(level?.glyphType)
}

async function paragraphBlock(paragraph, context) {
  const children = await paragraphChildren(paragraph, context)
  if (!children.length) return null

  const depth = headingDepth(paragraph.paragraphStyle?.namedStyleType)
  const node = depth
    ? {type: 'heading', depth, children}
    : {type: 'paragraph', children}

  if (!paragraph.bullet) return {node, bullet: null}

  return {
    node: node.type === 'paragraph' ? node : {type: 'paragraph', children},
    bullet: {
      level: paragraph.bullet.nestingLevel ?? 0,
      listId: paragraph.bullet.listId,
      ordered: orderedListFor(paragraph, context.documentTab),
    },
  }
}

function appendNestedList(parentItem, nestedList) {
  if (!parentItem) return
  parentItem.children.push(nestedList)
}

function listFromParagraphs(items) {
  const baseLevel = Math.min(...items.map((item) => item.bullet.level))
  const roots = []
  const stack = []

  for (const item of items) {
    const level = item.bullet.level - baseLevel
    const listItem = {type: 'listItem', spread: false, children: [item.node]}
    let list = stack[level]

    if (
      !list ||
      list.ordered !== item.bullet.ordered ||
      list.data?.googleListId !== item.bullet.listId
    ) {
      list = {
        type: 'list',
        ordered: item.bullet.ordered,
        spread: false,
        children: [],
        data: {googleListId: item.bullet.listId},
      }

      if (level === 0) {
        roots.push(list)
      } else {
        const parentList = stack[level - 1]
        const parentItem = parentList?.children.at(-1)
        if (!parentItem) {
          roots.push(list)
        } else {
          appendNestedList(parentItem, list)
        }
      }

      stack[level] = list
      stack.length = level + 1
    }

    list.children.push(listItem)
  }

  return roots
}

function blocksToTableCell(blocks) {
  const children = []

  for (const block of blocks) {
    if (children.length) children.push({type: 'html', value: '<br>'})
    if (block.type === 'paragraph' || block.type === 'heading') {
      children.push(...block.children)
    } else if (block.type === 'list') {
      const text = block.children
        .map((item) => plainText(item).trim())
        .filter(Boolean)
        .join('؛ ')
      children.push({type: 'text', value: text})
    } else {
      children.push({type: 'text', value: plainText(block)})
    }
  }

  return {type: 'tableCell', children}
}

async function tableNode(table, context) {
  const rows = []

  for (const tableRow of table.tableRows ?? []) {
    const cells = []
    for (const tableCell of tableRow.tableCells ?? []) {
      const blocks = await structuralElementsToBlocks(tableCell.content, context)
      cells.push(blocksToTableCell(blocks))
    }
    rows.push({type: 'tableRow', children: cells})
  }

  return {type: 'table', align: [], children: rows}
}

async function structuralElementsToBlocks(content, context) {
  const intermediate = []

  for (const element of content ?? []) {
    if (element.paragraph) {
      const block = await paragraphBlock(element.paragraph, context)
      if (block) intermediate.push(block)
    } else if (element.table) {
      intermediate.push({node: await tableNode(element.table, context), bullet: null})
    }
  }

  const blocks = []
  for (let index = 0; index < intermediate.length; index += 1) {
    const item = intermediate[index]
    if (!item.bullet) {
      blocks.push(item.node)
      continue
    }

    const listItems = [item]
    while (intermediate[index + 1]?.bullet) {
      listItems.push(intermediate[index + 1])
      index += 1
    }
    blocks.push(...listFromParagraphs(listItems))
  }

  return blocks
}

export async function documentTabToMdast({documentTab, assetsDirectory, auth}) {
  const context = {
    documentTab,
    assetsDirectory,
    auth,
    imageCache: new Map(),
  }
  return {
    type: 'root',
    children: await structuralElementsToBlocks(documentTab.body?.content, context),
  }
}

export function plainText(node) {
  if (node.type === 'text') return node.value
  if (node.type === 'image') return node.alt ?? ''
  if (!node.children) return ''
  return node.children.map(plainText).join('')
}
