import { randomBytes } from 'node:crypto';
import type { BinaryObject, BinaryStore, JsonStore, StorageDriver } from './types';

const newEtag = () => randomBytes(8).toString('hex');

/**
 * In-memory driver used by the test-suite. Conditional writes are evaluated
 * synchronously (no `await` between check and write), so they are atomic
 * within the single-threaded JS runtime — matching Netlify Blobs semantics.
 */
export function createMemoryDriver(): StorageDriver {
  const jsonStores = new Map<string, Map<string, { raw: string; etag: string }>>();
  const binStores = new Map<string, Map<string, BinaryObject>>();

  const jsonMap = (name: string) => {
    let m = jsonStores.get(name);
    if (!m) jsonStores.set(name, (m = new Map()));
    return m;
  };
  const binMap = (name: string) => {
    let m = binStores.get(name);
    if (!m) binStores.set(name, (m = new Map()));
    return m;
  };

  return {
    name: 'memory',
    json(name): JsonStore {
      const m = jsonMap(name);
      return {
        async get<T>(key: string) {
          const entry = m.get(key);
          return entry ? { value: JSON.parse(entry.raw) as T, etag: entry.etag } : null;
        },
        async set(key, value, options) {
          const current = m.get(key);
          if (options?.onlyIfNew && current) return { modified: false };
          if (options?.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
          const etag = newEtag();
          m.set(key, { raw: JSON.stringify(value), etag });
          return { modified: true, etag };
        },
        async delete(key) {
          m.delete(key);
        },
        async list(prefix = '') {
          return [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
        },
      };
    },
    binary(name): BinaryStore {
      const m = binMap(name);
      return {
        async get(key) {
          return m.get(key) ?? null;
        },
        async set(key, data, metadata) {
          m.set(key, { data, metadata });
        },
        async delete(key) {
          m.delete(key);
        },
      };
    },
  };
}
