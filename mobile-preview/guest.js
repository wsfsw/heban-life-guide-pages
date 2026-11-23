let opening;
const memory = new Map();

function openGuest() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('heban-guest', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('data');
      request.result.createObjectStore('records', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('浏览器正在使用旧版数据。'));
  }).catch(() => null);
  return opening;
}

async function storage(storeName, method, ...args) {
  const db = await openGuest();
  if (!db) {
    const key = `${storeName}:${args[1] ?? args[0]?.id ?? args[0]}`;
    if (method === 'get') return structuredClone(memory.get(key));
    if (method === 'put') memory.set(key, structuredClone(args[0]));
    if (method === 'delete') memory.delete(key);
    if (method === 'getAll') return [...memory].filter(([id]) => id.startsWith(storeName + ':')).map(([, item]) => structuredClone(item));
    return;
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, ['put', 'delete'].includes(method) ? 'readwrite' : 'readonly');
    const request = transaction.objectStore(storeName)[method](...args);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(new Error('无法保存到本机，请检查浏览器的存储空间。'));
  });
}

export async function readGuest() {
  return { user: { name: '游客', guest: true, temporary: !await openGuest() }, state: await storage('data', 'get', 'state') ?? {} };
}

export function saveGuest(state) {
  return storage('data', 'put', state, 'state');
}

export async function guestRecords(path, method, body) {
  const id = path.match(/^\/api\/records\/([0-9a-f-]{36})$/)?.[1];
  if (path === '/api/records' && method === 'GET') {
    const records = await storage('records', 'getAll');
    return { records: records.sort((a, b) => b.createdAt - a.createdAt) };
  }
  if (path === '/api/records' && method === 'POST') {
    const records = await storage('records', 'getAll');
    if (records.length >= 24) throw new Error('最多保存 24 条现场记录，请先整理旧照片。');
    const record = { ...body, id: crypto.randomUUID(), createdAt: Date.now() };
    await storage('records', 'put', record);
    return { record };
  }
  if (id && method === 'GET') {
    const record = await storage('records', 'get', id);
    if (record) return { record };
  }
  if (id && method === 'DELETE') {
    await storage('records', 'delete', id);
    return { removed: true };
  }
  throw new Error('找不到这条现场记录。');
}
