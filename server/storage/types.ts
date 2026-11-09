export interface StoredValue<T> {
  value: T;
  etag: string;
}

/**
 * Conditional write options, mirroring Netlify Blobs semantics:
 * - `onlyIfNew`: succeed only if the key does not exist yet.
 * - `onlyIfMatch`: succeed only if the current ETag equals the given one.
 * A failed condition resolves with `{ modified: false }` (it does not throw).
 */
export interface WriteOptions {
  onlyIfNew?: boolean;
  onlyIfMatch?: string;
}

export interface WriteResult {
  modified: boolean;
  etag?: string;
}

export interface JsonStore {
  get<T>(key: string): Promise<StoredValue<T> | null>;
  set(key: string, value: unknown, options?: WriteOptions): Promise<WriteResult>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface BinaryObject {
  data: ArrayBuffer;
  metadata: Record<string, unknown>;
}

export interface BinaryStore {
  get(key: string): Promise<BinaryObject | null>;
  set(key: string, data: ArrayBuffer, metadata: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface StorageDriver {
  readonly name: 'netlify' | 'fs' | 'memory';
  json(store: string): JsonStore;
  binary(store: string): BinaryStore;
}
