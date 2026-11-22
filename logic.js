export const storageKey = 'heban-local-v1';

export const personas = {
  '小禾': { label: '温和陪聊', prefix: '慢慢来，', preview: '您好，我是小禾。您慢慢说，我们一步一步来。' },
  '小松': { label: '说话简洁', prefix: '', preview: '您好，我是小松。您说要做什么，我帮您找下一步。' },
  '暖暖': { label: '活泼亲切', prefix: '好呀，', preview: '您好，我是暖暖。今天想聊点什么？' },
};

export const speechRates = {
  slow: { label: '慢', value: 0.7 },
  normal: { label: '标准', value: 0.9 },
  faster: { label: '较快', value: 1.1 },
  fast: { label: '快', value: 1.3 },
};

export function newState() {
  return {
    persona: '小禾', speechRate: 'normal', interests: '', contactName: '爸妈', phone: '', listen: false,
    monitoring: false, quietDays: 3, lastSeen: null, greeted: false,
    reminders: [], shared: [], deviceGuides: [], guideRuns: {}, shortcuts: [], messages: { chat: [], ask: [], 'family-chat': [] },
  };
}

export function dayStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function localDate(value) {
  const date = new Date(value);
  return [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join('-');
}

const two = (number) => String(number).padStart(2, '0');
export const localTime = (value) => {
  const date = new Date(value);
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
};

export function formatWhen(value, now = Date.now()) {
  const date = new Date(value);
  const tomorrow = dayStart(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const label = localDate(date) === localDate(now) ? '今天'
    : localDate(date) === localDate(tomorrow) ? '明天'
    : `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${label} ${localTime(date)}`;
}

export function inactiveDays(lastSeen, now = Date.now()) {
  return lastSeen ? Math.max(0, Math.floor((now - lastSeen) / 86_400_000)) : 0;
}

export function reminderOrder(reminders, owner) {
  return reminders.filter((item) => item.owner === owner).sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at);
}

export function finishReminder(item, now = Date.now()) {
  const interval = { daily: 1, weekly: 7 }[item.repeat];
  if (!interval) {
    item.done = !item.done;
    return item.done ? '已标为完成。' : '已恢复待办。';
  }
  const next = new Date(item.at);
  do {
    next.setDate(next.getDate() + interval);
  } while (next.getTime() <= now);
  item.at = next.getTime();
  item.notified = false;
  return `本次已完成。下次${formatWhen(item.at)}提醒。`;
}

const dayWords = { 今天: 0, 今晚: 0, 明天: 1, 明早: 1, 明晚: 1, 后天: 2 };
const numberChars = '零一二三四五六七八九';
const digit = (part) => part === '两' ? 2 : numberChars.indexOf(part);
function numberFromText(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value.includes('十')) {
    const [tens, units] = value.split('十');
    return (tens ? digit(tens) : 1) * 10 + (units ? digit(units) : 0);
  }
  return digit(value);
}

export function parseReminder(text, now = Date.now()) {
  const source = text.normalize('NFKC').trim();
  const day = source.match(/今天|今晚|明天|明早|明晚|后天/);
  const part = source.match(/凌晨|早上|上午|中午|下午|傍晚|晚上/);
  const time = source.match(/([0-9零一二两三四五六七八九十]{1,3})(?:[:：]([0-9]{1,2})|[点时](?:(半)|([0-9零一二两三四五六七八九十]{1,3})分?)?)/);
  if (!time) return null;

  let hour = numberFromText(time[1]);
  const minute = time[2] ? Number(time[2]) : time[3] ? 30 : time[4] ? numberFromText(time[4]) : 0;
  const evening = /下午|傍晚|晚上/.test(part?.[0] || '') || /晚/.test(day?.[0] || '');
  if (evening && hour < 12) hour += 12;
  if (part?.[0] === '中午' && hour >= 1 && hour <= 2) hour += 12;
  if (part?.[0] === '凌晨' && hour === 12) hour = 0;
  if (minute < 0 || minute >= 60 || hour < 0 || hour >= 24) return null;

  const date = dayStart(now);
  date.setDate(date.getDate() + (dayWords[day?.[0]] ?? 0));
  date.setHours(hour, minute, 0, 0);
  if (!day && date.getTime() <= now) date.setDate(date.getDate() + 1);
  const repeat = source.includes('每天') ? 'daily' : 'never';
  const title = source.replace(time[0], '').replace(day?.[0] || '', '').replace(part?.[0] || '', '').replace('每天', '')
    .replace(/^(?:请|帮我|记得|给我|设置|一个|提醒我|叫我|提醒|要|去|在|[\s,，。:：])+/g, '')
    .replace(/[\s,，。!！]+$/g, '').trim();
  return { title, at: date.getTime(), repeat };
}

