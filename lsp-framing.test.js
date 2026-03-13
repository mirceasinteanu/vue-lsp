const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseMessages, frameMessage } = require('./lsp-framing');

// Helper: build an LSP-framed buffer from a string body
function frame(body) {
  const buf = Buffer.from(body, 'utf8');
  return Buffer.from(`Content-Length: ${buf.length}\r\n\r\n${body}`, 'utf8');
}

describe('frameMessage', () => {
  it('frames a simple ASCII string', () => {
    const result = frameMessage('{"jsonrpc":"2.0"}');
    assert.equal(result.toString(), 'Content-Length: 17\r\n\r\n{"jsonrpc":"2.0"}');
  });

  it('handles multi-byte UTF-8 correctly', () => {
    const body = '{"text":"caf\u00e9"}';
    const result = frameMessage(body);
    const byteLen = Buffer.byteLength(body, 'utf8');
    assert.ok(result.toString().startsWith(`Content-Length: ${byteLen}\r\n\r\n`));
    // Body bytes should equal declared Content-Length
    const headerEnd = result.indexOf('\r\n\r\n') + 4;
    assert.equal(result.length - headerEnd, byteLen);
  });

  it('handles empty string', () => {
    const result = frameMessage('');
    assert.equal(result.toString(), 'Content-Length: 0\r\n\r\n');
  });
});

describe('parseMessages', () => {
  it('parses a single complete message', () => {
    const buf = frame('{"id":1}');
    const { messages, rest } = parseMessages(buf);
    assert.deepEqual(messages, ['{"id":1}']);
    assert.equal(rest.length, 0);
  });

  it('parses multiple messages in one buffer', () => {
    const buf = Buffer.concat([frame('{"id":1}'), frame('{"id":2}')]);
    const { messages, rest } = parseMessages(buf);
    assert.deepEqual(messages, ['{"id":1}', '{"id":2}']);
    assert.equal(rest.length, 0);
  });

  it('returns incomplete data as rest', () => {
    const full = frame('{"id":1}');
    // Chop off last 3 bytes to simulate partial delivery
    const partial = full.slice(0, full.length - 3);
    const { messages, rest } = parseMessages(partial);
    assert.deepEqual(messages, []);
    assert.equal(rest.length, partial.length);
  });

  it('handles split across chunks — complete + partial', () => {
    const msg1 = frame('{"a":1}');
    const msg2 = frame('{"b":2}');
    const partial2 = msg2.slice(0, msg2.length - 2);
    const buf = Buffer.concat([msg1, partial2]);
    const { messages, rest } = parseMessages(buf);
    assert.deepEqual(messages, ['{"a":1}']);
    assert.equal(rest.length, partial2.length);
  });

  it('skips malformed headers and continues parsing', () => {
    const bad = Buffer.from('Bad-Header: nope\r\n\r\n', 'utf8');
    const good = frame('{"id":1}');
    const buf = Buffer.concat([bad, good]);
    const malformed = [];
    const { messages } = parseMessages(buf, (h) => malformed.push(h));
    assert.deepEqual(messages, ['{"id":1}']);
    assert.equal(malformed.length, 1);
    assert.ok(malformed[0].includes('Bad-Header'));
  });

  it('handles empty buffer', () => {
    const { messages, rest } = parseMessages(Buffer.alloc(0));
    assert.deepEqual(messages, []);
    assert.equal(rest.length, 0);
  });

  it('handles multi-byte UTF-8 body', () => {
    const body = '{"text":"\u00e9\u00e8\u00ea"}';
    const buf = frame(body);
    const { messages } = parseMessages(buf);
    assert.deepEqual(messages, [body]);
  });

  it('works without onMalformedHeader callback', () => {
    const bad = Buffer.from('No-CL: x\r\n\r\n', 'utf8');
    const good = frame('{"ok":true}');
    const buf = Buffer.concat([bad, good]);
    // Should not throw when callback is omitted
    const { messages } = parseMessages(buf);
    assert.deepEqual(messages, ['{"ok":true}']);
  });
});
