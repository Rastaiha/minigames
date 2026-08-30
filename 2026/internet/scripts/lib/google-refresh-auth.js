import fs from 'node:fs/promises'
import {google} from 'googleapis'

export const DEFAULT_OAUTH_CLIENT_PATH = 'google-oauth-client.json'
export const DEFAULT_REFRESH_TOKEN_PATH = 'google-refresh-token.txt'

async function readFile(filePath, label) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`${label} file not found: ${filePath}`)
    }
    throw error
  }
}

function parseJson(value, label) {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

export async function loadGoogleRefreshCredentials({
  oauthClientPath = DEFAULT_OAUTH_CLIENT_PATH,
  refreshTokenPath = DEFAULT_REFRESH_TOKEN_PATH,
} = {}) {
  const clientJson =
    process.env.GOOGLE_OAUTH_CLIENT_JSON ??
    (await readFile(oauthClientPath, 'Google OAuth client'))
  const clientDocument = parseJson(clientJson, 'Google OAuth client')
  const client = clientDocument.web ?? clientDocument.installed

  if (!client?.client_id || !client?.client_secret) {
    throw new Error(
      'Google OAuth client JSON must contain web.client_id/client_secret or installed.client_id/client_secret',
    )
  }

  const refreshToken = (
    process.env.GOOGLE_REFRESH_TOKEN ??
    (await readFile(refreshTokenPath, 'Google refresh token'))
  ).trim()

  if (!refreshToken || /\s/.test(refreshToken)) {
    throw new Error(
      'Google refresh token must contain only the bare token value without surrounding text',
    )
  }

  return {
    clientId: client.client_id,
    clientSecret: client.client_secret,
    refreshToken,
  }
}

export async function createGoogleRefreshClient(options = {}) {
  const {clientId, clientSecret, refreshToken} =
    await loadGoogleRefreshCredentials(options)
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({refresh_token: refreshToken})

  // Obtain a new short-lived access token at the start of every process. The
  // client also retains the refresh token in case a long-running import needs
  // another access token later.
  const accessToken = await auth.getAccessToken()
  if (!accessToken.token) {
    throw new Error('Google did not return an access token for the refresh token')
  }

  return auth
}
