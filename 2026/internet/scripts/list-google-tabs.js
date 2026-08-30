import {google} from 'googleapis'
import {parseArgs} from './lib/args.js'
import {flattenTabs} from './lib/google-doc-content.js'
import {
  DEFAULT_OAUTH_CLIENT_PATH,
  DEFAULT_REFRESH_TOKEN_PATH,
  createGoogleRefreshClient,
} from './lib/google-refresh-auth.js'
import {loadStepConfig} from './lib/step-config.js'

const args = parseArgs(process.argv.slice(2))
const config = await loadStepConfig(args.config ?? 'step-names.json')
const auth = await createGoogleRefreshClient({
  oauthClientPath: args['oauth-client-file'] ?? DEFAULT_OAUTH_CLIENT_PATH,
  refreshTokenPath:
    args['refresh-token-file'] ?? DEFAULT_REFRESH_TOKEN_PATH,
})
const docs = google.docs({version: 'v1', auth})
const {data: document} = await docs.documents.get({
  documentId: config.documentId,
  includeTabsContent: true,
})

for (const {tab, depth} of flattenTabs(document.tabs)) {
  const properties = tab.tabProperties
  const stepName = config.names[properties.tabId]
  const status = stepName
    ? ` -> steps/${stepName}`
    : depth > 0
      ? ' [omitted]'
      : ''
  console.log(
    `${'  '.repeat(depth)}${properties.title}  (${properties.tabId})${status}`,
  )
}
