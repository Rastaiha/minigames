import fs from 'node:fs/promises'
import path from 'node:path'
import {google} from 'googleapis'
import {parseArgs} from './lib/args.js'
import {
  documentTabToMdast,
  flattenTabs,
} from './lib/google-doc-content.js'
import {
  DEFAULT_OAUTH_CLIENT_PATH,
  DEFAULT_REFRESH_TOKEN_PATH,
  createGoogleRefreshClient,
} from './lib/google-refresh-auth.js'
import {splitAndNormalizeStep, stringifyMdast} from './lib/normalize-step.js'
import {loadStepConfig} from './lib/step-config.js'

const args = parseArgs(process.argv.slice(2))
const configPath = args.config ?? 'step-names.json'
const outputDirectory = path.resolve(args.output ?? 'steps')
const config = await loadStepConfig(configPath)
const auth = await createGoogleRefreshClient({
  oauthClientPath: args['oauth-client-file'] ?? DEFAULT_OAUTH_CLIENT_PATH,
  refreshTokenPath:
    args['refresh-token-file'] ?? DEFAULT_REFRESH_TOKEN_PATH,
})
const docs = google.docs({version: 'v1', auth})

console.log(`Reading Google document ${config.documentId}...`)
const {data: document} = await docs.documents.get({
  documentId: config.documentId,
  includeTabsContent: true,
})

const allTabs = flattenTabs(document.tabs)
const tabIds = new Set(allTabs.map(({tab}) => tab.tabProperties.tabId))
const missingTabIds = Object.keys(config.names).filter((tabId) => !tabIds.has(tabId))
if (missingTabIds.length) {
  throw new Error(
    `Mapped tab IDs were not found in the document: ${missingTabIds.join(', ')}`,
  )
}

const unmappedSubtabs = allTabs.filter(
  ({tab, depth}) => depth > 0 && !config.names[tab.tabProperties.tabId],
)
if (unmappedSubtabs.length) {
  const descriptions = unmappedSubtabs.map(
    ({tab}) => `${tab.tabProperties.title} (${tab.tabProperties.tabId})`,
  )
  throw new Error(
    `Every subtab must be mapped in ${configPath}. Missing:\n- ${descriptions.join('\n- ')}`,
  )
}

const stepTabs = allTabs.filter(({tab}) => config.names[tab.tabProperties.tabId])
if (!stepTabs.length) throw new Error(`No mapped step tabs found in ${configPath}`)

await fs.mkdir(outputDirectory, {recursive: true})
const order = []

for (const {tab} of stepTabs) {
  const {tabId, title} = tab.tabProperties
  const stepName = config.names[tabId]
  const stepDirectory = path.join(outputDirectory, stepName)
  const assetsDirectory = path.join(stepDirectory, 'assets')

  console.log(`Importing ${title} -> steps/${stepName}`)
  await fs.rm(assetsDirectory, {recursive: true, force: true})
  await fs.mkdir(stepDirectory, {recursive: true})

  const root = await documentTabToMdast({
    documentTab: tab.documentTab,
    assetsDirectory,
    auth,
  })
  const {sections, warnings} = splitAndNormalizeStep(root)

  await Promise.all([
    fs.writeFile(
      path.join(stepDirectory, 'student.md'),
      stringifyMdast(sections.student),
    ),
    fs.writeFile(
      path.join(stepDirectory, 'mentor-before.md'),
      stringifyMdast(sections.mentorBefore),
    ),
    fs.writeFile(
      path.join(stepDirectory, 'mentor-after.md'),
      stringifyMdast(sections.mentorAfter),
    ),
  ])

  for (const warning of warnings) console.warn(`  Warning: ${warning}`)
  order.push({tabId, name: stepName, title})
}

await fs.writeFile(
  path.join(outputDirectory, '.order.json'),
  `${JSON.stringify(order, null, 2)}\n`,
)

console.log(`Imported ${order.length} step(s).`)
