type WorkerAction =
  | 'set'
  | 'get'
  | 'delete'
  | 'has'
  | 'keys'
  | 'values'
  | 'entries'
  | 'clear'
  | 'bulkSet';

type WorkerPayload = {
  id: string;
  action: WorkerAction;
  key?: string;
  value?: unknown;
  entries?: [string, unknown][];
};

type WorkerResult<T = unknown> = {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
};

export class WorkerAIStorageClient {
  private worker: Worker;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  constructor(workerUrl = new URL('./worker-ai-storage.js', import.meta.url)) {
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const result = event.data;
      const task = this.pending.get(result.id);
      if (!task) return;

      this.pending.delete(result.id);
      if (result.ok) {
        task.resolve(result.data);
      } else {
        task.reject(new Error(result.error ?? 'Worker operation failed'));
      }
    };
  }

  request<T = unknown>(action: WorkerAction, payload: Omit<WorkerPayload, 'id' | 'action'> = {}) {
    const id = crypto.randomUUID();
    const message: WorkerPayload = { id, action, ...payload };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message);
    });
  }

  set(key: string, value: unknown) {
    return this.request('set', { key, value });
  }

  get(key: string) {
    return this.request<{ key: string; value: unknown; exists: boolean }>('get', { key });
  }

  delete(key: string) {
    return this.request<{ key: string; deleted: boolean }>('delete', { key });
  }

  has(key: string) {
    return this.request<{ key: string; exists: boolean }>('has', { key });
  }

  keys() {
    return this.request<{ keys: string[] }>('keys');
  }

  entries() {
    return this.request<{ entries: [string, unknown][] }>('entries');
  }

  values() {
    return this.request<{ values: unknown[] }>('values');
  }

  clear() {
    return this.request<{ cleared: boolean }>('clear');
  }

  bulkSet(entries: [string, unknown][]) {
    return this.request<{ count: number }>('bulkSet', { entries });
  }

  terminate() {
    for (const { reject } of this.pending.values()) {
      reject(new Error('Worker terminated before response'));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
