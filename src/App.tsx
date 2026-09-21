import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Clipboard, Copy, Download, FileCode2, FolderOpen, Info, RotateCcw, ShieldCheck, Terminal } from 'lucide-react'
import { buildCreateCommand, buildModelfile } from './core/modelfile'
import { compatibilityPresets } from './core/presets'
import { validateConfig } from './core/validation'
import type { CompatibilityPreset, ImportConfig, ParameterInput } from './core/types'

type TemplateChoice = 'native' | CompatibilityPreset | 'custom'

type FormState = {
  source: string
  modelName: string
  templateChoice: TemplateChoice
  system: string
  customTemplate: string
  numCtx: string
  temperature: string
  topP: string
  topK: string
  repeatPenalty: string
  stop: string
}

const initialState: FormState = {
  source: '',
  modelName: '',
  templateChoice: 'native',
  system: '',
  customTemplate: '',
  numCtx: '',
  temperature: '',
  topP: '',
  topK: '',
  repeatPenalty: '',
  stop: '',
}

function configFromState(state: FormState): ImportConfig {
  const parameters: ParameterInput[] = [
    ['num_ctx', state.numCtx],
    ['temperature', state.temperature],
    ['top_p', state.topP],
    ['top_k', state.topK],
    ['repeat_penalty', state.repeatPenalty],
    ['stop', state.stop],
  ].filter(([, value]) => value.trim()).map(([key, value]) => ({ key, value }))
  return {
    source: state.source,
    modelName: state.modelName,
    system: state.system || undefined,
    template: state.templateChoice === 'custom' ? state.customTemplate : undefined,
    preset: state.templateChoice === 'native' || state.templateChoice === 'custom' ? undefined : state.templateChoice,
    parameters,
  }
}

