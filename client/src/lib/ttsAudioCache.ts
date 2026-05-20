// Cache de áudio TTS em IndexedDB.
//
// Frases curtas que o JARVIS repete com frequência ("Sim, senhor.",
// "Compreendido, senhor.", "Imediatamente, senhor.", "Em que posso ajudar?")
// pagam um TTFB fixo do ElevenLabs (~600ms-1.8s) toda vez. Guardando o Blob MP3
// indexado por SHA-256(text|voiceId) eliminamos completamente esse overhead em
// reproduções subsequentes.
//
// Política:
// - Apenas frases com até CACHE_MAX_CHARS (default 80) são cacheadas.
// - LRU simples: ao exceder CACHE_MAX_ENTRIES, removemos as menos recentemente
//   acessadas.
// - Compatível com SSR/sem suporte: todas as funções degradam silenciosamente
//   retornando null.

const DB_NAME = "jarvis-tts-cache";
const DB_VERSION = 1;
const STORE = "blobs";
export const CACHE_MAX_CHARS = 80;
export const CACHE_MAX_ENTRIES = 60;

interface CacheEntry {
  key: string;
  // Armazenamos ArrayBuffer + mime para sobreviver ao structured clone do
  // IndexedDB em qualquer ambiente (alguns polyfills perdem o objeto Blob).
  buffer: ArrayBuffer;
  mime: string;
  createdAt: number;
  lastUsedAt: number;
  byteSize: number;
}

function isAvailable(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function ttsCacheKey(text: string, voiceId: string): Promise<string> {
  // Normalização: trim + colapsa espaços + lowercase. Mantemos pontuação porque
  // afeta entonação do TTS (pergunta vs. afirmação geram MP3s diferentes).
  const normalized = text.trim().replace(/\s+/g, " ").toLowerCase();
  return `${voiceId}|${await sha256Hex(normalized)}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!isAvailable()) return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function txPromise<T>(tx: IDBTransaction, value: T): Promise<T> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(tx.error || new Error("tx aborted"));
    tx.onerror = () => reject(tx.error || new Error("tx error"));
  });
}

/** Recupera um Blob cacheado (e atualiza lastUsedAt) ou retorna null. */
export async function getCachedTtsBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let entry: CacheEntry | undefined;
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      entry = getReq.result as CacheEntry | undefined;
      if (entry) {
        entry.lastUsedAt = Date.now();
        store.put(entry);
      }
    };
    tx.oncomplete = () => {
      db.close();
      if (!entry) return resolve(null);
      try {
        const blob = new Blob([entry.buffer], { type: entry.mime || "audio/mpeg" });
        resolve(blob);
      } catch {
        resolve(null);
      }
    };
    tx.onerror = () => { db.close(); resolve(null); };
    tx.onabort = () => { db.close(); resolve(null); };
  });
}

/** Persiste um Blob cacheado, aplicando LRU simples. */
export async function putCachedTtsBlob(key: string, blob: Blob, originalText: string): Promise<void> {
  if (originalText.trim().length > CACHE_MAX_CHARS) return;
  // Materializa o ArrayBuffer ANTES de abrir a transação (await assino não
  // pode acontecer entre operations da mesma tx no IndexedDB).
  let buffer: ArrayBuffer;
  try {
    buffer = await blob.arrayBuffer();
  } catch {
    return;
  }
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const now = Date.now();
      const entry: CacheEntry = {
        key,
        buffer,
        mime: blob.type || "audio/mpeg",
        createdAt: now,
        lastUsedAt: now,
        byteSize: buffer.byteLength,
      };
      store.put(entry);
      txPromise(tx, undefined).then(() => resolve()).catch(() => resolve());
    });
    await evictIfNeeded(db);
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

async function evictIfNeeded(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    let toRemove = 0;
    let removed = 0;
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= CACHE_MAX_ENTRIES) {
        return; // tx fecha sozinha
      }
      toRemove = count - CACHE_MAX_ENTRIES;
      const idx = store.index("lastUsedAt");
      const cursorReq = idx.openCursor(null, "next");
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return; // chegamos ao fim
        if (removed < toRemove) {
          // delete + continue: a request 'cursor.delete()' é assíncrona,
          // mas o cursor avança com continue() na próxima iteração.
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
      };
    };
    txPromise(tx, undefined).then(() => resolve()).catch(() => resolve());
  });
}

/** Limpa o cache inteiro. Útil para troca de voz. */
export async function clearTtsCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    txPromise(tx, undefined).then(() => resolve()).catch(() => resolve());
  });
  try { db.close(); } catch { /* ignore */ }
}

/** Indica se a string é elegível para cache (heurística simples). */
export function isCacheableText(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= CACHE_MAX_CHARS;
}
