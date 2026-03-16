// Universal Worker storage engine for read/write (讀寫) operations.
// Supports:
// 1) Dedicated Web Worker message API
// 2) Service Worker message API
// 3) Fetch API (useful for Worker runtimes that require fetch handlers)

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

function executeAction(payload) {
  const { id, action, key, value, entries } = payload ?? {};

  switch (action) {
    case 'set': {
      if (!validateKey(key)) throw new Error('Invalid key');
      store.set(key, value);
      return ok(id, { key, value });
    }
    case 'get': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, { key, value: store.get(key), exists: store.has(key) });
    }
    case 'delete': {
      if (!validateKey(key)) throw new Error('Invalid key');
      const deleted = store.delete(key);
      return ok(id, { key, deleted });
    }
    case 'has': {
      if (!validateKey(key)) throw new Error('Invalid key');
      return ok(id, { key, exists: store.has(key) });
    }
    case 'keys':
      return ok(id, { keys: [...store.keys()] });
    case 'values':
      return ok(id, { values: [...store.values()] });
    case 'entries':
      return ok(id, { entries: [...store.entries()] });
    case 'clear': {
      store.clear();
      return ok(id, { cleared: true });
    }
    case 'bulkSet': {
      if (!Array.isArray(entries)) throw new Error('entries must be an array');
      for (const [entryKey, entryValue] of entries) {
        if (!validateKey(entryKey)) throw new Error(`Invalid key in entries: ${entryKey}`);
        store.set(entryKey, entryValue);
      }
      return ok(id, { count: entries.length });
    }
    default:
      throw new Error(`Unsupported action: ${String(action)}`);
  }
}

function toResult(payload) {
  try {
    return executeAction(payload);
  } catch (error) {
    const id = payload?.id;
    return fail(id, error instanceof Error ? error.message : 'Unknown worker error');
  }
}

function postMessageResponse(event, responsePayload) {
  // Service worker message events should reply through event.source when possible.
  if (event?.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage(responsePayload);
    return;
  }

  // Dedicated worker fallback.
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
    self.postMessage(responsePayload);
  }
}

self.addEventListener('message', (event) => {
  const responsePayload = toResult(event.data);
  postMessageResponse(event, responsePayload);
});

async function handleFetch(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Use POST with JSON body: { id, action, key?, value?, entries? }',
      }),
      { status: 405, headers: { 'content-type': 'application/json' } }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const responsePayload = toResult(payload);
  return new Response(JSON.stringify(responsePayload), {
    status: responsePayload.ok ? 200 : 400,
    headers: { 'content-type': 'application/json' },
  });
}

// Register fetch handler so Worker runtimes (e.g. AI worker style runtimes)
// do not fail with "No event handlers were registered".
self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});
