export type CompatibilityPreset = 'legacy-qwen-chatml'

export type ParameterInput = {
  key: string
  value: string
}

export type ImportConfig = {
  source: string
  modelName: string
  system?: string
  template?: string
  preset?: CompatibilityPreset
  parameters?: ParameterInput[]
}

export type ValidationIssue = {
  field: string
  message: string
}

export type ValidationResult = {
  issues: ValidationIssue[]
  valid: boolean
}
