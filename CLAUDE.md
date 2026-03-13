# CLAUDE.md

Claude Code plugin that integrates the Volar Vue language server via a proxy.

## Architecture

Claude Code launches the proxy via `.lsp.json`, which points to `vue-lsp-run.sh`. The proxy (`vue-lsp-proxy.js`) spawns `vue-language-server --stdio` and sits in the middle, intercepting Volar's `tsserver/request` notifications (which Claude Code can't handle) and responding with defaults.

## Key files

- **`.lsp.json`** — LSP server declaration: command, transport, file extension mappings, initialization options
- **`vue-lsp-run.sh`** — Shell entry point that resolves its own directory and runs `node vue-lsp-proxy.js`
- **`vue-lsp-proxy.js`** — The proxy: LSP message framing, `tsserver/request` interception, pass-through for everything else
- **`.claude-plugin/plugin.json`** — Plugin metadata (name, version, description, author)
- **`.claude-plugin/marketplace.json`** — Local marketplace registration
