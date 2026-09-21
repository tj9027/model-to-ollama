# Ollama Importer

Import a local GGUF model into [Ollama](https://ollama.com) with a small web UI or CLI.

The default import is intentionally minimal:

```text
FROM /absolute/path/model.gguf
```

This lets Ollama keep the model's native metadata, renderer, tools, and thinking behavior. The tool does not convert or upload model weights.

## Requirements

- Node.js 20.19 or newer
- Ollama installed and running for real imports

## Web UI

```bash
npm ci
npm run dev
```

Enter an absolute `.gguf` path or split pattern such as `/models/model-*.gguf`, choose an Ollama name, review the Modelfile, and copy the generated command into Terminal. The browser never executes commands.

## CLI

```bash
./convert.sh /models/model.Q4_K_M.gguf my-model
ollama run my-model
```

Useful options:

```bash
./convert.sh --help
./convert.sh /models/model-*.gguf my-model --dry-run
./convert.sh /models/model.gguf my-model --parameter temperature=0.7
./convert.sh /models/model.gguf my-model --modelfile ./Modelfile
```

Parameters, system prompts, and templates are omitted unless explicitly supplied. `--replace` is a project convenience that removes an existing model before creating its replacement; the web UI does not offer destructive replacement.

Use `--preset legacy-qwen-chatml` only for older or mismatched Qwen metadata. A custom template can disable model-specific Ollama capabilities, so native mode is recommended.

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All model files remain local. See [LICENSE](LICENSE).
