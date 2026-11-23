import { deviceLessons } from './devices.js';
import { lifeGuides } from './guides.js';

export const shortcutOptions = {
  guides: { title: '跟着做', link: 'guides', glyph: 'bill' },
  ask: { title: '问问助手', link: 'ask', glyph: 'chat' },
  camera: { title: '拍照问一问', link: 'capture/device', glyph: 'camera' },
  reminders: { title: '设个提醒', link: 'reminders', glyph: 'bell' },
  records: { title: '我的记录', link: 'records', glyph: 'photo' },
  chat: { title: '聊聊天', link: 'chat', glyph: 'chat' },
  devices: { title: '家电怎么用', link: 'devices', glyph: 'remote' },
  ...Object.fromEntries(lifeGuides.map(({ id, title, icon }) => [id, { title, link: `guide/${id}`, glyph: icon, group: '生活步骤' }])),
  ...Object.fromEntries(deviceLessons.map(({ id, name, icon }) => [id, { title: `${name}怎么用`, link: `device/${id}`, glyph: icon, group: '家电步骤' }])),
};

export const defaultShortcuts = ['ask', 'parcel', 'bill', 'devices', 'reminders'];

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
