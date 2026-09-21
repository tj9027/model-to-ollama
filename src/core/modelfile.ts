import { getPresetTemplate } from './presets'
import type { ImportConfig, ParameterInput } from './types'

function quote(value: string): string {
  return JSON.stringify(value)
}

function sourceArgument(source: string): string {
  return /[\s"'\\$`();#]/.test(source) ? quote(source) : source
}

function parameterLine(parameter: ParameterInput): string {
  const value = parameter.key === 'stop' ? quote(parameter.value) : parameter.value
  return `PARAMETER ${parameter.key} ${value}`
}

export function resolveTemplate(config: ImportConfig): string | undefined {
  return config.template?.trim() || getPresetTemplate(config.preset)
}

export function buildModelfile(config: ImportConfig): string {
  const lines = [`FROM ${sourceArgument(config.source.trim())}`]
  for (const parameter of config.parameters ?? []) {
    if (parameter.key.trim() && parameter.value.trim()) lines.push(parameterLine({ key: parameter.key.trim(), value: parameter.value }))
  }
  if (config.system?.trim()) lines.push(`SYSTEM ${quote(config.system.trim())}`)
  const template = resolveTemplate(config)
  if (template) lines.push(`TEMPLATE ${quote(template)}`)
  return `${lines.join('\n')}\n`
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function buildCreateCommand(modelName: string, modelfilePath: string): string {
  return `ollama create ${shellQuote(modelName)} -f ${shellQuote(modelfilePath)}`
}
