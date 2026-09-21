import type { CompatibilityPreset } from './types'

export const compatibilityPresets: Record<CompatibilityPreset, { label: string; template: string; description: string }> = {
  'legacy-qwen-chatml': {
    label: 'Legacy Qwen / ChatML compatibility',
    description: 'Explicit override for older or mismatched Qwen GGUF metadata. It can reduce model-specific capabilities.',
    template: `{{- range .Messages }}{{- if eq .Role "system" }}<|im_start|>system
{{ .Content }}<|im_end|>
{{- else if eq .Role "assistant" }}<|im_start|>assistant
{{ .Content }}<|im_end|>
{{- else }}<|im_start|>user
{{ .Content }}<|im_end|>
{{- end }}{{- end }}<|im_start|>assistant`,
  },
}

export function getPresetTemplate(preset?: CompatibilityPreset): string | undefined {
  return preset ? compatibilityPresets[preset]?.template : undefined
}
