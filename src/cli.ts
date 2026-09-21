import { spawnSync } from 'node:child_process'
import { existsSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { buildCreateCommand, buildModelfile } from './core/modelfile'
import { validateConfig, isSplitSource } from './core/validation'
import type { CompatibilityPreset, ImportConfig, ParameterInput } from './core/types'

type ParsedArgs = ImportConfig & {
  dryRun: boolean
  keepModelfile: boolean
  replace: boolean
  modelfilePath?: string
}

class CliError extends Error {}

function usage(): string {
  return `Import a local GGUF model into Ollama.

Usage:
  ./convert.sh <path-or-split-pattern.gguf> <ollama-model-name> [options]

Options:
  --system <text>          Add a SYSTEM instruction.
  --template <text>        Explicitly override the native model template.
  --preset <name>          Use a compatibility preset: legacy-qwen-chatml.
  --parameter <key=value> Add an optional PARAMETER. May be repeated.
  --modelfile <path>       Persist the generated Modelfile at this path.
  --keep-modelfile         Keep an auto-named Modelfile after import.
  --replace                Remove an existing model before creating it.
  --dry-run                Print the Modelfile without calling Ollama.
  -h, --help               Show this help.

Examples:
  ./convert.sh /models/llama.Q4_K_M.gguf llama-local
  ./convert.sh '/models/qwen-00001-of-00003.gguf' qwen-local
  ./convert.sh '/models/qwen-*.gguf' qwen-local --dry-run
  ./convert.sh /models/model.gguf model --parameter temperature=0.7
`
}

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new CliError(`${option} requires a value.`)
  return value
}

function parseParameter(value: string): ParameterInput {
  const separator = value.indexOf('=')
  if (separator <= 0) throw new CliError(`Parameter must use key=value: ${value}`)
  return { key: value.slice(0, separator), value: value.slice(separator + 1) }
}

function parseArgs(args: string[]): ParsedArgs {
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(usage())
    process.exit(0)
  }
  const positional: string[] = []
  const parameters: ParameterInput[] = []
  let system: string | undefined
  let template: string | undefined
  let preset: CompatibilityPreset | undefined
  let modelfilePath: string | undefined
  let dryRun = false
  let keepModelfile = false
  let replace = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('-')) {
      positional.push(arg)
      continue
    }
    if (arg === '--system') {
      system = requireValue(args, index, arg)
      index += 1
    } else if (arg === '--template') {
      template = requireValue(args, index, arg)
      index += 1
    } else if (arg === '--preset') {
      const value = requireValue(args, index, arg)
      if (value !== 'legacy-qwen-chatml') throw new CliError(`Unknown preset: ${value}`)
      preset = value
      index += 1
    } else if (arg === '--parameter') {
      parameters.push(parseParameter(requireValue(args, index, arg)))
      index += 1
    } else if (arg === '--modelfile') {
      modelfilePath = requireValue(args, index, arg)
      index += 1
    } else if (arg === '--dry-run') dryRun = true
    else if (arg === '--keep-modelfile') keepModelfile = true
    else if (arg === '--replace') replace = true
    else throw new CliError(`Unknown option: ${arg}`)
  }

  if (positional.length !== 2) throw new CliError('Expected exactly a GGUF path/pattern and an Ollama model name.')
  return { source: positional[0], modelName: positional[1], system, template, preset, parameters, dryRun, keepModelfile, replace, modelfilePath }
}

function validateFileSource(source: string): void {
  if (isSplitSource(source)) return
  const resolved = resolve(source)
  if (!existsSync(resolved)) throw new CliError(`GGUF file not found: ${source}`)
  if (!statSync(resolved).isFile()) throw new CliError(`GGUF source is not a regular file: ${source}`)
}

function run(command: string, args: string[], inherit = false): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' })
  if (result.error) throw new CliError(`Unable to run ${command}: ${result.error.message}`)
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function ollamaVersion(): string {
  const result = run('ollama', ['--version'])
  if (result.status !== 0) throw new CliError(`Ollama version check failed: ${result.stderr.trim() || result.stdout.trim()}`)
  return (result.stdout || result.stderr).trim()
}