export const topics = [
  { title: '怎么查电费？', tags: /电费|水费|燃气费|缴费|账单/, answer: '请从您平时使用的供电服务或微信里的生活缴费入口查账单。先确认住址和户号。只想查询的话，看到账单就可以停下。短信里的缴费链接可以先放一放，自己打开熟悉的入口核对。' },
  { title: '怎么叫车？', tags: /叫车|打车|出租|公交|出门/, answer: '先定一个司机容易找到的上车点，比如小区大门或便利店。可以打开您平时用的打车工具，也可以问社区便民点有没有本地的电话叫车服务。上车前对一下车牌。' },
  { title: '怎么放大手机字体？', tags: /字体|大字|字太小/, answer: '打开手机的「设置」，在上方搜索「字体大小」。找到后，慢慢把滑块往右移，选到看清楚又舒服的大小。不同手机的菜单名称可能有点不一样。' },
  { title: '怎么连接家里的 Wi-Fi？', tags: /wifi|wi-fi|网络|无线/i, answer: '打开手机「设置」，找「无线局域网」或「WLAN」，点家里的网络名字，然后输入家里的密码。输密码时留意大小写。' },
  { title: '附近有什么社区活动？', tags: /活动|社区|食堂|午饭|买菜/, answer: '想了解附近的活动或助餐，可以先看看社区公告栏，或者问一下熟悉的社区便民点。出门前问清时间、地点和是否要报名，省得白跑。' },
];

export function answerFor(text, mode, state) {
  const topic = topics.find((item) => item.tags.test(text));
  if (topic) return topic.answer;
  if (/提醒|叫我|记得/.test(text)) return '请告诉我什么时候提醒、要做什么。可以说「明天下午三点提醒我浇花」。我会先把时间和内容列给您确认。';
  if (mode === 'family-chat' && /爸|妈|家人|关心|电话/.test(text)) return '可以从一件具体的小事开头，比如问问今天吃了什么，或最近有没有想去的地方。如果想约个固定时间打电话，可以说「明天晚上八点提醒我给爸妈打电话」。';
  if (/孤单|无聊|想家|想念/.test(text)) return '听起来您想和人说说话。您可以和我聊一件今天发生的小事，也可以给熟悉的人打个电话。今天有什么事情让您印象特别深？';
  if (/难过|不开心|心情不好/.test(text)) return '听起来今天过得有些不容易。您愿意说说发生了什么吗？如果身边有信得过的人，也可以请他陪您坐一会儿。';
  if (mode === 'ask') return '可以再说说您卡在哪一步吗？比如「手机字太小」或「我想查电费，不知道在哪里查」。目前这里能帮您处理几种常见的生活问题。';
  const opening = personas[state.persona].prefix;
  const interest = state.interests.split(/[、，,\s]+/).find(Boolean);
  if (interest) return `${opening}我听着呢。您想继续聊刚才的事，还是说说您喜欢的「${interest.slice(0, 24)}」？`;
  return `${opening}我听着呢。您愿意接着跟我说说，今天发生了什么吗？`;
}

export function calendarFile(item) {
  const date = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const summary = item.title.replaceAll('\\', '\\\\').replace(/[,;]/g, '\\$&').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Heban//Reminder//CN', 'BEGIN:VEVENT',
    `UID:${item.id}@heban.local`, `DTSTAMP:${date(Date.now())}`, `DTSTART:${date(item.at)}`,
    `DTEND:${date(item.at + 15 * 60_000)}`, `SUMMARY:${summary}`,
    ...({ daily: ['RRULE:FREQ=DAILY'], weekly: ['RRULE:FREQ=WEEKLY'] }[item.repeat] ?? []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${summary}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
