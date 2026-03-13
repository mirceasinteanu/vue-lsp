/**
 * Proxy message handler.
 *
 * Classifies server-to-client LSP messages and determines the appropriate
 * action: pass through, intercept with a tsserver/response, or respond
 * with a JSON-RPC result.
 */

/**
 * @typedef {Object} HandleResult
 * @property {'forward'|'intercept'|'drop'} action
 * @property {string} [forward]     - JSON string to forward to client
 * @property {string} [response]    - JSON string to send back to server
 */

/**
 * Handle a single raw LSP message body from the server.
 *
 * @param {string} raw - The raw JSON string from the server
 * @returns {HandleResult}
 */
function handleServerMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    // Not valid JSON — pass through as-is
    return { action: 'forward', forward: raw };
  }

  // Intercept tsserver/request: Volar sends these as notifications with
  // params as a batch of [requestId, method, args] arrays. It expects a
  // tsserver/response notification back with the same requestIds.
  if (msg.method === 'tsserver/request') {
    if (Array.isArray(msg.params) && Array.isArray(msg.params[0])) {
      const responses = msg.params
        .filter(arr => Array.isArray(arr) && arr.length > 0)
        .map(([requestId]) => [requestId, null]);
      const response = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tsserver/response',
        params: responses,
      });
      return { action: 'intercept', response };
    } else if (msg.id !== undefined) {
      // Fallback: if it has a JSON-RPC id, respond normally
      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: null,
      });
      return { action: 'intercept', response };
    }
    // tsserver/request with unrecognized shape — drop it
    return { action: 'drop' };
  }

  // Everything else passes through
  return { action: 'forward', forward: raw };
}

module.exports = { handleServerMessage };
