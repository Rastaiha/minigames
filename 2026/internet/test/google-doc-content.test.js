import assert from 'node:assert/strict'
import test from 'node:test'
import {
  documentTabToMdast,
  flattenTabs,
  plainText,
} from '../scripts/lib/google-doc-content.js'
import {stringifyMdast} from '../scripts/lib/normalize-step.js'

test('flattens nested Google tabs in display order', () => {
  const tabs = [
    {
      tabProperties: {tabId: 'topic-1'},
      childTabs: [
        {tabProperties: {tabId: 'step-1'}},
        {tabProperties: {tabId: 'step-2'}},
      ],
    },
    {tabProperties: {tabId: 'topic-2'}},
  ]

  assert.deepEqual(
    flattenTabs(tabs).map(({tab, depth}) => [tab.tabProperties.tabId, depth]),
    [
      ['topic-1', 0],
      ['step-1', 1],
      ['step-2', 1],
      ['topic-2', 0],
    ],
  )
})

test('converts headings, styled links, and tables to mdast', async () => {
  const documentTab = {
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: {namedStyleType: 'HEADING_1'},
            elements: [{textRun: {content: 'عنوان\n'}}],
          },
        },
        {
          paragraph: {
            elements: [
              {
                textRun: {
                  content: 'بازی\n',
                  textStyle: {bold: true, link: {url: 'http://games/router/'}},
                },
              },
            ],
          },
        },
        {
          table: {
            tableRows: [
              {
                tableCells: [
                  {
                    content: [
                      {paragraph: {elements: [{textRun: {content: 'سلول\n'}}]}},
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  }

  const root = await documentTabToMdast({
    documentTab,
    assetsDirectory: '/tmp/unused-rasta-assets',
    auth: null,
  })

  assert.equal(root.children[0].type, 'heading')
  assert.equal(root.children[0].depth, 1)
  assert.equal(root.children[1].children[0].type, 'link')
  assert.equal(root.children[1].children[0].children[0].type, 'strong')
  assert.equal(root.children[2].type, 'table')
  assert.match(plainText(root), /عنوان/)
})

test('converts Roboto Mono text to inline code', async () => {
  const documentTab = {
    body: {
      content: [
        {
          paragraph: {
            elements: [
              {textRun: {content: 'دستور '}},
              {
                textRun: {
                  content: 'ping',
                  textStyle: {
                    bold: true,
                    weightedFontFamily: {fontFamily: 'Roboto Mono'},
                  },
                },
              },
              {textRun: {content: ' را اجرا کنید.\n'}},
            ],
          },
        },
      ],
    },
  }

  const root = await documentTabToMdast({
    documentTab,
    assetsDirectory: '/tmp/unused-rasta-assets',
    auth: null,
  })

  const strong = root.children[0].children[1]
  assert.equal(strong.type, 'strong')
  assert.deepEqual(strong.children, [{type: 'inlineCode', value: 'ping'}])
  assert.equal(plainText(root), 'دستور ping را اجرا کنید.')
  assert.equal(stringifyMdast(root), 'دستور **`ping`** را اجرا کنید.\n')
})
