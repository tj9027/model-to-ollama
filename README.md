# Ollama Importer

A small local UI and CLI for importing a `.gguf` model into [Ollama](https://ollama.com).

The app generates an Ollama `Modelfile` and the exact `ollama create` command. Model weights stay on your computer: the browser does not upload files or run shell commands.

## Web UI

Requirements: Node.js 20+ and Ollama.

```bash
npm install
npm run dev
```

Open the local Vite URL, enter the absolute `.gguf` path and a model name, review the Modelfile, then copy the command into Terminal.

The form supports Qwen-safe and ChatML templates, system prompts, context size, sampling parameters, stop tokens, and replacing an existing model.

## CLI

```bash
./convert.sh /path/to/model.gguf my-model --preset qwen --keep-modelfile
ollama run my-model
```

Use `./convert.sh --help` for all options. Add `--dry-run` to inspect the generated Modelfile without calling Ollama. Add `--replace` only when you intend to remove and recreate an existing model.

## Troubleshooting

For `System message must be at the beginning`, recreate the model with `--preset qwen --replace`. The preset overrides the GGUF's embedded template with an Ollama-native message template.

## Build

```bash
npm run build
```

## License

MIT. See [LICENSE](LICENSE).
