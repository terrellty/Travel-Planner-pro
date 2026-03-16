// A lightweight JavaScript Worker storage engine for read/write (讀寫) operations.
// Usage:
//   const worker = new Worker(new URL('./worker-ai-storage.js', import.meta.url), { type: 'module' });
//   worker.postMessage({ id: '1', action: 'set', key: 'trip:001', value: { city: 'Tokyo' } });
//   worker.onmessage = (event) => console.log(event.data);

const store = new Map();

function ok(id, data) {
  return { id, ok: true, data };
}

function fail(id, error) {
  return { id, ok: false, error };
}

function validateKey(key) {
  return typeof key === 'string' && key.length > 0;
}

self.onmessage = (event) => {
  const { id, action, key, value, entries } = event.data ?? {};

  try {
    switch (action) {
      case 'set': {
        if (!validateKey(key)) throw new Error('Invalid key');
        store.set(key, value);
        self.postMessage(ok(id, { key, value }));
        return;
      }
      case 'get': {
        if (!validateKey(key)) throw new Error('Invalid key');
        self.postMessage(ok(id, { key, value: store.get(key), exists: store.has(key) }));
        return;
      }
      case 'delete': {
        if (!validateKey(key)) throw new Error('Invalid key');
        const deleted = store.delete(key);
        self.postMessage(ok(id, { key, deleted }));
        return;
      }
      case 'has': {
        if (!validateKey(key)) throw new Error('Invalid key');
        self.postMessage(ok(id, { key, exists: store.has(key) }));
        return;
      }
      case 'keys': {
        self.postMessage(ok(id, { keys: [...store.keys()] }));
        return;
      }
      case 'values': {
        self.postMessage(ok(id, { values: [...store.values()] }));
        return;
      }
      case 'entries': {
        self.postMessage(ok(id, { entries: [...store.entries()] }));
        return;
      }
      case 'clear': {
        store.clear();
        self.postMessage(ok(id, { cleared: true }));
        return;
      }
      case 'bulkSet': {
        if (!Array.isArray(entries)) throw new Error('entries must be an array');
        for (const [entryKey, entryValue] of entries) {
          if (!validateKey(entryKey)) throw new Error(`Invalid key in entries: ${entryKey}`);
          store.set(entryKey, entryValue);
        }
        self.postMessage(ok(id, { count: entries.length }));
        return;
      }
      default:
        throw new Error(`Unsupported action: ${String(action)}`);
    }
  } catch (error) {
    self.postMessage(fail(id, error instanceof Error ? error.message : 'Unknown worker error'));
  }
};
