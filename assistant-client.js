const cloudSite = () => document.querySelector('meta[name="heban-cloud-site"]')?.content;
const assistantUrl = () => document.querySelector('meta[name="heban-assistant-url"]')?.content;

export function directAssistantUrl(route) {
  const site = cloudSite();
  return site && !assistantUrl() ? new URL(`#/${route}`, site).href : '';
}

function connectionError(message) {
  return Object.assign(new Error(message), { canOpenDirect: true });
}

function requestTimeout(milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function diagnoseConnection(endpoint) {
  if (navigator.onLine === false) return new Error('手机没有连上网络。连上 Wi-Fi 或打开移动数据后，再试一次。');

  const timeout = requestTimeout(4_000);
  let health;
  try {
    const response = await fetch(endpoint, {
      credentials: 'omit', cache: 'no-store', signal: timeout.signal,
    });
    if (response.ok) health = await response.json();
    if (response.status === 403) return connectionError('这个页面暂时不能连接助手。请重新打开禾伴再试。');
  } catch {
    // The browser can report both a blocked request and a network failure here.
  } finally {
    timeout.clear();
  }
  if (health?.online === true) return connectionError('能连上助手，但这次请求没完成。请再试一次。');
  if (health?.online === false) return new Error('助手服务暂时不可用。请稍后再试。');
  return connectionError('当前网络暂时连不上助手。可以换 Wi-Fi 或移动网络再试。');
}

function responseError(response, result) {
  if (response.status === 403) return connectionError('这个页面暂时不能连接助手。请重新打开禾伴再试。');
  if (typeof result?.error === 'string' && result.error.trim()) return new Error(result.error);
  if (response.status === 429) return new Error('现在使用助手的人较多。请稍后再试。');
  if (response.status === 504) return new Error('助手回答等得太久了。请再试一次。');
  return new Error('助手服务暂时不可用。请稍后再试。');
}

export async function askAssistant(input) {
  const configured = assistantUrl();
  const endpoint = configured ? new URL(configured) : new URL('/api/assistant', cloudSite() || location.origin);
  const timeout = requestTimeout(32_000);
  let response;
  let result;
  try {
    response = await fetch(endpoint, {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': endpoint.origin === location.origin ? 'application/json' : 'text/plain;charset=UTF-8' },
      body: JSON.stringify(input), signal: timeout.signal,
    });
    result = await response.json();
  } catch {
    if (timeout.signal.aborted) throw new Error('助手回答等得太久了。请再试一次。');
    if (!response) throw await diagnoseConnection(endpoint);
    if (response.ok) throw connectionError('助手返回的内容没能读完整。请再试一次。');
  } finally {
    timeout.clear();
  }
  if (!response.ok) throw responseError(response, result);
  return result;
}
