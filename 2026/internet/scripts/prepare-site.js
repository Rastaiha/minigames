import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'

const rootDirectory = process.cwd()
const stepsDirectory = path.join(rootDirectory, 'steps')
const gamesDirectory = path.join(rootDirectory, 'games')
const introDirectory = path.join(rootDirectory, 'intro')
const publicDirectory = path.join(rootDirectory, 'site', 'public')
const publicStepsDirectory = path.join(publicDirectory, 'steps')
const publicGamesDirectory = path.join(publicDirectory, 'games')
const publicIntroDirectory = path.join(publicDirectory, 'intro')
const gameVersionsPath = path.join(publicDirectory, 'game-entry-versions.json')
const introVersionsPath = path.join(publicDirectory, 'intro-entry-versions.json')
const cleanInstall = process.argv.includes('--clean-install')
const dependencyStateFilename = '.workshop-dependency-state'

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'inherit'})
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve()
      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`${command} ${args.join(' ')} failed with ${reason}`))
    })
  })
}

async function dependencyState(gameDirectory) {
  const hash = createHash('sha256')
  for (const filename of ['package.json', 'package-lock.json']) {
    hash.update(filename)
    hash.update(await fs.readFile(path.join(gameDirectory, filename)))
  }
  return hash.digest('hex')
}

