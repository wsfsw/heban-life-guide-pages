import { readGuest, saveGuest, guestRecords } from './guest.js';

let revision = null;
let pending = null;
let inFlight = null;
let timer;
let blocked = false;
let onChange = () => {};
let transport = 'account';

export async function api(path, method = 'GET', body) {
  if (transport === 'guest' && path.startsWith('/api/records')) return guestRecords(path, method, body);
  if (transport === 'guest' && path.startsWith('/api/family')) throw new Error('登录后可以与家人连接和分享。');
  const headers = new Headers();
  headers.set(transport === 'legacy' ? 'X-Heban-Legacy' : 'X-Heban-Account', '1');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    method, cache: 'no-store', credentials: 'same-origin', headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || (response.status === 401 ? '请先登录禾伴。' : '暂时无法连接，请稍后再试。'));
    error.status = response.status;
    throw error;
  }
  return data;
}

export function photoUrl(path) {
  if (!path?.startsWith('/api/')) return path;
  return path + (transport === 'legacy' ? '?identity=legacy' : '?identity=account');
}

export async function connectCloud(listener, mode = 'account') {
  clearTimeout(timer);
  onChange = listener;
  transport = mode;
  revision = null;
  pending = null;
  blocked = false;
  if (mode === 'guest') {
    const result = await readGuest();
    revision = 0;
    return result;
  }
  const result = await api('/api/state');
  if (!result.user || !Number.isSafeInteger(result.revision)) throw new Error('读取账户失败，请重新打开。');
  revision = result.revision;
  return result;
}

export function saveCloud(state) {
  if (revision === null) return false;
  pending = JSON.stringify(state);
  if (blocked) return true;
  onChange('saving');
  clearTimeout(timer);
  timer = setTimeout(flushCloud, 250);
  return true;
}

export async function flushCloud() {
  clearTimeout(timer);
  if (blocked || revision === null) return false;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    while (pending) {
      const item = pending;
      pending = null;
      try {
        const value = JSON.parse(item);
        if (transport === 'guest') await saveGuest(value);
        else revision = (await api('/api/state', 'PUT', { revision, state: value })).revision;
      } catch (error) {
        pending ??= item;
        blocked = error.status === 409 || error.status === 401;
        onChange(error.status === 409 ? 'conflict' : error.status === 401 ? 'auth' : 'error', error.message);
        return false;
      }
    }
    onChange('saved');
    return true;
  })();
  try { return await inFlight; } finally { inFlight = null; }
}

export function unsyncedCloud() {
  return Boolean(pending || inFlight);
}
