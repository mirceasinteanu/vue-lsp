/**
 * LSP message framing helpers.
 *
 * Parses and frames LSP messages using the Content-Length header protocol.
 * Extracted for testability and reuse.
 */

/**
 * Parse complete LSP messages from a buffer.
 * Returns { messages: string[], rest: Buffer } where rest is any
 * incomplete data remaining in the buffer.
 */
function parseMessages(buffer, onMalformedHeader) {
  const messages = [];
  let rest = buffer;

  while (rest.length > 0) {
    const headerEnd = rest.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = rest.slice(0, headerEnd).toString('ascii');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      // Malformed header — skip past it to avoid stalling the buffer
      if (onMalformedHeader) onMalformedHeader(header);
      rest = rest.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (rest.length < bodyStart + contentLength) break; // incomplete

    const body = rest.slice(bodyStart, bodyStart + contentLength).toString('utf8');
    messages.push(body);
    rest = rest.slice(bodyStart + contentLength);
  }

  return { messages, rest };
}

/**
 * Frame a JSON string as an LSP message with Content-Length header.
 */
function frameMessage(jsonStr) {
  const buf = Buffer.from(jsonStr, 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${buf.length}\r\n\r\n`, 'ascii'),
    buf,
  ]);
}

module.exports = { parseMessages, frameMessage };
