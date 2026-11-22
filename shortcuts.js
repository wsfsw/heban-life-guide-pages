export const shortcutOptions = {
  guides: { title: '生活操作指引', link: 'guides', glyph: 'bill' },
  camera: { title: '拍照分析', link: 'capture/device', glyph: 'camera' },
  reminders: { title: '设置提醒', link: 'reminders', glyph: 'bell' },
  records: { title: '我的记录', link: 'records', glyph: 'photo' },
  chat: { title: '聊聊天', link: 'chat', glyph: 'chat' },
};

export function cleanShortcut(source) {
  if (typeof source?.target !== 'string') return null;
  const title = typeof source.title === 'string' ? source.title.trim().slice(0, 24) : '';
  const { kind, target } = source;
  if (kind === 'built-in' && Object.hasOwn(shortcutOptions, target)) {
    return { kind, target, title: title || shortcutOptions[target].title };
  }
  if (kind !== 'website' || !title || target.length > 500) return null;
  try {
    const url = new URL(target.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 500) return null;
    return { kind, target: url.href, title };
  } catch { return null; }
}
