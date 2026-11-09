import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BinaryStore, JsonStore, StorageDriver } from './types';

const newEtag = () => randomBytes(8).toString('hex');
const encodeKey = (key: string) => encodeURIComponent(key);
const decodeKey = (file: string) => decodeURIComponent(file);

/**
 * Local-development driver that persists to `DATA_DIR` (default `.data/`).
 * Uses synchronous fs calls so conditional writes are atomic within the single
 * dev-server process.
 */
export function createFsDriver(rootDir: string): StorageDriver {
  const dir = (store: string) => {
    const d = path.join(rootDir, store);
    fs.mkdirSync(d, { recursive: true });
    return d;
  };

  return {
    name: 'fs',
    json(name): JsonStore {
      const d = () => dir(name);
      const file = (key: string) => path.join(d(), `${encodeKey(key)}.json`);
      const read = (key: string): { etag: string; value: unknown } | null => {
        try {
          return JSON.parse(fs.readFileSync(file(key), 'utf8'));
        } catch {
          return null;
        }
      };
      return {
        async get<T>(key: string) {
          const entry = read(key);
          return entry ? { value: entry.value as T, etag: entry.etag } : null;
        },
        async set(key, value, options) {
          const current = read(key);
          if (options?.onlyIfNew && current) return { modified: false };
          if (options?.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
          const etag = newEtag();
          const target = file(key);
          const tmp = `${target}.${etag}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify({ etag, value }));
          fs.renameSync(tmp, target);
          return { modified: true, etag };
        },
        async delete(key) {
          fs.rmSync(file(key), { force: true });
        },
        async list(prefix = '') {
          return fs
            .readdirSync(d())
            .filter((f) => f.endsWith('.json'))
            .map((f) => decodeKey(f.slice(0, -5)))
            .filter((k) => k.startsWith(prefix))
            .sort();
        },
      };
    },
    binary(name): BinaryStore {
      const d = () => dir(name);
      const file = (key: string) => path.join(d(), `${encodeKey(key)}.bin`);
      const meta = (key: string) => path.join(d(), `${encodeKey(key)}.meta`);
      return {
        async get(key) {
          try {
            const buf = fs.readFileSync(file(key));
            const metadata = JSON.parse(fs.readFileSync(meta(key), 'utf8'));
            return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), metadata };
          } catch {
            return null;
          }
        },
        async set(key, data, metadata) {
          fs.writeFileSync(file(key), Buffer.from(data));
          fs.writeFileSync(meta(key), JSON.stringify(metadata));
        },
        async delete(key) {
          fs.rmSync(file(key), { force: true });
          fs.rmSync(meta(key), { force: true });
        },
      };
    },
  };
}
