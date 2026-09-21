import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

function tempDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'ollama-import-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function fakeOllama(directory: string) {
  const bin = join(directory, 'bin')
  mkdirSync(bin)
  const script = join(bin, 'ollama')
  writeFileSync(script, `#!/bin/sh
set -eu
case "${'$'}1" in
  --version) echo "ollama version 0.12.0" ;;
  list) echo "NAME ID SIZE MODIFIED" ;;
  rm) echo "deleted ${'$'}2" ;;
  create)
    if [ -n "${'$'}{OLLAMA_PATH_LOG:-}" ]; then printf '%s\\n' "${'$'}4" > "${'$'}OLLAMA_PATH_LOG"; fi
    if [ "${'$'}{OLLAMA_FAIL:-}" = "1" ]; then exit 7; fi
    echo "created" ;;
  show) echo "FROM /models/model.gguf" ;;
  *) exit 2 ;;
esac
`)
  chmodSync(script, 0o755)
  return bin
}

function invoke(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('src/cli.ts'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('CLI integration', () => {
  it('supports dry-run, uppercase extensions, spaces, and split patterns', () => {
    const directory = tempDirectory()
    const model = join(directory, 'model with spaces.GGUF')
    writeFileSync(model, 'fixture')
    const bin = fakeOllama(directory)
    const result = invoke([model, 'local/model:tag', '--dry-run'], { PATH: `${bin}${delimiter}${process.env.PATH}` })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`FROM "${model}"`)

    const split = invoke([join(directory, 'model-*.gguf'), 'split-model', '--dry-run'], { PATH: `${bin}${delimiter}${process.env.PATH}` })
    expect(split.status).toBe(0)
    expect(split.stdout).toContain('model-*.gguf')
  })

  it('preserves an explicitly requested Modelfile after create failure', () => {
    const directory = tempDirectory()
    const model = join(directory, 'model.gguf')
    const output = join(directory, 'Modelfile')
    writeFileSync(model, 'fixture')
    const bin = fakeOllama(directory)
    const result = invoke([model, 'local-model', '--modelfile', output], { PATH: `${bin}${delimiter}${process.env.PATH}`, OLLAMA_FAIL: '1' })
    expect(result.status).not.toBe(0)
    expect(existsSync(output)).toBe(true)
    expect(readFileSync(output, 'utf8')).toBe(`FROM ${model}\n`)
  })

  it('cleans temporary Modelfiles after create failure', () => {
    const directory = tempDirectory()
    const model = join(directory, 'model.gguf')
    const pathLog = join(directory, 'path.log')
    writeFileSync(model, 'fixture')
    const bin = fakeOllama(directory)
    const result = invoke([model, 'local-model'], { PATH: `${bin}${delimiter}${process.env.PATH}`, OLLAMA_FAIL: '1', OLLAMA_PATH_LOG: pathLog })
    expect(result.status).not.toBe(0)
    expect(existsSync(pathLog)).toBe(true)
    expect(existsSync(readFileSync(pathLog, 'utf8').trim())).toBe(false)
  })
})
