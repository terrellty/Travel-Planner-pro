// Universal Worker storage engine for read/write (讀寫) operations.
// Supports:
// 1) Dedicated Web Worker message API (in-memory Map)
// 2) Service Worker message API (in-memory Map)
// 3) Cloudflare Worker Fetch API with optional KV persistence via env.AI_STORAGE

const memoryStore = new Map();

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

function ok(id, data) {
  return { id, ok: true, data };
}

function fail(id, error) {
  return { id, ok: false, error };
}

function validateKey(key) {
  return typeof key === 'string' && key.length > 0;
}

function createMemoryAdapter(mapRef) {
  return {
    async set(key, value) {
      mapRef.set(key, value);
      return { key, value };
    },
    async get(key) {
      return { key, value: mapRef.get(key), exists: mapRef.has(key) };
    },
    async delete(key) {
      const deleted = mapRef.delete(key);
      return { key, deleted };
    },
    async has(key) {
      return { key, exists: mapRef.has(key) };
    },
    async keys() {
      return { keys: [...mapRef.keys()] };
    },
    async values() {
      return { values: [...mapRef.values()] };
    },
    async entries() {
      return { entries: [...mapRef.entries()] };
    },
    async clear() {
      mapRef.clear();
      return { cleared: true };
    },
    async bulkSet(entries) {
      for (const [entryKey, entryValue] of entries) {
        mapRef.set(entryKey, entryValue);
      }
      return { count: entries.length };
    },
  };
}

function parseStoredValue(raw) {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createKVAdapter(kv) {
  return {
    async set(key, value) {
      await kv.put(key, JSON.stringify(value));
      return { key, value };
    },
    async get(key) {
      const raw = await kv.get(key);
      return { key, value: parseStoredValue(raw), exists: raw !== null };
    },
    async delete(key) {
      await kv.delete(key);
      return { key, deleted: true };
    },
    async has(key) {
      const raw = await kv.get(key);
      return { key, exists: raw !== null };
    },
    async keys() {
      const listed = await kv.list();
      return { keys: listed.keys.map((item) => item.name) };
    },
    async values() {
      const listed = await kv.list();
      const values = await Promise.all(listed.keys.map((item) => kv.get(item.name).then(parseStoredValue)));
      return { values };
    },
    async entries() {
      const listed = await kv.list();
      const entries = await Promise.all(
        listed.keys.map(async (item) => [item.name, parseStoredValue(await kv.get(item.name))])
      );
      return { entries };
    },
    async clear() {
      const listed = await kv.list();
      await Promise.all(listed.keys.map((item) => kv.delete(item.name)));
      return { cleared: true };
    },
    async bulkSet(entries) {
      await Promise.all(entries.map(([k, v]) => kv.put(k, JSON.stringify(v))));
      return { count: entries.length };
    },
  };
}

function pickStorage(env) {
  if (env?.AI_STORAGE && typeof env.AI_STORAGE.get === 'function') {
    return createKVAdapter(env.AI_STORAGE);
  }
  return createMemoryAdapter(memoryStore);
}

async function executeAction(payload, storage) {
  const { id, action, key, value, entries } = payload ?? {};

  switch (action) {
    case 'set': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, await storage.set(key, value));
    }
    case 'get': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, await storage.get(key));
    }
    case 'delete': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, await storage.delete(key));
    }
    case 'has': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, await storage.has(key));
    }
    case 'keys':
      return ok(id, await storage.keys());
    case 'values':
      return ok(id, await storage.values());
    case 'entries':
      return ok(id, await storage.entries());
    case 'clear':
      return ok(id, await storage.clear());
    case 'bulkSet': {
      if (!Array.isArray(entries)) throw new Error('entries must be an array');
      for (const [entryKey] of entries) {
        if (!validateKey(entryKey)) throw new Error(`Invalid key in entries: ${entryKey}`);
      }
      return ok(id, await storage.bulkSet(entries));
    }
    default:
      throw new Error(`Unsupported action: ${String(action)}`);
  }
}

async function toResult(payload, storage) {
  try {
    return await executeAction(payload, storage);
  } catch (error) {
    const id = payload?.id;
    return fail(id, error instanceof Error ? error.message : 'Unknown worker error');
  }
}

function postMessageResponse(event, responsePayload) {
  if (event?.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage(responsePayload);
    return;
  }
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
    self.postMessage(responsePayload);
  }
}

const localStorageAdapter = createMemoryAdapter(memoryStore);

self.addEventListener('message', async (event) => {
  const responsePayload = await toResult(event.data, localStorageAdapter);
  postMessageResponse(event, responsePayload);
});

async function handleFetch(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Use POST with JSON body: { id, action, key?, value?, entries? }' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const storage = pickStorage(env);
  const responsePayload = await toResult(payload, storage);
  return jsonResponse(responsePayload, responsePayload.ok ? 200 : 400);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});

export default {
  fetch(request, env) {
    return handleFetch(request, env);
  },
};