function App() {
  const [state, setState] = useState(initialState)
  const [activeTab, setActiveTab] = useState<'setup' | 'advanced'>('setup')
  const [copied, setCopied] = useState<'file' | 'command' | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const config = useMemo(() => configFromState(state), [state])
  const validation = useMemo(() => validateConfig(config), [config])
  const modelfile = useMemo(() => buildModelfile(config), [config])
  const command = useMemo(() => buildCreateCommand(state.modelName || '<model-name>', 'Modelfile'), [state.modelName])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }))
  }

  async function copyText(kind: 'file' | 'command', text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1600)
  }

  function downloadModelfile() {
    const blob = new Blob([modelfile], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Modelfile'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-[#f4f3f0] text-[#292824]">
      <header className="border-b border-black/10 bg-[#f8f7f4]/90">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#292824] text-[#f6f2ea]"><Terminal size={18} /></div>
            <div><p className="text-[15px] font-semibold tracking-tight">Ollama Importer</p><p className="text-[11px] text-black/45">GGUF → local model</p></div>
          </div>
          <button className="quiet-button" onClick={() => setShowHelp((value) => !value)}><Info size={15} /> How it works</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1380px] px-6 py-10 lg:px-10 lg:py-14">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">Local model setup</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-[#22211f] md:text-5xl">Bring a GGUF into Ollama, carefully.</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-black/55">Prepare a native import, review the generated Modelfile, then run one local command. Nothing is uploaded.</p>
        </div>

        {showHelp && <div className="mb-7 flex gap-3 rounded-2xl border border-[#bbcbb9] bg-[#edf4eb] p-4 text-sm leading-6 text-[#38503a]"><ShieldCheck className="mt-0.5 shrink-0" size={18} /><p>Ollama owns model-specific templates and capabilities by default. This page only generates text; it never executes commands or uploads model files.</p></div>}

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_480px]">
          <section className="panel p-6 md:p-8">
            <div className="mb-7 flex items-center justify-between border-b border-black/8 pb-5"><div><p className="section-kicker">01 / Model details</p><h2 className="mt-1 text-xl font-medium">Start with the source file</h2></div><div className="step-dot">1</div></div>
            <label className="field-label">GGUF path or split pattern <span>required</span></label>
            <div className="relative mt-2"><FolderOpen className="field-icon" size={17} /><input className="input with-icon" value={state.source} onChange={(event) => update('source', event.target.value)} placeholder="/Users/you/Downloads/model.Q4_K_M.gguf" /></div>
            <p className="field-help">Use an absolute path. Split models may use a pattern such as `/models/model-*.gguf`.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div><label className="field-label">New Ollama model name <span>required</span></label><input className="input mt-2" value={state.modelName} onChange={(event) => update('modelName', event.target.value)} placeholder="qwen-unc:4b" /><p className="field-help">Use a name such as `family:tag`.</p></div>
              <div><label className="field-label">Template mode</label><div className="relative mt-2"><select className="input appearance-none pr-10" value={state.templateChoice} onChange={(event) => update('templateChoice', event.target.value as TemplateChoice)}><option value="native">Native Ollama handling (recommended)</option><option value="legacy-qwen-chatml">{compatibilityPresets['legacy-qwen-chatml'].label}</option><option value="custom">Custom Go template</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-black/40" size={16} /></div><p className="field-help">Native mode preserves embedded metadata and model capabilities.</p></div>
            </div>

            {state.templateChoice !== 'native' && <div className="mt-5 flex gap-2 rounded-xl border border-[#e3c9b4] bg-[#fff6ed] p-3 text-xs leading-5 text-[#865631]"><AlertTriangle className="mt-0.5 shrink-0" size={15} /><p>{state.templateChoice === 'custom' ? 'A custom template can disable model-specific tools, thinking, roles, or future Ollama improvements.' : compatibilityPresets['legacy-qwen-chatml'].description}</p></div>}
            {state.templateChoice === 'custom' && <div className="mt-5"><label className="field-label">Custom Go template</label><textarea className="input mt-2 min-h-40 resize-y font-mono text-xs" value={state.customTemplate} onChange={(event) => update('customTemplate', event.target.value)} placeholder="{{ .Prompt }}" /><p className="field-help">Available variables include `.System`, `.Prompt`, `.Response`, and `.Messages`.</p></div>}

            <div className="mt-8 flex gap-1 border-b border-black/8"><button className={`tab ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}>Basic setup</button><button className={`tab ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => setActiveTab('advanced')}>Advanced controls</button></div>
            {activeTab === 'setup' ? <div className="pt-6"><label className="field-label">System instruction <span>optional</span></label><textarea className="input mt-2 min-h-28 resize-y" value={state.system} onChange={(event) => update('system', event.target.value)} placeholder="Leave empty to preserve the model's native behavior." /><p className="field-help">This adds a SYSTEM instruction to the Modelfile only when you provide one.</p></div> : <div className="grid gap-5 pt-6 sm:grid-cols-2"><NumberField label="Context window" value={state.numCtx} onChange={(value) => update('numCtx', value)} help="optional num_ctx" /><NumberField label="Temperature" value={state.temperature} onChange={(value) => update('temperature', value)} help="optional" /><NumberField label="Top P" value={state.topP} onChange={(value) => update('topP', value)} help="optional" /><NumberField label="Top K" value={state.topK} onChange={(value) => update('topK', value)} help="optional" /><NumberField label="Repeat penalty" value={state.repeatPenalty} onChange={(value) => update('repeatPenalty', value)} help="optional" /><div><label className="field-label">Stop string</label><input className="input mt-2" value={state.stop} onChange={(event) => update('stop', event.target.value)} placeholder="optional" /><p className="field-help">Leave empty to keep native stop handling.</p></div></div>}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-black/8 px-5 py-4"><div><p className="section-kicker">02 / Review</p><h2 className="mt-1 text-lg font-medium">Generated Modelfile</h2></div><FileCode2 size={18} className="text-black/35" /></div><pre className="code-preview">{modelfile}</pre><div className="flex gap-2 border-t border-black/8 p-4"><button className="secondary-button flex-1" onClick={() => copyText('file', modelfile)}>{copied === 'file' ? <Check size={15} /> : <Copy size={15} />} {copied === 'file' ? 'Copied' : 'Copy file'}</button><button className="secondary-button flex-1" onClick={downloadModelfile}><Download size={15} /> Download</button></div></section>
            <section className="panel p-5"><p className="section-kicker">03 / Run locally</p><div className="mt-3 rounded-xl bg-[#292824] p-4 text-[12px] leading-6 text-[#f7f2e8]"><code className="break-all">{command}</code></div><button className="primary-button mt-3 w-full" disabled={!validation.valid} onClick={() => copyText('command', command)}>{copied === 'command' ? <Check size={16} /> : <Clipboard size={16} />} {copied === 'command' ? 'Command copied' : 'Copy create command'}</button><div className="mt-4 flex gap-2 text-xs leading-5 text-black/50"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#55745b]" /><p>Review the path and name before running it in Terminal. The browser never executes commands.</p></div></section>
            {!validation.valid ? <div className="rounded-2xl border border-[#e3c9b4] bg-[#fff6ed] p-4"><div className="flex gap-2 text-sm font-medium text-[#865631]"><AlertTriangle size={16} /> Needs attention</div><ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-[#865631]">{validation.issues.map((issue) => <li key={`${issue.field}-${issue.message}`} className="list-disc">{issue.message}</li>)}</ul></div> : <div className="flex gap-3 rounded-2xl border border-[#bbcbb9] bg-[#edf4eb] p-4 text-sm text-[#38503a]"><Check size={17} className="mt-0.5" /><p>Ready. Native mode will preserve Ollama's model metadata.</p></div>}
          </aside>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-5 text-xs text-black/45"><p><span className="font-medium text-black/65">Safe by default.</span> No upload · no hidden network request · no destructive replacement.</p><button className="quiet-button" onClick={() => setState(initialState)}><RotateCcw size={14} /> Reset form</button></footer>
      </div>
    </main>
  )
}

function NumberField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <div><label className="field-label">{label}</label><input className="input mt-2" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /><p className="field-help">{help}</p></div>
}

export default App