async function installGameDependencies(gameName, gameDirectory, npm) {
  const nodeModulesDirectory = path.join(gameDirectory, 'node_modules')
  const statePath = path.join(nodeModulesDirectory, dependencyStateFilename)
  const expectedState = await dependencyState(gameDirectory)
  let installedState = null

  try {
    installedState = (await fs.readFile(statePath, 'utf8')).trim()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  if (!cleanInstall && installedState === expectedState) {
    console.log(`Reusing installed dependencies for game ${gameName}.`)
    return
  }

  await run(npm, ['ci'], gameDirectory)
  await fs.writeFile(statePath, `${expectedState}\n`)
}

async function fixRoutingGameScriptOrder(gameName, packageJson, gameDirectory) {
  if (gameName !== 'routing' || packageJson.name !== 'network-routing-game') return

  const distDirectory = path.join(gameDirectory, 'dist')
  const entries = await fs.readdir(distDirectory, {withFileTypes: true, recursive: true})
  let fixedPageCount = 0

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== '.html') continue

    const outputPath = path.join(entry.parentPath, entry.name)
    const html = await fs.readFile(outputPath, 'utf8')
    const headEnd = html.indexOf('</head>')
    const bodyEnd = html.lastIndexOf('</body>')
    if (headEnd === -1 || bodyEnd === -1) continue

    const head = html.slice(0, headEnd)
    const scriptMatch = head.match(/<script>([\s\S]*?getElementById\(["']app["']\)[\s\S]*?)<\/script>/)
    if (!scriptMatch) continue

    const withoutEarlyScript = html.replace(scriptMatch[0], '')
    const fixedHtml = withoutEarlyScript.replace(
      '</body>',
      () => `  ${scriptMatch[0]}\n  </body>`,
    )
    await fs.writeFile(outputPath, fixedHtml)
    fixedPageCount++
  }

  if (fixedPageCount > 0) {
    console.log(
      `Moved the routing game bundle after its DOM in ${fixedPageCount} page(s) ` +
      'to preserve classic-script execution order.',
    )
  }
}

async function addRoutingGameNestedEntries(gameName, packageJson, gameDirectory) {
  if (gameName !== 'routing' || packageJson.name !== 'network-routing-game') return

  const distDirectory = path.join(gameDirectory, 'dist')
  const hubPath = path.join(distDirectory, 'index.html')
  const routingPath = path.join(distDirectory, 'routing.html')

  // Newer versions of the routing game expose the two activities directly and
  // no longer build the old hub page. Keep the workshop's game entry contract by
  // using the primary routing activity as the root entry point.
  if (!(await exists(hubPath)) && await exists(routingPath)) {
    await fs.copyFile(routingPath, hubPath)
    console.log('Added routing game root entry point from routing.html.')
  }

  if (!(await exists(hubPath))) return

  let hubHtml = await fs.readFile(hubPath, 'utf8')
  let addedEntryCount = 0

  for (const pageName of ['routing', 'bellman-ford']) {
    const flatPath = path.join(distDirectory, `${pageName}.html`)
    const nestedPath = path.join(distDirectory, pageName, 'index.html')

    if (!(await exists(nestedPath)) && await exists(flatPath)) {
      const flatHtml = await fs.readFile(flatPath, 'utf8')
      const nestedHtml = flatHtml.replaceAll('href="./index.html"', 'href="../index.html"')
      await fs.mkdir(path.dirname(nestedPath), {recursive: true})
      await fs.writeFile(nestedPath, nestedHtml)
      addedEntryCount++
    }

    if (await exists(nestedPath)) {
      hubHtml = hubHtml.replaceAll(
        `href="./${pageName}.html"`,
        `href="./${pageName}/index.html"`,
      )
    }
  }

  await fs.writeFile(hubPath, hubHtml)
  if (addedEntryCount > 0) {
    console.log(`Added ${addedEntryCount} nested routing game entry point(s).`)
  }
}

async function assertSubmodulesAvailable() {
  const configPath = path.join(rootDirectory, '.gitmodules')
  if (!(await exists(configPath))) return

  const config = await fs.readFile(configPath, 'utf8')
  const submodulePaths = [...config.matchAll(/^\s*path\s*=\s*(.+)$/gm)]
    .map((match) => match[1].trim())

  for (const submodulePath of submodulePaths) {
    if (await exists(path.join(rootDirectory, submodulePath, '.git'))) continue
    throw new Error(
      `Submodule ${submodulePath} is not initialized. Run: git submodule update --init --recursive`,
    )
  }
}

async function buildGames() {
  if (!(await exists(gamesDirectory))) return
  const entries = await fs.readdir(gamesDirectory, {withFileTypes: true})

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const gameDirectory = path.join(gamesDirectory, entry.name)
    const packagePath = path.join(gameDirectory, 'package.json')
    if (!(await exists(packagePath))) continue

    const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'))
    if (!packageJson.scripts?.build) continue

    if (!(await exists(path.join(gameDirectory, 'package-lock.json')))) {
      throw new Error(
        `Game ${entry.name} has an npm build but no package-lock.json for npm ci`,
      )
    }

    console.log(`Building game ${entry.name}...`)
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    await installGameDependencies(entry.name, gameDirectory, npm)
    await run(npm, ['run', 'build'], gameDirectory)

    await fixRoutingGameScriptOrder(entry.name, packageJson, gameDirectory)
    await addRoutingGameNestedEntries(entry.name, packageJson, gameDirectory)

    if (!(await exists(path.join(gameDirectory, 'dist', 'index.html')))) {
      throw new Error(
        `Game ${entry.name} finished building without creating dist/index.html`,
      )
    }
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

async function copyIntro() {
  await fs.rm(publicIntroDirectory, {recursive: true, force: true})
  if (!(await exists(introDirectory))) return
  await fs.cp(introDirectory, publicIntroDirectory, {recursive: true})
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

async function gameEntryPaths(directory = publicGamesDirectory) {
  if (!(await exists(directory))) return []

  const paths = []
  const entries = await fs.readdir(directory, {withFileTypes: true})
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...await gameEntryPaths(entryPath))
    } else if (entry.name === 'index.html') {
      paths.push(entryPath)
    }
  }
  return paths
}

async function writeGameEntryVersions() {
  const versions = {}
  for (const entryPath of await gameEntryPaths()) {
    const gamePath = path.dirname(path.relative(publicGamesDirectory, entryPath))
      .split(path.sep)
      .join('/')
    const contents = await fs.readFile(entryPath)
    versions[gamePath] = createHash('sha256')
      .update(contents)
      .digest('hex')
      .slice(0, 12)
  }

  const orderedVersions = Object.fromEntries(
    Object.entries(versions).sort(([first], [second]) => first.localeCompare(second)),
  )
  await fs.writeFile(gameVersionsPath, `${JSON.stringify(orderedVersions, null, 2)}\n`)
}

async function writeIntroEntryVersions() {
  const versions = {}
  const entryName = 'slides.html'
  const entryPath = path.join(publicIntroDirectory, entryName)

  if (await exists(entryPath)) {
    const contents = await fs.readFile(entryPath)
    versions[entryName] = createHash('sha256')
      .update(contents)
      .digest('hex')
      .slice(0, 12)
  }

  await fs.writeFile(introVersionsPath, `${JSON.stringify(versions, null, 2)}\n`)
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

await assertSubmodulesAvailable()
await buildGames()
await Promise.all([copyStepAssets(), copyGames(), copyIntro()])
await Promise.all([writeGameEntryVersions(), writeIntroEntryVersions()])

for (const gamePath of await referencedGamePaths()) {
  const entry = path.join(publicGamesDirectory, gamePath, 'index.html')
  if (!(await exists(entry))) {
    throw new Error(
      `Step content references /games/${gamePath}/, but no standalone index.html was staged there`,
    )
  }
}

console.log('Prepared temporary step assets and game output in site/public/.')
