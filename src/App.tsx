import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  Info,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
} from 'lucide-react'

type Preset = 'qwen' | 'chatml' | 'custom'

type Settings = {
  ggufPath: string
  modelName: string
  preset: Preset
  system: string
  context: string
  temperature: string
  topP: string
  topK: string
  repeatPenalty: string
  stopTokens: string
  customTemplate: string
  replace: boolean
}

const initialSettings: Settings = {
  ggufPath: '',
  modelName: '',
  preset: 'qwen',
  system: '',
  context: '32768',
  temperature: '0.7',
  topP: '0.8',
  topK: '20',
  repeatPenalty: '1.05',
  stopTokens: '<|im_start|>, <|im_end|>',
  customTemplate: '{{ .Prompt }}',
  replace: false,
}

const qwenTemplate = `{{- range .Messages }}{{- if eq .Role "system" }}<|im_start|>system
{{ .Content }}<|im_end|>
{{- else if eq .Role "assistant" }}<|im_start|>assistant
{{ .Content }}<|im_end|>
{{- else }}<|im_start|>user
{{ .Content }}<|im_end|>
{{- end }}{{- end }}<|im_start|>assistant
`

const chatmlTemplate = `{{- if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{- end }}{{- range .Messages }}<|im_start|>{{ .Role }}
{{ .Content }}<|im_end|>
{{- end }}<|im_start|>assistant
`

function quote(value: string) {
  return `"""${value.replaceAll('"""', '\\"\\"\\"')}"""`
}

function buildModelfile(settings: Settings) {
  const template = settings.preset === 'qwen' ? qwenTemplate : settings.preset === 'chatml' ? chatmlTemplate : settings.customTemplate
  const lines = [`FROM ${settings.ggufPath.trim()}`]
  const parameters = [
    ['num_ctx', settings.context],
    ['temperature', settings.temperature],
    ['top_p', settings.topP],
    ['top_k', settings.topK],
    ['repeat_penalty', settings.repeatPenalty],
  ]
  parameters.forEach(([key, value]) => {
    if (value.trim()) lines.push(`PARAMETER ${key} ${value.trim()}`)
  })
  settings.stopTokens.split(',').map((token) => token.trim()).filter(Boolean).forEach((token) => lines.push(`PARAMETER stop ${token}`))
  if (settings.system.trim()) lines.push(`SYSTEM ${quote(settings.system.trim())}`)
  if (template.trim()) lines.push(`TEMPLATE ${quote(template.trimEnd())}`)
  return `${lines.join('\n')}\n`
}

