type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();

export function readCache<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeCache(key: string, value: unknown) {
  store.set(key, { at: Date.now(), value });
}

export function invalidateReadCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
