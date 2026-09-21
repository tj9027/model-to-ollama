import type { ImportConfig, ParameterInput, ValidationIssue, ValidationResult } from './types'

const modelNamePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/
const parameterKeyPattern = /^[a-z][a-z0-9_]*$/

export function isSplitSource(source: string): boolean {
  return source.includes('*') || source.includes('?') || source.includes('[')
}

export function hasGgufExtension(source: string): boolean {
  return source.trim().toLowerCase().endsWith('.gguf')
}

export function isAbsoluteSource(source: string): boolean {
  return source.startsWith('/') || /^\\\\/.test(source) || /^[A-Za-z]:[\\/]/.test(source)
}

export function validateModelName(modelName: string): string | undefined {
  const value = modelName.trim()
  if (!value) return 'Model name is required.'
  if (value !== modelName) return 'Model name must not start or end with whitespace.'
  if (/\s/.test(value) || value.includes('\0')) return 'Model name must not contain whitespace.'
  if (!modelNamePattern.test(value)) return 'Use letters, numbers, hyphens, underscores, dots, slashes, and an optional tag after a colon.'
  return undefined
}

export function validateSource(source: string, requireAbsolute = true): string | undefined {
  const value = source.trim()
  if (!value) return 'A GGUF path or split-model pattern is required.'
  if (value.includes('\0') || value.includes('\r') || value.includes('\n')) return 'The source must not contain null bytes or newlines.'
  if (!hasGgufExtension(value)) return 'The source must end in .gguf, including split patterns such as model-*.gguf.'
  if (requireAbsolute && !isAbsoluteSource(value)) return 'Use an absolute path so Ollama resolves the model reliably.'
  return undefined
}

const integerParameters = new Set(['num_ctx', 'num_batch', 'num_keep', 'num_gpu', 'num_thread', 'top_k', 'seed'])
const decimalParameters = new Set(['temperature', 'top_p', 'min_p', 'typical_p', 'repeat_penalty', 'repeat_last_n', 'tfs_z'])
const stringParameters = new Set(['stop', 'mirostat_eta', 'mirostat_tau'])

export function validateParameter(parameter: ParameterInput): string | undefined {
  const key = parameter.key.trim()
  const value = parameter.value
  if (!key || !parameterKeyPattern.test(key)) return `Invalid parameter key: ${parameter.key}`
  if (!value.trim()) return `Parameter ${key} needs a value.`
  if (stringParameters.has(key)) return undefined
  if (integerParameters.has(key)) {
    if (!/^-?\d+$/.test(value.trim())) return `${key} must be an integer.`
    if (Number(value) < 0 && key !== 'seed') return `${key} must not be negative.`
    return undefined
  }
  if (decimalParameters.has(key)) {
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return `${key} must be numeric.`
    const number = Number(value)
    if ((key === 'top_p' || key === 'min_p' || key === 'typical_p') && (number < 0 || number > 1)) return `${key} must be between 0 and 1.`
    if (key === 'temperature' && number < 0) return 'temperature must not be negative.'
    if (key === 'repeat_penalty' && number <= 0) return 'repeat_penalty must be greater than 0.'
  }
  return undefined
}

export function validateConfig(config: ImportConfig, requireAbsolute = true): ValidationResult {
  const issues: ValidationIssue[] = []
  const sourceError = validateSource(config.source, requireAbsolute)
  if (sourceError) issues.push({ field: 'source', message: sourceError })
  const nameError = validateModelName(config.modelName)
  if (nameError) issues.push({ field: 'modelName', message: nameError })
  if (config.template && config.preset) issues.push({ field: 'template', message: 'Choose a compatibility preset or a custom template, not both.' })
  if (config.template?.includes('\0')) issues.push({ field: 'template', message: 'Template must not contain null bytes.' })
  if (config.system?.includes('\0')) issues.push({ field: 'system', message: 'System text must not contain null bytes.' })
  for (const parameter of config.parameters ?? []) {
    const error = validateParameter(parameter)
    if (error) issues.push({ field: `parameter:${parameter.key}`, message: error })
  }
  return { issues, valid: issues.length === 0 }
}
