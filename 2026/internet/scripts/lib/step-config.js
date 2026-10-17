import fs from 'node:fs/promises'
import path from 'node:path'

const VALID_STEP_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

export async function loadStepConfig(configPath = 'step-names.json') {
  let config
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Step mapping not found: ${configPath}`)
    if (error instanceof SyntaxError) {
      throw new Error(`Step mapping is not valid JSON: ${configPath}`)
    }
    throw error
  }

  if (!config.documentId || typeof config.documentId !== 'string') {
    throw new Error(`Set documentId in ${configPath}`)
  }
  if (!config.names || typeof config.names !== 'object' || Array.isArray(config.names)) {
    throw new Error(`${configPath} must contain a names object`)
  }

  const usedNames = new Set()
  for (const [tabId, name] of Object.entries(config.names)) {
    if (!tabId.trim()) throw new Error(`${configPath} contains an empty tab ID`)
    if (typeof name !== 'string' || !VALID_STEP_NAME.test(name)) {
      throw new Error(
        `Invalid step name for ${tabId}: ${JSON.stringify(name)}. Use letters, numbers, hyphens, and underscores.`,
      )
    }
    if (usedNames.has(name)) throw new Error(`Duplicate step name: ${name}`)
    usedNames.add(name)
  }

  return config
}

export function resolveFromCwd(filePath) {
  return path.resolve(process.cwd(), filePath)
}
