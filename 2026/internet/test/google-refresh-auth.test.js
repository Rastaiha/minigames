import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {loadGoogleRefreshCredentials} from '../scripts/lib/google-refresh-auth.js'

test('loads a web OAuth client and bare refresh token', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rasta-refresh-test-'))
  t.after(() => fs.rm(directory, {recursive: true, force: true}))
  const oauthClientPath = path.join(directory, 'client.json')
  const refreshTokenPath = path.join(directory, 'refresh-token.txt')

  await fs.writeFile(
    oauthClientPath,
    JSON.stringify({
      web: {
        client_id: 'client.apps.googleusercontent.com',
        client_secret: 'secret',
      },
    }),
  )
  await fs.writeFile(refreshTokenPath, '1/example-refresh-token\n')

  assert.deepEqual(
    await loadGoogleRefreshCredentials({oauthClientPath, refreshTokenPath}),
    {
      clientId: 'client.apps.googleusercontent.com',
      clientSecret: 'secret',
      refreshToken: '1/example-refresh-token',
    },
  )
})

test('rejects a refresh token with surrounding text', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rasta-refresh-test-'))
  t.after(() => fs.rm(directory, {recursive: true, force: true}))
  const oauthClientPath = path.join(directory, 'client.json')
  const refreshTokenPath = path.join(directory, 'refresh-token.txt')

  await fs.writeFile(
    oauthClientPath,
    JSON.stringify({web: {client_id: 'client', client_secret: 'secret'}}),
  )
  await fs.writeFile(refreshTokenPath, 'Refresh token: 1/example')

  await assert.rejects(
    loadGoogleRefreshCredentials({oauthClientPath, refreshTokenPath}),
    /bare token value/,
  )
})
