export const deviceLessons = [
  {
    id: 'television',
    name: '电视遥控器',
    summary: '开电视、换台、调音量',
    icon: 'remote',
    controls: [
      ['power', '电源'], ['channel', '频道＋'], ['volume', '音量＋'], ['mute', '静音'],
    ],
    steps: [
      { key: 'power', text: '找到「电源」按钮，按一下打开电视。' },
      { key: 'channel', text: '想换到下一个台，按一下「频道＋」。' },
      { key: 'volume', text: '听不清时，按一下「音量＋」。' },
    ],
    displays: ['电视关着', '频道 01　音量 10', '频道 02　音量 10', '频道 02　音量 11'],
  },
  {
    id: 'washer',
    name: '洗衣机',
    summary: '选日常洗，开始洗衣',
    icon: 'washer',
    controls: [
      ['power', '电源'], ['cycle', '程序'], ['start', '启动 / 暂停'], ['rinse', '漂洗'],
    ],
    steps: [
      { key: 'power', text: '找到「电源」按钮，按一下打开面板。' },
      { key: 'cycle', text: '按「程序」，找到常用的「标准洗」。' },
      { key: 'start', text: '确认衣物放好、门盖关好后，按「启动 / 暂停」。' },
    ],
    displays: ['面板关着', '请选择程序', '已选：标准洗', '标准洗已开始'],
  },
  {
    id: 'rice-cooker',
    name: '电饭煲',
    summary: '找到煮饭功能，确认开始',
    icon: 'cooker',
    controls: [
      ['mode', '功能'], ['start', '开始'], ['warm', '保温'], ['cancel', '取消'],
    ],
    steps: [
      { key: 'mode', text: '找到「功能」按钮，在面板上选「煮饭」。' },
      { key: 'start', text: '确认内胆放好、盖子合好后，按「开始」。' },
    ],
    displays: ['请选择功能', '已选：煮饭', '煮饭已开始'],
  },
];

export async function readDevicePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 JPG、PNG 或 WebP 照片。');
  }
  if (file.size > 16 * 1024 * 1024) throw new Error('照片太大，请换一张小于 16 MB 的照片。');

  const url = URL.createObjectURL(file);
  const picture = new Image();
  try {
    picture.src = url;
    await picture.decode();
    return compressPhoto(picture, picture.naturalWidth, picture.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function compressPhoto(picture, width, height) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || !width || !height) throw new Error('暂时无法读取画面，请再试一次。');
  for (const limit of [1280, 960, 760, 560, 420]) {
    const scale = Math.min(1, limit / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.77);
    if (data.length <= 190_000) return data;
  }
  throw new Error('照片细节过多，请裁小一点或重新拍摄。');
}
