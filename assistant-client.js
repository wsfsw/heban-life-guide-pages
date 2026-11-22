export async function askAssistant(input) {
  const cloudSite = document.querySelector('meta[name="heban-cloud-site"]')?.content;
  const response = await fetch(new URL('/api/assistant', cloudSite || location.origin), {
    method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => { throw new Error('在线助手暂时连不上，请稍后再试。'); });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '在线助手暂时连不上，请稍后再试。');
  return result;
}
