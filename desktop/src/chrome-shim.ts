/**
 * Minimal `chrome.*` replacement so the extension's storage / capture / export code runs
 * unchanged inside the desktop app. Storage lives in IndexedDB (no 5 MB localStorage cap).
 * Must be imported before anything from ../src.
 */
import { recognize } from './ocr';

type Area = 'local' | 'sync';
type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type ChangeListener = (changes: Changes, area: Area) => void;

const DB_NAME = 'aureen-desktop';
const STORE = 'kv';

const cache: Record<Area, Map<string, unknown>> = { local: new Map(), sync: new Map() };
const listeners = new Set<ChangeListener>();
let ready: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (!ready) {
    ready = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).then(async (db) => {
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve();
          const [area, ...rest] = String(cursor.key).split(':');
          cache[area as Area]?.set(rest.join(':'), cursor.value);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
      return db;
    });
  }
  return ready;
}

async function persist(area: Area, key: string, value: unknown, remove: boolean): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (remove) store.delete(`${area}:${key}`);
    else store.put(value, `${area}:${key}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function emit(changes: Changes, area: Area): void {
  if (Object.keys(changes).length === 0) return;
  for (const listener of [...listeners]) listener(changes, area);
}

function makeArea(area: Area) {
  return {
    async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
      await openDb();
      const store = cache[area];
      const out: Record<string, unknown> = {};
      if (keys == null) {
        store.forEach((v, k) => (out[k] = v));
      } else if (typeof keys === 'string') {
        if (store.has(keys)) out[keys] = store.get(keys);
      } else if (Array.isArray(keys)) {
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
      } else {
        for (const [k, fallback] of Object.entries(keys)) out[k] = store.has(k) ? store.get(k) : fallback;
      }
      return out;
    },
    async set(items: Record<string, unknown>): Promise<void> {
      await openDb();
      const changes: Changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: cache[area].get(k), newValue: v };
        cache[area].set(k, v);
        await persist(area, k, v, false);
      }
      emit(changes, area);
    },
    async remove(keys: string | string[]): Promise<void> {
      await openDb();
      const changes: Changes = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (!cache[area].has(k)) continue;
        changes[k] = { oldValue: cache[area].get(k) };
        cache[area].delete(k);
        await persist(area, k, undefined, true);
      }
      emit(changes, area);
    },
    async getBytesInUse(): Promise<number> {
      await openDb();
      let total = 0;
      cache[area].forEach((v, k) => (total += k.length + JSON.stringify(v ?? null).length));
      return total;
    }
  };
}

const noopEvent = { addListener() {}, removeListener() {} };

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: makeArea('local'),
    sync: makeArea('sync'),
    onChanged: {
      addListener: (fn: ChangeListener) => listeners.add(fn),
      removeListener: (fn: ChangeListener) => listeners.delete(fn)
    }
  },
  runtime: {
    getURL: (path: string) => `/${path}`,
    onMessage: noopEvent,
    async sendMessage(message: { action?: string; imageData?: string }) {
      if (message.action === 'ocr-capture' && message.imageData) {
        try {
          const text = await recognize(message.imageData);
          return { success: true, text, lang: 'chi_tra+eng' };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      return undefined;
    }
  }
};
