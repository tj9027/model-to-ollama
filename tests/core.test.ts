import { describe, expect, it } from 'vitest'
import { buildCreateCommand, buildModelfile } from '../src/core/modelfile'
import { validateConfig, validateParameter, validateSource } from '../src/core/validation'

describe('Modelfile generation', () => {
  it('generates a minimal native import', () => {
    expect(buildModelfile({ source: '/models/model.gguf', modelName: 'model' })).toBe('FROM /models/model.gguf\n')
  })

  it('preserves paths with spaces and shell characters as Modelfile data', () => {
    const output = buildModelfile({ source: "/models/a model $1's.gguf", modelName: 'model' })
    expect(output).toContain('FROM "/models/a model $1\'s.gguf"')
    expect(output).not.toContain('ollama create')
  })

  it('emits optional system text, parameters, stop strings, and templates deterministically', () => {
    const config = {
      source: '/models/model.gguf',
      modelName: 'model',
      system: 'line one\nline two',
      template: '{{ .Prompt }}',
      parameters: [{ key: 'temperature', value: '0.7' }, { key: 'stop', value: '<END>' }],
    }
    expect(buildModelfile(config)).toBe('FROM /models/model.gguf\nPARAMETER temperature 0.7\nPARAMETER stop "<END>"\nSYSTEM "line one\\nline two"\nTEMPLATE "{{ .Prompt }}"\n')
  })

  it('quotes generated shell arguments', () => {
    expect(buildCreateCommand("user/model:'unsafe name'", '/tmp/a path/Modelfile')).toBe("ollama create 'user/model:'\\''unsafe name'\\''' -f '/tmp/a path/Modelfile'")
  })
})

describe('validation', () => {
  it('accepts uppercase GGUF and split patterns without filesystem checks', () => {
    expect(validateSource('/models/model.GGUF')).toBeUndefined()
    expect(validateSource('/models/model-*.gguf')).toBeUndefined()
  })

  it('rejects relative, malformed, and unsafe inputs', () => {
    expect(validateSource('model.gguf')).toContain('absolute')
    expect(validateSource('/models/model.bin')).toContain('end in .gguf')
    expect(validateConfig({ source: '/models/model.gguf', modelName: 'model; rm -rf /' }).valid).toBe(false)
    expect(validateConfig({ source: '/models/model.gguf', modelName: 'model name' }).valid).toBe(false)
  })

  it('validates optional advanced parameters without changing Ollama ownership', () => {
    expect(validateParameter({ key: 'num_ctx', value: '32768' })).toBeUndefined()
    expect(validateParameter({ key: 'top_p', value: '1.4' })).toContain('between 0 and 1')
    expect(validateParameter({ key: 'temperature', value: 'warm' })).toContain('numeric')
    expect(validateParameter({ key: 'stop', value: 'a; b' })).toBeUndefined()
  })
})
