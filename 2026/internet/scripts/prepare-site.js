import fs from 'node:fs/promises'
import path from 'node:path'

const rootDirectory = process.cwd()
const stepsDirectory = path.join(rootDirectory, 'steps')
const gamesDirectory = path.join(rootDirectory, 'games')
const publicDirectory = path.join(rootDirectory, 'site', 'public')
const publicStepsDirectory = path.join(publicDirectory, 'steps')
const publicGamesDirectory = path.join(publicDirectory, 'games')

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function copyStepAssets() {
  await fs.rm(publicStepsDirectory, {recursive: true, force: true})
  await fs.mkdir(publicStepsDirectory, {recursive: true})

  if (!(await exists(stepsDirectory))) return
  const entries = await fs.readdir(stepsDirectory, {withFileTypes: true})
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const source = path.join(stepsDirectory, entry.name, 'assets')
    if (!(await exists(source))) continue
    const destination = path.join(publicStepsDirectory, entry.name, 'assets')
    await fs.cp(source, destination, {recursive: true})
  }
}

async function copyGames() {
  await fs.rm(publicGamesDirectory, {recursive: true, force: true})
  await fs.mkdir(publicGamesDirectory, {recursive: true})

  if (!(await exists(gamesDirectory))) return
  const entries = await fs.readdir(gamesDirectory, {withFileTypes: true})
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const gameDirectory = path.join(gamesDirectory, entry.name)
    const builtDirectory = path.join(gameDirectory, 'dist')
    const source = (await exists(path.join(builtDirectory, 'index.html')))
      ? builtDirectory
      : gameDirectory

    if (!(await exists(path.join(source, 'index.html')))) continue
    await fs.cp(source, path.join(publicGamesDirectory, entry.name), {
      recursive: true,
      filter(sourcePath) {
        const relative = path.relative(source, sourcePath)
        const firstPart = relative.split(path.sep)[0]
        return !['node_modules', '.git'].includes(firstPart)
      },
    })
  }
}

async function referencedGamePaths() {
  if (!(await exists(stepsDirectory))) return []
  const paths = []
  const stepEntries = await fs.readdir(stepsDirectory, {withFileTypes: true})

  for (const stepEntry of stepEntries) {
    if (!stepEntry.isDirectory()) continue
    const files = await fs.readdir(path.join(stepsDirectory, stepEntry.name))
    for (const file of files.filter((name) => name.endsWith('.md'))) {
      const markdown = await fs.readFile(
        path.join(stepsDirectory, stepEntry.name, file),
        'utf8',
      )
      for (const match of markdown.matchAll(/src="\.\.\/\.\.\/games\/([^"?#]+)["?#]/g)) {
        paths.push(match[1].replace(/\/index\.html$/, '').replace(/\/$/, ''))
      }
    }
  }
  return [...new Set(paths)]
}

await Promise.all([copyStepAssets(), copyGames()])

for (const gamePath of await referencedGamePaths()) {
  const entry = path.join(publicGamesDirectory, gamePath, 'index.html')
  if (!(await exists(entry))) {
    throw new Error(
      `Step content references /games/${gamePath}/, but no standalone index.html was staged there`,
    )
  }
}

console.log('Prepared temporary step assets and game output in site/public/.')
