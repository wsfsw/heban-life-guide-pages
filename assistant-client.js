export async function askAssistant(input) {
  const cloudSite = document.querySelector('meta[name="heban-cloud-site"]')?.content;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 32_000);
  try {
    const response = await fetch(new URL('/api/assistant', cloudSite || location.origin), {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': cloudSite ? 'text/plain;charset=UTF-8' : 'application/json' },
      body: JSON.stringify(input), signal: controller.signal,
    }).catch(() => {
      throw new Error(controller.signal.aborted ? '这次等待超时了，您可以重试。' : '没能连接到在线助手，请检查网络后重试。');
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '在线助手暂时连不上，请稍后再试。');
    return result;
  } finally {
    clearTimeout(timer);
  }
}
