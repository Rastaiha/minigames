import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeUtf8Binary } from './utf8.js'

test('decodes complete ASCII text', () => {
  assert.deepEqual(
    decodeUtf8Binary('01001000 01100101 01101100 01101100 01101111'),
    { ok: true, text: 'Hello' },
  )
})

test('decodes complete Persian UTF-8 text', () => {
  assert.deepEqual(
    decodeUtf8Binary('11011000 10110011 11011001 10000100 11011000 10100111 11011001 10000101'),
    { ok: true, text: 'سلام' },
  )
})

test('accepts Persian binary digits', () => {
  assert.deepEqual(decodeUtf8Binary('۰۱۰۰۰۰۰۱'), { ok: true, text: 'A' })
})

test('reports incomplete and malformed input', () => {
  assert.equal(decodeUtf8Binary('0101').ok, false)
  assert.equal(decodeUtf8Binary('0100000x').ok, false)
  assert.equal(decodeUtf8Binary('11111111').ok, false)
})
