# vue-lsp

A Claude Code plugin that provides [Volar](https://github.com/vuejs/language-tools) (Vue language server) integration for `.vue` files.

## Why a proxy?

Volar sends `tsserver/request` notifications that Claude Code doesn't understand, causing internal errors. This plugin includes a lightweight Node.js proxy (`vue-lsp-proxy.js`) that sits between Claude Code and Volar, intercepting those messages and responding with `null` defaults while passing everything else through transparently.

**Trade-off:** Because `tsserver/request` calls are stubbed with `null`, TypeScript-powered features that depend on these requests (e.g., some advanced completions and refactorings) may return degraded results. Core features like go-to-definition, find-references, hover, document symbols, and diagnostics work fully.

## Prerequisites

- **Node.js** (v18+)
- **Vue Language Server** (`@vue/language-server`) on your PATH. The simplest way is a global install:

```bash
npm install -g @vue/language-server@^2
```

Verify it's available:

```bash
vue-language-server --version
```

> **Note:** A global install is the standard pattern for LSP binaries (same as `metals`, `pyright`, etc.). Pin a major version to avoid surprises across projects.

## Installation

Load as a plugin directory:

```bash
claude --plugin-dir /path/to/vue-lsp
```

Or install via the local marketplace:

```bash
# Inside Claude Code:
/plugin marketplace add /path/to/vue-lsp
/plugin install vue-lsp
```

## Supported features

- Go-to-definition
- Find references
- Hover information (types, documentation)
- Document symbols
- Diagnostics (template and script errors/warnings)
- Code completions

## Troubleshooting

1. Ensure `vue-language-server` is on your PATH:
   ```bash
   which vue-language-server
   ```
2. Ensure your project has TypeScript installed locally (`node_modules/typescript/lib`) — Volar uses it for type checking.
3. Restart Claude Code to re-initialize the LSP connection.

### Debug logging

Enable verbose proxy logs:

```bash
VUE_LSP_DEBUG=1 claude --plugin-dir /path/to/vue-lsp
```

Logs are written to `/tmp/vue-lsp-proxy.log`.

## License

MIT
