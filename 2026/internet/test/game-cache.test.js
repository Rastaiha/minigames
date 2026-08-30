import assert from 'node:assert/strict'
import test from 'node:test'
import {versionGameEntryUrls} from '../site/src/lib/steps.js'

test('adds the matching content version to embedded game entry pages', () => {
  const html = [
    '<iframe src="../../games/router/index.html"></iframe>',
    '<iframe src="../../games/nested/demo/index.html#level-2"></iframe>',
    '<iframe src="../../games/unversioned/index.html"></iframe>',
  ].join('')

  const versioned = versionGameEntryUrls(html, {
    router: 'abc123',
    'nested/demo': 'def456',
  })

  assert.match(versioned, /router\/index\.html\?v=abc123"/)
  assert.match(versioned, /nested\/demo\/index\.html\?v=def456#level-2"/)
  assert.match(versioned, /unversioned\/index\.html"/)
})

test('replaces an existing game entry version instead of appending another', () => {
  const html = '<iframe src="../../games/router/index.html?v=old"></iframe>'
  assert.equal(
    versionGameEntryUrls(html, {router: 'new'}),
    '<iframe src="../../games/router/index.html?v=new"></iframe>',
  )
})