function modelExists(modelName: string): boolean {
  const result = run('ollama', ['list'])
  if (result.status !== 0) throw new CliError(`Could not list Ollama models: ${result.stderr.trim() || result.stdout.trim()}`)
  return result.stdout.split('\n').slice(1).some((line) => {
    const listedName = line.trim().split(/\s+/)[0]
    return listedName === modelName || (listedName === `${modelName}:latest` && !modelName.includes(':'))
  })
}

function removeExistingModel(modelName: string): void {
  if (!modelExists(modelName)) return
  const result = run('ollama', ['rm', modelName])
  if (result.status !== 0) throw new CliError(`Could not remove existing model ${modelName}: ${result.stderr.trim() || result.stdout.trim()}`)
}

function writeOutput(config: ImportConfig, requestedPath: string | undefined, keep: boolean): { path?: string; cleanup: () => void } {
  if (requestedPath) {
    const outputPath = isAbsolute(requestedPath) ? requestedPath : resolve(requestedPath)
    const parent = dirname(outputPath)
    if (!existsSync(parent)) throw new CliError(`Modelfile directory does not exist: ${parent}`)
    writeFileSync(outputPath, buildModelfile(config), { encoding: 'utf8', mode: 0o600 })
    return { path: outputPath, cleanup: () => undefined }
  }
  if (keep) {
    const safeName = config.modelName.replaceAll(/[^A-Za-z0-9._-]+/g, '-')
    const outputPath = resolve(`Modelfile.${safeName}`)
    writeFileSync(outputPath, buildModelfile(config), { encoding: 'utf8', mode: 0o600 })
    return { path: outputPath, cleanup: () => undefined }
  }
  const directory = mkdtempSync(join(tmpdir(), 'ollama-import-'))
  const outputPath = join(directory, 'Modelfile')
  try {
    writeFileSync(outputPath, buildModelfile(config), { encoding: 'utf8', mode: 0o600 })
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
  return { path: outputPath, cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}

function printDryRun(config: ImportConfig, outputPath?: string): void {
  if (outputPath) {
    process.stdout.write(`Wrote ${outputPath}\n`)
    return
  }
  process.stdout.write(buildModelfile(config))
}

export function runCli(args: string[]): number {
  try {
    const parsed = parseArgs(args)
    const config: ImportConfig = { source: parsed.source, modelName: parsed.modelName, system: parsed.system, template: parsed.template, preset: parsed.preset, parameters: parsed.parameters }
    const validation = validateConfig(config)
    if (!validation.valid) throw new CliError(validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join('\n'))
    validateFileSource(config.source)

    if (parsed.dryRun) {
      const output = parsed.modelfilePath || (parsed.keepModelfile ? `Modelfile.${config.modelName.replaceAll(/[^A-Za-z0-9._-]+/g, '-')}` : undefined)
      if (output) {
        const written = writeOutput(config, output, false)
        printDryRun(config, written.path)
      } else printDryRun(config)
      return 0
    }

    const version = ollamaVersion()
    const output = writeOutput(config, parsed.modelfilePath, parsed.keepModelfile)
    let cleaned = false
    const cleanup = () => {
      if (!cleaned) {
        cleaned = true
        output.cleanup()
      }
    }
    process.once('exit', cleanup)
    process.once('SIGINT', () => { cleanup(); process.exit(130) })
    process.once('SIGTERM', () => { cleanup(); process.exit(143) })

    if (parsed.replace) removeExistingModel(config.modelName)
    const create = run('ollama', ['create', config.modelName, '-f', output.path!], true)
    if (create.status !== 0) throw new CliError(`ollama create failed for ${config.modelName}.`)
    const inspect = run('ollama', ['show', config.modelName, '--modelfile'])
    if (inspect.status !== 0) throw new CliError(`Model was created, but inspection failed: ${inspect.stderr.trim() || inspect.stdout.trim()}`)
    cleanup()
    process.stdout.write(`Created ${config.modelName} using ${version}.\n`)
    if (parsed.modelfilePath || parsed.keepModelfile) process.stdout.write(`${buildCreateCommand(config.modelName, output.path!)}\n`)
    return 0
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = runCli(process.argv.slice(2))
