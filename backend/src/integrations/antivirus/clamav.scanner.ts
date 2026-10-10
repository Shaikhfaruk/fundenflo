import { once } from 'node:events';
import { connect } from 'node:net';
import type { Readable } from 'node:stream';

import type { AntivirusScanner, ScanVerdict } from './antivirus.port.js';

export type ClamavOptions = { host: string; port: number; timeoutMs: number };

export const CLAMAV_ENGINE = 'clamav';

const CLAMD_COMMAND = 'zINSTREAM\0';

const CLAMD_CHUNK_BYTES = 64 * 1024;

const CLEAN_REPLY = /^stream: OK$/;

const FOUND_REPLY = /^stream: (.+) FOUND$/;

export function parseClamdReply(reply: string): ScanVerdict {
  const text = reply.replace(/\0/g, '').trim();
  if (CLEAN_REPLY.test(text)) return { clean: true, signature: null, engine: CLAMAV_ENGINE };
  const found = FOUND_REPLY.exec(text);
  if (found?.[1]) return { clean: false, signature: found[1], engine: CLAMAV_ENGINE };
  throw new Error(`clamd could not scan the file: ${text || 'empty reply'}`);
}

const frame = (part: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(part.length);
  return Buffer.concat([size, part]);
};

export class ClamavScanner implements AntivirusScanner {
  constructor(private readonly options: ClamavOptions) {}

  scan(body: Readable): Promise<ScanVerdict> {
    return new Promise<ScanVerdict>((resolve, reject) => {
      const socket = connect({ host: this.options.host, port: this.options.port });
      const replies: Buffer[] = [];
      let settled = false;
      const settle = (outcome: () => ScanVerdict) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        body.destroy();
        try {
          resolve(outcome());
        } catch (error) {
          reject(error);
        }
      };
      const fail = (error: Error) =>
        settle(() => {
          throw error;
        });
      const reply = () => Buffer.concat(replies).toString('utf8');

      socket.setTimeout(this.options.timeoutMs, () => fail(new Error(`clamd did not answer within ${this.options.timeoutMs} ms`)));
      socket.on('error', fail);
      socket.on('data', (chunk: Buffer) => {
        replies.push(chunk);
        if (chunk.includes(0)) settle(() => parseClamdReply(reply()));
      });
      socket.on('end', () => settle(() => parseClamdReply(reply())));
      socket.once('connect', () => {
        void (async () => {
          try {
            socket.write(CLAMD_COMMAND);
            for await (const chunk of body) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
              for (let offset = 0; offset < buffer.length; offset += CLAMD_CHUNK_BYTES) {
                if (settled) return;
                if (!socket.write(frame(buffer.subarray(offset, offset + CLAMD_CHUNK_BYTES)))) await once(socket, 'drain');
              }
            }
            if (!settled) socket.end(Buffer.alloc(4));
          } catch (error) {
            fail(error as Error);
          }
        })();
      });
    });
  }
}
