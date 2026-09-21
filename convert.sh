#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Convert a GGUF file into a named Ollama model.

Usage:
  ./convert.sh <path-to-model.gguf> <ollama-model-name> [options]

Options:
  --system <text>          Add a SYSTEM instruction to the Modelfile.
  --template <text>        Add a TEMPLATE block to the Modelfile.
  --preset <name>          Add a known template preset. Supported: qwen.
  --parameter <key=value>  Add a PARAMETER line. Can be repeated.
  --modelfile <path>       Write the generated Modelfile to this path.
                           Default: ./Modelfile.<model-name>
  --replace                Remove an existing Ollama model with this name first.
  --keep-modelfile         Keep a temporary generated Modelfile.
  --dry-run                Generate/print the Modelfile without running ollama.
  -h, --help               Show this help.

Examples:
  ./convert.sh ./llama.gguf llama-local
  ./convert.sh ./mistral.gguf mistral-test --parameter temperature=0.7
  ./convert.sh ./model.gguf my-model --system "You are helpful."
  ./convert.sh ./qwen.gguf qwen-local --preset qwen
USAGE
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ $# -ge 2 ]] || die "Expected a GGUF path and an Ollama model name."

gguf_path=$1
model_name=$2
shift 2

system_text=""
template_text=""
preset=""
modelfile_path=""
keep_modelfile=false
dry_run=false
replace_model=false
parameters=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --system)
      [[ $# -ge 2 ]] || die "--system requires text."
      system_text=$2
      shift 2
      ;;
    --template)
      [[ $# -ge 2 ]] || die "--template requires text."
      template_text=$2
      shift 2
      ;;
    --preset)
      [[ $# -ge 2 ]] || die "--preset requires a name."
      preset=$2
      shift 2
      ;;
    --parameter)
      [[ $# -ge 2 ]] || die "--parameter requires key=value."
      parameters+=("$2")
      shift 2
      ;;
    --modelfile)
      [[ $# -ge 2 ]] || die "--modelfile requires a path."
      modelfile_path=$2
      shift 2
      ;;
    --keep-modelfile)
      keep_modelfile=true
      shift
      ;;
    --replace)
      replace_model=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -f "$gguf_path" ]] || die "GGUF file not found: $gguf_path"
[[ "$gguf_path" == *.gguf ]] || die "Input file must end with .gguf: $gguf_path"
[[ -n "$model_name" ]] || die "Model name cannot be empty."
[[ "$model_name" =~ ^[A-Za-z0-9._:-]+$ ]] || die "Model name may only contain letters, numbers, dot, underscore, colon, or hyphen."
[[ -z "$preset" || -z "$template_text" ]] || die "Use either --preset or --template, not both."

case "$preset" in
  "")
    ;;
  qwen)
    # Use Ollama's native message variables. This deliberately bypasses the
    # Jinja chat template embedded in some Qwen3.5 GGUF files. In particular,
    # developer messages are rendered as user messages because Qwen's embedded
    # template accepts only a system message at the beginning.
    template_text='{{- range .Messages }}{{- if eq .Role "system" }}<|im_start|>system
{{ .Content }}<|im_end|>
{{- else if eq .Role "assistant" }}<|im_start|>assistant
{{ .Content }}<|im_end|>
{{- else }}<|im_start|>user
{{ .Content }}<|im_end|>
{{- end }}{{- end }}<|im_start|>assistant
'
    parameters+=("stop=<|im_start|>")
    parameters+=("stop=<|im_end|>")
    ;;
  *)
    die "Unknown preset: $preset"
    ;;
esac

if [[ "$dry_run" != true ]]; then
  require_command ollama
fi

if [[ -z "$modelfile_path" ]]; then
  safe_model_name=${model_name//[:\/]/-}
  if [[ "$keep_modelfile" == true || "$dry_run" == true ]]; then
    modelfile_path="./Modelfile.${safe_model_name}"
  else
    modelfile_path=$(mktemp "${TMPDIR:-/tmp}/ollama-modelfile.XXXXXX")
  fi
fi

gguf_abs=$(cd "$(dirname "$gguf_path")" && pwd)/$(basename "$gguf_path")

{
  printf 'FROM %s\n' "$gguf_abs"

  for parameter in "${parameters[@]+"${parameters[@]}"}"; do
    [[ "$parameter" == *=* ]] || die "Parameter must be key=value: $parameter"
    key=${parameter%%=*}
    value=${parameter#*=}
    [[ -n "$key" && -n "$value" ]] || die "Parameter must be key=value: $parameter"
    printf 'PARAMETER %s %s\n' "$key" "$value"
  done

  if [[ -n "$system_text" ]]; then
    printf 'SYSTEM """%s"""\n' "$system_text"
  fi

  if [[ -n "$template_text" ]]; then
    printf 'TEMPLATE """%s"""\n' "$template_text"
  fi
} > "$modelfile_path"

if [[ "$dry_run" == true ]]; then
  printf 'Generated %s:\n\n' "$modelfile_path"
  cat "$modelfile_path"
  exit 0
fi

printf 'Creating Ollama model %s from %s\n' "$model_name" "$gguf_abs"
if [[ "$replace_model" == true ]]; then
  ollama rm "$model_name" >/dev/null 2>&1 || true
fi
ollama create "$model_name" -f "$modelfile_path"

# Confirm Ollama stored the override. If this check fails, the model may still
# be using the GGUF's embedded Jinja template and will reproduce the
# "System message must be at the beginning" error.
stored_modelfile=$(ollama show "$model_name" --modelfile 2>/dev/null || true)
if [[ "$preset" == "qwen" && "$stored_modelfile" != *'.Messages'* ]]; then
  printf 'Error: Ollama did not store the Qwen message template for %s.\n' "$model_name" >&2
  printf 'Run: ollama show %s --modelfile\n' "$model_name" >&2
  exit 1
fi

if [[ "$keep_modelfile" == true ]]; then
  printf 'Kept Modelfile at %s\n' "$modelfile_path"
else
  rm -f "$modelfile_path"
fi

printf 'Done. Try it with:\n  ollama run %s\n' "$(shell_quote "$model_name")"
