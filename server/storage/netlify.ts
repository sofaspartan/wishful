import { getStore, type Store } from '@netlify/blobs';
import type { BinaryStore, JsonStore, StorageDriver, WriteOptions } from './types';

function conditions(options?: WriteOptions) {
  if (options?.onlyIfNew) return { onlyIfNew: true as const };
  if (options?.onlyIfMatch) return { onlyIfMatch: options.onlyIfMatch };
  return {};
}

/**
 * Netlify Blobs driver. Stores are site-wide (not deploy-scoped) and use
 * strong consistency so reads always observe the latest write — required for
 * the ETag-based optimistic concurrency used throughout the data layer.
 */
export function createNetlifyDriver(): StorageDriver {
  const cache = new Map<string, Store>();
  const store = (name: string) => {
    let s = cache.get(name);
    if (!s) {
      s = getStore({ name, consistency: 'strong' });
      cache.set(name, s);
    }
    return s;
  };

  return {
    name: 'netlify',
    json(name): JsonStore {
      const s = () => store(name);
      return {
        async get<T>(key: string) {
          const res = await s().getWithMetadata(key, { type: 'json' });
          if (!res) return null;
          return { value: res.data as T, etag: res.etag ?? '' };
        },
        async set(key, value, options) {
          const res = await s().setJSON(key, value, conditions(options));
          return { modified: res.modified, etag: res.etag };
        },
        async delete(key) {
          await s().delete(key);
        },
        async list(prefix) {
          const keys: string[] = [];
          for await (const page of s().list({ prefix, paginate: true })) {
            for (const blob of page.blobs) keys.push(blob.key);
          }
          return keys;
        },
      };
    },
    binary(name): BinaryStore {
      const s = () => store(name);
      return {
        async get(key) {
          const res = await s().getWithMetadata(key, { type: 'arrayBuffer' });
          if (!res) return null;
          return { data: res.data, metadata: res.metadata };
        },
        async set(key, data, metadata) {
          await s().set(key, data, { metadata });
        },
        async delete(key) {
          await s().delete(key);
        },
      };
    },
  };
}
