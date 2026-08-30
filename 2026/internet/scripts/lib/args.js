export function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`)
    }

    const separator = argument.indexOf('=')
    if (separator !== -1) {
      args[argument.slice(2, separator)] = argument.slice(separator + 1)
      continue
    }

    const name = argument.slice(2)
    const value = argv[index + 1]
    if (value && !value.startsWith('--')) {
      args[name] = value
      index += 1
    } else {
      args[name] = true
    }
  }

  return args
}
