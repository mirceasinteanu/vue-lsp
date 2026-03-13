const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handleServerMessage } = require('./proxy-handler');

describe('handleServerMessage', () => {
  // --- Pass-through ---

  it('forwards normal JSON-RPC responses', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'forward');
    assert.equal(result.forward, raw);
  });

  it('forwards JSON-RPC notifications (non-tsserver)', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: {} });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'forward');
    assert.equal(result.forward, raw);
  });

  it('forwards non-JSON messages as-is', () => {
    const raw = 'this is not json at all';
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'forward');
    assert.equal(result.forward, raw);
  });

  // --- tsserver/request interception (nested params) ---

  it('intercepts tsserver/request with single nested param', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tsserver/request',
      params: [[42, 'completionInfo', { file: 'test.vue' }]],
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'intercept');
    const response = JSON.parse(result.response);
    assert.equal(response.method, 'tsserver/response');
    assert.deepEqual(response.params, [[42, null]]);
  });

  it('intercepts tsserver/request with batch of nested params', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tsserver/request',
      params: [
        [1, 'completionInfo', {}],
        [2, 'quickInfo', {}],
        [3, 'signatureHelp', {}],
      ],
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'intercept');
    const response = JSON.parse(result.response);
    assert.equal(response.method, 'tsserver/response');
    assert.deepEqual(response.params, [[1, null], [2, null], [3, null]]);
  });

  it('filters out empty inner arrays in tsserver/request params', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tsserver/request',
      params: [[10, 'method', {}], [], [20, 'other', {}]],
    });
    const result = handleServerMessage(raw);
    const response = JSON.parse(result.response);
    assert.deepEqual(response.params, [[10, null], [20, null]]);
  });

  // --- tsserver/request interception (JSON-RPC id fallback) ---

  it('intercepts tsserver/request with JSON-RPC id', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 99,
      method: 'tsserver/request',
      params: 'unexpected-shape',
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'intercept');
    const response = JSON.parse(result.response);
    assert.equal(response.id, 99);
    assert.equal(response.result, null);
    assert.equal(response.method, undefined);
  });

  it('intercepts tsserver/request with id=0 (falsy but defined)', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'tsserver/request',
      params: {},
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'intercept');
    const response = JSON.parse(result.response);
    assert.equal(response.id, 0);
  });

  // --- tsserver/request drop (unrecognized shape, no id) ---

  it('drops tsserver/request with non-array params and no id', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tsserver/request',
      params: { unexpected: true },
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'drop');
  });

  it('drops tsserver/request with flat array params and no id', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tsserver/request',
      params: [1, 'method', {}],
    });
    const result = handleServerMessage(raw);
    assert.equal(result.action, 'drop');
  });
});
