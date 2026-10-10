import { once } from 'node:events';
import { type AddressInfo, createServer, type Server, type Socket } from 'node:net';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClamavScanner, parseClamdReply } from './clamav.scanner.js';
import { EICAR_TEST_STRING, EicarScanner } from './eicar.scanner.js';

const chunked = (text: string, size: number) => {
  const buffer = Buffer.from(text, 'latin1');
  const parts: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += size) parts.push(buffer.subarray(offset, offset + size));
  return Readable.from(parts);
};

const fakeClamd = (socket: Socket) => {
  let received = Buffer.alloc(0);
  socket.on('data', (chunk: Buffer) => {
    received = Buffer.concat([received, chunk]);
    const command = received.indexOf(0);
    if (command < 0) return;
    let offset = command + 1;
    const payload: Buffer[] = [];
    while (offset + 4 <= received.length) {
      const size = received.readUInt32BE(offset);
      if (size === 0) {
        const body = Buffer.concat(payload).toString('latin1');
        socket.end(body.includes('EICAR-STANDARD') ? 'stream: Eicar-Signature FOUND\0' : body.includes('TOO-BIG') ? 'INSTREAM size limit exceeded. ERROR\0' : 'stream: OK\0');
        return;
      }
      if (offset + 4 + size > received.length) return;
      payload.push(received.subarray(offset + 4, offset + 4 + size));
      offset += 4 + size;
    }
  });
};

describe('clamd reply parsing', () => {
  it('reads clean, infected and error replies', () => {
    expect(parseClamdReply('stream: OK\0')).toEqual({ clean: true, signature: null, engine: 'clamav' });
    expect(parseClamdReply('stream: Win.Test.EICAR_HDB-1 FOUND\0')).toEqual({ clean: false, signature: 'Win.Test.EICAR_HDB-1', engine: 'clamav' });
    expect(() => parseClamdReply('INSTREAM size limit exceeded. ERROR\0')).toThrow('clamd could not scan the file');
    expect(() => parseClamdReply('')).toThrow('empty reply');
  });
});

describe('ClamavScanner', () => {
  let server: Server;
  let silent: Server;
  let port: number;
  let silentPort: number;

  beforeAll(async () => {
    server = createServer(fakeClamd);
    silent = createServer(() => undefined);
    server.listen(0, '127.0.0.1');
    silent.listen(0, '127.0.0.1');
    await Promise.all([once(server, 'listening'), once(silent, 'listening')]);
    port = (server.address() as AddressInfo).port;
    silentPort = (silent.address() as AddressInfo).port;
  });

  afterAll(() => {
    server.close();
    silent.close();
  });

  it('streams the file in INSTREAM chunks and reads the verdict', async () => {
    const scanner = new ClamavScanner({ host: '127.0.0.1', port, timeoutMs: 2_000 });
    await expect(scanner.scan(chunked('%PDF-1.7 a clean bank statement '.repeat(5_000), 7_000))).resolves.toMatchObject({ clean: true });
    await expect(scanner.scan(chunked(`header ${EICAR_TEST_STRING} trailer`, 16))).resolves.toEqual({ clean: false, signature: 'Eicar-Signature', engine: 'clamav' });
    await expect(scanner.scan(chunked('TOO-BIG', 4))).rejects.toThrow('size limit exceeded');
  });

  it('fails when clamd is unreachable or silent', async () => {
    await expect(new ClamavScanner({ host: '127.0.0.1', port: silentPort, timeoutMs: 1_000 }).scan(chunked('hello', 5))).rejects.toThrow('did not answer');
    silent.close();
    await expect(new ClamavScanner({ host: '127.0.0.1', port: silentPort, timeoutMs: 1_000 }).scan(chunked('hello', 5))).rejects.toThrow();
  });
});

describe('EicarScanner', () => {
  it('finds the EICAR test string even when it spans chunks', async () => {
    const scanner = new EicarScanner();
    await expect(scanner.scan(chunked(`prefix ${EICAR_TEST_STRING} suffix`, 9))).resolves.toEqual({ clean: false, signature: 'Eicar-Test-Signature', engine: 'eicar-test' });
    await expect(scanner.scan(chunked('an ordinary file', 3))).resolves.toEqual({ clean: true, signature: null, engine: 'eicar-test' });
  });
});