function App() {
  const [settings, setSettings] = useState(initialSettings)
  const [activeTab, setActiveTab] = useState<'setup' | 'advanced'>('setup')
  const [copied, setCopied] = useState<'file' | 'command' | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const errors = useMemo(() => {
    const next: string[] = []
    if (!settings.ggufPath.trim()) next.push('Add the absolute path to a .gguf file.')
    if (settings.ggufPath.trim() && !settings.ggufPath.toLowerCase().endsWith('.gguf')) next.push('The model path must end in .gguf.')
    if (!settings.modelName.trim()) next.push('Choose an Ollama model name.')
    if (settings.modelName.includes(' ')) next.push('Ollama model names cannot contain spaces.')
    return next
  }, [settings])

  const modelfile = useMemo(() => buildModelfile(settings), [settings])
  const command = useMemo(() => {
    const replace = settings.replace ? ' --replace' : ''
    return `ollama create ${settings.modelName || '<model-name>'} -f Modelfile${replace}`
  }, [settings.modelName, settings.replace])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
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
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-black/55">Fill in the model details, review the generated Modelfile, then run one local command. Nothing is uploaded.</p>
        </div>

        {showHelp && <div className="mb-7 flex gap-3 rounded-2xl border border-[#bbcbb9] bg-[#edf4eb] p-4 text-sm leading-6 text-[#38503a]"><ShieldCheck className="mt-0.5 shrink-0" size={18} /><p>Your browser only generates text. The final `ollama create` command runs on your Mac and imports the path you provide into Ollama's local store.</p></div>}

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_480px]">
          <section className="panel p-6 md:p-8">
            <div className="mb-7 flex items-center justify-between border-b border-black/8 pb-5">
              <div><p className="section-kicker">01 / Model details</p><h2 className="mt-1 text-xl font-medium">Start with the source file</h2></div>
              <div className="step-dot">1</div>
            </div>
            <label className="field-label">GGUF file path <span>required</span></label>
            <div className="relative mt-2"><FolderOpen className="field-icon" size={17} /><input className="input with-icon" value={settings.ggufPath} onChange={(event) => update('ggufPath', event.target.value)} placeholder="/Users/you/Downloads/model.Q4_K_M.gguf" /></div>
            <p className="field-help">Use an absolute path. Ollama reads the file directly; it is not copied by this page.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div><label className="field-label">New Ollama model name <span>required</span></label><input className="input mt-2" value={settings.modelName} onChange={(event) => update('modelName', event.target.value)} placeholder="qwen-unc:4b" /><p className="field-help">Example: `family:tag`</p></div>
              <div><label className="field-label">Template preset</label><div className="relative mt-2"><select className="input appearance-none pr-10" value={settings.preset} onChange={(event) => update('preset', event.target.value as Preset)}><option value="qwen">Qwen / ChatML safe</option><option value="chatml">ChatML messages</option><option value="custom">Custom Go template</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-black/40" size={16} /></div><p className="field-help">Qwen preset avoids the system-message Jinja error.</p></div>
            </div>

            <div className="mt-8 flex gap-1 border-b border-black/8"><button className={`tab ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}>Basic setup</button><button className={`tab ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => setActiveTab('advanced')}>Advanced controls</button></div>
            {activeTab === 'setup' ? <div className="pt-6"><label className="field-label">System instruction <span>optional</span></label><textarea className="input mt-2 min-h-28 resize-y" value={settings.system} onChange={(event) => update('system', event.target.value)} placeholder="You are a helpful local assistant." /><p className="field-help">Keep this at the beginning of the conversation for Qwen-compatible templates.</p></div> : <div className="grid gap-5 pt-6 sm:grid-cols-2"><NumberField label="Context window" value={settings.context} onChange={(value) => update('context', value)} help="num_ctx" /><NumberField label="Temperature" value={settings.temperature} onChange={(value) => update('temperature', value)} help="0 = focused" /><NumberField label="Top P" value={settings.topP} onChange={(value) => update('topP', value)} help="sampling range" /><NumberField label="Top K" value={settings.topK} onChange={(value) => update('topK', value)} help="candidate limit" /><NumberField label="Repeat penalty" value={settings.repeatPenalty} onChange={(value) => update('repeatPenalty', value)} help="1 = off" /><div><label className="field-label">Stop tokens</label><input className="input mt-2" value={settings.stopTokens} onChange={(event) => update('stopTokens', event.target.value)} placeholder="token-a, token-b" /><p className="field-help">Comma-separated.</p></div></div>}

            {settings.preset === 'custom' && <div className="mt-6"><label className="field-label">Custom Go template</label><textarea className="input mt-2 min-h-40 resize-y font-mono text-xs" value={settings.customTemplate} onChange={(event) => update('customTemplate', event.target.value)} /><p className="field-help">Available variables include `.System`, `.Prompt`, `.Response`, and `.Messages`.</p></div>}

            <div className="mt-8 rounded-2xl border border-black/8 bg-[#faf9f6] p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 accent-[#292824]" checked={settings.replace} onChange={(event) => update('replace', event.target.checked)} /><span><span className="block text-sm font-medium">Replace an existing model with this name</span><span className="mt-1 block text-xs leading-5 text-black/50">Runs `ollama rm` before creating. Leave off if you want to preserve an existing model.</span></span></label></div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-black/8 px-5 py-4"><div><p className="section-kicker">02 / Review</p><h2 className="mt-1 text-lg font-medium">Generated Modelfile</h2></div><FileCode2 size={18} className="text-black/35" /></div><pre className="code-preview">{modelfile}</pre><div className="flex gap-2 border-t border-black/8 p-4"><button className="secondary-button flex-1" onClick={() => copyText('file', modelfile)}>{copied === 'file' ? <Check size={15} /> : <Copy size={15} />} {copied === 'file' ? 'Copied' : 'Copy file'}</button><button className="secondary-button flex-1" onClick={downloadModelfile}><Download size={15} /> Download</button></div></section>
            <section className="panel p-5"><p className="section-kicker">03 / Run locally</p><div className="mt-3 rounded-xl bg-[#292824] p-4 text-[12px] leading-6 text-[#f7f2e8]"><code className="break-all">{command}</code></div><button className="primary-button mt-3 w-full" disabled={errors.length > 0} onClick={() => copyText('command', command)}>{copied === 'command' ? <Check size={16} /> : <Clipboard size={16} />} {copied === 'command' ? 'Command copied' : 'Copy create command'}</button><div className="mt-4 flex gap-2 text-xs leading-5 text-black/50"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#55745b]" /><p>Review the path and name before running it in Terminal. The browser never executes commands.</p></div></section>
            {errors.length > 0 ? <div className="rounded-2xl border border-[#e3c9b4] bg-[#fff6ed] p-4"><div className="flex gap-2 text-sm font-medium text-[#865631]"><AlertTriangle size={16} /> Needs attention</div><ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-[#865631]">{errors.map((error) => <li key={error} className="list-disc">{error}</li>)}</ul></div> : <div className="flex gap-3 rounded-2xl border border-[#bbcbb9] bg-[#edf4eb] p-4 text-sm text-[#38503a]"><Check size={17} className="mt-0.5" /><p>Ready to generate. The current form has the required details.</p></div>}
          </aside>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-5 text-xs text-black/45"><p><span className="font-medium text-black/65">Safe by default.</span> No upload · no hidden network request · review before import.</p><button className="quiet-button" onClick={() => setSettings(initialSettings)}><RotateCcw size={14} /> Reset form</button></footer>
      </div>
    </main>
  )
}

function NumberField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help: string }) {
  return <div><label className="field-label">{label}</label><input className="input mt-2" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /><p className="field-help">{help}</p></div>
}

export default App
