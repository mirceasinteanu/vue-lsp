#!/usr/bin/env node
/**
 * Proxy between Claude Code and vue-language-server.
 *
 * Problem: Volar sends `tsserver/request` messages that Claude Code doesn't
 * understand, causing an internal error. This proxy intercepts those messages
 * and either responds with a sensible default or drops them, while passing
 * everything else through transparently.
 */

const { spawn } = require('child_process');
const { parseMessages, frameMessage } = require('./lsp-framing');

const LOG = process.env.VUE_LSP_DEBUG === '1';
const logFile = LOG ? require('fs').createWriteStream('/tmp/vue-lsp-proxy.log', { flags: 'a', mode: 0o600 }) : null;
function log(direction, msg) {
  if (!LOG) return;
  const preview = typeof msg === 'string' ? msg.slice(0, 200) : JSON.stringify(msg).slice(0, 200);
  logFile.write(`${new Date().toISOString()} [${direction}] ${preview}\n`);
}

// Launch the real vue-language-server
const server = spawn('vue-language-server', ['--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd(),
});

server.stderr.on('data', (data) => {
  log('SERVER_ERR', data.toString());
});

server.on('error', (err) => {
  process.stderr.write(`vue-lsp-proxy: failed to spawn server: ${err.message}\n`);
  process.exit(1);
});

server.on('exit', (code) => {
  log('SERVER', `exited with code ${code}`);
  process.exit(code || 0);
});

// Forward termination signals to prevent orphaned server processes
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log('SIGNAL', sig);
    server.kill(sig);
  });
}

function onMalformedHeader(header) {
  process.stderr.write(`vue-lsp-proxy: malformed LSP header, skipping: ${header.slice(0, 100)}\n`);
}

// --- Proxy: Claude Code stdin -> server stdin (pass-through) ---

let clientBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  clientBuffer = Buffer.concat([clientBuffer, chunk]);
  const { messages, rest } = parseMessages(clientBuffer, onMalformedHeader);
  clientBuffer = rest;

  for (const raw of messages) {
    log('CLIENT->SERVER', raw);
    server.stdin.write(frameMessage(raw));
  }
});

process.stdin.on('end', () => {
  server.stdin.end();
});

process.stdin.on('error', (err) => {
  log('STDIN_ERR', err.message);
});

server.stdin.on('error', (err) => {
  log('SERVER_STDIN_ERR', err.message);
});

// --- Proxy: server stdout -> Claude Code stdout (filter tsserver/request) ---

let serverBuffer = Buffer.alloc(0);

server.stdout.on('data', (chunk) => {
  serverBuffer = Buffer.concat([serverBuffer, chunk]);
  const { messages, rest } = parseMessages(serverBuffer, onMalformedHeader);
  serverBuffer = rest;

  for (const raw of messages) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      // Not valid JSON — pass through as-is
      log('SERVER->CLIENT (raw)', raw);
      process.stdout.write(frameMessage(raw));
      continue;
    }

    // Intercept tsserver/request: Volar sends these as notifications with
    // params: [[requestId, method, args]]. It expects a tsserver/response
    // notification back with the same requestId.
    if (msg.method === 'tsserver/request') {
      log('INTERCEPTED', raw);

      // Send a tsserver/response back to unblock the server
      if (Array.isArray(msg.params) && Array.isArray(msg.params[0])) {
        const responses = msg.params
          .filter(arr => Array.isArray(arr) && arr.length > 0)
          .map(([requestId]) => [requestId, null]);
        const response = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tsserver/response',
          params: responses,
        });
        log('PROXY->SERVER (tsserver/response)', response);
        server.stdin.write(frameMessage(response));
      } else if (msg.id !== undefined) {
        // Fallback: if it has a JSON-RPC id, respond normally
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: null,
        });
        log('PROXY->SERVER (jsonrpc response)', response);
        server.stdin.write(frameMessage(response));
      }
      // Don't forward to Claude Code
      continue;
    }

    // Pass everything else through
    log('SERVER->CLIENT', raw);
    process.stdout.write(frameMessage(raw));
  }
});
