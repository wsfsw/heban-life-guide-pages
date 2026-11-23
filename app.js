// logic.js
var personas = {
  "\u5C0F\u79BE": { label: "\u6E29\u548C\u966A\u804A", preview: "\u60A8\u597D\uFF0C\u6211\u662F\u5C0F\u79BE\u3002\u60A8\u6162\u6162\u8BF4\uFF0C\u6211\u4EEC\u4E00\u6B65\u4E00\u6B65\u6765\u3002" },
  "\u5C0F\u677E": { label: "\u8BF4\u8BDD\u7B80\u6D01", preview: "\u60A8\u597D\uFF0C\u6211\u662F\u5C0F\u677E\u3002\u60A8\u8BF4\u8981\u505A\u4EC0\u4E48\uFF0C\u6211\u5E2E\u60A8\u627E\u4E0B\u4E00\u6B65\u3002" },
  "\u6696\u6696": { label: "\u6D3B\u6CFC\u4EB2\u5207", preview: "\u60A8\u597D\uFF0C\u6211\u662F\u6696\u6696\u3002\u4ECA\u5929\u60F3\u804A\u70B9\u4EC0\u4E48\uFF1F" }
};
var speechRates = {
  slow: { label: "\u6162", value: 0.7 },
  normal: { label: "\u6807\u51C6", value: 0.9 },
  faster: { label: "\u8F83\u5FEB", value: 1.1 },
  fast: { label: "\u5FEB", value: 1.3 }
};
function newState() {
  return {
    persona: "\u5C0F\u79BE",
    speechRate: "normal",
    interests: "",
    contactName: "\u7238\u5988",
    phone: "",
    listen: false,
    monitoring: false,
    quietDays: 3,
    lastSeen: null,
    greeted: false,
    reminders: [],
    shared: [],
    deviceGuides: [],
    guideRuns: {},
    shortcuts: [],
    hiddenShortcuts: [],
    familyVisibility: [],
    messages: { chat: [], ask: [], "family-chat": [] }
  };
}
function familyPermission(state2, person) {
  if (!Array.isArray(state2.familyVisibility)) return void 0;
  return state2.familyVisibility.find((item) => item?.id === person.id && item.linkedAt === person.linkedAt);
}
function dayStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
function localDate(value) {
  const date = new Date(value);
  return [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join("-");
}
var two = (number) => String(number).padStart(2, "0");
var localTime = (value) => {
  const date = new Date(value);
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
};
function formatWhen(value, now = Date.now()) {
  const date = new Date(value);
  const tomorrow = dayStart(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const label = localDate(date) === localDate(now) ? "\u4ECA\u5929" : localDate(date) === localDate(tomorrow) ? "\u660E\u5929" : `${date.getMonth() + 1}\u6708${date.getDate()}\u65E5`;
  return `${label} ${localTime(date)}`;
}
function inactiveDays(lastSeen, now = Date.now()) {
  return lastSeen ? Math.max(0, Math.floor((now - lastSeen) / 864e5)) : 0;
}
function reminderOrder(reminders, owner) {
  return reminders.filter((item) => item.owner === owner).sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at);
}
function finishReminder(item, now = Date.now()) {
  const interval = { daily: 1, weekly: 7 }[item.repeat];
  if (!interval) {
    item.done = !item.done;
    return item.done ? "\u5DF2\u6807\u4E3A\u5B8C\u6210\u3002" : "\u5DF2\u6062\u590D\u5F85\u529E\u3002";
  }
  const next = new Date(item.at);
  do {
    next.setDate(next.getDate() + interval);
  } while (next.getTime() <= now);
  item.at = next.getTime();
  item.notified = false;
  return `\u672C\u6B21\u5DF2\u5B8C\u6210\u3002\u4E0B\u6B21${formatWhen(item.at)}\u63D0\u9192\u3002`;
}
var dayWords = { \u4ECA\u5929: 0, \u4ECA\u665A: 0, \u660E\u5929: 1, \u660E\u65E9: 1, \u660E\u665A: 1, \u540E\u5929: 2 };
var numberChars = "\u96F6\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D";
var digit = (part) => part === "\u4E24" ? 2 : numberChars.indexOf(part);
function numberFromText(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value.includes("\u5341")) {
    const [tens, units] = value.split("\u5341");
    return (tens ? digit(tens) : 1) * 10 + (units ? digit(units) : 0);
  }
  return digit(value);
}
function parseReminder(text, now = Date.now()) {
  const source = text.normalize("NFKC").trim();
  const day = source.match(/今天|今晚|明天|明早|明晚|后天/);
  const part = source.match(/凌晨|早上|上午|中午|下午|傍晚|晚上/);
  const time = source.match(/([0-9零一二两三四五六七八九十]{1,3})(?:[:：]([0-9]{1,2})|[点时](?:(半)|([0-9零一二两三四五六七八九十]{1,3})分?)?)/);
  if (!time) return null;
  let hour = numberFromText(time[1]);
  const minute = time[2] ? Number(time[2]) : time[3] ? 30 : time[4] ? numberFromText(time[4]) : 0;
  const evening = /下午|傍晚|晚上/.test(part?.[0] || "") || /晚/.test(day?.[0] || "");
  if (evening && hour < 12) hour += 12;
  if (part?.[0] === "\u4E2D\u5348" && hour >= 1 && hour <= 2) hour += 12;
  if (part?.[0] === "\u51CC\u6668" && hour === 12) hour = 0;
  if (minute < 0 || minute >= 60 || hour < 0 || hour >= 24) return null;
  const date = dayStart(now);
  date.setDate(date.getDate() + (dayWords[day?.[0]] ?? 0));
  date.setHours(hour, minute, 0, 0);
  if (!day && date.getTime() <= now) date.setDate(date.getDate() + 1);
  const repeat = source.includes("\u6BCF\u5929") ? "daily" : "never";
  const title = source.replace(time[0], "").replace(day?.[0] || "", "").replace(part?.[0] || "", "").replace("\u6BCF\u5929", "").replace(/^(?:请|帮我|记得|给我|设置|一个|提醒我|叫我|提醒|要|去|在|[\s,，。:：])+/g, "").replace(/[\s,，。!！]+$/g, "").trim();
  return { title, at: date.getTime(), repeat };
}
var exampleQuestions = [
  "\u600E\u4E48\u67E5\u7535\u8D39\uFF1F",
  "\u600E\u4E48\u53EB\u8F66\uFF1F",
  "\u600E\u4E48\u653E\u5927\u624B\u673A\u5B57\u4F53\uFF1F"
];
function calendarFile(item) {
  const date = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const summary = item.title.replaceAll("\\", "\\\\").replace(/[,;]/g, "\\$&").replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Heban//Reminder//CN",
    "BEGIN:VEVENT",
    `UID:${item.id}@heban.local`,
    `DTSTAMP:${date(Date.now())}`,
    `DTSTART:${date(item.at)}`,
    `DTEND:${date(item.at + 15 * 6e4)}`,
    `SUMMARY:${summary}`,
    ...{ daily: ["RRULE:FREQ=DAILY"], weekly: ["RRULE:FREQ=WEEKLY"] }[item.repeat] ?? [],
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    `DESCRIPTION:${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

// devices.js
var deviceLessons = [
  {
    id: "television",
    name: "\u7535\u89C6\u9065\u63A7\u5668",
    summary: "\u5F00\u7535\u89C6\u3001\u6362\u53F0\u3001\u8C03\u97F3\u91CF",
    icon: "remote",
    controls: [
      ["power", "\u7535\u6E90"],
      ["channel", "\u9891\u9053\uFF0B"],
      ["volume", "\u97F3\u91CF\uFF0B"],
      ["mute", "\u9759\u97F3"]
    ],
    steps: [
      { key: "power", text: "\u627E\u5230\u300C\u7535\u6E90\u300D\u6309\u94AE\uFF0C\u6309\u4E00\u4E0B\u6253\u5F00\u7535\u89C6\u3002" },
      { key: "channel", text: "\u60F3\u6362\u5230\u4E0B\u4E00\u4E2A\u53F0\uFF0C\u6309\u4E00\u4E0B\u300C\u9891\u9053\uFF0B\u300D\u3002" },
      { key: "volume", text: "\u542C\u4E0D\u6E05\u65F6\uFF0C\u6309\u4E00\u4E0B\u300C\u97F3\u91CF\uFF0B\u300D\u3002" }
    ],
    displays: ["\u7535\u89C6\u5173\u7740", "\u9891\u9053 01\u3000\u97F3\u91CF 10", "\u9891\u9053 02\u3000\u97F3\u91CF 10", "\u9891\u9053 02\u3000\u97F3\u91CF 11"]
  },
  {
    id: "washer",
    name: "\u6D17\u8863\u673A",
    summary: "\u9009\u65E5\u5E38\u6D17\uFF0C\u5F00\u59CB\u6D17\u8863",
    icon: "washer",
    controls: [
      ["power", "\u7535\u6E90"],
      ["cycle", "\u7A0B\u5E8F"],
      ["start", "\u542F\u52A8 / \u6682\u505C"],
      ["rinse", "\u6F02\u6D17"]
    ],
    steps: [
      { key: "power", text: "\u627E\u5230\u300C\u7535\u6E90\u300D\u6309\u94AE\uFF0C\u6309\u4E00\u4E0B\u6253\u5F00\u9762\u677F\u3002" },
      { key: "cycle", text: "\u6309\u300C\u7A0B\u5E8F\u300D\uFF0C\u627E\u5230\u5E38\u7528\u7684\u300C\u6807\u51C6\u6D17\u300D\u3002" },
      { key: "start", text: "\u786E\u8BA4\u8863\u7269\u653E\u597D\u3001\u95E8\u76D6\u5173\u597D\u540E\uFF0C\u6309\u300C\u542F\u52A8 / \u6682\u505C\u300D\u3002" }
    ],
    displays: ["\u9762\u677F\u5173\u7740", "\u8BF7\u9009\u62E9\u7A0B\u5E8F", "\u5DF2\u9009\uFF1A\u6807\u51C6\u6D17", "\u6807\u51C6\u6D17\u5DF2\u5F00\u59CB"]
  },
  {
    id: "rice-cooker",
    name: "\u7535\u996D\u7172",
    summary: "\u627E\u5230\u716E\u996D\u529F\u80FD\uFF0C\u786E\u8BA4\u5F00\u59CB",
    icon: "cooker",
    controls: [
      ["mode", "\u529F\u80FD"],
      ["start", "\u5F00\u59CB"],
      ["warm", "\u4FDD\u6E29"],
      ["cancel", "\u53D6\u6D88"]
    ],
    steps: [
      { key: "mode", text: "\u627E\u5230\u300C\u529F\u80FD\u300D\u6309\u94AE\uFF0C\u5728\u9762\u677F\u4E0A\u9009\u300C\u716E\u996D\u300D\u3002" },
      { key: "start", text: "\u786E\u8BA4\u5185\u80C6\u653E\u597D\u3001\u76D6\u5B50\u5408\u597D\u540E\uFF0C\u6309\u300C\u5F00\u59CB\u300D\u3002" }
    ],
    displays: ["\u8BF7\u9009\u62E9\u529F\u80FD", "\u5DF2\u9009\uFF1A\u716E\u996D", "\u716E\u996D\u5DF2\u5F00\u59CB"]
  }
];
async function readDevicePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("\u8BF7\u9009\u62E9 JPG\u3001PNG \u6216 WebP \u7167\u7247\u3002");
  }
  if (file.size > 16 * 1024 * 1024) throw new Error("\u7167\u7247\u592A\u5927\uFF0C\u8BF7\u6362\u4E00\u5F20\u5C0F\u4E8E 16 MB \u7684\u7167\u7247\u3002");
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
function compressPhoto(picture, width, height) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || !width || !height) throw new Error("\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u753B\u9762\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
  for (const limit of [1280, 960, 760, 560, 420]) {
    const scale = Math.min(1, limit / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.77);
    if (data.length <= 19e4) return data;
  }
  throw new Error("\u7167\u7247\u7EC6\u8282\u8FC7\u591A\uFF0C\u8BF7\u88C1\u5C0F\u4E00\u70B9\u6216\u91CD\u65B0\u62CD\u6444\u3002");
}

// guides.js
var lifeGuides = [
  {
    id: "parcel",
    version: 1,
    title: "\u5FEB\u9012\u67DC\u53D6\u4EF6",
    icon: "parcel",
    summary: "\u627E\u53D6\u4EF6\u7801\uFF0C\u770B\u770B\u67DC\u95E8\u6CA1\u5F00\u600E\u4E48\u529E",
    starts: ["home", "code", "blocked"],
    success: "\u8FD9\u6B21\u53D6\u4EF6\u6307\u5F15\u8D70\u5B8C\u4E86\u3002",
    help: ["\u770B\u770B\u67DC\u4F53\u4E0A\u516C\u793A\u7684\u5BA2\u670D\u7535\u8BDD\u6216\u6C42\u52A9\u6309\u94AE\u3002", "\u5982\u679C\u65C1\u8FB9\u6709\u503C\u5B88\u9A7F\u7AD9\uFF0C\u53EF\u4EE5\u8BF7\u5DE5\u4F5C\u4EBA\u5458\u5E2E\u60A8\u770B\u5F53\u524D\u753B\u9762\u3002"],
    steps: {
      home: {
        title: "\u67DC\u673A\u9996\u9875",
        text: "\u5728\u67DC\u673A\u753B\u9762\u4E0A\u627E\u5230\u300C\u53D6\u4EF6\u300D\u3002",
        preview: { label: "\u5FEB\u9012\u67DC\u9996\u9875", labels: ["\u53D6\u4EF6", "\u5BC4\u4EF6"], focus: 0 },
        options: [{ label: "\u770B\u5230\u8F93\u5165\u53D6\u4EF6\u7801\u7684\u5730\u65B9", to: "code" }, { label: "\u70B9\u53D6\u4EF6\u540E\u4E0D\u77E5\u9053\u4ECE\u54EA\u627E\u7801", to: "notice" }]
      },
      code: {
        title: "\u8F93\u5165\u53D6\u4EF6\u7801",
        text: "\u627E\u5230\u539F\u6765\u7684\u53D6\u4EF6\u901A\u77E5\uFF0C\u5728\u67DC\u673A\u4E0A\u8F93\u5165\u901A\u77E5\u91CC\u7684\u53D6\u4EF6\u7801\u3002",
        preview: { label: "\u67DC\u673A\u53D6\u4EF6\u9875", labels: ["\u8F93\u5165\u53D6\u4EF6\u7801", "\u786E\u8BA4\u53D6\u4EF6"], focus: 0 },
        options: [{ label: "\u67DC\u95E8\u5F00\u4E86", to: "collect" }, { label: "\u67DC\u95E8\u6CA1\u5F00", to: "blocked", countFailure: true }, { label: "\u6211\u627E\u4E0D\u5230\u53D6\u4EF6\u7801", to: "notice" }]
      },
      blocked: {
        title: "\u67DC\u95E8\u6CA1\u5F00",
        text: "\u5982\u679C\u67DC\u673A\u63D0\u793A\u300C\u53D6\u4EF6\u7801\u6709\u8BEF\u300D\uFF0C\u5148\u6838\u5BF9\u539F\u53D6\u4EF6\u901A\u77E5\u3002",
        preview: { label: "\u67DC\u673A\u63D0\u793A\u793A\u610F", labels: ["\u53D6\u4EF6\u7801\u6709\u8BEF", "\u91CD\u65B0\u8F93\u5165"], focus: 0 },
        options: [{ label: "\u6211\u60F3\u56DE\u53BB\u6838\u5BF9", to: "code" }, { label: "\u4ECD\u6253\u4E0D\u5F00\uFF0C\u627E\u4EBA\u5E2E\u5FD9", to: "help" }]
      },
      notice: {
        title: "\u627E\u53D6\u4EF6\u901A\u77E5",
        text: "\u6253\u5F00\u539F\u6765\u7684\u77ED\u4FE1\u6216\u5FEB\u9012\u901A\u77E5\uFF0C\u627E\u5199\u7740\u300C\u53D6\u4EF6\u7801\u300D\u7684\u4E00\u884C\uFF0C\u518D\u56DE\u5230\u67DC\u673A\u3002",
        preview: { label: "\u53D6\u4EF6\u901A\u77E5\u793A\u610F", labels: ["\u67DC\u673A\u4F4D\u7F6E", "\u53D6\u4EF6\u7801"], focus: 1 },
        options: [{ label: "\u627E\u5230\u4E86\u53D6\u4EF6\u7801", to: "code" }, { label: "\u8FD8\u662F\u627E\u4E0D\u5230", to: "help" }]
      },
      collect: {
        title: "\u67DC\u95E8\u5DF2\u6253\u5F00",
        text: "\u627E\u5230\u6253\u5F00\u7684\u67DC\u95E8\uFF0C\u62FF\u51FA\u81EA\u5DF1\u7684\u5305\u88F9\u3002\u62FF\u5230\u540E\u5173\u597D\u67DC\u95E8\u3002",
        preview: { label: "\u67DC\u673A\u7ED3\u679C\u793A\u610F", labels: ["\u67DC\u95E8\u5DF2\u6253\u5F00"], focus: 0 },
        options: [{ label: "\u62FF\u5230\u5305\u88F9\u4E86", to: "done" }, { label: "\u91CC\u9762\u6CA1\u6709\u6211\u7684\u5305\u88F9", to: "help" }]
      }
    }
  },
  {
    id: "bill",
    version: 1,
    title: "\u67E5\u7535\u8D39\u8D26\u5355",
    icon: "bill",
    summary: "\u627E\u5230\u8D26\u5355\u65E5\u671F\u548C\u7535\u8D39\u91D1\u989D",
    starts: ["services", "statement", "payment"],
    success: "\u8FD9\u6B21\u67E5\u8D26\u6307\u5F15\u8D70\u5B8C\u4E86\u3002",
    help: ["\u56DE\u5230\u60A8\u5E73\u65F6\u4F7F\u7528\u7684\u4F9B\u7535\u670D\u52A1\u5165\u53E3\uFF0C\u627E\u300C\u5E2E\u52A9\u300D\u6216\u300C\u5BA2\u670D\u300D\u3002", "\u4E5F\u53EF\u4EE5\u62FF\u7740\u65E7\u8D26\u5355\uFF0C\u5230\u719F\u6089\u7684\u4FBF\u6C11\u70B9\u6216\u4F9B\u7535\u8425\u4E1A\u5385\u8BE2\u95EE\u3002"],
    steps: {
      services: {
        title: "\u770B\u5230\u751F\u6D3B\u7F34\u8D39",
        text: "\u5728\u60A8\u5E73\u65F6\u4F7F\u7528\u7684\u5B98\u65B9\u670D\u52A1\u91CC\u627E\u300C\u7535\u8D39\u300D\uFF0C\u518D\u627E\u300C\u8D26\u5355\u300D\u6216\u300C\u8D26\u5355\u67E5\u8BE2\u300D\u3002",
        preview: { label: "\u751F\u6D3B\u670D\u52A1\u5165\u53E3\u793A\u610F", labels: ["\u7535\u8D39", "\u6C34\u8D39", "\u71C3\u6C14\u8D39"], focus: 0 },
        options: [{ label: "\u6211\u770B\u5230\u7535\u8D39\u8D26\u5355\u4E86", to: "statement" }, { label: "\u8FDB\u4E86\u4ED8\u6B3E\u9875\u9762", to: "payment" }, { label: "\u9875\u9762\u8BA9\u6211\u5148\u7ED1\u6237\u53F7", to: "account" }]
      },
      statement: {
        title: "\u770B\u5230\u7535\u8D39\u8D26\u5355",
        text: "\u627E\u5230\u672C\u671F\u8D26\u671F\u548C\u91D1\u989D\u3002\u53EA\u60F3\u67E5\u4E00\u4E0B\u7684\u8BDD\uFF0C\u770B\u5230\u8FD9\u4E24\u9879\u5C31\u53EF\u4EE5\u505C\u3002",
        preview: { label: "\u8D26\u5355\u9875\u9762\u793A\u610F", labels: ["\u672C\u671F\u8D26\u671F", "\u672C\u671F\u91D1\u989D"], focus: 0 },
        options: [{ label: "\u5DF2\u770B\u5230\u672C\u671F\u8D26\u671F\u548C\u91D1\u989D", to: "done" }, { label: "\u6CA1\u627E\u5230\u672C\u671F\u8D26\u5355", to: "period" }]
      },
      payment: {
        title: "\u5230\u4E86\u4ED8\u6B3E\u9875\u9762",
        text: "\u5148\u8FD4\u56DE\u4E0A\u4E00\u9875\uFF0C\u518D\u627E\u300C\u8D26\u5355\u300D\u6216\u300C\u8D26\u5355\u67E5\u8BE2\u300D\u3002",
        preview: { label: "\u4ED8\u6B3E\u9875\u9762\u793A\u610F", labels: ["\u8FD4\u56DE", "\u4ED8\u6B3E\u786E\u8BA4"], focus: 0 },
        options: [{ label: "\u56DE\u5230\u67E5\u8BE2\u9875\u4E86", to: "statement" }, { label: "\u56DE\u53BB\u8FD8\u662F\u770B\u4E0D\u61C2", to: "help" }]
      },
      account: {
        title: "\u9875\u9762\u8981\u6C42\u7ED1\u5B9A\u6237\u53F7",
        text: "\u5148\u770B\u770B\u65E7\u8D26\u5355\u6216\u60A8\u5BB6\u539F\u6765\u7684\u7F34\u8D39\u8BB0\u5F55\u4E0A\u6709\u6CA1\u6709\u300C\u6237\u53F7\u300D\u3002\u9700\u8981\u7ED1\u5B9A\u65F6\uFF0C\u5728\u5B98\u65B9\u9875\u9762\u586B\u5199\u3002",
        preview: { label: "\u65E7\u8D26\u5355\u793A\u610F", labels: ["\u6237\u53F7", "\u8D26\u671F"], focus: 0 },
        options: [{ label: "\u5DF2\u7ECF\u770B\u5230\u7535\u8D39\u8D26\u5355\u4E86", to: "statement" }, { label: "\u6211\u8FD8\u662F\u627E\u4E0D\u5230\u6237\u53F7", to: "help" }]
      },
      period: {
        title: "\u8D26\u5355\u91CC\u6CA1\u6709\u672C\u671F",
        text: "\u770B\u4E00\u4E0B\u8D26\u671F\u662F\u5426\u9009\u5BF9\u3002\u4ECD\u6CA1\u6709\u672C\u671F\u4FE1\u606F\u65F6\uFF0C\u53EF\u4EE5\u5411\u4F9B\u7535\u670D\u52A1\u786E\u8BA4\u3002",
        preview: { label: "\u8D26\u671F\u9009\u62E9\u793A\u610F", labels: ["\u9009\u62E9\u8D26\u671F", "\u5386\u53F2\u8D26\u5355"], focus: 0 },
        options: [{ label: "\u627E\u5230\u672C\u671F\u8D26\u5355", to: "statement" }, { label: "\u8FD8\u662F\u6CA1\u6709\u672C\u671F", to: "help" }]
      }
    }
  }
];
var maxGuideAge = 24 * 60 * 6e4;
var guideTerminals = ["pick", "help", "done"];
var guideStepExists = (guide, screen) => Object.hasOwn(guide.steps, screen) || guideTerminals.includes(screen);
function readGuideRun(guide, previous, now = Date.now()) {
  if (previous?.version === guide.version && Number.isFinite(previous.updatedAt) && now - previous.updatedAt < maxGuideAge && guideStepExists(guide, previous.screen) && Array.isArray(previous.history) && previous.history.every((screen) => guideStepExists(guide, screen))) return previous;
  return { version: guide.version, screen: "pick", history: [], failed: 0, updatedAt: now };
}
function setGuideScreen(guide, run, screen, countFailure = false) {
  if (!guideStepExists(guide, screen) || screen === run.screen) return run;
  const failed = (run.failed || 0) + Number(countFailure);
  return {
    ...run,
    screen: countFailure && failed >= 2 ? "help" : screen,
    failed,
    history: [...run.history, run.screen].slice(-20),
    updatedAt: Date.now()
  };
}
function previousGuideScreen(run) {
  const screen = run.history.at(-1);
  return screen ? { ...run, screen, history: run.history.slice(0, -1), updatedAt: Date.now() } : run;
}

// guest.js
var opening;
var memory = /* @__PURE__ */ new Map();
function openGuest() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("heban-guest", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("data");
      request.result.createObjectStore("records", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("\u6D4F\u89C8\u5668\u6B63\u5728\u4F7F\u7528\u65E7\u7248\u6570\u636E\u3002"));
  }).catch(() => null);
  return opening;
}
async function storage(storeName, method, ...args) {
  const db = await openGuest();
  if (!db) {
    const key = `${storeName}:${args[1] ?? args[0]?.id ?? args[0]}`;
    if (method === "get") return structuredClone(memory.get(key));
    if (method === "put") memory.set(key, structuredClone(args[0]));
    if (method === "delete") memory.delete(key);
    if (method === "getAll") return [...memory].filter(([id]) => id.startsWith(storeName + ":")).map(([, item]) => structuredClone(item));
    return;
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, ["put", "delete"].includes(method) ? "readwrite" : "readonly");
    const request = transaction.objectStore(storeName)[method](...args);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(new Error("\u65E0\u6CD5\u4FDD\u5B58\u5230\u672C\u673A\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u7684\u5B58\u50A8\u7A7A\u95F4\u3002"));
  });
}
async function readGuest() {
  return { user: { name: "\u6E38\u5BA2", guest: true, temporary: !await openGuest() }, state: await storage("data", "get", "state") ?? {} };
}
function saveGuest(state2) {
  return storage("data", "put", state2, "state");
}
async function guestRecords(path2, method, body) {
  const id = path2.match(/^\/api\/records\/([0-9a-f-]{36})$/)?.[1];
  if (path2 === "/api/records" && method === "GET") {
    const records2 = await storage("records", "getAll");
    return { records: records2.sort((a, b) => b.createdAt - a.createdAt) };
  }
  if (path2 === "/api/records" && method === "POST") {
    const records2 = await storage("records", "getAll");
    if (records2.length >= 24) throw new Error("\u6700\u591A\u4FDD\u5B58 24 \u6761\u73B0\u573A\u8BB0\u5F55\uFF0C\u8BF7\u5148\u6574\u7406\u65E7\u7167\u7247\u3002");
    const record = { ...body, id: crypto.randomUUID(), createdAt: Date.now() };
    await storage("records", "put", record);
    return { record };
  }
  if (id && method === "GET") {
    const record = await storage("records", "get", id);
    if (record) return { record };
  }
  if (id && method === "DELETE") {
    await storage("records", "delete", id);
    return { removed: true };
  }
  throw new Error("\u627E\u4E0D\u5230\u8FD9\u6761\u73B0\u573A\u8BB0\u5F55\u3002");
}

// cloud.js
var revision = null;
var pending = null;
var inFlight = null;
var timer;
var blocked = false;
var onChange = () => {
};
var transport = "account";
async function api(path2, method = "GET", body) {
  if (transport === "guest" && path2.startsWith("/api/records")) return guestRecords(path2, method, body);
  if (transport === "guest" && path2.startsWith("/api/family")) throw new Error("\u767B\u5F55\u540E\u53EF\u4EE5\u4E0E\u5BB6\u4EBA\u8FDE\u63A5\u548C\u5206\u4EAB\u3002");
  const headers = new Headers();
  headers.set(transport === "legacy" ? "X-Heban-Legacy" : "X-Heban-Account", "1");
  if (body !== void 0) headers.set("Content-Type", "application/json");
  const response = await fetch(path2, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers,
    ...body === void 0 ? {} : { body: JSON.stringify(body) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || (response.status === 401 ? "\u8BF7\u5148\u767B\u5F55\u79BE\u4F34\u3002" : "\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002"));
    error.status = response.status;
    throw error;
  }
  return data;
}
function photoUrl(path2) {
  if (!path2?.startsWith("/api/")) return path2;
  return path2 + (transport === "legacy" ? "?identity=legacy" : "?identity=account");
}
async function connectCloud(listener, mode = "account") {
  clearTimeout(timer);
  onChange = listener;
  transport = mode;
  revision = null;
  pending = null;
  blocked = false;
  if (mode === "guest") {
    const result2 = await readGuest();
    revision = 0;
    return result2;
  }
  const result = await api("/api/state");
  if (!result.user || !Number.isSafeInteger(result.revision)) throw new Error("\u8BFB\u53D6\u8D26\u6237\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u3002");
  revision = result.revision;
  return result;
}
function saveCloud(state2) {
  if (revision === null) return false;
  pending = JSON.stringify(state2);
  if (blocked) return true;
  onChange("saving");
  clearTimeout(timer);
  timer = setTimeout(flushCloud, 250);
  return true;
}
async function flushCloud() {
  clearTimeout(timer);
  if (blocked || revision === null) return false;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    while (pending) {
      const item = pending;
      pending = null;
      try {
        const value = JSON.parse(item);
        if (transport === "guest") await saveGuest(value);
        else revision = (await api("/api/state", "PUT", { revision, state: value })).revision;
      } catch (error) {
        pending ??= item;
        blocked = error.status === 409 || error.status === 401;
        onChange(error.status === 409 ? "conflict" : error.status === 401 ? "auth" : "error", error.message);
        return false;
      }
    }
    onChange("saved");
    return true;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
function unsyncedCloud() {
  return Boolean(pending || inFlight);
}

// assistant-client.js
var cloudSite = () => document.querySelector('meta[name="heban-cloud-site"]')?.content;
var assistantUrl = () => document.querySelector('meta[name="heban-assistant-url"]')?.content;
function directAssistantUrl(route2) {
  const site = cloudSite();
  return site && !assistantUrl() ? new URL(`#/${route2}`, site).href : "";
}
function connectionError(message) {
  return Object.assign(new Error(message), { canOpenDirect: true });
}
function requestTimeout(milliseconds) {
  const controller = new AbortController();
  const timer2 = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timer2) };
}
async function diagnoseConnection(endpoint) {
  if (navigator.onLine === false) return new Error("\u624B\u673A\u6CA1\u6709\u8FDE\u4E0A\u7F51\u7EDC\u3002\u8FDE\u4E0A Wi-Fi \u6216\u6253\u5F00\u79FB\u52A8\u6570\u636E\u540E\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002");
  const timeout = requestTimeout(4e3);
  let health;
  try {
    const response = await fetch(endpoint, {
      credentials: "omit",
      cache: "no-store",
      signal: timeout.signal
    });
    if (response.ok) health = await response.json();
    if (response.status === 403) return connectionError("\u8FD9\u4E2A\u9875\u9762\u6682\u65F6\u4E0D\u80FD\u8FDE\u63A5\u52A9\u624B\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u79BE\u4F34\u518D\u8BD5\u3002");
  } catch {
  } finally {
    timeout.clear();
  }
  if (health?.online === true) return connectionError("\u80FD\u8FDE\u4E0A\u52A9\u624B\uFF0C\u4F46\u8FD9\u6B21\u8BF7\u6C42\u6CA1\u5B8C\u6210\u3002\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
  if (health?.online === false) return new Error("\u52A9\u624B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
  return connectionError("\u5F53\u524D\u7F51\u7EDC\u6682\u65F6\u8FDE\u4E0D\u4E0A\u52A9\u624B\u3002\u53EF\u4EE5\u6362 Wi-Fi \u6216\u79FB\u52A8\u7F51\u7EDC\u518D\u8BD5\u3002");
}
function responseError(response, result) {
  if (response.status === 403) return connectionError("\u8FD9\u4E2A\u9875\u9762\u6682\u65F6\u4E0D\u80FD\u8FDE\u63A5\u52A9\u624B\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u79BE\u4F34\u518D\u8BD5\u3002");
  if (typeof result?.error === "string" && result.error.trim()) return new Error(result.error);
  if (response.status === 429) return new Error("\u73B0\u5728\u4F7F\u7528\u52A9\u624B\u7684\u4EBA\u8F83\u591A\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
  if (response.status === 504) return new Error("\u52A9\u624B\u56DE\u7B54\u7B49\u5F97\u592A\u4E45\u4E86\u3002\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
  return new Error("\u52A9\u624B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
}
async function askAssistant(input) {
  const configured = assistantUrl();
  const endpoint = configured ? new URL(configured) : new URL("/api/assistant", cloudSite() || location.origin);
  const timeout = requestTimeout(32e3);
  let response;
  let result;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": endpoint.origin === location.origin ? "application/json" : "text/plain;charset=UTF-8" },
      body: JSON.stringify(input),
      signal: timeout.signal
    });
    result = await response.json();
  } catch {
    if (timeout.signal.aborted) throw new Error("\u52A9\u624B\u56DE\u7B54\u7B49\u5F97\u592A\u4E45\u4E86\u3002\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
    if (!response) throw await diagnoseConnection(endpoint);
    if (response.ok) throw connectionError("\u52A9\u624B\u8FD4\u56DE\u7684\u5185\u5BB9\u6CA1\u80FD\u8BFB\u5B8C\u6574\u3002\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
  } finally {
    timeout.clear();
  }
  if (!response.ok) throw responseError(response, result);
  return result;
}

// records.js
var scenes = {
  parcel: { name: "\u5FEB\u9012\u548C\u53D6\u4EF6", guide: "guide/parcel", action: "\u770B\u770B\u600E\u4E48\u53D6\u5FEB\u9012" },
  bill: { name: "\u7F34\u8D39\u548C\u8D26\u5355", guide: "guide/bill", action: "\u770B\u770B\u600E\u4E48\u67E5\u7535\u8D39" },
  device: { name: "\u8BBE\u5907\u548C\u6309\u952E", guide: "devices", action: "\u770B\u770B\u5BB6\u7535\u600E\u4E48\u7528" },
  other: { name: "\u5176\u4ED6\u751F\u6D3B\u573A\u666F", guide: "guides", action: "\u770B\u770B\u64CD\u4F5C\u6B65\u9AA4" }
};
function createRecords({ paint, pageHeader: pageHeader2, escapeHtml: escapeHtml2, icon: icon2, showDialog: showDialog2, closeDialog, notify: notify2, isGuest }) {
  let view = null;
  let camera = null;
  function stopCamera() {
    camera?.getTracks().forEach((track) => track.stop());
    camera = null;
  }
  function close() {
    stopCamera();
    view = null;
  }
  function open(route2, id, from) {
    close();
    view = {
      route: route2,
      id,
      mode: "idle",
      photo: "",
      source: "",
      error: "",
      note: "",
      scene: Object.hasOwn(scenes, id) ? id : "other",
      back: from === "home" ? "elder" : ["parcel", "bill"].includes(id) ? `guide/${id}` : "ask",
      loading: route2 !== "capture"
    };
    if (view.loading) void load(view);
  }
  function redraw(current, focus) {
    if (view !== current) return;
    paint();
    if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
  }
  async function load(current) {
    try {
      const result = await api(current.route === "records" ? "/api/records" : `/api/records/${encodeURIComponent(current.id ?? "")}`);
      current.record = result.record;
      current.records = result.records;
    } catch (error) {
      current.error = error.message;
    } finally {
      current.loading = false;
      redraw(current);
    }
  }
  const captureLink = '<a class="button quiet" href="#/records">\u6211\u7684\u8BB0\u5F55</a>';
  const help = () => `<p class="capture-help">\u8BF7\u522B\u62CD\u5230\u53D6\u4EF6\u7801\u3001\u8D26\u53F7\u6216\u9A8C\u8BC1\u7801\u3002${isGuest() ? "\u70B9\u300C\u4FDD\u5B58\u7167\u7247\u300D\u540E\uFF0C\u53EF\u4EE5\u5728\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u67E5\u770B\u3002" : "\u70B9\u300C\u4FDD\u5B58\u7167\u7247\u300D\u540E\uFF0C\u53EF\u4EE5\u5728\u60A8\u7684\u8D26\u6237\u91CC\u67E5\u770B\u3002"}</p>`;
  const filePicker = (id, label, native = false) => `<input type="file" id="${id}" class="capture-file" accept="image/*" ${native ? 'capture="environment"' : ""}><label for="${id}" class="button quiet capture-file-label">${icon2(native ? "camera" : "photo", 21)}${label}</label>`;
  function analysisPanel(result, analyzing) {
    if (analyzing) return '<p class="analysis-panel" role="status">\u52A9\u624B\u6B63\u5728\u770B\u7167\u7247\u2026</p>';
    if (!result) return "";
    const spoken = [result.observation, ...result.steps, result.verify].filter(Boolean).join("\u3002");
    return `<section class="analysis-panel" aria-labelledby="capture-analysis">
      <h2 id="capture-analysis" tabindex="-1">\u52A9\u624B\u770B\u5230\u4E86\u4EC0\u4E48</h2><p>${escapeHtml2(result.observation)}</p>
      ${result.steps.length ? `<h3>\u63A5\u4E0B\u6765\u600E\u4E48\u505A</h3><ol>${result.steps.map((step) => `<li>${escapeHtml2(step)}</li>`).join("")}</ol>` : ""}
      ${result.verify ? `<p class="analysis-check"><strong>\u8BF7\u6838\u5BF9</strong><br>${escapeHtml2(result.verify)}</p>` : ""}
      ${result.choices.length ? `<h3>\u60A8\u60F3\u505A\u54EA\u4E00\u4EF6\uFF1F</h3><div class="examples">${result.choices.map((choice) => `
        <button class="example" data-action="capture-choice" data-text="${escapeHtml2(choice)}" type="button">${escapeHtml2(choice)}</button>`).join("")}</div>` : ""}
      <button class="button quiet" data-action="read" data-text="${escapeHtml2(spoken)}" type="button">${icon2("sound", 21)}\u542C\u8BF4\u660E</button>
    </section>`;
  }
  function captureScreen() {
    const { back, mode, photo, scene, error, note, native, analysis } = view;
    const reviewing = ["review", "saving", "analyzing"].includes(mode);
    let body;
    if (mode === "camera") {
      body = `<video id="capture-video" class="capture-frame" autoplay muted playsinline aria-label="\u76F8\u673A\u753B\u9762"></video>
        <div class="capture-actions"><button class="button" id="capture-shutter" type="button" data-action="capture-shutter" disabled>${icon2("camera", 22)}\u62CD\u4E00\u5F20</button>
        <button class="button quiet" type="button" data-action="capture-reset">\u5173\u95ED\u76F8\u673A</button></div>`;
    } else if (reviewing) {
      const saving = mode === "saving";
      const analyzing = mode === "analyzing";
      const disabled = mode !== "review" ? "disabled" : "";
      const direct = error?.canOpenDirect ? directAssistantUrl(`capture/${scene}`) : "";
      body = `<img class="capture-frame" src="${photo}" alt="\u60A8\u9009\u7684\u7167\u7247">
        <form class="capture-form" id="capture-review" data-form="scene-record">
          <label for="record-scene">\u7167\u7247\u662F\u5173\u4E8E\u4EC0\u4E48\u7684\uFF1F</label>
          <select id="record-scene" name="scene" ${disabled}>
            ${Object.entries(scenes).map(([key, item]) => `<option value="${key}" ${key === scene ? "selected" : ""}>${item.name}</option>`).join("")}
          </select>
          <label for="record-note">\u60A8\u60F3\u505A\u4EC0\u4E48\uFF1F\uFF08\u9009\u586B\uFF09</label>
          <textarea id="record-note" name="note" maxlength="140" rows="2" placeholder="\u4F8B\u5982\uFF1A\u60F3\u628A\u7A7A\u8C03\u8C03\u5230\u5236\u51B7" ${disabled}>${escapeHtml2(note)}</textarea>
          <p class="form-help">\u70B9\u300C\u8BF7\u52A9\u624B\u770B\u770B\u300D\uFF0C\u7167\u7247\u548C\u60A8\u586B\u7684\u8BDD\u4F1A\u53D1\u7ED9 DeepSeek\u3002</p>
          <div class="capture-actions">
          <button id="capture-analyze" class="button" type="submit" value="analyze" ${disabled}>${analyzing ? "\u6B63\u5728\u770B\u7167\u7247\u2026" : "\u8BF7\u52A9\u624B\u770B\u770B"}</button>
          <button id="capture-save" class="button quiet" type="submit" value="save" ${disabled}>${saving ? "\u6B63\u5728\u4FDD\u5B58\u2026" : "\u4FDD\u5B58\u7167\u7247"}</button>
          <button class="button quiet" type="button" data-action="capture-reset" ${disabled}>\u91CD\u62CD\u6216\u6362\u4E00\u5F20</button></div>
        </form>
        ${error ? `<div class="capture-error"><p id="capture-action-error" role="alert" tabindex="-1">${escapeHtml2(error.message ?? error)}</p>
          ${error instanceof Error ? `<div class="capture-actions"><button class="button quiet" type="submit" form="capture-review" value="analyze">\u518D\u8BD5\u4E00\u6B21</button>
            ${direct ? `<a class="button quiet" href="${escapeHtml2(direct)}" target="_blank" rel="noopener">\u6253\u5F00\u62CD\u7167\u52A9\u624B</a>` : ""}</div>` : ""}</div>` : ""}
        ${analysisPanel(analysis, analyzing)}`;
    } else if (mode === "opening" || mode === "reading") {
      body = `<p class="capture-status" role="status">${mode === "opening" ? "\u6B63\u5728\u6253\u5F00\u76F8\u673A\uFF0C\u8BF7\u7559\u610F\u76F8\u673A\u6743\u9650\u63D0\u793A\u3002" : "\u6B63\u5728\u8BFB\u53D6\u7167\u7247\u2026"}</p>
        <button class="button quiet" type="button" data-action="capture-reset">\u53D6\u6D88</button>`;
    } else {
      body = `<section class="capture-ready" aria-label="\u9009\u62E9\u7167\u7247\u6765\u6E90">
        <img src="./assets/guide-kit.webp" width="520" height="434" alt="">
        <div class="capture-actions">
          <button id="capture-open" class="button" type="button" data-action="capture-open">${icon2("camera", 22)}\u6253\u5F00\u76F8\u673A</button>
          ${filePicker("capture-album", "\u4ECE\u76F8\u518C\u9009\u62E9")}
          ${native ? filePicker("capture-native", "\u7528\u624B\u673A\u76F8\u673A\u62CD") : ""}
        </div>
      </section>`;
    }
    return `${pageHeader2("\u62CD\u7167\u95EE\u4E00\u95EE", back)}<main class="surface capture-screen">
      <div class="capture-intro"><div><h2>${reviewing ? "\u5148\u770B\u4E00\u773C\u7167\u7247" : "\u62CD\u6E05\u695A\u6309\u952E\u6216\u5C4F\u5E55"}</h2>${help()}</div>${captureLink}</div>
      ${error && !reviewing ? `<p class="capture-error" role="alert">${escapeHtml2(error)}</p>` : ""}
      ${body}
    </main>`;
  }
  function recordsScreen() {
    return `${pageHeader2("\u6211\u7684\u8BB0\u5F55", "mine")}<main class="surface capture-screen">
      <div class="capture-intro"><div><h2>\u4FDD\u5B58\u7684\u7167\u7247</h2><p class="capture-help">${isGuest() ? "\u8FD9\u4E9B\u7167\u7247\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u3002" : "\u53EA\u6709\u60A8\u767B\u5F55\u540E\u53EF\u4EE5\u67E5\u770B\u3002"}</p></div><a class="button" href="#/capture">${icon2("camera", 22)}\u62CD\u7167\u95EE\u4E00\u95EE</a></div>
      ${view.loading ? '<p role="status" class="empty-card">\u6B63\u5728\u8BFB\u53D6\u8BB0\u5F55\u2026</p>' : view.error ? retry() : !view.records.length ? '<p class="empty-card">\u8FD8\u6CA1\u6709\u7167\u7247\u3002\u9047\u5230\u4E0D\u4F1A\u64CD\u4F5C\u7684\u753B\u9762\uFF0C\u53EF\u4EE5\u62CD\u4E00\u5F20\u7559\u7740\u3002</p>' : `<ul class="record-list">${view.records.map((record) => `<li><a href="#/record/${encodeURIComponent(record.id)}">
          <img src="${escapeHtml2(photoUrl(record.photo))}" alt="" loading="lazy"><span><strong>${scenes[record.scene].name}</strong>
          <span>${escapeHtml2(formatWhen(record.createdAt))}</span>${record.note ? `<span>${escapeHtml2(record.note)}</span>` : ""}</span></a></li>`).join("")}</ul>`}
    </main>`;
  }
  function retry() {
    return `<p class="capture-error" role="alert">${escapeHtml2(view.error)}</p><button class="button quiet" type="button" data-action="capture-retry">\u91CD\u65B0\u8BFB\u53D6</button>`;
  }
  function recordScreen() {
    const { record, loading, error } = view;
    const scene = record && scenes[record.scene];
    return `${pageHeader2("\u73B0\u573A\u8BB0\u5F55", "records")}<main class="surface capture-screen">
      ${loading ? '<p role="status" class="empty-card">\u6B63\u5728\u8BFB\u53D6\u7167\u7247\u2026</p>' : !record ? retry() : `
        <div class="capture-intro"><div><h2>${scene.name}</h2><p class="capture-help">\u4FDD\u5B58\u4E8E ${escapeHtml2(formatWhen(record.createdAt))}</p></div></div>
        ${error ? `<p class="capture-error" role="alert">${escapeHtml2(error)}</p>` : ""}
        <img class="capture-frame" src="${escapeHtml2(photoUrl(record.photo))}" alt="\u4FDD\u5B58\u7684\u73B0\u573A\u7167\u7247">
        ${record.note ? `<p class="record-note">${escapeHtml2(record.note)}</p>` : ""}
        <div class="capture-actions"><a class="button" href="#/${scene.guide}">${scene.action}</a><button class="button quiet" type="button" data-action="capture-delete">\u5220\u9664\u8BB0\u5F55</button></div>`}
    </main>`;
  }
  function reset(current) {
    stopCamera();
    Object.assign(current, { mode: "idle", error: "", photo: "", analysis: null });
    redraw(current, "#capture-open");
  }
  async function startCamera(current) {
    current.mode = "opening";
    current.error = "";
    redraw(current);
    const pending2 = current.cameraRequest = {};
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (current !== view || current.mode !== "opening" || current.cameraRequest !== pending2) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      camera = stream;
      current.mode = "camera";
      redraw(current);
      const video = document.querySelector("#capture-video");
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        const shutter = document.querySelector("#capture-shutter");
        if (view === current && camera === stream && shutter) {
          shutter.disabled = false;
          shutter.focus({ preventScroll: true });
        }
      }, { once: true });
      await video.play();
    } catch {
      if (current !== view || current.cameraRequest !== pending2 || !["opening", "camera"].includes(current.mode)) return;
      stopCamera();
      Object.assign(current, { mode: "idle", native: true, error: "\u76F8\u673A\u672A\u80FD\u6253\u5F00\u3002\u8BF7\u5141\u8BB8\u76F8\u673A\u6743\u9650\uFF0C\u6216\u7528\u624B\u673A\u76F8\u673A\u62CD\u7167\u3001\u4ECE\u76F8\u518C\u9009\u62E9\u3002" });
      redraw(current);
    }
  }
  function takePhoto(current) {
    const video = document.querySelector("#capture-video");
    try {
      current.photo = compressPhoto(video, video.videoWidth, video.videoHeight);
      current.source = "camera";
      current.mode = "review";
      stopCamera();
      redraw(current, "#record-scene");
    } catch (error) {
      notify2(error.message);
    }
  }
  async function readFile(field) {
    const current = view;
    if (current?.route !== "capture" || current.mode !== "idle" || !field.files.length) return;
    const file = field.files[0];
    const pending2 = current.fileRequest = {};
    Object.assign(current, { mode: "reading", error: "" });
    redraw(current);
    try {
      const photo = await readDevicePhoto(file);
      if (current !== view || current.mode !== "reading" || current.fileRequest !== pending2) return;
      Object.assign(current, { mode: "review", photo, source: field.id === "capture-native" ? "camera" : "album" });
      redraw(current, "#record-scene");
    } catch (error) {
      if (current !== view || current.mode !== "reading" || current.fileRequest !== pending2) return;
      Object.assign(current, { mode: "idle", error: error.message || "\u65E0\u6CD5\u8BFB\u53D6\u8FD9\u5F20\u7167\u7247\uFF0C\u8BF7\u6362\u4E00\u5F20\u3002" });
      redraw(current);
    }
  }
  async function save2(data) {
    const current = view;
    if (current?.mode !== "review") return;
    Object.assign(current, { mode: "saving", scene: data.get("scene"), note: data.get("note").trim(), error: "" });
    redraw(current);
    try {
      const { record } = await api("/api/records", "POST", { scene: current.scene, note: current.note, photo: current.photo, source: current.source });
      if (view !== current) return;
      location.hash = `#/record/${record.id}`;
      notify2(isGuest() ? "\u73B0\u573A\u7167\u7247\u5DF2\u4FDD\u5B58\u5230\u672C\u673A\u3002" : "\u73B0\u573A\u7167\u7247\u5DF2\u5B58\u5165\u60A8\u7684\u8D26\u6237\u3002");
    } catch (error) {
      Object.assign(current, { mode: "review", error: error.message });
      redraw(current, "#capture-save");
    }
  }
  async function analyze(data, chosen) {
    const current = view;
    if (current?.mode !== "review") return;
    Object.assign(current, { mode: "analyzing", scene: data.get("scene"), note: (chosen ?? data.get("note")).trim(), error: "", analysis: null });
    redraw(current);
    try {
      const { analysis } = await askAssistant({ text: current.note, photo: current.photo });
      if (!analysis?.observation) throw new Error("\u52A9\u624B\u8FD9\u6B21\u6CA1\u6709\u770B\u6E05\u753B\u9762\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
      current.analysis = analysis;
    } catch (error) {
      current.error = error;
    } finally {
      current.mode = "review";
      const target = current.error ? "#capture-action-error" : "#capture-analysis";
      redraw(current, target);
      if (current === view) document.querySelector(target)?.scrollIntoView({ block: "nearest" });
    }
  }
  async function action(name, button2) {
    const current = view;
    if (!current) return;
    switch (name) {
      case "capture-choice": {
        const form = document.querySelector('[data-form="scene-record"]');
        if (form) await analyze(new FormData(form), button2.dataset.text);
        break;
      }
      case "capture-open":
        await startCamera(current);
        break;
      case "capture-shutter":
        takePhoto(current);
        break;
      case "capture-reset":
        reset(current);
        break;
      case "capture-retry":
        Object.assign(current, { loading: true, error: "" });
        redraw(current);
        await load(current);
        break;
      case "capture-delete":
        showDialog2("\u5220\u9664\u8FD9\u6761\u8BB0\u5F55\uFF1F", '<p class="form-help">\u8FD9\u5F20\u7167\u7247\u548C\u5907\u6CE8\u4F1A\u4E00\u8D77\u5220\u9664\u3002</p><div class="dialog-actions"><button class="button quiet" type="button" data-action="close">\u53D6\u6D88</button><button class="button danger" type="button" data-action="capture-confirm-delete">\u5220\u9664</button></div>');
        break;
      case "capture-confirm-delete":
        button2.disabled = true;
        try {
          await api(`/api/records/${encodeURIComponent(current.id)}`, "DELETE");
          if (view !== current) return;
          closeDialog();
          location.hash = "#/records";
          notify2("\u73B0\u573A\u8BB0\u5F55\u5DF2\u5220\u9664\u3002");
        } catch (error) {
          if (view !== current) return;
          closeDialog();
          current.error = error.message;
          redraw(current);
        }
        break;
    }
  }
  return { open, close, stopCamera, action, readFile, save: save2, analyze, captureScreen, recordsScreen, recordScreen };
}

// node_modules/@simplewebauthn/browser/esm/helpers/bufferToBase64URLString.js
function bufferToBase64URLString(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// node_modules/@simplewebauthn/browser/esm/helpers/base64URLStringToBuffer.js
function base64URLStringToBuffer(base64URLString) {
  const base64 = base64URLString.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - base64.length % 4) % 4;
  const padded = base64.padEnd(base64.length + padLength, "=");
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// node_modules/@simplewebauthn/browser/esm/helpers/browserSupportsWebAuthn.js
function browserSupportsWebAuthn() {
  return _browserSupportsWebAuthnInternals.stubThis(globalThis?.PublicKeyCredential !== void 0 && typeof globalThis.PublicKeyCredential === "function");
}
var _browserSupportsWebAuthnInternals = {
  stubThis: (value) => value
};

// node_modules/@simplewebauthn/browser/esm/helpers/toPublicKeyCredentialDescriptor.js
function toPublicKeyCredentialDescriptor(descriptor) {
  const { id } = descriptor;
  return {
    ...descriptor,
    id: base64URLStringToBuffer(id),
    /**
     * `descriptor.transports` is an array of our `AuthenticatorTransportFuture` that includes newer
     * transports that TypeScript's DOM lib is ignorant of. Convince TS that our list of transports
     * are fine to pass to WebAuthn since browsers will recognize the new value.
     */
    transports: descriptor.transports
  };
}

// node_modules/@simplewebauthn/browser/esm/helpers/isValidDomain.js
function isValidDomain(hostname) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === "localhost" || // Support punycode (ACE) or ascii labels and domains
    /^((xn--[a-z0-9-]+|[a-z0-9]+(-[a-z0-9]+)*)\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(hostname)
  );
}

// node_modules/@simplewebauthn/browser/esm/helpers/webAuthnError.js
var WebAuthnError = class extends Error {
  constructor({ message, code, cause, name }) {
    super(message, { cause });
    Object.defineProperty(this, "code", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this.name = name ?? cause.name;
    this.code = code;
  }
};

// node_modules/@simplewebauthn/browser/esm/helpers/identifyRegistrationError.js
function identifyRegistrationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "ConstraintError") {
    if (publicKey.authenticatorSelection?.requireResidentKey === true) {
      return new WebAuthnError({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: error
      });
    } else if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      options.mediation === "conditional" && publicKey.authenticatorSelection?.userVerification === "required"
    ) {
      return new WebAuthnError({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: error
      });
    } else if (publicKey.authenticatorSelection?.userVerification === "required") {
      return new WebAuthnError({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: error
      });
    }
  } else if (error.name === "InvalidStateError") {
    return new WebAuthnError({
      message: "The authenticator was previously registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: error
    });
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "NotSupportedError") {
    const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
    if (validPubKeyCredParams.length === 0) {
      return new WebAuthnError({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: error
      });
    }
    return new WebAuthnError({
      message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
      code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = globalThis.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rp.id !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "TypeError") {
    if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
      return new WebAuthnError({
        message: "User ID was not between 1 and 64 characters",
        code: "ERROR_INVALID_USER_ID_LENGTH",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new credential",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return error;
}

// node_modules/@simplewebauthn/browser/esm/helpers/webAuthnAbortService.js
var BaseWebAuthnAbortService = class {
  constructor() {
    Object.defineProperty(this, "controller", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
  }
  createNewAbortSignal() {
    if (this.controller) {
      const abortError = new Error("Cancelling existing WebAuthn API call for new one");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
    }
    const newController = new AbortController();
    this.controller = newController;
    return newController.signal;
  }
  cancelCeremony() {
    if (this.controller) {
      const abortError = new Error("Manually cancelling existing WebAuthn API call");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
      this.controller = void 0;
    }
  }
};
var WebAuthnAbortService = new BaseWebAuthnAbortService();

// node_modules/@simplewebauthn/browser/esm/helpers/toAuthenticatorAttachment.js
var attachments = ["cross-platform", "platform"];
function toAuthenticatorAttachment(attachment) {
  if (!attachment) {
    return;
  }
  if (attachments.indexOf(attachment) < 0) {
    return;
  }
  return attachment;
}

// node_modules/@simplewebauthn/browser/esm/methods/startRegistration.js
async function startRegistration(options) {
  if (!options.optionsJSON && options.challenge) {
    console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information.");
    options = { optionsJSON: options };
  }
  const { optionsJSON, useAutoRegister = false } = options;
  if (!browserSupportsWebAuthn()) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  const publicKey = {
    ...optionsJSON,
    challenge: base64URLStringToBuffer(optionsJSON.challenge),
    user: {
      ...optionsJSON.user,
      id: base64URLStringToBuffer(optionsJSON.user.id)
    },
    excludeCredentials: optionsJSON.excludeCredentials?.map(toPublicKeyCredentialDescriptor)
  };
  const createOptions = {};
  if (useAutoRegister) {
    createOptions.mediation = "conditional";
  }
  createOptions.publicKey = publicKey;
  createOptions.signal = WebAuthnAbortService.createNewAbortSignal();
  let credential;
  try {
    credential = await navigator.credentials.create(createOptions);
  } catch (err) {
    throw identifyRegistrationError({ error: err, options: createOptions });
  }
  if (!credential) {
    throw new Error("Registration was not completed");
  }
  const { id, rawId, response, type } = credential;
  let transports = void 0;
  if (typeof response.getTransports === "function") {
    transports = response.getTransports();
  }
  let responsePublicKeyAlgorithm = void 0;
  if (typeof response.getPublicKeyAlgorithm === "function") {
    try {
      responsePublicKeyAlgorithm = response.getPublicKeyAlgorithm();
    } catch (error) {
      warnOnBrokenImplementation("getPublicKeyAlgorithm()", error);
    }
  }
  let responsePublicKey = void 0;
  if (typeof response.getPublicKey === "function") {
    try {
      const _publicKey = response.getPublicKey();
      if (_publicKey !== null) {
        responsePublicKey = bufferToBase64URLString(_publicKey);
      }
    } catch (error) {
      warnOnBrokenImplementation("getPublicKey()", error);
    }
  }
  let responseAuthenticatorData;
  if (typeof response.getAuthenticatorData === "function") {
    try {
      responseAuthenticatorData = bufferToBase64URLString(response.getAuthenticatorData());
    } catch (error) {
      warnOnBrokenImplementation("getAuthenticatorData()", error);
    }
  }
  return {
    id,
    rawId: bufferToBase64URLString(rawId),
    response: {
      attestationObject: bufferToBase64URLString(response.attestationObject),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      transports,
      publicKeyAlgorithm: responsePublicKeyAlgorithm,
      publicKey: responsePublicKey,
      authenticatorData: responseAuthenticatorData
    },
    type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: toAuthenticatorAttachment(credential.authenticatorAttachment)
  };
}
function warnOnBrokenImplementation(methodName, cause) {
  console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${methodName}. You should report this error to them.
`, cause);
}

// node_modules/@simplewebauthn/browser/esm/helpers/browserSupportsWebAuthnAutofill.js
function browserSupportsWebAuthnAutofill() {
  if (!browserSupportsWebAuthn()) {
    return _browserSupportsWebAuthnAutofillInternals.stubThis(new Promise((resolve) => resolve(false)));
  }
  const globalPublicKeyCredential = globalThis.PublicKeyCredential;
  if (globalPublicKeyCredential?.isConditionalMediationAvailable === void 0) {
    return _browserSupportsWebAuthnAutofillInternals.stubThis(new Promise((resolve) => resolve(false)));
  }
  return _browserSupportsWebAuthnAutofillInternals.stubThis(globalPublicKeyCredential.isConditionalMediationAvailable());
}
var _browserSupportsWebAuthnAutofillInternals = {
  stubThis: (value) => value
};

// node_modules/@simplewebauthn/browser/esm/helpers/identifyAuthenticationError.js
function identifyAuthenticationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = globalThis.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rpId !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return error;
}

// node_modules/@simplewebauthn/browser/esm/methods/startAuthentication.js
async function startAuthentication(options) {
  if (!options.optionsJSON && options.challenge) {
    console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information.");
    options = { optionsJSON: options };
  }
  const { optionsJSON, useBrowserAutofill = false, verifyBrowserAutofillInput = true } = options;
  if (!browserSupportsWebAuthn()) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  let allowCredentials;
  if (optionsJSON.allowCredentials?.length !== 0) {
    allowCredentials = optionsJSON.allowCredentials?.map(toPublicKeyCredentialDescriptor);
  }
  const publicKey = {
    ...optionsJSON,
    challenge: base64URLStringToBuffer(optionsJSON.challenge),
    allowCredentials
  };
  const getOptions = {};
  if (useBrowserAutofill) {
    if (!await browserSupportsWebAuthnAutofill()) {
      throw Error("Browser does not support WebAuthn autofill");
    }
    const eligibleInputs = document.querySelectorAll("input[autocomplete$='webauthn']");
    if (eligibleInputs.length < 1 && verifyBrowserAutofillInput) {
      throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');
    }
    getOptions.mediation = "conditional";
    publicKey.allowCredentials = [];
  }
  getOptions.publicKey = publicKey;
  getOptions.signal = WebAuthnAbortService.createNewAbortSignal();
  let credential;
  try {
    credential = await navigator.credentials.get(getOptions);
  } catch (err) {
    throw identifyAuthenticationError({ error: err, options: getOptions });
  }
  if (!credential) {
    throw new Error("Authentication was not completed");
  }
  const { id, rawId, response, type } = credential;
  let userHandle = void 0;
  if (response.userHandle) {
    userHandle = bufferToBase64URLString(response.userHandle);
  }
  return {
    id,
    rawId: bufferToBase64URLString(rawId),
    response: {
      authenticatorData: bufferToBase64URLString(response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      signature: bufferToBase64URLString(response.signature),
      userHandle
    },
    type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: toAuthenticatorAttachment(credential.authenticatorAttachment)
  };
}

// sign-in.js
async function signInWithDevice(api2, mode, fields) {
  if (!browserSupportsWebAuthn()) throw new Error("\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u786E\u8BA4\u8BBE\u5907\u3002\u53EF\u4EE5\u5728\u624B\u673A\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u79BE\u4F34\uFF0C\u6216\u8DF3\u8FC7\u767B\u5F55\u3002");
  const { options } = await api2("/api/auth/options", "POST", { mode, ...fields });
  let response;
  try {
    const confirm = mode === "create" ? startRegistration : startAuthentication;
    response = await confirm({ optionsJSON: options });
  } catch (error) {
    if (error.name === "InvalidStateError") throw new Error("\u6B64\u8BBE\u5907\u5DF2\u6709\u51ED\u636E\uFF0C\u8BF7\u5C1D\u8BD5\u7528\u90AE\u7BB1\u767B\u5F55\u3002");
    throw new Error("\u8BBE\u5907\u786E\u8BA4\u672A\u5B8C\u6210\u3002\u60A8\u53EF\u4EE5\u518D\u8BD5\u4E00\u6B21\uFF0C\u6216\u5728\u624B\u673A\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u79BE\u4F34\u3002");
  }
  await api2("/api/auth/verify", "POST", { challenge: options.challenge, response });
}

// shortcuts.js
var shortcutOptions = {
  guides: { title: "\u8DDF\u7740\u505A", link: "guides", glyph: "bill" },
  ask: { title: "\u95EE\u95EE\u52A9\u624B", link: "ask", glyph: "chat" },
  camera: { title: "\u62CD\u7167\u95EE\u4E00\u95EE", link: "capture/device", glyph: "camera" },
  reminders: { title: "\u8BBE\u4E2A\u63D0\u9192", link: "reminders", glyph: "bell" },
  records: { title: "\u6211\u7684\u8BB0\u5F55", link: "records", glyph: "photo" },
  chat: { title: "\u804A\u804A\u5929", link: "chat", glyph: "chat" },
  devices: { title: "\u5BB6\u7535\u600E\u4E48\u7528", link: "devices", glyph: "remote" },
  ...Object.fromEntries(lifeGuides.map(({ id, title, icon: icon2 }) => [id, { title, link: `guide/${id}`, glyph: icon2, group: "\u751F\u6D3B\u6B65\u9AA4" }])),
  ...Object.fromEntries(deviceLessons.map(({ id, name, icon: icon2 }) => [id, { title: `${name}\u600E\u4E48\u7528`, link: `device/${id}`, glyph: icon2, group: "\u5BB6\u7535\u6B65\u9AA4" }]))
};
var defaultShortcuts = ["ask", "parcel", "bill", "devices", "reminders"];
function cleanShortcut(source) {
  if (typeof source?.target !== "string") return null;
  const title = typeof source.title === "string" ? source.title.trim().slice(0, 24) : "";
  const { kind, target } = source;
  if (kind === "built-in" && Object.hasOwn(shortcutOptions, target)) {
    return { kind, target, title: title || shortcutOptions[target].title };
  }
  if (kind !== "website" || !title || target.length > 500) return null;
  try {
    const url = new URL(target.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 500) return null;
    return { kind, target: url.href, title };
  } catch {
    return null;
  }
}

// electricity.js
var path = "/api/family/cards";
var cardLink = (id) => "electricity-card/" + id;
var editLink = (id) => "electricity-editor/" + id;
var newStep = (text = "") => ({ id: crypto.randomUUID(), text, photo: "", x: null, y: null, audio: "" });
var button = (action, label, kind = "quiet", extra = "") => `<button class="button ${kind}" type="button" data-action="electricity-${action}" ${extra}>${label}</button>`;
var audioTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
var pictureInputTypes = "image/jpeg,image/png,image/webp";
function dataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002"));
    reader.readAsDataURL(file);
  });
}
async function readAudio(file) {
  const type = file.type.split(";")[0];
  if (!audioTypes.includes(type) || file.size > 265e3) throw new Error("\u8BF7\u9009\u62E9\u5C0F\u4E8E 260 KB \u7684\u77ED\u5F55\u97F3\uFF0C\u652F\u6301 MP3\u3001M4A\u3001WAV\u3001WebM \u548C OGG\u3002");
  return dataUrl(file);
}
function createElectricityCards({ api: api2, escapeHtml: escapeHtml2, pageHeader: pageHeader2, loginAction: loginAction2, render: render2, speak: speak2, stopSpeech: stopSpeech2, account: getAccount, family: getFamily }) {
  const esc = escapeHtml2;
  const element = () => document.querySelector(".electricity-screen");
  let cards = [];
  let section = "";
  let selected = "";
  let data;
  let draft;
  let help;
  let index = 0;
  let preview = false;
  let finished = false;
  let sent = false;
  let error = "";
  let busy = false;
  let loaded = false;
  let context = {};
  let listLoad;
  let recording;
  let audio;
  let cachedCard;
  function stopAudio() {
    audio?.pause();
    audio = null;
    stopSpeech2();
  }
  function cancelRecording() {
    const current = recording;
    if (!current) return;
    recording = null;
    clearTimeout(current.timer);
    current.stream?.getTracks().forEach((track) => track.stop());
    if (current.recorder?.state === "recording") current.recorder.stop();
  }
  function reset() {
    cards = [];
    loaded = false;
    listLoad = null;
    cachedCard = null;
    section = "";
    cancelRecording();
    stopAudio();
    context = {};
  }
  async function loadList(show = false) {
    if (getAccount()?.guest) return;
    if (listLoad) {
      await listLoad;
      if (show && section === "electricity-cards") render2();
      return;
    }
    const account2 = getAccount();
    const active = context;
    const job = api2(path).then((result) => {
      if (getAccount() !== account2) return;
      cards = result.cards;
      loaded = true;
      if (cachedCard && !cards.some((item) => item.id === cachedCard.id)) cachedCard = null;
    }).catch((failure) => {
      if (context === active && !loaded) error = failure.message;
    }).finally(() => {
      if (listLoad === job) listLoad = null;
      if (getAccount() === account2 && (show && context === active || ["elder", "home-shortcuts", "family"].includes(section))) render2();
    });
    listLoad = job;
    return job;
  }
  function startDraft(card) {
    return card ? { ...card, steps: structuredClone(card.steps) } : {
      title: "\u67E5\u8001\u5BB6\u7535\u8D39",
      recipient: "",
      steps: [newStep("\u6253\u5F00\u5BB6\u91CC\u5E73\u65F6\u7528\u7684\u7F34\u8D39\u670D\u52A1\u3002"), newStep("\u627E\u5230\u201C\u7535\u8D39\u201D\u6216\u201C\u7528\u7535\u8D26\u5355\u201D\uFF0C\u70B9\u8FDB\u53BB\u3002"), newStep("\u770B\u6E05\u6237\u540D\u548C\u6708\u4EFD\uFF0C\u518D\u67E5\u770B\u8FD9\u6708\u7684\u7528\u7535\u548C\u8D26\u5355\u3002")]
    };
  }
  async function open(route2, id = "") {
    cancelRecording();
    stopAudio();
    section = route2;
    selected = id;
    const active = context = {};
    data = draft = help = null;
    index = 0;
    finished = preview = sent = busy = false;
    error = "";
    if (["elder", "home-shortcuts", "family"].includes(route2)) {
      void loadList();
      return;
    }
    if (!route2.startsWith("electricity-") || getAccount()?.guest) return;
    if (route2 === "electricity-cards") {
      void loadList(true);
      return;
    }
    if (!id && route2 === "electricity-editor") {
      draft = startDraft();
      return;
    }
    try {
      const card = await api2(path + "/" + id);
      if (active !== context) return;
      if (route2 === "electricity-editor") {
        if (card.direction !== "sent") throw new Error("\u8BF7\u8BA9\u5236\u4F5C\u8FD9\u5F20\u5361\u7684\u5BB6\u4EBA\u6765\u4FEE\u6539\u3002");
        draft = startDraft(card);
        index = Math.max(0, draft.steps.findIndex((step) => step.id === draft.issue?.stepId));
      } else {
        if (card.direction !== "received") throw new Error("\u8BF7\u5728\u5BB6\u5C5E\u7AEF\u9884\u89C8\u8FD9\u5F20\u64CD\u4F5C\u5361\u3002");
        data = card;
        cachedCard = card;
      }
    } catch (failure) {
      if (active !== context) return;
      if (!failure.status && route2 === "electricity-card" && cachedCard?.id === id) {
        data = cachedCard;
        error = "\u7F51\u7EDC\u6682\u65F6\u8FDE\u4E0D\u4E0A\uFF0C\u6B63\u5728\u770B\u4E0A\u6B21\u6253\u5F00\u7684\u7248\u672C\u3002";
      } else {
        if (cachedCard?.id === id) cachedCard = null;
        error = failure.message;
      }
    }
    if (active === context) render2();
  }
  const back = () => section === "electricity-card" ? "elder" : "electricity-cards";
  const photo = (src, pin, editable = false) => {
    if (!src) return "";
    const mark = pin?.x != null ? `<span class="photo-pin" style="--left:${pin.x * 100}%;--top:${pin.y * 100}%" aria-hidden="true"></span>` : "";
    const tag = editable ? "button" : "div";
    return `<div class="photo-board electricity-photo"><${tag} class="photo-target" ${editable ? 'type="button" data-action="electricity-pin" aria-label="\u5728\u622A\u56FE\u4E0A\u6807\u51FA\u4F4D\u7F6E"' : ""}><img class="device-photo-image" src="${esc(src)}" alt="${editable ? "\u5F85\u6807\u8BB0\u7684\u64CD\u4F5C\u622A\u56FE" : "\u8FD9\u4E00\u6B65\u7684\u64CD\u4F5C\u622A\u56FE"}">${mark}</${tag}></div>`;
  };
  const message = () => `<p class="form-error" role="alert">${esc(error)}</p>`;
  const renderStep = (focus) => {
    render2();
    element()?.querySelector(focus)?.focus({ preventScroll: true });
  };
  function screenList() {
    const account2 = getAccount();
    const sentCards = cards.filter((item) => item.direction === "sent");
    const links = getFamily()?.links ?? [];
    const available = links.filter((link) => !sentCards.some((item) => item.recipient === link.id));
    const body = account2.guest ? `<p class="empty-card">\u767B\u5F55\u79BE\u4F34\u5E76\u8FDE\u63A5\u5BB6\u4EBA\u540E\uFF0C\u5C31\u80FD\u628A\u64CD\u4F5C\u5361\u9001\u5230\u5BF9\u65B9\u9996\u9875\u3002</p>${loginAction2("\u7528\u90AE\u7BB1\u767B\u5F55", "button", "electricity-cards")}` : `${sentCards.length ? `<ul class="record-list">${sentCards.map((item) => `<li class="shortcut-row"><div><strong>${esc(item.title)}</strong>
        <span>${item.needsHelp ? "\u5BB6\u4EBA\u8BF4\u6709\u4E00\u6B65\u753B\u9762\u4E0D\u4E00\u6837" : esc(links.find((link) => link.id === item.recipient)?.name ?? "\u5DF2\u53D1\u9001\u7ED9\u5BB6\u4EBA")}</span></div>
        <a class="button quiet" href="#/${editLink(item.id)}">${item.needsHelp ? "\u67E5\u770B\u6C42\u52A9" : "\u4FEE\u6539"}</a></li>`).join("")}</ul>` : ""}
          ${loaded && available.length ? '<a class="button" href="#/electricity-editor">\u65B0\u5EFA\u67E5\u7535\u8D39\u5361</a>' : !links.length ? '<a class="button quiet" href="#/connections">\u5148\u8FDE\u63A5\u5BB6\u4EBA</a>' : ""}
        ${!loaded && !error ? '<p role="status">\u6B63\u5728\u8BFB\u53D6\u64CD\u4F5C\u5361\u2026</p>' : ""}${message()}${error ? button("list-reload", "\u91CD\u65B0\u8BFB\u53D6") : ""}`;
    return `${pageHeader2("\u67E5\u7535\u8D39\u64CD\u4F5C\u5361", "family")}<main class="surface electricity-screen stack">${body}</main>`;
  }
  function screenEditor() {
    const links = (getFamily()?.links ?? []).filter((link) => !cards.some((item) => item.direction === "sent" && item.recipient === link.id));
    const step = draft.steps[index];
    const flagged = draft.issue?.stepId === step.id;
    return `${pageHeader2(draft.id ? "\u4FEE\u6539\u67E5\u7535\u8D39\u5361" : "\u5236\u4F5C\u67E5\u7535\u8D39\u5361", back())}<main class="surface electricity-screen guide-editor">
      <form data-form="electricity-publish">
        ${draft.id ? "" : `<label for="electricity-recipient">\u53D1\u7ED9\u8C01\uFF1F</label>
          <select id="electricity-recipient" data-electricity-field="recipient" required>
          <option value="">\u9009\u4E00\u4F4D\u5BB6\u4EBA</option>${links.map((link) => `<option value="${esc(link.id)}" ${draft.recipient === link.id ? "selected" : ""}>${esc(link.name)}</option>`).join("")}</select>
          ${links.length ? "" : '<a class="section-link" href="#/connections">\u5148\u8FDE\u63A5\u5BB6\u4EBA</a>'}`}
        <label for="electricity-title">\u9996\u9875\u6309\u94AE\u53EB\u4EC0\u4E48\uFF1F</label><input id="electricity-title" data-electricity-field="title" maxlength="26" value="${esc(draft.title)}" required>
        <div class="electricity-step-tabs" aria-label="\u9009\u62E9\u8981\u7F16\u8F91\u7684\u6B65\u9AA4">${draft.steps.map((_, i) => button("select", `\u7B2C ${i + 1} \u6B65`, i === index ? "" : "quiet", `data-index="${i}" aria-pressed="${i === index}"`)).join("")}
          ${draft.steps.length < 5 ? button("add", "\u52A0\u4E00\u6B65") : ""}</div>
        ${flagged ? `<section class="empty-card electricity-notice"><strong>\u5BB6\u4EBA\u8BF4\u8FD9\u4E00\u6B65\u7684\u753B\u9762\u4E0D\u4E00\u6837</strong>${draft.issue.photo ? photo(draft.issue.photo) : ""}</section>` : ""}
        <label for="electricity-text">\u8FD9\u4E00\u6B65\u8981\u505A\u4EC0\u4E48\uFF1F</label><textarea id="electricity-text" rows="2" data-electricity-step="text" maxlength="100">${esc(step.text)}</textarea>
        <label for="electricity-screenshot">\u9009\u4E00\u5F20\u5B9E\u9645\u64CD\u4F5C\u7684\u622A\u56FE</label><input id="electricity-screenshot" type="file" accept="${pictureInputTypes}" data-electricity-file="photo">
        ${step.photo ? `<p class="device-help">\u70B9\u56FE\u4E0A\u8981\u6309\u7684\u4F4D\u7F6E\uFF0C\u4E5F\u53EF\u4EE5\u7528\u65B9\u5411\u952E\u6807\u8BB0\u3002${step.x === null ? "" : "\u5DF2\u6807\u597D\u4F4D\u7F6E\u3002"}</p>${photo(step.photo, step, true)}` : '<p class="device-help">\u8BF7\u5148\u906E\u4F4F\u6237\u53F7\u3001\u59D3\u540D\u7B49\u4E2A\u4EBA\u4FE1\u606F\uFF0C\u518D\u9009\u56FE\u3002</p>'}
        <div class="electricity-actions">${recording ? button("stop-recording", recording.recorder ? "\u7ED3\u675F\u5F55\u97F3" : "\u53D6\u6D88\u5F55\u97F3") : button("record", step.audio ? "\u91CD\u65B0\u5F55\u4E00\u53E5" : "\u5F55\u4E00\u53E5\u5BB6\u4EBA\u7684\u8BDD")}
          ${step.audio ? button("listen", "\u8BD5\u542C\u5F55\u97F3") + button("remove-audio", "\u79FB\u9664\u5F55\u97F3") : ""}</div>
        <details><summary>\u9009\u62E9\u5DF2\u6709\u5F55\u97F3</summary><input aria-label="\u9009\u62E9\u5DF2\u6709\u77ED\u5F55\u97F3" type="file" accept="audio/*,.m4a" data-electricity-file="audio"></details>
        ${draft.steps.length > 1 ? button("remove", "\u79FB\u9664\u8FD9\u4E00\u6B65") : ""}
        ${message()}
        <div class="electricity-actions">${button("preview", "\u6309\u957F\u8F88\u770B\u5230\u7684\u6837\u5B50\u9884\u89C8", "quiet")}
          <button class="button" type="submit" ${busy || recording ? "disabled" : ""}>${busy ? "\u6B63\u5728\u53D1\u9001\u2026" : draft.id ? "\u4FDD\u5B58\u65B0\u7248" : "\u53D1\u9001\u5230\u957F\u8F88\u9996\u9875"}</button></div>
      </form></main>`;
  }
  function screenReader(card) {
    const step = card.steps[index];
    const title = preview ? "\u9884\u89C8\u64CD\u4F5C\u5361" : card.title;
    const closePreview = preview ? button("edit", "\u8FD4\u56DE\u7F16\u8F91") : "";
    const body = finished ? `<div class="empty-card"><h2>\u5DF2\u8D70\u5B8C\u8FD9\u5F20\u5361</h2><p>\u4E0B\u6B21\u53EF\u4EE5\u4ECE\u9996\u9875\u518D\u6253\u5F00\u3002</p></div>
      ${preview ? closePreview : '<a class="button" href="#/elder">\u56DE\u9996\u9875</a>'}${button("start-over", "\u518D\u770B\u4E00\u904D")}` : `<p class="electricity-progress">\u7B2C ${index + 1} \u6B65\uFF0C\u5171 ${card.steps.length} \u6B65</p>
        ${photo(step.photo, step)}<h2 id="electricity-instruction" tabindex="-1">${esc(step.text)}</h2>
        ${button("listen", step.audio ? "\u542C\u5BB6\u4EBA\u8BF4" : "\u542C\u8FD9\u4E00\u6B65")}
        <div class="electricity-reader-nav">${index > 0 ? button("previous", "\u4E0A\u4E00\u6B65") : ""}${button("next", index + 1 === card.steps.length ? "\u6211\u505A\u5B8C\u4E86" : "\u4E0B\u4E00\u6B65", "")}</div>
        ${preview ? closePreview : help ? `<form data-form="electricity-help" class="electricity-help">
          <h3>\u8BF7\u5BB6\u4EBA\u770B\u770B\u7B2C ${index + 1} \u6B65</h3><p>\u5BB6\u4EBA\u4F1A\u77E5\u9053\u60A8\u5361\u5728\u54EA\u4E00\u6B65\u3002\u60A8\u4E5F\u53EF\u4EE5\u52A0\u4E00\u5F20\u73B0\u5728\u7684\u622A\u56FE\u3002</p>
          <label for="electricity-help-photo">\u73B0\u5728\u7684\u622A\u56FE\uFF08\u9009\u586B\uFF09</label><input id="electricity-help-photo" type="file" accept="${pictureInputTypes}" data-electricity-file="help">
          ${help.photo ? photo(help.photo) + button("clear-help-photo", "\u79FB\u9664\u622A\u56FE") : ""}
          <div class="electricity-actions"><button class="button" type="submit" ${busy ? "disabled" : ""}>${busy ? "\u6B63\u5728\u53D1\u9001\u2026" : "\u53D1\u7ED9\u5BB6\u4EBA"}</button>${button("cancel-help", "\u53D6\u6D88")}</div>
        </form>` : sent ? '<p role="status" class="empty-card">\u5DF2\u8BF7\u5BB6\u4EBA\u770B\u770B\u8FD9\u4E00\u6B65\u3002\u6709\u65B0\u7248\u65F6\uFF0C\u4ECE\u9996\u9875\u6253\u5F00\u5C31\u80FD\u770B\u5230\u3002</p>' : button("open-help", "\u6211\u770B\u5230\u7684\u753B\u9762\u4E0D\u4E00\u6837")}`;
    return `${pageHeader2(title, preview ? "electricity-cards" : "elder")}<main class="surface electricity-screen electricity-reader stack">${body}${message()}</main>`;
  }
  function screen() {
    if (section === "electricity-cards") return screenList();
    if (getAccount().guest) return `${pageHeader2("\u67E5\u7535\u8D39\u64CD\u4F5C\u5361", back())}<main class="surface electricity-screen stack">
      <p class="empty-card">\u8BF7\u767B\u5F55\u79BE\u4F34\uFF0C\u67E5\u770B\u5BB6\u4EBA\u5206\u4EAB\u7684\u64CD\u4F5C\u5361\u3002</p>${loginAction2("\u7528\u90AE\u7BB1\u767B\u5F55", "button", "electricity-cards")}</main>`;
    if (draft) return preview ? screenReader(draft) : screenEditor();
    if (data) return screenReader(data);
    return `${pageHeader2("\u67E5\u7535\u8D39\u64CD\u4F5C\u5361", back())}<main class="surface electricity-screen stack">
      ${error ? message() + button("reload", "\u91CD\u65B0\u6253\u5F00") : '<p role="status">\u6B63\u5728\u6253\u5F00\u64CD\u4F5C\u5361\u2026</p>'}</main>`;
  }
  function homeEntries() {
    return cards.filter((item) => item.direction === "received" && !item.hidden).map((item) => ({
      id: item.id,
      place: "electricity",
      link: cardLink(item.id),
      title: item.title,
      subtitle: item.revision > 1 ? "\u5BB6\u4EBA\u5DF2\u66F4\u65B0" : "\u5BB6\u4EBA\u6559\u6211\u67E5\u7535\u8D39",
      glyph: "bill",
      color: "mint"
    }));
  }
  const hiddenEntries = () => cards.filter((item) => item.direction === "received" && item.hidden);
  const needsHelp = () => cards.filter((item) => item.direction === "sent" && item.needsHelp).length;
  async function visibility(id, hidden, control) {
    control.disabled = true;
    const active = getAccount();
    try {
      await api2(path + "/" + id + "/visibility", "PATCH", { hidden });
      if (getAccount() !== active) return;
      cards = cards.map((item) => item.id === id ? { ...item, hidden } : item);
      render2();
    } catch (failure) {
      control.disabled = false;
      throw failure;
    }
  }
  function validateDraft() {
    const invalid = draft.steps.findIndex((step) => !step.text.trim() || !step.photo || step.x === null);
    if (!draft.title.trim()) throw new Error("\u8BF7\u586B\u5199\u9996\u9875\u6309\u94AE\u7684\u540D\u5B57\u3002");
    if (invalid !== -1) {
      index = invalid;
      throw new Error(`\u8BF7\u5199\u597D\u7B2C ${index + 1} \u6B65\u7684\u8BF4\u660E\uFF0C\u9009\u4E00\u5F20\u622A\u56FE\u5E76\u6807\u4E0A\u4F4D\u7F6E\u3002`);
    }
  }
  function listen() {
    const step = (draft ?? data)?.steps[index];
    if (!step) return;
    stopAudio();
    if (!step.audio) {
      speak2(step.text);
      return;
    }
    const player = audio = new Audio(step.audio);
    player.play().catch(() => {
      if (audio === player) speak2(step.text);
    });
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("\u8FD9\u91CC\u6682\u65F6\u65E0\u6CD5\u5F55\u97F3\uFF0C\u53EF\u4EE5\u9009\u62E9\u5DF2\u6709\u5F55\u97F3\u3002");
    const active = recording = {};
    const step = draft.steps[index];
    render2();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active !== recording) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      active.stream = stream;
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = active.recorder = new MediaRecorder(stream, { ...mimeType ? { mimeType } : {}, audioBitsPerSecond: 48e3 });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (active !== recording) return;
        cancelRecording();
        error = "\u8FD9\u6B21\u5F55\u97F3\u5931\u8D25\u4E86\uFF0C\u8BF7\u518D\u5F55\u4E00\u6B21\u3002";
        render2();
      };
      recorder.onstop = async () => {
        clearTimeout(active.timer);
        stream.getTracks().forEach((track) => track.stop());
        if (active !== recording) return;
        try {
          const file2 = new Blob(chunks, { type: recorder.mimeType.split(";")[0] });
          if (!file2.size) throw new Error("\u6CA1\u6709\u5F55\u5230\u58F0\u97F3\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
          const value = await readAudio(file2);
          if (active === recording) step.audio = value;
        } catch (failure) {
          if (active === recording) error = failure.message;
        } finally {
          if (active === recording) {
            recording = null;
            render2();
          }
        }
      };
      recorder.start();
      active.timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 18e3);
      render2();
    } catch (failure) {
      if (active !== recording) return;
      cancelRecording();
      throw new Error(failure.name === "NotAllowedError" ? "\u8BF7\u5141\u8BB8\u4F7F\u7528\u9EA6\u514B\u98CE\uFF0C\u6216\u8005\u9009\u62E9\u5DF2\u6709\u5F55\u97F3\u3002" : "\u6682\u65F6\u65E0\u6CD5\u5F55\u97F3\uFF0C\u53EF\u4EE5\u9009\u62E9\u5DF2\u6709\u5F55\u97F3\u3002");
    }
  }
  async function action(name, control, event) {
    if (busy) return;
    const active = context;
    error = "";
    try {
      switch (name) {
        case "list-reload":
          await loadList(true);
          return;
        case "reload":
          void open(section, selected);
          render2();
          return;
        case "listen":
          listen();
          return;
        case "stop-recording":
          if (recording?.recorder?.state === "recording") {
            control.disabled = true;
            recording.recorder.stop();
            return;
          }
          cancelRecording();
          break;
        default:
          if (recording) return;
          switch (name) {
            case "record":
              stopAudio();
              await record();
              return;
            case "preview":
              validateDraft();
              preview = true;
              index = 0;
              finished = false;
              break;
            case "edit":
              preview = false;
              index = 0;
              finished = false;
              break;
            case "select":
              index = Number(control.dataset.index);
              break;
            case "add":
              draft.steps.push(newStep());
              index = draft.steps.length - 1;
              break;
            case "remove":
              draft.steps.splice(index, 1);
              index = Math.min(index, draft.steps.length - 1);
              break;
            case "remove-audio":
              draft.steps[index].audio = "";
              break;
            case "pin": {
              const bounds = control.getBoundingClientRect();
              const center = event.detail === 0;
              draft.steps[index].x = center ? 0.5 : Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
              draft.steps[index].y = center ? 0.5 : Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
              break;
            }
            case "next":
              if (index + 1 === (draft ?? data).steps.length) finished = true;
              else index++;
              help = null;
              sent = false;
              break;
            case "previous":
              index--;
              help = null;
              sent = false;
              break;
            case "start-over":
              index = 0;
              finished = false;
              help = null;
              sent = false;
              break;
            case "open-help":
              help = { photo: "" };
              break;
            case "cancel-help":
              help = null;
              break;
            case "clear-help-photo":
              help.photo = "";
              break;
          }
      }
      stopAudio();
      renderStep(name === "open-help" ? "#electricity-help-photo" : ["next", "previous", "start-over", "preview"].includes(name) ? "#electricity-instruction" : "");
    } catch (failure) {
      if (active !== context) return;
      error = failure.message;
      render2();
    }
  }
  function input(field) {
    if (!draft) return;
    if (field.dataset.electricityField) draft[field.dataset.electricityField] = field.value;
    if (field.dataset.electricityStep) draft.steps[index][field.dataset.electricityStep] = field.value;
  }
  function adjustPin(event) {
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!movement || busy || recording) return;
    event.preventDefault();
    const step = draft.steps[index];
    const move = (coordinate, delta) => Math.max(0, Math.min(1, (coordinate ?? 0.5) + delta * 0.025));
    step.x = move(step.x, movement[0]);
    step.y = move(step.y, movement[1]);
    renderStep('[data-action="electricity-pin"]');
  }
  async function file(field) {
    const selectedFile = field.files[0];
    if (!selectedFile || busy || recording) return;
    const active = context;
    const mode = field.dataset.electricityFile;
    const target = mode === "help" ? help : draft.steps[index];
    busy = true;
    field.disabled = true;
    try {
      if (mode === "audio") target.audio = await readAudio(selectedFile);
      else {
        target.photo = await readDevicePhoto(selectedFile);
        if (mode === "photo") target.x = target.y = null;
      }
      if (active === context) error = "";
    } catch (failure) {
      if (active === context) error = failure.message;
    } finally {
      if (active === context) {
        busy = false;
        render2();
      }
    }
  }
  async function submit(mode) {
    if (busy || recording) return;
    const active = context;
    try {
      if (mode === "publish") {
        validateDraft();
        if (!draft.recipient) throw new Error("\u8BF7\u5148\u9009\u62E9\u4E00\u4F4D\u5BB6\u4EBA\u3002");
      }
      busy = true;
      error = "";
      render2();
      if (mode === "publish") {
        await api2(
          draft.id ? path + "/" + draft.id : path,
          draft.id ? "PUT" : "POST",
          { title: draft.title, steps: draft.steps, revision: draft.revision, recipient: draft.recipient }
        );
        if (active === context) {
          loaded = false;
          location.hash = "#/electricity-cards";
        }
      } else {
        await api2(path + "/" + data.id + "/help", "POST", { stepId: data.steps[index].id, revision: data.revision, photo: help.photo });
        if (active === context) {
          help = null;
          sent = true;
        }
      }
    } catch (failure) {
      if (active === context) error = failure.message;
    } finally {
      if (active === context) {
        busy = false;
        render2();
      }
    }
  }
  return {
    reset,
    open,
    screen,
    homeEntries,
    hiddenEntries,
    needsHelp,
    visibility,
    action,
    input,
    file,
    submit,
    adjustPin,
    refresh: () => loadList(section === "electricity-cards"),
    stopMedia: () => {
      cancelRecording();
      stopAudio();
    }
  };
}

// phone-guide.js
var labels = { font: "\u653E\u5927\u624B\u673A\u5B57", wifi: "\u8FDE\u63A5\u65E0\u7EBF\u7F51" };
var phoneLessons = {
  android: {
    font: ["\u8BF7\u6253\u5F00\u624B\u673A\u91CC\u7684\u201C\u8BBE\u7F6E\u201D\u3002", "\u5728\u8BBE\u7F6E\u91CC\u641C\u7D22\u201C\u5B57\u4F53\u5927\u5C0F\u201D\uFF0C\u70B9\u5F00\u5BF9\u5E94\u7684\u7ED3\u679C\u3002", "\u628A\u5B57\u53F7\u6ED1\u5757\u5F80\u53F3\u79FB\uFF0C\u76F4\u5230\u5B57\u80FD\u770B\u6E05\u3002"],
    wifi: ["\u8BF7\u6253\u5F00\u624B\u673A\u91CC\u7684\u201C\u8BBE\u7F6E\u201D\u3002", "\u627E\u5230\u201C\u65E0\u7EBF\u5C40\u57DF\u7F51\u201D\u6216\u201C\u65E0\u7EBF\u7F51\u7EDC\u201D\uFF0C\u628A\u5B83\u6253\u5F00\u3002", "\u70B9\u60A8\u8BA4\u8BC6\u7684\u7F51\u7EDC\u3002\u9700\u8981\u5BC6\u7801\u65F6\uFF0C\u5728\u624B\u673A\u5F39\u51FA\u7684\u8FDE\u63A5\u6846\u91CC\u8F93\u5165\u3002"]
  },
  iphone: {
    font: ["\u8BF7\u6253\u5F00\u82F9\u679C\u624B\u673A\u7684\u201C\u8BBE\u7F6E\u201D\u3002", "\u70B9\u201C\u8F85\u52A9\u529F\u80FD\u201D\uFF0C\u518D\u70B9\u201C\u663E\u793A\u4E0E\u6587\u5B57\u5927\u5C0F\u201D\u3002", "\u70B9\u201C\u66F4\u5927\u5B57\u4F53\u201D\uFF0C\u628A\u5E95\u90E8\u7684\u6ED1\u5757\u5F80\u53F3\u79FB\u3002"],
    wifi: ["\u8BF7\u6253\u5F00\u82F9\u679C\u624B\u673A\u7684\u201C\u8BBE\u7F6E\u201D\u3002", "\u70B9\u201C\u65E0\u7EBF\u5C40\u57DF\u7F51\u201D\uFF0C\u628A\u5B83\u6253\u5F00\u3002", "\u70B9\u60A8\u8BA4\u8BC6\u7684\u7F51\u7EDC\u3002\u9700\u8981\u5BC6\u7801\u65F6\uFF0C\u5728\u624B\u673A\u5F39\u51FA\u7684\u8FDE\u63A5\u6846\u91CC\u8F93\u5165\u3002"]
  }
};
var phoneAudio = (platform, topic, index) => `assets/phone-${platform}-${topic}-${index + 1}.mp3`;
function phoneTopic(question) {
  const text = question.trim().replace(/[\s？?。，！!\-]/g, "").toLowerCase();
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(把)?(手机)?(放大|调大|增大)(手机)?(字体|字|字号)(呢|吗)?$/.test(text) || /^(手机)?(字体|字|字号)太小(了)?(怎么办)?$/.test(text)) return "font";
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(用)?(手机)?(连接|连上|连|接入)(家里|家里的)?(wifi|无线网|无线网络|无线局域网)(呢|吗)?$/.test(text)) return "wifi";
  return "";
}
function createPhoneGuide({ dialog: dialog2, showDialog: showDialog2, api: api2, esc, speak: speak2, stopSpeech: stopSpeech2, getAccount }) {
  let current;
  let player;
  let spoken = false;
  let voiceStatus = "";
  function stop() {
    const active = player;
    player = null;
    if (active) active.pause();
    if (spoken) {
      spoken = false;
      stopSpeech2();
    }
  }
  const button2 = (name, label, style = "quiet") => `<button type="button" class="button ${style}" data-action="phone-${name}">${label}</button>`;
  const ready = () => current?.steps?.length && current.index < current.steps.length;
  const panel = () => dialog2.querySelector(".phone-guide");
  function setStatus(text) {
    voiceStatus = text;
    const target = panel()?.querySelector(".phone-voice-status");
    if (target) target.textContent = text;
  }
  function render2(focus = "") {
    const { platform, steps, index, clarification, pending: pending2, error, title, auto } = current;
    let body;
    if (!platform) {
      body = `<h3>\u60A8\u7528\u7684\u662F\u54EA\u79CD\u624B\u673A\uFF1F</h3><div class="phone-guide-actions">${button2("android", "\u5B89\u5353\u624B\u673A", "")}${button2("iphone", "\u82F9\u679C\u624B\u673A", "")}</div>`;
    } else if (pending2) {
      body = '<p role="status">\u6B63\u5728\u51C6\u5907\u624B\u673A\u64CD\u4F5C\u6B65\u9AA4\u2026</p>';
    } else if (error) {
      body = `<p class="form-error" role="alert">${esc(error)}</p><div class="phone-guide-actions">${button2("retry", "\u518D\u8BD5\u4E00\u6B21", "")}${button2("change", "\u6362\u4E00\u79CD\u624B\u673A")}</div>`;
    } else if (!steps.length) {
      body = `<p class="phone-caption">${esc(clarification)}</p>${button2("answer", "\u56DE\u53BB\u8865\u5145\u95EE\u9898", "")}`;
    } else if (index >= steps.length) {
      body = `<h3>\u5DF2\u7ECF\u770B\u5B8C\u4E86</h3><div class="phone-guide-actions">${button2("restart", "\u4ECE\u5934\u518D\u542C")}${button2("answer", "\u8FD4\u56DE\u52A9\u624B", "")}</div>`;
    } else {
      body = `<p class="phone-step-count">${esc(title)} \xB7 \u7B2C ${index + 1} \u6B65\uFF0C\u5171 ${steps.length} \u6B65</p>
        <p class="phone-caption" id="phone-caption" tabindex="-1">${esc(steps[index])}</p>
        <div class="phone-guide-actions">${button2("listen", auto ? "\u518D\u542C\u4E00\u904D" : "\u542C\u8FD9\u4E00\u6B65", "")}${auto ? button2("mute", "\u5173\u95ED\u58F0\u97F3") : ""}</div>
        <p class="phone-voice-status" role="status">${esc(voiceStatus)}</p>
        <div class="phone-guide-actions phone-step-nav">${index ? button2("previous", "\u4E0A\u4E00\u6B65") : ""}${button2("next", index + 1 < steps.length ? "\u4E0B\u4E00\u6B65" : "\u6211\u505A\u5B8C\u4E86", "primary")}</div>
        <p class="device-help">\u53EF\u4EE5\u5148\u53BB\u624B\u673A\u91CC\u64CD\u4F5C\uFF0C\u56DE\u5230\u79BE\u4F34\u4F1A\u7559\u5728\u8FD9\u4E00\u6B65\u3002</p>${button2("change", "\u6362\u4E00\u79CD\u624B\u673A")}`;
    }
    const markup = `<div class="phone-guide">${body}</div>`;
    if (dialog2.open && panel()) panel().outerHTML = markup;
    else showDialog2("\u542C\u7740\u4E00\u6B65\u4E00\u6B65\u505A", markup);
    if (focus) panel()?.querySelector(focus)?.focus({ preventScroll: true });
  }
  function open(question, history2) {
    if (current?.id !== question.id) {
      stop();
      voiceStatus = "";
      current = { id: question.id, question: question.text, history: history2, owner: getAccount(), platform: "", steps: [], index: 0, auto: false };
    }
    render2();
  }
  async function load(platform) {
    stop();
    voiceStatus = "";
    const active = current = { ...current, platform, steps: [], index: 0, auto: false, pending: true, error: "", clarification: "" };
    const topic = phoneTopic(active.question);
    if (topic) {
      Object.assign(active, { steps: phoneLessons[platform][topic], title: labels[topic], topic, pending: false });
      render2("#phone-caption");
      return;
    }
    active.topic = "";
    render2();
    try {
      const { phoneGuide: phoneGuide2 } = await api2({ text: active.question, history: active.history, phonePlatform: platform });
      if (!phoneGuide2 || !Array.isArray(phoneGuide2.steps)) throw new Error("\u8FD9\u6B21\u6CA1\u6709\u8BFB\u5230\u624B\u673A\u64CD\u4F5C\u6B65\u9AA4\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002");
      Object.assign(active, phoneGuide2);
    } catch (error) {
      active.error = error.message;
    } finally {
      active.pending = false;
      if (active === current && active.owner === getAccount() && dialog2.open && panel()) render2("#phone-caption");
    }
  }
  function nativeVoice(text) {
    spoken = true;
    speak2(text, (status2) => {
      if (!spoken) return;
      if (status2 === "error") setStatus("\u6CA1\u6709\u542C\u5230\u58F0\u97F3\u65F6\uFF0C\u53EF\u4EE5\u5148\u770B\u5927\u5B57\uFF0C\u6216\u7528\u624B\u673A\u81EA\u5E26\u7684\u6D4F\u89C8\u5668\u6253\u5F00\u79BE\u4F34\u3002");
      else setStatus(status2 === "playing" ? "\u6B63\u5728\u6717\u8BFB\u8FD9\u4E00\u6B65" : "");
      if (status2 !== "playing") spoken = false;
    });
  }
  function play() {
    if (!ready()) return;
    stop();
    setStatus("");
    const { platform, topic, index, steps } = current;
    if (!topic) {
      nativeVoice(steps[index]);
      return;
    }
    const audio = player = new Audio("./" + phoneAudio(platform, topic, index));
    audio.onplaying = () => {
      if (player === audio) setStatus("\u6B63\u5728\u6717\u8BFB\u8FD9\u4E00\u6B65");
    };
    audio.onended = () => {
      if (player === audio) {
        player = null;
        setStatus("");
      }
    };
    audio.play().catch(() => {
      if (player !== audio) return;
      player = null;
      nativeVoice(steps[index]);
    });
  }
  function action(name) {
    if (!current || !panel()) return;
    switch (name) {
      case "android":
      case "iphone":
        void load(name);
        return;
      case "retry":
        void load(current.platform);
        return;
      case "change":
        stop();
        current = { ...current, platform: "", auto: false };
        render2(".phone-guide-actions button");
        return;
      case "answer":
        dialog2.close();
        setTimeout(() => document.getElementById("message-input")?.focus(), 0);
        return;
      case "listen":
        current.auto = true;
        render2('[data-action="phone-listen"]');
        play();
        return;
      case "mute":
        stop();
        voiceStatus = "";
        current.auto = false;
        render2('[data-action="phone-listen"]');
        return;
      case "next":
        current.index++;
        break;
      case "previous":
        current.index--;
        break;
      case "restart":
        current.index = 0;
        break;
      default:
        return;
    }
    stop();
    voiceStatus = "";
    render2("#phone-caption");
    if (current.auto) play();
  }
  function close() {
    stop();
    voiceStatus = "";
    if (current) current.auto = false;
  }
  return { open, action, close, reset() {
    close();
    current = null;
  } };
}

// app.js
var app = document.querySelector("#app");
var cloudSite2 = document.querySelector('meta[name="heban-cloud-site"]')?.content;
var dialog = document.querySelector("#dialog");
var status = document.querySelector("#status");
var accountBar = document.querySelector("#account-bar");
var recordRoutes = ["capture", "records", "record"];
var electricityRoutes = ["electricity-cards", "electricity-editor", "electricity-card"];
var routes = ["elder", "family", "chat", "ask", "reminders", "family-chat", "family-reminders", "family-shortcuts", "home-shortcuts", "family-overview", "devices", "device", "family-devices", "device-editor", "guides", "guide", "connections", "shared-device", "assistant-settings", "mine", ...recordRoutes, ...electricityRoutes];
var familyPages = ["elder", "home-shortcuts", "family-shortcuts", "family-overview", "connections", "shared-device", "electricity-cards"];
var pendingReplies = /* @__PURE__ */ new Map();
var failedReplies = /* @__PURE__ */ new Map();
var elderRoutes = ["elder", "home-shortcuts", "chat", "ask", "reminders", "devices", "device", "guides", "guide", "shared-device", "assistant-settings", "mine", "electricity-card", ...recordRoutes];
var voices = window.SpeechRecognition || window.webkitSpeechRecognition;
var longDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" });
var repeats = { never: "\u53EA\u63D0\u9192\u4E00\u6B21", daily: "\u6BCF\u5929\u63D0\u9192", weekly: "\u6BCF\u5468\u63D0\u9192" };
var symbol = {
  home: '<path d="M3 10.8 10.3 4.5a2.6 2.6 0 0 1 3.4 0L21 10.8M4.8 9.4v9.1a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2V9.4"/><path fill="currentColor" stroke-width="1.1" d="M12 16.8 9 14a1.8 1.8 0 0 1 2.5-2.6l.5.5.5-.5A1.8 1.8 0 0 1 15 14z"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2zm2-6a4 4 0 0 1 4 4v2m-4-17a4 4 0 0 1 0 8"/><circle cx="9" cy="8" r="4"/>',
  heart: '<path d="M20.8 5.8a4.8 4.8 0 0 0-6.8 0l-2 2-2-2a4.8 4.8 0 0 0-6.8 6.8l8.8 8.5 8.8-8.5a4.8 4.8 0 0 0 0-6.8z"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0M12 1v2"/>',
  question: '<circle cx="12" cy="12" r="9.5"/><path d="M9 9a3 3 0 1 1 4.4 2.7c-.9.5-1.4 1.1-1.4 2.3m0 3h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M21 11.6a9 8 0 0 1-9 8 11 11 0 0 1-3.5-.6l-4 2 1-4a7.7 7.7 0 0 1-2.5-5.4 9 8 0 0 1 18 0zM8 12h.01m4 0h.01m4 0h.01"/>',
  phone: '<path d="M8 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a13 13 0 0 1-6-6l2-2z"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 1 0 14 0m-7 7v5m-3 0h6"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
  tune: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="var(--paper)"/><circle cx="16" cy="17" r="2" fill="var(--paper)"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  remote: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M12 6v.01M10 11h4m-2 5v2m-1-1h2"/>',
  washer: '<rect x="3" y="2" width="18" height="20" rx="3"/><path d="M3 7h18M7 4.5h.01m4 0h.01"/><circle cx="12" cy="14" r="4"/>',
  cooker: '<rect x="3" y="8" width="18" height="12" rx="4"/><path d="M8 8V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-7 5h6m-4 4h2"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m3 17 5-4 4 3 4-6 5 5"/>',
  camera: '<path d="M8 6 9.4 4h5.2L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.1"/>',
  parcel: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18m-12-2h6m-4 7h2"/>',
  bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6m-6 4h4"/>'
};
var icon = (name, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbol[name]}</svg>`;
var escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
var records = createRecords({ paint: render, pageHeader, escapeHtml, icon, showDialog, closeDialog: () => dialog.close(), notify, isGuest: () => account?.guest });
var electricity = createElectricityCards({ api, escapeHtml, pageHeader, loginAction, render, speak, stopSpeech, account: () => account, family: () => family });
var phoneGuide = createPhoneGuide({
  dialog,
  showDialog,
  api: askAssistant,
  esc: escapeHtml,
  speak: (text, status2) => speak(text, state.speechRate, true, status2),
  stopSpeech,
  getAccount: () => account
});
var state = newState();
var route = readRoute();
var returnFocus = null;
var statusTimer;
var demoLastSeen = null;
var recognition;
var speechQueue;
var deviceStep = 0;
var deviceEditor = null;
var account = null;
var family = null;
var familyError = "";
var familyBusy = false;
var overview = null;
var cloudStatus = "saving";
var invite = null;
var authMode = "";
var authPanel = false;
var formMode = "";
var authBusy = false;
var legacySignIn = "/signin-with-chatgpt?return_to=%2F%23%2Flegacy";
function accessPreference(value) {
  try {
    if (value === void 0) return localStorage.getItem("heban-access");
    localStorage.setItem("heban-access", value);
  } catch {
  }
}
function loginAction(label = "\u7528\u90AE\u7BB1\u767B\u5F55", classes = "button", destination = "") {
  return cloudSite2 ? `<a class="${classes}" href="${escapeHtml(destination ? new URL(`#/${destination}`, cloudSite2).href : cloudSite2)}">\u6253\u5F00\u4E91\u7AEF\u7248</a>` : `<button class="${classes}" data-action="show-login" type="button">${label}</button>`;
}
function updateCloudStatus(current, detail = "") {
  cloudStatus = current;
  if (!account || authPanel) return;
  accountBar.dataset.state = current;
  const text = { saving: "\u6B63\u5728\u4FDD\u5B58", saved: account.guest ? account.temporary ? "\u672C\u6B21\u8BBF\u95EE\u6709\u6548" : "\u5DF2\u4FDD\u5B58\u5230\u672C\u673A" : "\u5DF2\u4E91\u7AEF\u4FDD\u5B58", error: "\u4FDD\u5B58\u5931\u8D25", conflict: "\u53E6\u4E00\u53F0\u8BBE\u5907\u6709\u66F4\u65B0", auth: "\u767B\u5F55\u5DF2\u5931\u6548" };
  accountBar.hidden = false;
  accountBar.innerHTML = `<div>${account.guest ? `<span>\u6E38\u5BA2</span>${loginAction("\u7528\u90AE\u7BB1\u767B\u5F55", "text-button")}` : `<a href="#/connections">${escapeHtml(account.name)}</a>`}<span class="sync-label" role="status">${text[current]}</span></div>
    ${current === "error" ? '<button type="button" class="text-button" data-action="cloud-retry">\u91CD\u8BD5\u4FDD\u5B58</button>' : ""}
    ${current === "conflict" ? '<button type="button" class="text-button" data-action="cloud-refresh">\u8BFB\u53D6\u4E91\u7AEF</button>' : ""}
    ${current === "auth" ? '<button type="button" class="text-button" data-action="show-login">\u91CD\u65B0\u767B\u5F55</button>' : ""}
    ${["error", "conflict", "auth"].includes(current) && detail ? `<p>${escapeHtml(detail)}</p>` : ""}`;
}
function save() {
  return saveCloud(state);
}
function readRoute() {
  const value = location.hash.slice(2).split("/")[0];
  return routes.includes(value) ? value : "elder";
}
var routeDeviceId = () => location.hash.split("/")[2];
function notify(message) {
  clearTimeout(statusTimer);
  status.textContent = message.includes("\u5DF2\u4FDD\u5B58") && cloudStatus !== "saved" ? account?.guest ? "\u6B63\u5728\u4FDD\u5B58\u5230\u672C\u673A\u3002" : "\u6B63\u5728\u4FDD\u5B58\u5230\u4E91\u7AEF\u3002" : message;
  status.classList.add("visible");
  statusTimer = window.setTimeout(() => status.classList.remove("visible"), 3700);
}
function noteActivity() {
  if (account && (state.monitoring || state.familyVisibility.some((item) => item.activity)) && elderRoutes.includes(route) && document.visibilityState === "visible") {
    state.lastSeen = Date.now();
    save();
  }
}
function stopSpeech() {
  clearTimeout(speechQueue?.startTimer);
  speechQueue = null;
  const engine = window.speechSynthesis;
  if (engine?.speaking || engine?.pending) engine.cancel();
}
function speak(text, rate = state.speechRate, manual = true, onStatus) {
  if (!text?.trim()) return;
  const engine = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  if (!engine || !Utterance) {
    notify("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u63D0\u4F9B\u6717\u8BFB\u3002\u8BF7\u7528\u624B\u673A\u81EA\u5E26\u7684\u6D4F\u89C8\u5668\u6253\u5F00\u79BE\u4F34\u3002");
    onStatus?.("error");
    return;
  }
  stopSpeech();
  const chunks = text.trim().match(/[^。！？\n]{1,100}[。！？\n]*|[。！？\n]+/gu);
  const zhVoices = (engine.getVoices?.() ?? []).filter((voice2) => /^(zh|cmn)(?:[-_]|$)/i.test(voice2.lang));
  const mandarin = zhVoices.filter((voice2) => !/[-_](hk|mo|yue)(?:[-_]|$)/i.test(voice2.lang));
  const voice = mandarin.find((item) => item.localService && /(?:[-_]cn|hans)/i.test(item.lang)) ?? mandarin.find((item) => item.localService) ?? mandarin[0] ?? zhVoices[0];
  const queue = { utterance: null, startTimer: null };
  speechQueue = queue;
  function failure(error) {
    if (speechQueue !== queue) return;
    stopSpeech();
    if (error === "canceled" || error === "interrupted") {
      onStatus?.("ended");
      return;
    }
    onStatus?.("error");
    notify(!manual ? "\u81EA\u52A8\u6717\u8BFB\u672A\u542F\u52A8\u3002\u8BF7\u70B9\u56DE\u590D\u4E0B\u65B9\u7684\u300C\u6717\u8BFB\u300D\u3002" : error === "voice-unavailable" || error === "language-unavailable" ? "\u8FD9\u53F0\u624B\u673A\u7F3A\u5C11\u4E2D\u6587\u8BED\u97F3\u3002\u8BF7\u5728\u624B\u673A\u7CFB\u7EDF\u91CC\u6DFB\u52A0\u4E2D\u6587\u8BED\u97F3\u3002" : "\u6CA1\u6709\u5F00\u59CB\u6717\u8BFB\u3002\u8BF7\u68C0\u67E5\u5A92\u4F53\u97F3\u91CF\uFF0C\u6216\u7528\u624B\u673A\u81EA\u5E26\u7684\u6D4F\u89C8\u5668\u6253\u5F00\u79BE\u4F34\u3002");
  }
  function next() {
    if (speechQueue !== queue) return;
    clearTimeout(queue.startTimer);
    const part = chunks.shift();
    if (!part) {
      speechQueue = null;
      onStatus?.("ended");
      return;
    }
    const item = new Utterance(part);
    item.lang = voice?.lang ?? "zh-CN";
    if (voice) item.voice = voice;
    item.rate = speechRates[rate]?.value ?? speechRates.normal.value;
    item.onstart = () => {
      if (speechQueue !== queue) return;
      clearTimeout(queue.startTimer);
      onStatus?.("playing");
    };
    item.onend = next;
    item.onerror = (event) => failure(event.error);
    queue.utterance = item;
    queue.startTimer = setTimeout(() => failure("timeout"), 4500);
    try {
      if (engine.paused) engine.resume();
      engine.speak(item);
    } catch {
      failure("exception");
    }
  }
  next();
}
var settings = (back = "ask") => `<a class="icon-button" href="#/assistant-settings/${back}" aria-label="\u52A9\u624B\u8BBE\u7F6E">${icon("tune", 23)}</a>`;
function homeHeader(owner) {
  const isFamily = owner === "family";
  return `<header class="topbar home-bar"><a class="brand" href="#/${owner}"><span class="brand-mark">${icon("home", 25)}</span><span>\u79BE\u4F34</span></a>
    <div class="toolbar">${isFamily ? "" : settings("elder")}
      <a class="role-link" href="#/${isFamily ? "elder" : "family"}">${icon("people", 22)}${isFamily ? "\u957F\u8F88\u7AEF" : "\u5BB6\u5C5E\u7AEF"}</a>
    </div></header>`;
}
function pageHeader(title, owner, extra = "") {
  const backLabel = { family: "\u5BB6\u5C5E\u7AEF", devices: "\u5BB6\u7535\u600E\u4E48\u7528", "family-devices": "\u8BBE\u5907\u5361\u5217\u8868", guides: "\u300C\u8DDF\u7740\u505A\u300D", connections: "\u5BB6\u5EAD\u8FDE\u63A5", ask: "\u95EE\u95EE\u52A9\u624B", chat: "\u804A\u5929", mine: "\u6211\u7684", records: "\u6211\u7684\u8BB0\u5F55", "guide/parcel": "\u5FEB\u9012\u67DC\u53D6\u4EF6", "guide/bill": "\u67E5\u7535\u8D39\u8D26\u5355" }[owner] ?? "\u9996\u9875";
  return `<header class="topbar subbar"><a class="icon-button" href="#/${owner}" aria-label="\u8FD4\u56DE${backLabel}">${icon("back")}</a><h1 id="screen-title" tabindex="-1">${title}</h1>${extra}<span class="subbar-space" aria-hidden="true"></span></header>`;
}
function tile({ link, action, title, subtitle, glyph, tone = "sage", prominent = false, id }) {
  const tag = link ? "a" : "button";
  const attrs = link ? `href="#/${link}"` : `type="button" data-action="${action}"`;
  return `<${tag} class="tile ${prominent ? "tile-prominent" : ""}" ${attrs}${id ? ` data-id="${id}"` : ""}>
    <span class="tile-icon ${tone}">${icon(glyph, 30)}</span><span class="tile-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></span>${icon("right", 23)}</${tag}>`;
}
var quickCards = [
  { key: "ask", ...shortcutOptions.ask, subtitle: "\u53EF\u4EE5\u8BF4\u8BDD\uFF0C\u4E5F\u53EF\u4EE5\u6253\u5B57", color: "blue" },
  { key: "parcel", ...shortcutOptions.parcel, subtitle: "\u627E\u53D6\u4EF6\u7801\uFF0C\u5B66\u7740\u5F00\u67DC\u95E8", color: "peach" },
  { key: "bill", ...shortcutOptions.bill, subtitle: "\u770B\u770B\u8FD9\u671F\u8981\u4EA4\u591A\u5C11\u94B1", color: "lilac" },
  { key: "devices", ...shortcutOptions.devices, subtitle: "\u770B\u56FE\u627E\u6309\u952E", color: "mint" }
];
function featureCard({ link, title, subtitle, glyph, color = "blue", external = false }) {
  return `<a class="feature-card tone-${color}" href="${escapeHtml(external ? link : "#/" + link)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
    <span class="feature-icon">${icon(glyph, 28)}</span>
    <span class="feature-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></span>
  </a>`;
}
function addedHomeShortcuts() {
  const items = [...state.shortcuts, ...family?.shortcuts?.filter((item) => item.direction === "received") ?? []];
  const seen = /* @__PURE__ */ new Set();
  return items.flatMap((item) => {
    const entry = cleanShortcut(item);
    if (!entry || seen.has(entry.kind + entry.target)) return [];
    seen.add(entry.kind + entry.target);
    const description = item.name ? `${item.name}\u6DFB\u52A0` : "\u5BB6\u5C5E\u7AEF\u6DFB\u52A0";
    const info = { id: item.id, place: item.direction === "received" ? "remote" : "local", title: entry.title };
    if (entry.kind === "built-in") return [{ ...shortcutOptions[entry.target], ...info, key: entry.target, subtitle: description, color: "lilac" }];
    return [{ ...info, link: entry.target, subtitle: new URL(entry.target).hostname, glyph: "question", color: "mint", external: true }];
  });
}
function visibleDefaults(added) {
  return defaultShortcuts.filter((key) => !state.hiddenShortcuts.includes(key) && !added.some((item) => item.key === key));
}
function homeShortcutsScreen() {
  const added = addedHomeShortcuts();
  const defaults = visibleDefaults(added).map((key) => ({ ...shortcutOptions[key], key, place: "default" }));
  const rows = [...defaults, ...added, ...electricity.homeEntries()];
  const hiddenCards = electricity.hiddenEntries();
  const hidden = state.hiddenShortcuts.filter((key) => !added.some((item) => item.key === key));
  return `${pageHeader("\u7BA1\u7406\u5E38\u7528\u529F\u80FD", "elder")}<main class="surface shortcut-screen">
    <p class="device-help">\u5220\u9664\u540E\uFF0C\u8BE5\u5165\u53E3\u4F1A\u4ECE\u9996\u9875\u79FB\u9664\u3002\u539F\u6765\u7684\u63D0\u9192\u3001\u7167\u7247\u548C\u4F7F\u7528\u8BB0\u5F55\u4ECD\u53EF\u67E5\u770B\u3002</p>
    <section class="shortcut-items"><h2>\u9996\u9875\u4E0A\u7684\u529F\u80FD</h2>
      ${rows.length ? `<ul class="record-list">${rows.map((item) => `<li class="shortcut-row"><div><strong>${escapeHtml(item.title)}</strong>${item.subtitle ? `<span>${escapeHtml(item.subtitle)}</span>` : ""}</div>
        <button class="button quiet" type="button" data-action="${item.place === "electricity" ? "hide-electricity" : "remove-shortcut"}" data-id="${escapeHtml(item.id ?? "")}" data-place="${item.place}" data-key="${escapeHtml(item.key ?? "")}" aria-label="\u5220\u9664${escapeHtml(item.title)}\u5165\u53E3">\u5220\u9664</button></li>`).join("")}</ul>` : '<p class="empty-card">\u9996\u9875\u6682\u65F6\u6CA1\u6709\u5E38\u7528\u5165\u53E3\u3002</p>'}</section>
    ${hidden.length ? `<section class="shortcut-items"><h2>\u53EF\u6062\u590D\u7684\u9ED8\u8BA4\u5165\u53E3</h2><ul class="record-list">${hidden.map((key) => `<li class="shortcut-row"><strong>${escapeHtml(shortcutOptions[key].title)}</strong><button class="button quiet" type="button" data-action="restore-shortcut" data-key="${key}">\u6062\u590D</button></li>`).join("")}</ul></section>` : ""}
    ${hiddenCards.length ? `<section class="shortcut-items"><h2>\u53EF\u6062\u590D\u7684\u64CD\u4F5C\u5361</h2><ul class="record-list">${hiddenCards.map((item) => `<li class="shortcut-row"><strong>${escapeHtml(item.title)}</strong><button class="button quiet" type="button" data-action="restore-electricity" data-id="${escapeHtml(item.id)}">\u6062\u590D</button></li>`).join("")}</ul></section>` : ""}
  </main>`;
}
function elderHome() {
  const next = reminderOrder(state.reminders, "elder").find((item) => !item.done && item.at > Date.now());
  const added = addedHomeShortcuts();
  const defaults = visibleDefaults(added);
  const featured = [...electricity.homeEntries(), ...quickCards.filter((item) => defaults.includes(item.key)), ...added];
  return `${homeHeader("elder")}<main class="surface home-screen">
    <div class="home-heading"><h1 id="screen-title" tabindex="-1">\u751F\u6D3B\u5E2E\u624B</h1><p class="date">${longDate.format(/* @__PURE__ */ new Date())}</p></div>
    <section class="feature-banner home-capture" aria-labelledby="capture-home-title">
      <div class="banner-copy"><h2 id="capture-home-title">\u4E0D\u77E5\u9053\u6309\u54EA\u4E2A\u952E\uFF1F</h2><p>\u62CD\u4E0B\u6309\u952E\u6216\u5C4F\u5E55\uFF0C\u770B\u770B\u4E0B\u4E00\u6B65\u600E\u4E48\u505A\u3002</p>
      <a class="button home-camera-button" href="#/capture/other/home">${icon("camera", 23)}\u62CD\u7167\u95EE\u4E00\u95EE</a></div>
      <img src="./assets/guide-kit.webp" width="520" height="434" alt="" fetchpriority="high">
    </section>
    <section class="tool-section" aria-labelledby="home-tools-title">
      <div class="section-heading"><h2 id="home-tools-title">\u5E38\u7528\u529F\u80FD</h2><div class="section-actions"><a class="section-link" href="#/records">\u6211\u7684\u8BB0\u5F55</a><a class="section-link" href="#/home-shortcuts">\u7BA1\u7406</a></div></div>
      ${featured.length ? `<div class="feature-grid">${featured.map(featureCard).join("")}</div>` : defaults.includes("reminders") ? "" : '<p class="empty-card">\u8FD8\u6CA1\u6709\u5E38\u7528\u5165\u53E3\u3002</p>'}
    </section>
    ${defaults.includes("reminders") ? `<div class="app-list home-shortcuts">
      ${tile({ link: "reminders", title: "\u8BBE\u4E2A\u63D0\u9192", subtitle: next ? `${formatWhen(next.at)}\u3000${next.title}` : "\u8BB0\u4E0B\u4E70\u83DC\u3001\u51FA\u95E8\u7684\u65F6\u95F4", glyph: "bell" })}
    </div>` : ""}
  </main>`;
}
function bottomNav() {
  const tabs = [
    { link: "elder", label: "\u9996\u9875", glyph: "home", pages: ["elder", "home-shortcuts", "electricity-card"] },
    { link: "ask", label: "\u52A9\u624B", glyph: "chat", pages: ["ask", "chat", "assistant-settings", "capture"] },
    { link: "guides", label: "\u8DDF\u7740\u505A", glyph: "bill", pages: ["guides", "guide", "devices", "device"] },
    { link: "mine", label: "\u6211\u7684", glyph: "people" }
  ];
  const selected = tabs.find((tab) => tab.pages?.includes(route))?.link ?? "mine";
  return `<nav class="app-nav" aria-label="\u4E3B\u5BFC\u822A">${tabs.map(({ link, label, glyph }) => `
    <a href="#/${link}" ${selected === link ? 'aria-current="page"' : ""}><span>${icon(glyph, 24)}</span>${label}</a>`).join("")}
  </nav>`;
}
function mineScreen() {
  return `${pageHeader("\u6211\u7684", "elder")}<main class="surface mine-screen">
    <div class="profile-card tone-blue"><span class="feature-icon">${icon("people", 28)}</span>
      <div><h2>${escapeHtml(account.name)}</h2><p>${account.guest ? account.temporary ? "\u672C\u6B21\u6D4F\u89C8\u53EF\u7528" : "\u8BB0\u5F55\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668" : "\u8BB0\u5F55\u4FDD\u5B58\u5230\u4E91\u7AEF"}</p></div>
      ${account.guest ? loginAction("\u767B\u5F55") : '<button class="button quiet" data-action="account-signout" type="button">\u9000\u51FA\u767B\u5F55</button>'}
    </div>
    <div class="app-list">
      ${tile({ link: "records", title: "\u6211\u7684\u8BB0\u5F55", subtitle: "\u770B\u770B\u5B58\u4E0B\u7684\u7167\u7247", glyph: "photo" })}
      ${tile({ link: "reminders", title: "\u6211\u7684\u63D0\u9192", subtitle: "\u770B\u65F6\u95F4\uFF0C\u4E5F\u53EF\u4EE5\u6539\u65F6\u95F4", glyph: "bell" })}
      ${tile({ link: "assistant-settings/mine", title: "\u52A9\u624B\u8BBE\u7F6E", subtitle: "\u53EF\u4EE5\u8BA9\u52A9\u624B\u8BFB\u6162\u4E00\u70B9", glyph: "tune" })}
      ${tile({ link: "connections", title: "\u548C\u5BB6\u4EBA\u5206\u4EAB", subtitle: "\u9009\u62E9\u5BB6\u4EBA\u80FD\u770B\u5230\u7684\u5185\u5BB9", glyph: "people" })}
      ${tile({ link: "family", title: "\u5BB6\u5C5E\u7AEF", subtitle: "\u8054\u7CFB\u5BB6\u4EBA\u3001\u5236\u4F5C\u8BBE\u5907\u5361", glyph: "heart" })}
    </div>
  </main>`;
}
function familyHome() {
  const seen = demoLastSeen ?? state.lastSeen;
  const days = inactiveDays(seen);
  const overdue = (state.monitoring || demoLastSeen !== null) && seen && days >= state.quietDays;
  const activity = overdue ? `\u5DF2\u7ECF ${days} \u5929\u6CA1\u6709\u6253\u5F00\u957F\u8F88\u7AEF\uFF0C\u65B9\u4FBF\u65F6\u6253\u4E2A\u7535\u8BDD\u95EE\u5019\u3002` : !state.monitoring && !demoLastSeen ? "\u957F\u8F88\u540C\u610F\u540E\uFF0C\u53EF\u4EE5\u5F00\u542F\u672A\u4F7F\u7528\u63D0\u9192\u3002" : !seen ? "\u7B49\u5F85\u957F\u8F88\u7B2C\u4E00\u6B21\u4F7F\u7528\u3002" : `\u6700\u8FD1\u4F7F\u7528\uFF1A${formatWhen(seen)}`;
  const callReminder = reminderOrder(state.reminders, "family").find((item) => !item.done && item.at > Date.now());
  const phoneAction = state.phone ? `<a class="button small" href="tel:${escapeHtml(state.phone)}">${icon("phone", 19)}\u53BB\u62E8\u6253</a>` : '<button class="button small" data-action="contact" type="button">\u8BBE\u7F6E\u53F7\u7801</button>';
  return `${homeHeader("family")}<main class="surface family-screen"><h1 id="screen-title" tabindex="-1">\u5BB6\u4EBA\u5173\u6000</h1>
    <button class="care-card ${overdue ? "care-warn" : ""}" type="button" data-action="care"><span class="care-icon">${icon("heart", 42)}</span>
      <span><strong>${demoLastSeen ? "\u672C\u673A\u63D0\u9192\u6F14\u793A" : "\u672C\u673A\u5173\u6000\u8BBE\u7F6E"}</strong><span>${activity}</span></span>${icon("right", 22)}</button>
    <div class="contact-card"><span class="tile-icon apricot">${icon("phone", 30)}</span><span class="tile-text"><strong>\u7ED9${escapeHtml(state.contactName)}\u6253\u7535\u8BDD</strong><span>${callReminder ? `${formatWhen(callReminder.at)} \u6709\u8054\u7CFB\u63D0\u9192` : "\u9009\u4E2A\u65F6\u95F4\uFF0C\u6253\u4E2A\u7535\u8BDD"}</span></span>${phoneAction}</div>
    <div class="feature-grid family-tools">
      ${featureCard({ link: "electricity-cards", title: "\u67E5\u7535\u8D39\u64CD\u4F5C\u5361", subtitle: electricity.needsHelp() ? "\u6709\u64CD\u4F5C\u5361\u9700\u8981\u4FEE\u6539" : "\u5708\u51FA\u4F4D\u7F6E\uFF0C\u5F55\u4E00\u53E5\u8BDD", glyph: "bill", color: "mint" })}
      ${featureCard({ link: "connections", title: "\u5BB6\u5EAD\u8FDE\u63A5", subtitle: "\u8FDE\u63A5\u5BB6\u4EBA\u548C\u67E5\u770B\u5206\u4EAB", glyph: "people", color: "blue" })}
      ${featureCard({ link: "family-overview", title: "\u957F\u8F88\u804A\u5929\u548C\u8FD1\u51B5", subtitle: "\u67E5\u770B\u957F\u8F88\u540C\u610F\u5206\u4EAB\u7684\u5185\u5BB9", glyph: "heart", color: "peach" })}
      ${featureCard({ link: "family-reminders", title: "\u8054\u7CFB\u63D0\u9192", subtitle: "\u8BB0\u4E0B\u6253\u7535\u8BDD\u7684\u65F6\u95F4", glyph: "calendar", color: "peach" })}
      ${featureCard({ link: "family-devices", title: "\u5236\u4F5C\u8BBE\u5907\u5361", subtitle: "\u5728\u7167\u7247\u4E0A\u6807\u51FA\u6309\u952E", glyph: "photo", color: "mint" })}
      ${featureCard({ link: "family-chat", title: "\u8DDF\u52A9\u624B\u804A\u804A", subtitle: "\u804A\u804A\u600E\u4E48\u5173\u5FC3\u5BB6\u4EBA", glyph: "chat", color: "lilac" })}
      ${featureCard({ link: "family-shortcuts", title: "\u957F\u8F88\u7AEF\u5E38\u7528\u529F\u80FD", subtitle: "\u6DFB\u52A0\u529F\u80FD\u6216\u7F51\u9875\u5165\u53E3", glyph: "plus", color: "blue" })}
    </div>
    ${state.phone ? '<button class="text-button" type="button" data-action="contact">\u4FEE\u6539\u8054\u7CFB\u4EBA\u53F7\u7801</button>' : ""}
  </main>`;
}
function familyShortcutsScreen() {
  const head = pageHeader("\u957F\u8F88\u7AEF\u5E38\u7528\u529F\u80FD", "family");
  if (!account.guest && !family && !familyError) return `${head}<main class="surface"><p class="empty-card" role="status">\u6B63\u5728\u8BFB\u53D6\u5BB6\u4EBA\u548C\u529F\u80FD\u2026</p></main>`;
  const links = family?.links ?? [];
  const items = [...state.shortcuts, ...family?.shortcuts?.filter((item) => item.direction === "sent") ?? []];
  const catalog = Object.entries(shortcutOptions);
  const options = (group) => catalog.filter(([, item]) => item.group === group).map(([key, item]) => `<option value="${key}">${item.title}</option>`).join("");
  return `${head}<main class="surface shortcut-screen">
    <form class="shortcut-form" data-form="family-shortcut">
      <h2>\u6DFB\u52A0\u4E00\u4E2A\u529F\u80FD</h2>
      <a class="section-link" href="#/electricity-cards">\u7ED9\u5BB6\u4EBA\u5236\u4F5C\u67E5\u7535\u8D39\u64CD\u4F5C\u5361</a>
      <label for="shortcut-recipient">\u52A0\u7ED9\u8C01\uFF1F</label>
      <select id="shortcut-recipient" name="recipient" required>${links.length > 1 ? '<option value="">\u8BF7\u9009\u62E9\u4E00\u4F4D\u5BB6\u4EBA</option>' : ""}
        ${links.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}\u7684\u9996\u9875</option>`).join("")}
        <option value="local">${account.guest ? "\u8FD9\u4E2A\u6D4F\u89C8\u5668\u7684\u957F\u8F88\u9996\u9875" : "\u81EA\u5DF1\u7684\u957F\u8F88\u9996\u9875"}</option></select>
      ${!links.length ? `<p class="form-help">\u60F3\u6DFB\u52A0\u5230\u5BB6\u4EBA\u624B\u673A\u7684\u9996\u9875\uFF1F\u5148\u5B8C\u6210\u5BB6\u5EAD\u8FDE\u63A5\u3002 ${account.guest ? loginAction("\u7528\u90AE\u7BB1\u767B\u5F55", "section-link", "family-shortcuts") : '<a class="section-link" href="#/connections">\u53BB\u8FDE\u63A5\u5BB6\u4EBA</a>'}</p>` : ""}
      <label for="shortcut-kind">\u8981\u6DFB\u52A0\u4EC0\u4E48\uFF1F</label>
      <select id="shortcut-kind" name="kind" required>
        <option value="">\u8BF7\u9009\u62E9\u4E00\u4E2A\u529F\u80FD</option>
        <optgroup label="\u751F\u6D3B\u6B65\u9AA4">${options("\u751F\u6D3B\u6B65\u9AA4")}</optgroup>
        <optgroup label="\u5BB6\u7535\u6B65\u9AA4">${options("\u5BB6\u7535\u6B65\u9AA4")}</optgroup>
        <optgroup label="\u5176\u4ED6\u529F\u80FD">${options(void 0)}</optgroup>
        <option value="website">\u81EA\u5B9A\u4E49\u7F51\u9875</option>
      </select>
      <label for="shortcut-title">\u5728\u9996\u9875\u663E\u793A\u7684\u540D\u5B57</label><input id="shortcut-title" name="title" maxlength="24" placeholder="\u9009\u586B\uFF0C\u7559\u7A7A\u5C31\u7528\u529F\u80FD\u540D\u79F0">
      <div class="shortcut-custom" data-shortcut-custom hidden>
        <label for="shortcut-url">\u7F51\u9875\u5730\u5740</label><input id="shortcut-url" name="target" type="url" inputmode="url" maxlength="500" placeholder="https://" disabled>
      </div>
  <p class="form-error" role="alert">${escapeHtml(familyError)}</p>
      <button class="button" type="submit">${icon("plus", 21)}\u6DFB\u52A0\u5230\u957F\u8F88\u7AEF</button>
    </form>
    <section class="shortcut-items"><h2>\u5DF2\u6DFB\u52A0</h2>
      ${items.length ? `<ul class="record-list">${items.map((item) => `
        <li class="shortcut-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.name || "\u672C\u673A\u957F\u8F88\u7AEF")}</span></div>
          <button class="button quiet" type="button" data-action="remove-shortcut" data-id="${escapeHtml(item.id)}" data-place="${item.direction === "sent" ? "remote" : "local"}" aria-label="\u79FB\u9664${escapeHtml(item.title)}">\u79FB\u9664</button></li>`).join("")}</ul>` : '<p class="empty-card">\u8FD8\u6CA1\u6709\u65B0\u589E\u5165\u53E3\u3002</p>'}</section>
  </main>`;
}
async function submitShortcut(form, data) {
  const kind = data.get("kind");
  const shortcut = cleanShortcut(kind === "website" ? { kind, title: data.get("title"), target: data.get("target") } : { kind: "built-in", target: kind, title: data.get("title") });
  const error = form.querySelector(".form-error");
  if (!shortcut) {
    error.textContent = kind === "website" ? "\u8BF7\u586B\u5199\u540D\u79F0\u548C\u4EE5 https:// \u5F00\u5934\u7684\u7F51\u9875\u5730\u5740\u3002" : "\u8BF7\u9009\u62E9\u8981\u6DFB\u52A0\u7684\u529F\u80FD\u3002";
    return;
  }
  const recipient = data.get("recipient");
  if (!recipient) {
    error.textContent = "\u8BF7\u9009\u62E9\u52A0\u5230\u8C01\u7684\u9996\u9875\u3002";
    return;
  }
  if (recipient === "local") {
    if (state.shortcuts.some((item) => item.kind === shortcut.kind && item.target === shortcut.target)) {
      error.textContent = "\u8FD9\u4E2A\u5165\u53E3\u5DF2\u7ECF\u6DFB\u52A0\u8FC7\u3002";
      return;
    }
    if (state.shortcuts.length >= 12) {
      error.textContent = "\u6700\u591A\u53EF\u6DFB\u52A0 12 \u4E2A\u5165\u53E3\uFF0C\u8BF7\u5148\u79FB\u9664\u4E00\u9879\u3002";
      return;
    }
    state.shortcuts.push({ id: crypto.randomUUID(), ...shortcut });
    refresh("\u5DF2\u6DFB\u52A0\u5230\u957F\u8F88\u7AEF\u3002");
    return;
  }
  const active = account;
  const button2 = form.querySelector("[type=submit]");
  button2.disabled = true;
  try {
    const result = await api("/api/family/shortcuts", "POST", { recipient, ...shortcut });
    if (account !== active) return;
    family = result;
    if (route === "family-shortcuts") render();
    notify("\u5DF2\u6DFB\u52A0\u5230\u5BB6\u4EBA\u7684\u957F\u8F88\u7AEF\u3002");
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    button2.disabled = false;
  }
}
async function removeShortcut(button2) {
  const { id, place, key } = button2.dataset;
  const hideDefault = route === "home-shortcuts" && defaultShortcuts.includes(key);
  function updateHiddenDefaults() {
    if (hideDefault && !state.hiddenShortcuts.includes(key)) state.hiddenShortcuts.push(key);
  }
  if (place === "default") {
    updateHiddenDefaults();
    refresh("\u5DF2\u4ECE\u9996\u9875\u5220\u9664\u3002");
    return;
  }
  if (place === "local") {
    state.shortcuts = state.shortcuts.filter((item) => item.id !== id);
    updateHiddenDefaults();
    refresh("\u529F\u80FD\u5165\u53E3\u5DF2\u79FB\u9664\u3002");
    return;
  }
  const active = account;
  button2.disabled = true;
  try {
    const result = await api(`/api/family/shortcuts/${encodeURIComponent(id)}`, "DELETE");
    if (account !== active) return;
    family = result;
    if (hideDefault) {
      updateHiddenDefaults();
      save();
    }
    if (["family-shortcuts", "home-shortcuts", "elder"].includes(route)) render();
    notify("\u529F\u80FD\u5165\u53E3\u5DF2\u79FB\u9664\u3002");
  } catch (error) {
    notify(error.message);
  } finally {
    button2.disabled = false;
  }
}
var chatConfig = {
  chat: { title: "\u804A\u804A\u5929", examples: ["\u4ECA\u5929\u60F3\u804A\u804A\u5929", "\u9644\u8FD1\u6709\u4EC0\u4E48\u793E\u533A\u6D3B\u52A8\uFF1F", "\u660E\u5929\u4E0B\u5348\u4E09\u70B9\u63D0\u9192\u6211\u6D47\u82B1"], greeting: "\u60A8\u597D\uFF0C\u6211\u662F{name}\u3002\u60A8\u53EF\u4EE5\u548C\u6211\u8BF4\u8BF4\u4ECA\u5929\u8FC7\u5F97\u600E\u4E48\u6837\uFF0C\u4E5F\u53EF\u4EE5\u8BA9\u6211\u5E2E\u60A8\u8BB0\u4E00\u4EF6\u8981\u505A\u7684\u4E8B\u3002" },
  ask: { title: "\u95EE\u95EE\u52A9\u624B", examples: exampleQuestions, greeting: "\u9047\u5230\u4E0D\u4F1A\u7528\u7684\u624B\u673A\u529F\u80FD\u6216\u5BB6\u7535\uFF0C\u53EF\u4EE5\u5728\u8FD9\u513F\u95EE\u3002\u6BD4\u5982\u300C\u600E\u4E48\u770B\u7535\u8D39\u8D26\u5355\uFF1F\u300D" },
  "family-chat": { title: "\u8DDF\u52A9\u624B\u804A\u804A", examples: ["\u600E\u4E48\u548C\u7238\u5988\u6253\u5F00\u8BDD\u9898\uFF1F", "\u660E\u5929\u665A\u4E0A\u516B\u70B9\u63D0\u9192\u6211\u7ED9\u7238\u5988\u6253\u7535\u8BDD"], greeting: "\u60A8\u597D\uFF0C\u6211\u662F{name}\u3002\u60A8\u53EF\u4EE5\u95EE\u6211\u600E\u4E48\u548C\u957F\u8F88\u804A\u804A\uFF0C\u4E5F\u53EF\u4EE5\u8BBE\u7F6E\u4E00\u4E2A\u8054\u7CFB\u63D0\u9192\u3002" }
};
function chatScreen(mode) {
  const config = chatConfig[mode];
  const waiting = pendingReplies.get(mode) === account;
  const failure = failedReplies.get(mode);
  const direct = failure?.error.canOpenDirect && failure.account === account ? directAssistantUrl(mode) : "";
  const interest = mode === "chat" ? state.interests.split(/[、，,\s]+/).find(Boolean) : "";
  const greeting = config.greeting.replace("{name}", state.persona) + (interest ? `\u4E5F\u53EF\u4EE5\u804A\u804A\u60A8\u559C\u6B22\u7684\u300C${interest.slice(0, 24)}\u300D\u3002` : "");
  const messages = [{ role: "assistant", text: greeting }, ...state.messages[mode]];
  const toggle = `<button class="listen" data-action="listen" type="button" aria-pressed="${state.listen}">${icon("sound", 20)}\u542C\u56DE\u590D<span class="switch" aria-hidden="true"></span></button>`;
  const familyMode = mode === "family-chat";
  return `${pageHeader(config.title, familyMode ? "family" : "elder", `<div class="toolbar chat-controls">${toggle}${familyMode ? "" : settings(mode)}</div>`)}<main class="surface conversation" data-mode="${mode}">
    ${familyMode ? "" : `<nav class="assistant-tabs" aria-label="\u52A9\u624B\u529F\u80FD"><a href="#/ask" ${mode === "ask" ? 'aria-current="page"' : ""}>\u95EE\u600E\u4E48\u7528</a><a href="#/chat" ${mode === "chat" ? 'aria-current="page"' : ""}>\u804A\u804A\u5929</a></nav>
      <div class="assistant-tools" aria-label="\u52A9\u624B\u5DE5\u5177">
        ${featureCard({ link: "capture", title: "\u62CD\u7167\u95EE\u4E00\u95EE", subtitle: "\u62CD\u4E0B\u6309\u952E\u6216\u5C4F\u5E55", glyph: "camera", color: "blue" })}
        ${featureCard({ link: "records", title: "\u6211\u7684\u8BB0\u5F55", subtitle: "\u770B\u5B58\u4E0B\u7684\u7167\u7247", glyph: "photo", color: "lilac" })}
      </div>`}
    <div class="message-list" role="log" aria-label="\u804A\u5929\u8BB0\u5F55">${messages.map(renderMessage).join("")}
      ${waiting ? '<p class="assistant-wait" role="status">\u79BE\u4F34\u6B63\u5728\u56DE\u7B54\u2026</p>' : ""}
      ${failure?.account === account ? `<div class="assistant-retry"><p role="alert">${escapeHtml(failure.error.message)}</p>
        <button type="button" class="button quiet" data-action="assistant-retry">\u518D\u95EE\u4E00\u6B21</button>
        ${mode === "ask" && phoneTopic(failure.text) ? phoneGuideButton(failure.questionId) : ""}
        ${direct ? `<a class="button quiet" href="${escapeHtml(direct)}" target="_blank" rel="noopener">\u76F4\u63A5\u6253\u5F00\u52A9\u624B</a>` : ""}
        ${mode === "ask" ? '<a class="section-link" href="#/guides">\u5148\u770B\u64CD\u4F5C\u6B65\u9AA4</a>' : ""}</div>` : ""}
    </div>
    <div class="composer-area">
      <div class="examples" aria-label="\u5E38\u7528\u8BF4\u6CD5">${config.examples.map((example) => `<button class="example" type="button" data-action="example" data-text="${escapeHtml(example)}" ${waiting ? "disabled" : ""}>${escapeHtml(example)}</button>`).join("")}</div>
      <form class="composer" data-form="message"><button class="icon-button mic" type="button" data-action="voice" aria-label="\u7528\u8BED\u97F3\u8F93\u5165" ${waiting ? "disabled" : ""}>${icon("mic", 25)}</button>
      <input id="message-input" name="message" aria-label="\u60F3\u8BF4\u7684\u8BDD" placeholder="${mode === "ask" ? "\u5728\u8FD9\u91CC\u5199\u4E0B\u60A8\u7684\u95EE\u9898" : "\u5728\u8FD9\u91CC\u5199\u4E0B\u60A8\u60F3\u8BF4\u7684\u8BDD"}" maxlength="300" autocomplete="off" required ${waiting ? "disabled" : ""}><button class="button" type="submit" ${waiting ? "disabled" : ""}>\u53D1\u9001</button></form>
      <p class="chat-note">\u8BF7\u522B\u53D1\u9001\u8D26\u53F7\u3001\u5BC6\u7801\u6216\u9A8C\u8BC1\u7801\u3002\u5728\u7EBF\u56DE\u590D\u7531 DeepSeek \u63D0\u4F9B\u3002</p>
    </div></main>`;
}
function phoneGuideButton(questionId) {
  return `<button class="button quiet phone-offer" type="button" data-action="open-phone-guide" data-id="${escapeHtml(questionId)}">${icon("sound", 20)}\u542C\u7740\u4E00\u6B65\u4E00\u6B65\u505A</button>`;
}
function renderMessage(message) {
  const tools = [];
  if (message.role === "assistant") tools.push(`<button class="message-action" type="button" data-action="read" data-text="${escapeHtml(message.text)}" aria-label="\u6717\u8BFB\u8FD9\u6761\u56DE\u590D">${icon("sound", 17)}\u6717\u8BFB</button>`);
  if (route === "ask" && message.guideFor && state.messages.ask.some((item) => item.role === "user" && item.id === message.guideFor)) {
    tools.push(phoneGuideButton(message.guideFor));
  }
  if (route === "ask" && message.role === "user") {
    tools.push(`<button class="message-action" type="button" data-action="share" data-id="${message.id}">\u5206\u4EAB\u7ED9\u5BB6\u4EBA</button>`);
  }
  const proposal = message.draft;
  if (proposal) {
    const stored = state.reminders.some((item) => item.id === message.id);
    tools.push(stored ? `<span class="recorded">${icon("check", 17)}\u5DF2\u4FDD\u5B58</span>` : `<button class="message-action" type="button" data-action="draft" data-id="${message.id}">\u6838\u5BF9\u5E76\u4FDD\u5B58\u63D0\u9192</button>`);
  }
  return `<article class="message ${message.role}">${message.role === "assistant" ? `<span class="message-avatar" aria-hidden="true">${icon("home", 24)}</span>` : ""}<div><p class="bubble">${escapeHtml(message.text)}</p>${tools.length ? `<div class="message-actions">${tools.join("")}</div>` : ""}</div></article>`;
}
function remindersScreen(owner) {
  const family2 = owner === "family";
  const items = reminderOrder(state.reminders, owner);
  const examples = family2 ? ["\u660E\u5929\u665A\u4E0A\u516B\u70B9\u63D0\u9192\u6211\u7ED9\u7238\u5988\u6253\u7535\u8BDD"] : ["\u660E\u5929\u4E0A\u5348\u516B\u70B9\u534A\u63D0\u9192\u6211\u4E70\u83DC", "\u4E0B\u5348\u4E09\u70B9\u63D0\u9192\u6211\u6D47\u82B1"];
  return `${pageHeader(family2 ? "\u8054\u7CFB\u63D0\u9192" : "\u6211\u7684\u63D0\u9192", owner)}<main class="surface reminder-screen">
    <button class="button new-reminder" type="button" data-action="new-reminder">${icon("plus", 26)}\u65B0\u5EFA\u63D0\u9192</button>
    <h2>\u63D0\u9192\u5217\u8868</h2>
    ${items.length ? `<div class="stack">${items.map((item) => `<button class="tile reminder-row" data-action="edit-reminder" data-id="${item.id}" type="button"><span class="tile-icon apricot">${icon("calendar", 27)}</span><span class="tile-text"><strong>${escapeHtml(item.title)}</strong><span>${formatWhen(item.at)}${item.repeat && item.repeat !== "never" ? ` \xB7 ${repeats[item.repeat]}` : ""}</span></span><span class="badge ${item.done ? "done" : ""}">${item.done ? "\u5DF2\u5B8C\u6210" : item.at <= Date.now() ? "\u5DF2\u5230\u65F6\u95F4" : "\u5F85\u5B8C\u6210"}</span>${icon("right", 20)}</button>`).join("")}</div>` : '<p class="empty-card">\u8FD8\u6CA1\u6709\u63D0\u9192\u3002\u70B9\u4E0A\u65B9\u7684\u300C\u65B0\u5EFA\u63D0\u9192\u300D\u8BB0\u4E0B\u4E00\u4EF6\u4E8B\u3002</p>'}
    <section class="reminder-examples"><h2>\u4E00\u53E5\u8BDD\u5C31\u80FD\u6DFB\u52A0</h2><div class="examples">${examples.map((example) => `<button class="example" data-action="reminder-example" data-text="${escapeHtml(example)}" type="button">${icon("calendar", 19)}${escapeHtml(example)}</button>`).join("")}</div></section>
  </main>`;
}
function devicesScreen() {
  return `${pageHeader("\u5BB6\u7535\u600E\u4E48\u7528", "elder")}<main class="surface devices-screen">
    ${state.deviceGuides.length ? `<section aria-labelledby="my-devices"><h2 id="my-devices">\u6211\u5BB6\u7684\u8BBE\u5907</h2><div class="stack">${state.deviceGuides.map((guide) => tile({ link: `device/${guide.id}`, title: guide.name, subtitle: "\u770B\u6211\u5BB6\u8BBE\u5907\u7684\u7167\u7247", glyph: "photo" })).join("")}</div></section>` : ""}
    <section aria-labelledby="practice-devices"><h2 id="practice-devices">\u5148\u5728\u624B\u673A\u4E0A\u7EC3\u4E00\u7EC3</h2><div class="stack">${deviceLessons.map((lesson) => tile({ link: `device/${lesson.id}`, title: lesson.name, subtitle: lesson.summary, glyph: lesson.icon, tone: lesson.icon === "washer" ? "apricot" : "sage" })).join("")}</div></section>
    <p class="device-help">\u7EC3\u5B8C\u53EF\u4EE5\u5BF9\u7167\u5B9E\u7269\u627E\u6309\u952E\u3002\u6309\u952E\u4E0D\u4E00\u6837\u65F6\uFF0C\u53EF\u4EE5\u8BF7\u5BB6\u4EBA\u7ED9\u8FD9\u53F0\u8BBE\u5907\u505A\u4E00\u5F20\u7167\u7247\u6307\u5F15\u3002</p>
  </main>`;
}
function selectedDevice() {
  const id = routeDeviceId();
  if (route === "shared-device") {
    const item = family?.items.find((entry) => entry.id === id && entry.kind === "device");
    return item ? { name: item.payload.title, photo: item.payload.photo, steps: item.payload.steps } : null;
  }
  return deviceLessons.find((lesson) => lesson.id === id) ?? state.deviceGuides.find((guide) => guide.id === id);
}
function pinMarkup(pin) {
  if (!pin) return "";
  return `<span class="photo-pin" style="--left:${pin.x * 100}%;--top:${pin.y * 100}%" aria-hidden="true"></span>`;
}
function photoBoard(photo, name, pin, editable = false) {
  const image = `<img class="device-photo-image" src="${escapeHtml(photoUrl(photo))}" alt="${escapeHtml(name)}\u7684\u6309\u952E\u7167\u7247">${pinMarkup(pin)}`;
  return `<div class="photo-board">${editable ? `<button type="button" data-action="device-pin" class="photo-target" aria-label="\u5728\u7167\u7247\u4E0A\u6807\u8BB0\u6309\u952E" aria-describedby="device-pin-help">${image}</button>` : `<div class="photo-target">${image}</div>`}</div>`;
}
function deviceScreen() {
  const device = selectedDevice();
  const shared = route === "shared-device";
  const back = shared ? "connections" : "devices";
  if (!device) return `${pageHeader(shared ? "\u5BB6\u4EBA\u5206\u4EAB\u7684\u8BBE\u5907" : "\u5BB6\u91CC\u8BBE\u5907", back)}<main class="surface"><p class="empty-card">${shared && !family && !familyError ? "\u6B63\u5728\u8BFB\u53D6\u5206\u4EAB\u2026" : "\u627E\u4E0D\u5230\u8FD9\u5F20\u8BBE\u5907\u5361\u3002\u8BF7\u8FD4\u56DE\u5217\u8868\u91CD\u65B0\u9009\u62E9\u3002"}</p></main>`;
  const steps = device.steps;
  const step = steps[deviceStep];
  const complete = !step;
  const sample = Boolean(device.controls);
  const activeKey = sample && step ? device.controls.find(([key]) => key === step.key)?.[1] : "";
  const controls = sample ? `<div class="practice-panel">
    <div class="practice-display" role="status"><span class="practice-indicator" aria-hidden="true"></span>${device.displays[deviceStep]}</div>
    <div class="practice-buttons" aria-label="\u7EC3\u4E60\u9762\u677F">${device.controls.map(([key, name]) => `<button type="button" class="practice-key ${activeKey === name ? "is-current" : ""}" data-action="device-key" data-key="${key}" ${complete ? "disabled" : ""}>${escapeHtml(name)}</button>`).join("")}</div>
  </div>` : "";
  const title = sample ? `${device.name}\u7EC3\u4E60` : device.name;
  return `${pageHeader(escapeHtml(title), back)}<main class="surface device-lesson">
    <div class="lesson-progress"><span>${complete ? "\u5DF2\u5B8C\u6210" : `\u7B2C ${deviceStep + 1} \u6B65\uFF0C\u5171 ${steps.length} \u6B65`}</span><progress aria-label="\u64CD\u4F5C\u8FDB\u5EA6" value="${deviceStep}" max="${steps.length}"></progress></div>
    ${complete ? `<h2 class="device-instruction" id="device-step-heading" tabindex="-1">${sample ? "\u7EC3\u4E60\u5B8C\u6210" : "\u5168\u90E8\u6B65\u9AA4\u90FD\u770B\u5B8C\u4E86"}</h2>` : `<h2 class="device-instruction" id="device-step-heading" tabindex="-1">${escapeHtml(step.text)}</h2><button type="button" class="button quiet listen-step" data-action="read" data-text="${escapeHtml(step.text)}">${icon("sound", 23)}\u542C\u8FD9\u4E00\u6B65</button>`}
    ${sample ? controls : !complete ? photoBoard(device.photo, device.name, step) : ""}
    ${sample && !complete ? '<p class="device-help">\u5728\u7EC3\u4E60\u9762\u677F\u4E0A\u70B9\u9AD8\u4EAE\u7684\u6309\u952E\u3002</p>' : ""}
    <p id="device-feedback" class="form-error" role="status"></p>
    <div class="lesson-actions">
      ${deviceStep > 0 && !complete ? '<button type="button" class="button quiet" data-action="device-previous">\u4E0A\u4E00\u6B65</button>' : ""}
      ${!sample && !complete ? `<button type="button" class="button" data-action="device-next">${deviceStep === steps.length - 1 ? "\u770B\u5B8C\u4E86" : "\u627E\u5230\u4E86\uFF0C\u4E0B\u4E00\u6B65"}</button>` : ""}
      ${complete ? `<button type="button" class="button quiet" data-action="device-restart">\u518D\u6765\u4E00\u6B21</button><a class="button" href="#/${back}">${shared ? "\u8FD4\u56DE\u5BB6\u5EAD\u8FDE\u63A5" : "\u8FD4\u56DE\u8BBE\u5907\u5217\u8868"}</a>` : ""}
    </div>
  </main>`;
}
function familyDevicesScreen() {
  return `${pageHeader("\u5BB6\u91CC\u7684\u8BBE\u5907\u5361", "family")}<main class="surface devices-screen family-devices">
    <p class="device-help">\u62CD\u6E05\u695A\u8BBE\u5907\u7684\u6309\u952E\uFF0C\u4F60\u6807\u597D\u4F4D\u7F6E\u3001\u5199\u597D\u6B65\u9AA4\uFF0C\u957F\u8F88\u7AEF\u5C31\u80FD\u7167\u7740\u505A\u3002</p>
    <a class="button wide new-device" href="#/device-editor">${icon("plus", 24)}\u65B0\u5EFA\u8BBE\u5907\u5361</a>
    ${state.deviceGuides.length ? `<div class="stack">${state.deviceGuides.map((guide) => tile({ link: `device-editor/${guide.id}`, title: guide.name, subtitle: `${guide.steps.length} \u6B65 \xB7 \u53EF\u4FEE\u6539`, glyph: "photo" })).join("")}</div>` : '<p class="empty-card">\u53EF\u4EE5\u4ECE\u957F\u8F88\u6700\u5E38\u7528\u7684\u4E00\u4EF6\u8BBE\u5907\u5F00\u59CB\u3002</p>'}
  </main>`;
}
function editorStepRows() {
  return deviceEditor.steps.length ? deviceEditor.steps.map((step, index) => `<li><span>${escapeHtml(step.text)}${step.x === null ? "<small>\u8BF7\u91CD\u65B0\u6807\u8BB0\u4F4D\u7F6E</small>" : ""}</span><button type="button" class="text-button" data-action="device-edit-step" data-index="${index}" aria-label="\u4FEE\u6539\u7B2C ${index + 1} \u6B65">\u4FEE\u6539</button><button type="button" class="text-button remove-step" data-action="device-remove-step" data-index="${index}" aria-label="\u79FB\u9664\u7B2C ${index + 1} \u6B65">\u79FB\u9664</button></li>`).join("") : '<li class="empty-step">\u8FD8\u6CA1\u6DFB\u52A0\u6B65\u9AA4\u3002</li>';
}
function editorPhotoContent(name = "\u5BB6\u91CC\u7684\u8BBE\u5907") {
  return deviceEditor.photo ? photoBoard(deviceEditor.photo, name, deviceEditor.pin, true) : `<p class="photo-empty">${icon("photo", 28)}\u8BF7\u9009\u62E9\u4E00\u5F20\u80FD\u770B\u6E05\u6309\u952E\u7684\u7167\u7247\u3002</p>`;
}
function deviceEditorScreen() {
  if (!deviceEditor) return `${pageHeader("\u8BBE\u5907\u5361", "family-devices")}<main class="surface"><p class="empty-card">\u627E\u4E0D\u5230\u8981\u4FEE\u6539\u7684\u8BBE\u5907\u5361\u3002</p></main>`;
  const { name, id, loading, stepIndex } = deviceEditor;
  return `${pageHeader(id ? "\u4FEE\u6539\u8BBE\u5907\u5361" : "\u65B0\u5EFA\u8BBE\u5907\u5361", "family-devices")}<main class="surface guide-editor">
    <form data-form="device-guide">
      <label for="device-name">\u8BBE\u5907\u53EB\u4EC0\u4E48\uFF1F</label><input id="device-name" name="name" maxlength="26" placeholder="\u5982\uFF1A\u5BA2\u5385\u7535\u89C6\u9065\u63A7\u5668" value="${escapeHtml(name)}" required>
      <label for="device-file">\u62CD\u4E00\u5F20\u6309\u952E\u7167\u7247</label><input id="device-file" type="file" accept="image/jpeg,image/png,image/webp" ${loading ? "disabled" : ""}>
      <div id="guide-photo">${editorPhotoContent(name || "\u5BB6\u91CC\u7684\u8BBE\u5907")}</div>
      <div class="step-builder">
        <h2>\u6DFB\u52A0\u64CD\u4F5C\u6B65\u9AA4</h2><p id="device-pin-help" class="device-help">\u5148\u70B9\u7167\u7247\u6807\u8BB0\u8981\u6309\u7684\u4F4D\u7F6E\uFF0C\u518D\u5199\u4E00\u53E5\u8BF4\u660E\u3002\u4E5F\u53EF\u4EE5\u7528\u65B9\u5411\u952E\u79FB\u52A8\u6807\u8BB0\u3002</p>
        <p id="pin-status" role="status">${deviceEditor.pin ? "\u5DF2\u6807\u8BB0\u6309\u952E\u4F4D\u7F6E" : ""}</p>
        <label for="device-step-text">\u8FD9\u4E00\u6B65\u600E\u4E48\u505A\uFF1F</label><textarea id="device-step-text" name="step" rows="2" maxlength="100" placeholder="\u5982\uFF1A\u6309\u9065\u63A7\u5668\u6700\u4E0A\u9762\u7684\u7535\u6E90\u952E"></textarea>
        <button type="button" class="button quiet" data-action="device-add-step">${stepIndex !== null ? "\u66F4\u65B0\u8FD9\u4E00\u6B65" : "\u6DFB\u52A0\u8FD9\u4E00\u6B65"}</button>
      </div>
      <ol class="guide-steps" id="guide-steps" aria-label="\u5DF2\u6709\u6B65\u9AA4">${editorStepRows()}</ol>
      <p class="form-error" role="alert"></p>
      <button type="submit" class="button wide" ${loading ? "disabled" : ""}>\u4FDD\u5B58\u8BBE\u5907\u5361</button>
      ${id ? `<button type="button" class="button quiet" data-action="share-device" data-id="${id}">\u5206\u4EAB\u5DF2\u4FDD\u5B58\u7684\u8BBE\u5907\u5361</button><button type="button" class="text-button remove-step" data-action="device-delete">\u5220\u9664\u8BBE\u5907\u5361</button>` : ""}
    </form>
  </main>`;
}
function guideError(text) {
  document.querySelector(".guide-editor .form-error").textContent = text;
}
function moveLesson(step) {
  const device = selectedDevice();
  if (!device) return;
  deviceStep = Math.max(0, Math.min(step, device.steps.length));
  render();
  const instruction = document.querySelector("#device-step-heading");
  instruction?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (state.listen && device.steps[deviceStep]) speak(device.steps[deviceStep].text);
}
function updatePin(form, pin) {
  deviceEditor.pin = pin;
  const target = form.querySelector(".photo-target");
  target.querySelector(".photo-pin")?.remove();
  if (pin) target.insertAdjacentHTML("beforeend", pinMarkup(pin));
  form.querySelector("#pin-status").textContent = pin ? "\u5DF2\u6807\u8BB0\u6309\u952E\u4F4D\u7F6E" : "";
}
function addDeviceStep(form) {
  const text = form.elements.step.value.trim();
  if (!deviceEditor.photo || !deviceEditor.pin || !text) {
    guideError("\u8BF7\u70B9\u7167\u7247\u6807\u8BB0\u4E00\u4E2A\u6309\u952E\uFF0C\u518D\u5199\u4E00\u53E5\u8FD9\u4E00\u6B65\u600E\u4E48\u505A\u3002");
    return false;
  }
  const index = deviceEditor.stepIndex;
  if (index === null && deviceEditor.steps.length >= 8) {
    guideError("\u4E00\u5F20\u5361\u6700\u591A\u653E 8 \u6B65\u3002\u53EF\u4EE5\u628A\u53E6\u4E00\u4EF6\u4E8B\u5355\u72EC\u505A\u6210\u4E00\u5F20\u5361\u3002");
    return false;
  }
  const { x, y } = deviceEditor.pin;
  const entry = { text, x, y };
  if (index === null) deviceEditor.steps.push(entry);
  else deviceEditor.steps[index] = entry;
  deviceEditor.stepIndex = null;
  updatePin(form, null);
  form.elements.step.value = "";
  form.querySelector('[data-action="device-add-step"]').textContent = "\u6DFB\u52A0\u8FD9\u4E00\u6B65";
  form.querySelector("#guide-steps").innerHTML = editorStepRows();
  guideError("");
  return true;
}
function saveDeviceGuide(form) {
  if (deviceEditor.loading) return;
  if ((form.elements.step.value.trim() || deviceEditor.pin) && !addDeviceStep(form)) return;
  const name = form.elements.name.value.trim();
  const { id, photo, steps } = deviceEditor;
  if (!name || !photo || !steps.length || steps.some((step) => step.x === null)) {
    guideError("\u8BF7\u586B\u5199\u8BBE\u5907\u540D\u79F0\uFF0C\u9009\u4E00\u5F20\u7167\u7247\uFF0C\u5E76\u7ED9\u6BCF\u4E2A\u6B65\u9AA4\u6807\u597D\u6309\u952E\u4F4D\u7F6E\u3002");
    return;
  }
  if (!id && state.deviceGuides.length >= 8) {
    guideError("\u8FD9\u53F0\u8BBE\u5907\u6700\u591A\u4FDD\u5B58 8 \u5F20\u8BBE\u5907\u5361\u3002\u53EF\u4EE5\u5148\u79FB\u9664\u4E00\u5F20\u4E0D\u518D\u4F7F\u7528\u7684\u5361\u3002");
    return;
  }
  const guide = { id: id ?? crypto.randomUUID(), name, photo, steps };
  const previous = state.deviceGuides;
  state.deviceGuides = id ? previous.map((item) => item.id === id ? guide : item) : [...previous, guide];
  if (!save()) {
    state.deviceGuides = previous;
    guideError("\u6D4F\u89C8\u5668\u5B58\u50A8\u4E0D\u8DB3\u6216\u4E0D\u53EF\u7528\uFF0C\u8FD9\u5F20\u8BBE\u5907\u5361\u8FD8\u6CA1\u6709\u4FDD\u5B58\u3002");
    return;
  }
  location.hash = "#/family-devices";
  notify("\u8BBE\u5907\u5361\u5DF2\u4FDD\u5B58\u3002\u957F\u8F88\u7AEF\u53EF\u4EE5\u67E5\u770B\u4E86\u3002");
}
function guidesScreen() {
  return `${pageHeader("\u8DDF\u7740\u505A", "elder")}<main class="surface guides-screen">
    <div class="section-heading"><h2>\u60A8\u60F3\u5B66\u54EA\u4E00\u4EF6\u4E8B\uFF1F</h2></div>
    <div class="feature-grid">${lifeGuides.map((guide) => {
    const run = readGuideRun(guide, state.guideRuns[guide.id]);
    const inProgress = guide.steps[run.screen]?.title ?? (run.screen === "help" ? "\u627E\u4EBA\u5E2E\u5FD9" : "");
    return featureCard({ link: `guide/${guide.id}`, title: guide.title, subtitle: inProgress ? `\u7EE7\u7EED\uFF1A${inProgress}` : guide.summary, glyph: guide.icon, color: guide.id === "parcel" ? "peach" : "lilac" });
  }).join("")}
      ${featureCard(quickCards[3])}
      ${featureCard({ link: "capture", title: "\u62CD\u7167\u95EE\u4E00\u95EE", subtitle: "\u62CD\u4E0B\u6309\u952E\u6216\u5C4F\u5E55", glyph: "camera", color: "blue" })}
    </div>
    <p class="device-help">\u8FD9\u91CC\u662F\u64CD\u4F5C\u6F14\u793A\u3002\u5B9E\u9645\u753B\u9762\u4EE5\u73B0\u573A\u8BBE\u5907\u6216\u5B98\u65B9\u670D\u52A1\u4E3A\u51C6\u3002</p>
  </main>`;
}
function currentGuide() {
  return lifeGuides.find((guide) => guide.id === routeDeviceId());
}
function guidePicture(preview) {
  return `<figure class="guide-picture"><figcaption>${escapeHtml(preview.label)}</figcaption>
    <div class="guide-preview-grid">${preview.labels.map((label, index) => `<span class="guide-preview-label ${index === preview.focus ? "is-guide-focus" : ""}">${escapeHtml(label)}</span>`).join("")}</div>
    </figure>`;
}
function guideScreen() {
  const guide = currentGuide();
  if (!guide) return `${pageHeader("\u627E\u4E0D\u5230\u8FD9\u4EFD\u6307\u5F15", "guides")}<main class="surface"><p class="empty-card">\u8BF7\u8FD4\u56DE\u5217\u8868\uFF0C\u9009\u62E9\u60A8\u8981\u505A\u7684\u4E8B\u3002</p></main>`;
  const run = readGuideRun(guide, state.guideRuns[guide.id]);
  const header = pageHeader(guide.title, "guides");
  const footer = `<nav class="guide-footer" aria-label="\u6307\u5F15\u64CD\u4F5C">${run.history.length ? '<button class="button quiet" type="button" data-action="guide-previous">\u4E0A\u4E00\u6B65</button>' : ""}<button class="button quiet" type="button" data-action="guide-start-over">\u91CD\u65B0\u9009\u753B\u9762</button></nav>`;
  if (run.screen === "pick") {
    return `${header}<main class="surface guide-screen"><h2 id="guide-heading" tabindex="-1">\u60A8\u73B0\u5728\u770B\u5230\u4EC0\u4E48\uFF1F</h2>
      <p class="device-help">\u9009\u4E00\u4E2A\u4E0E\u60A8\u773C\u524D\u6700\u63A5\u8FD1\u7684\u753B\u9762\u3002</p>
      <div class="stack">${guide.starts.map((key) => {
      const step2 = guide.steps[key];
      return `<button class="guide-choice" type="button" data-action="guide-start" data-step="${key}"><span><strong>${escapeHtml(step2.title)}</strong><span>${escapeHtml(step2.preview.labels.join(" \xB7 "))}</span></span>${icon("right", 21)}</button>`;
    }).join("")}<button class="button quiet wide" type="button" data-action="guide-help">\u90FD\u4E0D\u4E00\u6837\uFF0C\u627E\u4EBA\u5E2E\u5FD9</button></div>
      <a class="button quiet guide-capture" href="#/capture/${guide.id}">${icon("camera", 22)}\u62CD\u7167\u95EE\u4E00\u95EE</a>
      <p class="device-help guide-caption">\u793A\u4F8B\u91CC\u6CA1\u6709\u771F\u5B9E\u53D6\u4EF6\u7801\u3001\u6237\u53F7\u6216\u4EA4\u6613\u3002</p>
    </main>`;
  }
  if (run.screen === "help" || run.screen === "done") {
    const complete = run.screen === "done";
    return `${header}<main class="surface guide-screen">
      <h2 id="guide-heading" tabindex="-1">${complete ? guide.success : "\u53EF\u4EE5\u627E\u4EBA\u5E2E\u60A8\u770B\u770B"}</h2>
      ${complete ? '<a class="button wide" href="#/guides">\u8FD4\u56DE\u300C\u8DDF\u7740\u505A\u300D</a>' : `${run.failed >= 2 ? '<p class="guide-notice">\u67DC\u95E8\u8BD5\u4E86\u4E24\u6B21\u4ECD\u672A\u6253\u5F00\uFF0C\u53EF\u4EE5\u8BF7\u5DE5\u4F5C\u4EBA\u5458\u67E5\u770B\u3002</p>' : ""}
          <ol class="guide-help-list">${guide.help.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ol>
          <button class="button quiet" type="button" data-action="read" data-text="${escapeHtml(guide.help.join(""))}">${icon("sound", 23)}\u542C\u6C42\u52A9\u529E\u6CD5</button>`}
      ${footer}
    </main>`;
  }
  const step = guide.steps[run.screen];
  return `${header}<main class="surface guide-screen">
    <p class="guide-current">\u5F53\u524D\u4F4D\u7F6E \xB7 ${escapeHtml(step.title)}</p>
    <h2 class="guide-instruction" id="guide-heading" tabindex="-1">${escapeHtml(step.text)}</h2>
    <button class="button quiet listen-step" type="button" data-action="read" data-text="${escapeHtml(step.text)}">${icon("sound", 23)}\u542C\u8FD9\u4E00\u6B65</button>
    ${guidePicture(step.preview)}
    <h3>\u64CD\u4F5C\u540E\u770B\u5230\u4EC0\u4E48\uFF1F</h3>
    <div class="stack guide-options">${step.options.map((option, index) => `<button class="button ${index ? "quiet" : ""}" type="button" data-action="guide-answer" data-index="${index}">${escapeHtml(option.label)}${icon("right", 19)}</button>`).join("")}</div>
    ${footer}
  </main>`;
}
function guideInteraction(action, button2) {
  const guide = currentGuide();
  if (!guide) return;
  let run = readGuideRun(guide, state.guideRuns[guide.id]);
  switch (action) {
    case "guide-start":
      if (run.screen === "pick" && guide.starts.includes(button2.dataset.step)) run = setGuideScreen(guide, run, button2.dataset.step);
      break;
    case "guide-answer": {
      const option = guide.steps[run.screen]?.options[Number(button2.dataset.index)];
      if (option) run = setGuideScreen(guide, run, option.to, option.countFailure);
      break;
    }
    case "guide-help":
      run = setGuideScreen(guide, run, "help");
      break;
    case "guide-previous":
      run = previousGuideScreen(run);
      break;
    case "guide-start-over":
      run = readGuideRun(guide, null);
      break;
  }
  state.guideRuns[guide.id] = run;
  save();
  render();
  window.scrollTo(0, 0);
  document.querySelector("#guide-heading")?.focus({ preventScroll: true });
}
function connectionsScreen() {
  if (account.guest) return `${pageHeader("\u5BB6\u5EAD\u8FDE\u63A5", "family")}<main class="surface connections">
    <p class="empty-card">${cloudSite2 ? "\u8BF7\u5728\u4E91\u7AEF\u7248\u767B\u5F55\u540E\u8FDE\u63A5\u5BB6\u4EBA\uFF0C\u5206\u4EAB\u95EE\u9898\u548C\u8BBE\u5907\u5361\u3002" : "\u767B\u5F55\u540E\u53EF\u4EE5\u8FDE\u63A5\u5BB6\u4EBA\uFF0C\u5206\u4EAB\u95EE\u9898\u548C\u8BBE\u5907\u5361\u3002"}</p>
    ${loginAction("\u7528\u90AE\u7BB1\u767B\u5F55", "button", "connections")}
  </main>`;
  const links = family?.links ?? [];
  const items = family?.items ?? [];
  return `${pageHeader("\u5BB6\u5EAD\u8FDE\u63A5", "family")}<main class="surface connections-screen">
    <p class="device-help">\u7528\u9080\u8BF7\u7801\u8FDE\u63A5\u4E0D\u540C\u8D26\u6237\u3002\u8FDE\u63A5\u540E\uFF0C\u5728\u300C\u5206\u4EAB\u8BBE\u7F6E\u300D\u9009\u62E9\u5BF9\u65B9\u80FD\u770B\u5230\u7684\u5185\u5BB9\u3002</p>
    <div class="connection-actions">
      <button class="button" type="button" data-action="invite-family">\u751F\u6210\u9080\u8BF7\u7801</button>
      <button class="button quiet" type="button" data-action="join-family">\u8F93\u5165\u5BB6\u4EBA\u7684\u9080\u8BF7\u7801</button>
    </div>
    ${invite ? `<div class="connection-code"><label for="invite-code">\u9080\u8BF7\u7801 \xB7 24 \u5C0F\u65F6\u6709\u6548</label><input id="invite-code" readonly value="${escapeHtml(invite)}"><button class="button quiet" type="button" data-action="copy-invite">\u590D\u5236\u9080\u8BF7\u7801</button></div>` : ""}
    ${familyError ? `<p role="alert" class="form-error">${escapeHtml(familyError)}</p><button class="button quiet" type="button" data-action="reload-family">\u91CD\u65B0\u8BFB\u53D6</button>` : ""}
    <section><h2>\u5DF2\u8FDE\u63A5\u7684\u5BB6\u4EBA</h2>
      ${links.length ? `<div class="shared-list">${links.map((person) => `<div class="connection-row family-person"><strong>${escapeHtml(person.name)}</strong><div class="section-actions">
        <button type="button" class="text-button" data-action="family-permission" data-id="${escapeHtml(person.id)}" aria-label="${escapeHtml(person.name)}\u7684\u5206\u4EAB\u8BBE\u7F6E">\u5206\u4EAB\u8BBE\u7F6E</button>
        <button type="button" class="text-button" data-action="remove-family" data-id="${escapeHtml(person.id)}">\u89E3\u9664\u8FDE\u63A5</button></div></div>`).join("")}</div>` : `<p class="empty-card">${familyBusy ? "\u6B63\u5728\u8BFB\u53D6\u2026" : "\u8FD8\u6CA1\u6709\u8FDE\u63A5\u5BB6\u4EBA\u3002"}</p>`}
    </section>
    <section><h2>\u5BB6\u5EAD\u5206\u4EAB</h2>
      ${items.length ? `<div class="shared-list">${items.map((item) => `<article class="connection-row connection-share"><div><strong>${escapeHtml(item.payload.title)}</strong><span>${item.direction === "sent" ? "\u53D1\u7ED9" : "\u6765\u81EA"} ${escapeHtml(item.name)} \xB7 ${formatWhen(item.at)}</span></div>
        ${item.kind === "device" ? `<a class="button quiet" href="#/shared-device/${item.id}">\u770B\u6B65\u9AA4</a>` : ""}
        ${item.direction === "sent" ? `<button type="button" class="text-button" data-action="recall-share" data-id="${item.id}">\u64A4\u56DE</button>` : ""}
      </article>`).join("")}</div>` : '<p class="empty-card">\u4E3B\u52A8\u5206\u4EAB\u7684\u95EE\u9898\u548C\u8BBE\u5907\u5361\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002</p>'}
    </section>
    <div class="connection-account"><button class="text-button" type="button" data-action="reload-family">\u5237\u65B0\u5BB6\u5EAD\u5206\u4EAB</button><button class="text-button" data-action="account-signout" type="button">\u9000\u51FA\u767B\u5F55</button></div>
  </main>`;
}
function familyOverviewScreen() {
  const title = pageHeader("\u957F\u8F88\u804A\u5929\u548C\u8FD1\u51B5", "family");
  if (account.guest) return `${title}<main class="surface connections-screen"><p class="empty-card">\u767B\u5F55\u5E76\u8FDE\u63A5\u957F\u8F88\u540E\uFF0C\u53EF\u4EE5\u67E5\u770B\u5BF9\u65B9\u540C\u610F\u5206\u4EAB\u7684\u5185\u5BB9\u3002</p>${loginAction("\u7528\u90AE\u7BB1\u767B\u5F55", "button", "family-overview")}</main>`;
  const links = family?.links ?? [];
  const id = routeDeviceId();
  const data = overview?.id === id ? overview : null;
  const seen = data?.activity?.lastSeen;
  const days = seen ? inactiveDays(seen) : 0;
  return `${title}<main class="surface connections-screen family-overview">
    ${links.length ? `<section><h2>\u9009\u62E9\u4E00\u4F4D\u5BB6\u4EBA</h2><div class="connection-actions">${links.map((person) => `<a class="button ${id === person.id ? "" : "quiet"}" href="#/family-overview/${encodeURIComponent(person.id)}" ${id === person.id ? 'aria-current="page"' : ""}>${escapeHtml(person.name)}</a>`).join("")}</div></section>` : ""}
    ${!id ? familyError ? `<p class="form-error" role="alert">${escapeHtml(familyError)}</p><button class="button quiet" data-action="reload-family" type="button">\u91CD\u65B0\u8BFB\u53D6</button>` : !links.length ? familyBusy ? '<p class="empty-card" role="status">\u6B63\u5728\u8BFB\u53D6\u5BB6\u4EBA\u2026</p>' : '<p class="empty-card">\u5148\u901A\u8FC7\u9080\u8BF7\u7801\u8FDE\u63A5\u957F\u8F88\u3002</p><a class="button" href="#/connections">\u53BB\u8FDE\u63A5\u5BB6\u4EBA</a>' : '<p class="empty-card">\u9009\u62E9\u5BB6\u4EBA\u540E\u53EF\u67E5\u770B\u5BF9\u65B9\u5206\u4EAB\u7684\u5185\u5BB9\u3002</p>' : data?.error ? `<p class="form-error" role="alert">${escapeHtml(data.error)}</p><button class="button quiet" type="button" data-action="reload-overview">\u91CD\u65B0\u8BFB\u53D6</button>` : !data || data.loading ? '<p class="empty-card" role="status">\u6B63\u5728\u8BFB\u53D6\u957F\u8F88\u5206\u4EAB\u7684\u5185\u5BB9\u2026</p>' : `<div class="section-heading"><h2>${escapeHtml(data.name)}\u5206\u4EAB\u7684\u5185\u5BB9</h2><button class="text-button" type="button" data-action="reload-overview">\u5237\u65B0</button></div>
        <section class="overview-card"><h3>\u6700\u8FD1\u4F7F\u7528</h3>
          <p>${data.activity ? seen ? `\u4E0A\u6B21\u4F7F\u7528\u79BE\u4F34 ${formatWhen(seen)}` : "\u6682\u65F6\u8FD8\u6CA1\u6709\u4F7F\u7528\u8BB0\u5F55\u3002" : "\u8FD9\u4F4D\u5BB6\u4EBA\u8FD8\u672A\u5206\u4EAB\u4F7F\u7528\u65F6\u95F4\u3002"}</p>
          ${seen && days >= data.activity.quietDays ? `<p>\u5DF2 ${days} \u5929\u672A\u6253\u5F00\u79BE\u4F34\u3002\u65B9\u4FBF\u65F6\u53EF\u4EE5\u6253\u7535\u8BDD\u95EE\u5019\u3002</p>` : ""}</section>
        <section class="overview-card"><h3>\u6700\u8FD1\u804A\u5929\u548C\u95EE\u7B54</h3>${data.chats ? [["ask", "\u751F\u6D3B\u95EE\u7B54"], ["chat", "\u804A\u804A\u5929"]].map(([mode, label]) => `<div class="overview-conversation"><h4>${label}</h4>
          ${data.chats[mode].length ? `<ul class="record-list">${data.chats[mode].map((message) => `<li><strong>${message.role === "user" ? "\u957F\u8F88" : "\u79BE\u4F34"}</strong>${message.at ? `<time datetime="${new Date(message.at).toISOString()}">${formatWhen(message.at)}</time>` : ""}<p>${escapeHtml(message.text)}</p></li>`).join("")}</ul>` : "<p>\u6682\u65E0\u804A\u5929\u8BB0\u5F55\u3002</p>"}</div>`).join("") : "<p>\u8FD9\u4F4D\u5BB6\u4EBA\u8FD8\u672A\u5206\u4EAB\u804A\u5929\u5185\u5BB9\u3002\u957F\u8F88\u53EF\u5728\u300C\u6211\u7684 \u2192 \u548C\u5BB6\u4EBA\u5206\u4EAB\u300D\u91CC\u5F00\u542F\u3002</p>"}</section>`}
  </main>`;
}
async function loadOverview() {
  const id = routeDeviceId();
  if (!id || account?.guest || route !== "family-overview") return;
  const active = account;
  const current = { id, loading: true };
  overview = current;
  render();
  try {
    Object.assign(current, await api(`/api/family/overview/${encodeURIComponent(id)}`));
  } catch (error) {
    current.error = error.message;
  } finally {
    current.loading = false;
    if (active === account && overview === current && route === "family-overview" && routeDeviceId() === id) render();
  }
}
function showFamilyPermission(id) {
  const person = family?.links.find((item) => item.id === id);
  if (!person) return;
  const permission = familyPermission(state, person);
  showDialog(`\u5206\u4EAB\u7ED9${escapeHtml(person.name)}`, `<form data-form="family-permission" data-id="${escapeHtml(id)}">
    <label class="check-input"><input type="checkbox" name="activity" ${permission?.activity ? "checked" : ""}><span>\u8BA9\u5BF9\u65B9\u67E5\u770B\u6211\u6700\u8FD1\u4F7F\u7528\u79BE\u4F34\u7684\u65F6\u95F4</span></label>
    <label class="check-input"><input type="checkbox" name="chats" ${permission?.chats ? "checked" : ""}><span>\u8BA9\u5BF9\u65B9\u67E5\u770B\u6211\u6700\u8FD1\u7684\u804A\u5929\u548C\u95EE\u7B54\u6587\u5B57</span></label>
    <p class="form-help">\u8BF7\u7531\u672C\u4EBA\u9009\u62E9\u3002\u5F00\u542F\u540E\uFF0C\u5BF9\u65B9\u53EF\u770B\u5230\u6BCF\u4E2A\u804A\u5929\u9875\u6700\u8FD1 12 \u6761\u6587\u5B57\uFF0C\u53D6\u6D88\u52FE\u9009\u5E76\u4FDD\u5B58\u5373\u53EF\u5173\u95ED\u3002</p>
    <p class="form-error" role="alert"></p><button class="button wide" type="submit">\u4FDD\u5B58\u5206\u4EAB\u8BBE\u7F6E</button>
  </form>`);
}
async function saveFamilyPermission(form, data) {
  const person = family?.links.find((item) => item.id === form.dataset.id);
  if (!person) return;
  const active = account;
  const button2 = form.querySelector("[type=submit]");
  const activity = data.has("activity");
  const chats = data.has("chats");
  state.familyVisibility = state.familyVisibility.filter((item) => item.id !== person.id);
  if (activity || chats) state.familyVisibility.push({ id: person.id, linkedAt: person.linkedAt, activity, chats });
  if (activity && document.visibilityState === "visible") state.lastSeen = Date.now();
  const notified = save();
  button2.disabled = true;
  try {
    if (!notified || !await flushCloud()) throw new Error("\u8BBE\u7F6E\u8FD8\u6CA1\u540C\u6B65\uFF0C\u8BF7\u8FDE\u63A5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002");
    if (account !== active) return;
    if (form.isConnected) dialog.close();
    render();
    notify("\u5206\u4EAB\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
  } catch (error) {
    form.querySelector(".form-error").textContent = error.message;
  } finally {
    button2.disabled = false;
  }
}
var familyLoad;
async function loadFamily() {
  if (account?.guest) return;
  const active = account;
  if (familyLoad) return familyLoad;
  const previous = family;
  familyBusy = true;
  familyError = "";
  familyLoad = api("/api/family").then(
    (data) => {
      if (account === active && family === previous) family = data;
    },
    (error) => {
      if (account === active) familyError = error.message;
    }
  ).finally(() => {
    if (account === active) {
      familyLoad = null;
      familyBusy = false;
    }
  });
  await familyLoad;
  if (account === active && familyPages.includes(route)) render();
}
function actionError(error) {
  const errorField = dialog.open && dialog.querySelector(".form-error");
  if (errorField) errorField.textContent = error.message;
  else notify(error.message);
}
function joinFamilyDialog() {
  showDialog("\u8F93\u5165\u5BB6\u4EBA\u7684\u9080\u8BF7\u7801", `<form data-form="join-family">
    <label for="join-code">\u5BB6\u4EBA\u53D1\u7ED9\u60A8\u7684\u9080\u8BF7\u7801</label><input id="join-code" name="code" required maxlength="35" autocomplete="off" spellcheck="false">
    <p class="form-help">\u8FDE\u63A5\u540E\uFF0C\u60A8\u4ECD\u7136\u53EF\u4EE5\u9009\u62E9\u6BCF\u6B21\u5206\u4EAB\u4EC0\u4E48\u3002</p><p class="form-error" role="alert"></p>
    <button class="button wide" type="submit">\u786E\u8BA4\u8FDE\u63A5</button></form>`);
}
async function openShareItem(kind, id) {
  if (account.guest) {
    showDialog("\u767B\u5F55\u540E\u5206\u4EAB", `<p class="form-help">${cloudSite2 ? "\u53EF\u4EE5\u5728\u4E91\u7AEF\u7248\u4E0E\u5BB6\u4EBA\u8FDE\u63A5\u5E76\u5206\u4EAB\u95EE\u9898\u6216\u8BBE\u5907\u5361\u3002" : "\u767B\u5F55\u540E\u53EF\u4EE5\u628A\u8FD9\u6761\u5185\u5BB9\u5206\u4EAB\u7ED9\u5DF2\u8FDE\u63A5\u7684\u5BB6\u4EBA\u3002"}</p>${loginAction("\u7528\u90AE\u7BB1\u767B\u5F55", "button wide")}`);
    return;
  }
  const item = kind === "device" ? state.deviceGuides.find((entry) => entry.id === id) : state.messages.ask.find((entry) => entry.role === "user" && entry.id === id);
  if (!item) return;
  const startRoute = location.hash;
  await loadFamily();
  if (startRoute !== location.hash) return;
  if (familyError) {
    notify(familyError);
    return;
  }
  if (!family?.links.length) {
    showDialog("\u5148\u8FDE\u63A5\u4E00\u4F4D\u5BB6\u4EBA", '<p class="form-help">\u5EFA\u7ACB\u8FDE\u63A5\u540E\uFF0C\u5C31\u53EF\u4EE5\u628A\u8FD9\u4E00\u6761\u5185\u5BB9\u5206\u4EAB\u7ED9\u5BF9\u65B9\u3002</p><a class="button wide" href="#/connections">\u53BB\u5BB6\u5EAD\u8FDE\u63A5</a>');
    return;
  }
  showDialog("\u5206\u4EAB\u7ED9\u5BB6\u4EBA", `<p class="share-preview">${escapeHtml(kind === "device" ? item.name : item.text)}</p>
    <form data-form="share-family" data-kind="${kind}" data-id="${id}">
    <label for="share-recipient">\u5206\u4EAB\u7ED9\u8C01\uFF1F</label><select id="share-recipient" name="recipient" required>
      <option value="">\u9009\u62E9\u4E00\u4F4D\u5BB6\u4EBA</option>${family.links.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("")}
    </select><p class="form-help">\u5BF9\u65B9\u53EF\u4EE5\u770B\u5230\u8FD9\u4E00\u6B21\u5206\u4EAB\u3002\u60A8\u53EF\u4EE5\u5728\u5BB6\u5EAD\u8FDE\u63A5\u91CC\u64A4\u56DE\u3002</p><p class="form-error" role="alert"></p>
    <button class="button wide" type="submit">\u786E\u8BA4\u5206\u4EAB</button></form>`);
}
async function familyForm(form, data) {
  const button2 = form.querySelector('[type="submit"]');
  button2.disabled = true;
  try {
    const joining = form.dataset.form === "join-family";
    if (!joining && !await flushCloud()) throw new Error("\u8FD9\u6761\u5185\u5BB9\u8FD8\u6CA1\u6709\u540C\u6B65\uFF0C\u8BF7\u5148\u5B8C\u6210\u4E91\u7AEF\u4FDD\u5B58\u3002");
    family = joining ? await api("/api/family/join", "POST", { code: data.get("code") }) : await api("/api/family/share", "POST", { recipient: data.get("recipient"), kind: form.dataset.kind, itemId: form.dataset.id });
    dialog.close();
    if (route === "connections") render();
    notify(joining ? "\u5DF2\u7ECF\u8FDE\u63A5\u5BB6\u4EBA\u3002" : "\u5DF2\u5206\u4EAB\u7ED9\u6240\u9009\u5BB6\u4EBA\u3002");
  } catch (error) {
    actionError(error);
  } finally {
    button2.disabled = false;
  }
}
async function connectionAction(action, id, button2) {
  if (action === "reload-family") {
    await loadFamily();
    return;
  }
  if (action === "join-family") {
    joinFamilyDialog();
    return;
  }
  if (action === "remove-family" || action === "recall-share") {
    const removing = action === "remove-family";
    showDialog(removing ? "\u89E3\u9664\u5BB6\u5EAD\u8FDE\u63A5\uFF1F" : "\u64A4\u56DE\u8FD9\u6761\u5206\u4EAB\uFF1F", `<p class="form-help">${removing ? "\u89E3\u9664\u8FDE\u63A5\u540E\uFF0C\u53CC\u65B9\u5C06\u65E0\u6CD5\u518D\u67E5\u770B\u8FD9\u6BB5\u8FDE\u63A5\u91CC\u7684\u5206\u4EAB\u3002" : "\u64A4\u56DE\u540E\uFF0C\u5BF9\u65B9\u5C06\u65E0\u6CD5\u518D\u67E5\u770B\u8FD9\u6761\u5185\u5BB9\u3002"}</p>
      <div class="dialog-actions"><button type="button" class="button quiet" data-action="close">\u53D6\u6D88</button><button type="button" class="button danger" data-action="${removing ? "confirm-remove-family" : "confirm-recall-share"}" data-id="${id}">\u786E\u8BA4</button></div>`);
    return;
  }
  button2.disabled = true;
  try {
    if (action === "invite-family") {
      invite = (await api("/api/family/invite", "POST")).code;
      if (route === "connections") render();
    } else if (action === "copy-invite") {
      try {
        await navigator.clipboard.writeText(invite);
        notify("\u9080\u8BF7\u7801\u5DF2\u590D\u5236\u3002");
      } catch {
        document.querySelector("#invite-code")?.select();
        notify("\u8BF7\u9009\u62E9\u5E76\u590D\u5236\u9080\u8BF7\u7801\u3002");
      }
    } else {
      const kind = action === "confirm-remove-family" ? "link" : "share";
      family = await api(`/api/family/${kind}/${id}`, "DELETE");
      dialog.close();
      if (route === "connections") render();
      notify("\u64CD\u4F5C\u5B8C\u6210\u3002");
    }
  } catch (error) {
    actionError(error);
  } finally {
    button2.disabled = false;
  }
}
function cloudEntry(message = "", values = {}) {
  accountBar.hidden = true;
  const creating = formMode === "create";
  app.innerHTML = `<header class="topbar"><span class="brand">${icon("home", 40)}\u79BE\u4F34</span></header>
    <main class="surface cloud-entry entry-choice"><h1 id="screen-title" tabindex="-1">${formMode ? creating ? "\u521B\u5EFA\u79BE\u4F34\u8D26\u6237" : "\u7528\u90AE\u7BB1\u767B\u5F55" : "\u60A8\u7684\u751F\u6D3B\u5E2E\u624B"}</h1>
    ${formMode ? `<p>\u7528\u624B\u673A\u6216\u7535\u8111\u7684\u6307\u7EB9\u3001\u9762\u5BB9\u6216\u9501\u5C4F\u5BC6\u7801\u786E\u8BA4\u8EAB\u4EFD\u3002</p>
      <form class="sign-in-form" data-form="email-login">
        ${creating ? `<label for="login-name">\u600E\u4E48\u79F0\u547C\u60A8\uFF1F</label><input id="login-name" name="name" autocomplete="nickname" maxlength="40" value="${escapeHtml(values.name ?? "")}" required>` : ""}
        <label for="login-email">\u90AE\u7BB1</label><input id="login-email" name="email" type="email" inputmode="email" autocomplete="username" maxlength="254" value="${escapeHtml(values.email ?? "")}" required>
        <p class="form-error" role="alert">${escapeHtml(message)}</p>
        <button class="button" type="submit">${creating ? "\u786E\u8BA4\u8BBE\u5907\u5E76\u521B\u5EFA" : "\u786E\u8BA4\u8BBE\u5907\u5E76\u767B\u5F55"}</button>
      </form>
      <button class="text-button" data-action="${creating ? "login-existing" : "login-create"}" type="button">${creating ? "\u5DF2\u6709\u79BE\u4F34\u8D26\u6237\uFF1F\u767B\u5F55" : "\u7B2C\u4E00\u6B21\u4F7F\u7528\uFF1F\u521B\u5EFA\u8D26\u6237"}</button>` : `<p>\u5B66\u53D6\u5FEB\u9012\u3001\u67E5\u7535\u8D39\u3002\u9047\u5230\u4E0D\u4F1A\u6309\u7684\u952E\uFF0C\u62CD\u5F20\u7167\u7247\u95EE\u4E00\u95EE\u3002</p>
      ${message ? `<p class="form-error" role="alert">${escapeHtml(message)}</p>` : ""}
      <button class="button" type="button" data-action="continue-guest">\u4E0D\u767B\u5F55\uFF0C\u76F4\u63A5\u7528</button>
      <button class="button quiet" type="button" data-action="login-create">\u7528\u90AE\u7BB1\u7EE7\u7EED</button>
      <p class="form-help">\u8DF3\u8FC7\u540E\uFF0C\u63D0\u9192\u548C\u7167\u7247\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u3002</p>`}
    ${formMode ? '<button class="text-button" data-action="continue-guest" type="button">\u4E0D\u767B\u5F55\uFF0C\u76F4\u63A5\u7528</button>' : ""}
    ${account ? '<button class="text-button" type="button" data-action="close-login">\u8FD4\u56DE</button>' : ""}
    <details class="old-account"><summary>\u627E\u56DE\u65E7\u7248\u8BB0\u5F55</summary><a href="${legacySignIn}" target="_top">\u6253\u5F00\u65E7\u7248\u8D26\u6237</a></details>
    </main>`;
}
async function startCloud(mode) {
  const switching = Boolean(authMode && mode !== authMode);
  const result = await connectCloud(updateCloudStatus, mode);
  electricity.reset();
  phoneGuide.reset();
  account = result.user;
  authMode = mode;
  account = mode === "legacy" ? { ...account, legacy: true } : account;
  state = { ...newState(), ...result.state };
  family = null;
  familyLoad = null;
  familyError = "";
  familyBusy = false;
  overview = null;
  invite = null;
  formMode = "";
  authPanel = false;
  accessPreference(mode);
  if (location.hash === "#/legacy") {
    history.replaceState(null, "", "#/connections");
    route = readRoute();
  } else if (switching) {
    const destination = { record: "records", "shared-device": "connections", "device-editor": "family-devices" }[route];
    if (destination) {
      history.replaceState(null, "", `#/${destination}`);
      route = readRoute();
    }
  }
  updateCloudStatus("saved");
  enterScreen(true);
}
async function boot() {
  let locked = false;
  try {
    if (cloudSite2) {
      await startCloud("guest");
      return;
    }
    const choice = accessPreference();
    const old = location.hash === "#/legacy" || choice === "legacy";
    const mode = old ? "legacy" : choice === "guest" ? "guest" : (await api("/api/auth/session")).signedIn ? "account" : "";
    if (authBusy || !old && (authPanel || account)) return;
    authBusy = locked = true;
    if (mode) await startCloud(mode);
  } catch (error) {
    if (locked || !authPanel && !account) cloudEntry(error.status === 401 ? "" : error.message);
  } finally {
    if (locked) authBusy = false;
  }
}
async function flushBeforeSwitch() {
  if (unsyncedCloud() && !await flushCloud() && cloudStatus !== "auth") throw new Error("\u8FD8\u6709\u5185\u5BB9\u6CA1\u6709\u4FDD\u5B58\uFF0C\u8BF7\u5148\u91CD\u8BD5\u4FDD\u5B58\u3002");
}
async function chooseAccess(action, button2) {
  if (authBusy) return;
  if (action === "show-login" || action === "login-create" || action === "login-existing") {
    const values = { name: document.querySelector("#login-name")?.value, email: document.querySelector("#login-email")?.value };
    if (dialog.open) dialog.close();
    authPanel = true;
    records.stopCamera();
    formMode = action === "login-existing" ? "login" : "create";
    cloudEntry("", values);
    document.querySelector("#screen-title")?.focus();
    return;
  }
  if (action === "close-login") {
    authPanel = false;
    updateCloudStatus(cloudStatus);
    enterScreen(true);
    return;
  }
  authBusy = true;
  button2.disabled = true;
  try {
    if (action === "continue-guest") {
      await flushBeforeSwitch();
      await startCloud("guest");
    } else if (action === "account-signout") {
      await flushBeforeSwitch();
      if (authMode === "account") await api("/api/auth/logout", "POST");
      electricity.reset();
      phoneGuide.reset();
      accessPreference("");
      account = null;
      authMode = "";
      authPanel = true;
      records.close();
      formMode = "";
      cloudEntry();
    }
  } catch (error) {
    notify(error.message);
  } finally {
    authBusy = false;
    button2.disabled = false;
  }
}
async function submitEmailLogin(form, data) {
  if (authBusy) return;
  authBusy = true;
  const button2 = form.querySelector('button[type="submit"]');
  const errorField = form.querySelector(".form-error");
  button2.disabled = true;
  errorField.textContent = "";
  try {
    await flushBeforeSwitch();
    await signInWithDevice(api, formMode, { email: data.get("email"), name: data.get("name") });
    await startCloud("account");
  } catch (error) {
    errorField.textContent = error.message;
  } finally {
    authBusy = false;
    button2.disabled = false;
  }
}
function render() {
  if (authPanel) return;
  const screens = {
    elder: elderHome,
    family: familyHome,
    chat: () => chatScreen("chat"),
    ask: () => chatScreen("ask"),
    "family-chat": () => chatScreen("family-chat"),
    reminders: () => remindersScreen("elder"),
    "family-reminders": () => remindersScreen("family"),
    devices: devicesScreen,
    device: deviceScreen,
    "family-devices": familyDevicesScreen,
    "family-shortcuts": familyShortcutsScreen,
    "device-editor": deviceEditorScreen,
    guides: guidesScreen,
    guide: guideScreen,
    connections: connectionsScreen,
    "shared-device": deviceScreen,
    "home-shortcuts": homeShortcutsScreen,
    "family-overview": familyOverviewScreen,
    capture: records.captureScreen,
    records: records.recordsScreen,
    record: records.recordScreen,
    "assistant-settings": assistantSettings,
    mine: mineScreen
  };
  const screen = electricityRoutes.includes(route) ? electricity.screen : screens[route];
  app.innerHTML = screen() + bottomNav();
}
function showDialog(title, body) {
  if (!dialog.open) returnFocus = document.activeElement;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.innerHTML = `<div class="dialog-body"><div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" type="button" data-action="close" aria-label="\u5173\u95ED">${icon("close")}</button></div>${body}</div>`;
  if (!dialog.open) dialog.showModal();
}
function draftReminder(owner, item = null, suggested = null, draftId = "") {
  const defaultTime = new Date(Date.now() + 60 * 6e4);
  const value = item ?? suggested;
  const stamp = value?.at && (item || value.at > Date.now()) ? value.at : defaultTime.getTime();
  showDialog(item ? "\u7BA1\u7406\u63D0\u9192" : "\u65B0\u5EFA\u63D0\u9192", `<form data-form="reminder" data-owner="${owner}" data-id="${item?.id ?? draftId}" data-editing="${Boolean(item)}">
    ${item ? "" : `<label for="reminder-sentence">\u4E5F\u53EF\u4EE5\u8BF4\u4E00\u53E5\u8BDD</label><div class="sentence-row"><button class="icon-button mic" type="button" data-action="voice" data-target="reminder-sentence" aria-label="\u7528\u8BED\u97F3\u8BF4\u63D0\u9192">${icon("mic")}</button><input id="reminder-sentence" name="sentence" placeholder="\u5982\uFF1A\u660E\u65E9\u516B\u70B9\u63D0\u9192\u6211\u4E70\u83DC" maxlength="150"><button class="button quiet" type="button" data-action="parse">\u586B\u8FDB\u53BB</button></div>`}
    <label for="reminder-title">\u8981\u63D0\u9192\u4EC0\u4E48\uFF1F</label><input id="reminder-title" name="title" value="${escapeHtml(value?.title ?? "")}" maxlength="80" placeholder="\u6BD4\u5982\uFF1A\u4E0B\u697C\u6563\u6B65" required ${item ? "" : "autofocus"}>
    <div class="form-columns"><div><label for="reminder-date">\u65E5\u671F</label><input id="reminder-date" name="date" type="date" value="${localDate(stamp)}" required></div><div><label for="reminder-time">\u65F6\u95F4</label><input id="reminder-time" name="time" type="time" value="${localTime(stamp)}" required></div></div>
    <label for="reminder-repeat">\u91CD\u590D</label><select id="reminder-repeat" name="repeat">${Object.entries(repeats).map(([key, label]) => `<option value="${key}" ${key === value?.repeat ? "selected" : ""}>${label}</option>`).join("")}</select>
    <p class="form-help">\u8FD9\u91CC\u4F1A\u5728\u9875\u9762\u6253\u5F00\u65F6\u63D0\u9192\uFF0C\u4E5F\u53EF\u4EE5\u4FDD\u5B58\u5230\u624B\u673A\u65E5\u5386\u3002</p>
    <p class="form-error" role="alert"></p><button class="button wide" type="submit">\u4FDD\u5B58\u63D0\u9192</button>
    ${item ? `<div class="dialog-actions"><button class="button quiet" type="button" data-action="complete" data-id="${item.id}">${item.repeat && item.repeat !== "never" ? "\u5B8C\u6210\u672C\u6B21" : item.done ? "\u6062\u590D\u5F85\u529E" : "\u6807\u4E3A\u5B8C\u6210"}</button><button class="button quiet" type="button" data-action="calendar" data-id="${item.id}">\u4FDD\u5B58\u5230\u65E5\u5386</button><button class="button danger" type="button" data-action="remove-reminder" data-id="${item.id}">\u5220\u9664\u63D0\u9192</button></div>` : ""}</form>`);
}
function showCare() {
  showDialog("\u5173\u6000\u8BBE\u7F6E", `<form data-form="care">
    <label class="check-input"><input type="checkbox" name="monitoring" ${state.monitoring ? "checked" : ""}><span>\u957F\u8F88\u672C\u4EBA\u540C\u610F\u663E\u793A\u6700\u8FD1\u4F7F\u7528\u65F6\u95F4\u53CA\u672A\u4F7F\u7528\u63D0\u9192</span></label>
    <label for="quiet-days">\u51E0\u5929\u6CA1\u6253\u5F00\u957F\u8F88\u7AEF\u540E\u63D0\u9192</label><select id="quiet-days" name="days">${[1, 2, 3, 5, 7].map((number) => `<option value="${number}" ${state.quietDays === number ? "selected" : ""}>${number} \u5929</option>`).join("")}</select>
    <p class="form-help">\u8FD9\u6761\u63D0\u793A\u4F1A\u51FA\u73B0\u5728\u672C\u673A\u5BB6\u5C5E\u7AEF\u3002\u770B\u5230\u63D0\u9192\u65F6\uFF0C\u53EF\u4EE5\u5148\u6253\u4E2A\u7535\u8BDD\u95EE\u5019\u3002</p><button class="button wide" type="submit">\u4FDD\u5B58\u8BBE\u7F6E</button>
    <button class="button quiet wide" type="button" data-action="demo-care">${demoLastSeen ? "\u7ED3\u675F\u63D0\u9192\u6F14\u793A" : "\u9884\u89C8\u672A\u4F7F\u7528\u63D0\u9192"}</button></form>`);
}
function assistantSettings() {
  const origin = routeDeviceId();
  const back = ["ask", "chat", "elder", "mine"].includes(origin) ? origin : "ask";
  return `${pageHeader("\u9009\u62E9\u52A9\u624B", back)}<main class="surface assistant-settings">
    <form data-form="persona">
      <fieldset><legend>\u56DE\u590D\u98CE\u683C</legend><div class="persona-options">${Object.entries(personas).map(([name, info], i) => `
        <label class="option-card"><input type="radio" name="persona" value="${name}" ${state.persona === name ? "checked" : ""} required>
          <span class="feature-icon tone-${["blue", "mint", "lilac"][i]}">${icon("chat", 23)}</span><strong>${name}</strong><span>${info.label}</span>
        </label>`).join("")}</div></fieldset>
      <section class="feature-banner voice-banner">
        <div class="banner-copy"><p class="persona-preview" aria-live="polite">${personas[state.persona].preview}</p>
          <button class="button quiet" type="button" data-action="preview-persona">${icon("sound", 21)}\u8BD5\u542C</button></div>
        <img src="./assets/voice-card.webp" alt="" width="480" height="480">
      </section>
      <fieldset><legend>\u6717\u8BFB\u8BED\u901F</legend><div class="rate-options">${Object.entries(speechRates).map(([rate, item]) => `
        <label class="option-card"><input type="radio" name="speech-rate" value="${rate}" ${rate === state.speechRate ? "checked" : ""} required><span>${item.label}</span></label>`).join("")}
      </div></fieldset>
      <div class="interest-field"><label for="interests">\u559C\u6B22\u804A\u7684\u8BDD\u9898\uFF08\u9009\u586B\uFF09</label><input id="interests" name="interests" placeholder="\u6BD4\u5982\uFF1A\u79CD\u82B1\u3001\u505A\u996D\u3001\u542C\u620F" value="${escapeHtml(state.interests)}" maxlength="80"></div>
      <button class="button wide" type="submit">\u4FDD\u5B58\u52A9\u624B\u8BBE\u7F6E</button>
    </form>
  </main>`;
}
function showContact() {
  showDialog("\u8BBE\u7F6E\u5BB6\u4EBA\u7535\u8BDD", `<form data-form="contact"><label for="contact-name">\u600E\u4E48\u79F0\u547C\uFF1F</label><input id="contact-name" name="name" maxlength="18" value="${escapeHtml(state.contactName)}" required><label for="contact-phone">\u7535\u8BDD\u53F7\u7801</label><input id="contact-phone" name="phone" type="tel" inputmode="tel" maxlength="24" value="${escapeHtml(state.phone)}" placeholder="\u8F93\u5165\u8981\u8054\u7CFB\u7684\u7535\u8BDD\u53F7\u7801" required><p class="form-error" role="alert"></p><button class="button wide" type="submit">\u4FDD\u5B58\u53F7\u7801</button></form>`);
}
function setSentence(text, form) {
  const draft = parseReminder(text);
  const error = form.querySelector(".form-error");
  if (!draft || draft.at <= Date.now()) {
    error.textContent = "\u8BF7\u8BF4\u6E05\u695A\u672A\u6765\u7684\u65F6\u95F4\uFF0C\u6BD4\u5982\u300C\u660E\u65E9\u516B\u70B9\u63D0\u9192\u6211\u4E70\u83DC\u300D\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u9009\u65E5\u671F\u548C\u65F6\u95F4\u3002";
    return;
  }
  error.textContent = "";
  if (draft.title) form.elements.title.value = draft.title.slice(0, 80);
  form.elements.date.value = localDate(draft.at);
  form.elements.time.value = localTime(draft.at);
  form.elements.repeat.value = draft.repeat;
  form.elements.title.focus();
}
async function sendMessage(text, retry = false) {
  const input = text.trim().slice(0, 300);
  if (!input) return;
  const mode = route;
  const active = account;
  const messages = state.messages[mode];
  if (!messages || pendingReplies.get(mode) === active) return;
  if (retry) {
    const failed = failedReplies.get(mode);
    if (failed?.account !== active || messages.at(-1)?.id !== failed.questionId) return;
  } else {
    messages.push({ id: crypto.randomUUID(), role: "user", text: input, at: Date.now() });
  }
  failedReplies.delete(mode);
  const questionId = messages.at(-1).id;
  const history2 = messages.slice(0, -1).filter(({ role, text: text2 }) => role !== "assistant" || !text2.startsWith("\u53EF\u4EE5\u5148\u53C2\u8003\u79BE\u4F34\u7684\u5185\u7F6E\u6307\u5F15\u3002\n")).slice(-6).map(({ role, text: text2 }) => ({ role, text: text2 }));
  const draft = /提醒|叫我|记得/.test(input) ? parseReminder(input) : null;
  const validDraft = draft?.title && draft.at > Date.now() ? draft : null;
  let reply;
  let offerPhoneGuide = false;
  let failure;
  if (validDraft) reply = `\u63D0\u9192\u5DF2\u7ECF\u586B\u597D\uFF1A${formatWhen(validDraft.at)}\uFF0C${validDraft.title}\u3002\u8BF7\u6838\u5BF9\u4E00\u4E0B\uFF0C\u518D\u4FDD\u5B58\u3002`;
  else {
    pendingReplies.set(mode, active);
    save();
    render();
    document.querySelector(".assistant-wait")?.scrollIntoView({ block: "nearest" });
    try {
      const result = await askAssistant({ text: input, history: history2, style: state.persona, ...mode === "ask" ? { suggestPhoneGuide: true } : {} });
      reply = result.answer;
      offerPhoneGuide = mode === "ask" && (result.offerPhoneGuide === true || Boolean(phoneTopic(input)));
      if (!reply) throw new Error("\u6CA1\u6709\u6536\u5230\u56DE\u590D\u3002");
    } catch (error) {
      failure = error;
    } finally {
      if (pendingReplies.get(mode) === active) pendingReplies.delete(mode);
    }
  }
  if (account !== active) return;
  if (failure) failedReplies.set(mode, { account: active, text: input, error: failure, questionId });
  else messages.push({
    id: crypto.randomUUID(),
    role: "assistant",
    text: reply,
    draft: validDraft,
    at: Date.now(),
    ...offerPhoneGuide ? { guideFor: questionId } : {}
  });
  if (messages.length > 150) messages.splice(0, messages.length - 150);
  noteActivity();
  save();
  if (route !== mode || authPanel) return;
  render();
  if (failure) {
    document.querySelector(".assistant-retry")?.scrollIntoView({ block: "nearest" });
    document.querySelector("[data-action=assistant-retry]")?.focus({ preventScroll: true });
  } else {
    document.querySelector(".message:last-child")?.scrollIntoView({ block: "nearest" });
    document.querySelector("#message-input")?.focus({ preventScroll: true });
  }
  if (state.listen) speak(failure?.message || reply, state.speechRate, false);
}
function startVoice(button2) {
  if (!voices) {
    notify("\u8FD9\u53F0\u6D4F\u89C8\u5668\u6682\u4E0D\u652F\u6301\u8BED\u97F3\u8F93\u5165\uFF0C\u60A8\u53EF\u4EE5\u6253\u5B57\u3002");
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }
  const target = document.getElementById(button2.dataset.target || "message-input");
  if (!target) return;
  const speech = new voices();
  speech.lang = "zh-CN";
  speech.onresult = (event) => {
    target.value = event.results[0][0].transcript.slice(0, target.maxLength);
    target.focus();
  };
  speech.onerror = () => notify("\u6CA1\u6709\u542C\u6E05\uFF0C\u60A8\u53EF\u4EE5\u91CD\u8BD5\u6216\u6253\u5B57\u3002");
  speech.onend = () => {
    button2.classList.remove("recording");
    button2.setAttribute("aria-pressed", "false");
    recognition = void 0;
  };
  try {
    speech.start();
    recognition = speech;
    button2.classList.add("recording");
    button2.setAttribute("aria-pressed", "true");
    notify("\u6B63\u5728\u542C\uFF0C\u8BF7\u8BF4\u8BDD\u3002");
  } catch {
    notify("\u6682\u65F6\u65E0\u6CD5\u5F00\u542F\u9EA6\u514B\u98CE\uFF0C\u60A8\u53EF\u4EE5\u6253\u5B57\u3002");
  }
}
function downloadReminder(item) {
  const url = URL.createObjectURL(new Blob([calendarFile(item)], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "\u79BE\u4F34\u63D0\u9192.ics";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
  notify("\u5DF2\u4E0B\u8F7D\u65E5\u5386\u6587\u4EF6\uFF0C\u8BF7\u7528\u65E5\u5386\u6253\u5F00\u5E76\u786E\u8BA4\u6DFB\u52A0\u3002");
}
function refresh(message) {
  const wasDialog = dialog.open;
  if (wasDialog) dialog.close();
  save();
  render();
  if (wasDialog) document.querySelector("#screen-title")?.focus({ preventScroll: true });
  if (message) notify(message);
}
function checkReminders() {
  if (authPanel || document.visibilityState !== "visible" || route === "capture") return;
  const owner = elderRoutes.includes(route) ? "elder" : "family";
  const due = state.reminders.find((item) => item.owner === owner && !item.done && !item.notified && item.at <= Date.now());
  if (!due || dialog.open) return;
  due.notified = true;
  save();
  showDialog("\u63D0\u9192\u65F6\u95F4\u5230\u4E86", `<p class="share-preview">${escapeHtml(due.title)}</p><div class="dialog-actions"><button class="button" type="button" data-action="complete" data-id="${due.id}">\u5DF2\u5B8C\u6210</button><button class="button quiet" type="button" data-action="close">\u6211\u77E5\u9053\u4E86</button></div>`);
  if (state.listen) speak(`\u63D0\u9192\u65F6\u95F4\u5230\u4E86\uFF1A${due.title}`, state.speechRate, false);
}
document.addEventListener("click", (event) => {
  const button2 = event.target.closest("[data-action]");
  if (!button2) return;
  const { action, id, text } = button2.dataset;
  if (["show-login", "login-create", "login-existing", "continue-guest", "close-login", "account-signout"].includes(action)) {
    void chooseAccess(action, button2);
    return;
  }
  if (!account) return;
  if (action === "open-phone-guide" && route === "ask") {
    const messages = state.messages.ask;
    const index = messages.findIndex((item2) => item2.role === "user" && item2.id === id);
    if (index !== -1) {
      stopSpeech();
      phoneGuide.open(messages[index], messages.slice(Math.max(0, index - 4), index).map(({ role, text: text2 }) => ({ role, text: text2 })));
    }
    return;
  }
  if (action.startsWith("phone-")) {
    phoneGuide.action(action.slice("phone-".length));
    return;
  }
  if (action.startsWith("electricity-")) {
    void electricity.action(action.slice("electricity-".length), button2, event);
    return;
  }
  if (action === "hide-electricity" || action === "restore-electricity") {
    void electricity.visibility(id, action === "hide-electricity", button2).catch(actionError);
    return;
  }
  if (recordRoutes.includes(route) && action.startsWith("capture-")) {
    void records.action(action, button2);
    return;
  }
  if (action === "remove-shortcut") {
    void removeShortcut(button2);
    return;
  }
  if (action === "restore-shortcut") {
    state.hiddenShortcuts = state.hiddenShortcuts.filter((key) => key !== button2.dataset.key);
    refresh("\u5DF2\u6062\u590D\u5230\u9996\u9875\u3002");
    return;
  }
  if (action === "family-permission") {
    showFamilyPermission(id);
    return;
  }
  if (action === "reload-overview") {
    void loadOverview();
    return;
  }
  if (action === "cloud-retry") {
    void flushCloud();
    return;
  }
  if (action === "cloud-refresh") {
    showDialog("\u8BFB\u53D6\u4E91\u7AEF\u7248\u672C\uFF1F", '<p class="form-help">\u672C\u9875\u5C1A\u672A\u540C\u6B65\u7684\u4FEE\u6539\u5C06\u88AB\u653E\u5F03\uFF0C\u8D26\u6237\u4F1A\u56DE\u5230\u4E91\u7AEF\u4FDD\u5B58\u7684\u7248\u672C\u3002</p><button class="button wide" data-action="cloud-refresh-confirm" type="button">\u8BFB\u53D6\u4E91\u7AEF\u7248\u672C</button>');
    return;
  }
  if (action === "cloud-refresh-confirm") {
    dialog.close();
    void startCloud(authMode).catch((error) => notify(error.message));
    return;
  }
  if (["invite-family", "join-family", "copy-invite", "reload-family", "remove-family", "recall-share", "confirm-remove-family", "confirm-recall-share"].includes(action)) {
    void connectionAction(action, id, button2);
    return;
  }
  if (route === "guide" && action.startsWith("guide-")) {
    guideInteraction(action, button2);
    return;
  }
  const item = state.reminders.find((reminder) => reminder.id === id);
  const owner = elderRoutes.includes(route) ? "elder" : "family";
  switch (action) {
    case "close":
      dialog.close();
      break;
    case "preview-persona": {
      const form = button2.form;
      speak(personas[form.elements.persona.value].preview, form.elements["speech-rate"].value);
      break;
    }
    case "care":
      showCare();
      break;
    case "contact":
      showContact();
      break;
    case "demo-care": {
      demoLastSeen = demoLastSeen ? null : Date.now() - state.quietDays * 864e5;
      dialog.close();
      render();
      break;
    }
    case "listen": {
      state.listen = !state.listen;
      button2.setAttribute("aria-pressed", String(state.listen));
      save();
      if (state.listen) speak("\u5DF2\u5F00\u542F\u542C\u56DE\u590D\u3002");
      else stopSpeech();
      break;
    }
    case "read":
      speak(text);
      break;
    case "device-key": {
      const device = selectedDevice();
      const step = device?.steps[deviceStep];
      if (!step) break;
      if (button2.dataset.key === step.key) moveLesson(deviceStep + 1);
      else document.querySelector("#device-feedback").textContent = `\u518D\u627E\u627E\u300C${device.controls.find(([key]) => key === step.key)[1]}\u300D\u3002`;
      break;
    }
    case "device-previous":
      moveLesson(deviceStep - 1);
      break;
    case "device-next":
      moveLesson(deviceStep + 1);
      break;
    case "device-restart":
      moveLesson(0);
      break;
    case "device-pin": {
      const bounds = button2.querySelector("img").getBoundingClientRect();
      const clampCoordinate = (value) => Math.max(0, Math.min(1, value));
      const pin = event.detail && bounds.width && bounds.height ? { x: clampCoordinate((event.clientX - bounds.left) / bounds.width), y: clampCoordinate((event.clientY - bounds.top) / bounds.height) } : deviceEditor.pin ?? { x: 0.5, y: 0.5 };
      updatePin(button2.form, pin);
      guideError("");
      break;
    }
    case "device-add-step": {
      if (addDeviceStep(button2.form)) button2.form.querySelector(".photo-target").focus();
      break;
    }
    case "device-edit-step": {
      const index = Number(button2.dataset.index);
      const step = deviceEditor.steps[index];
      deviceEditor.stepIndex = index;
      button2.form.elements.step.value = step.text;
      updatePin(button2.form, step.x === null ? null : step);
      button2.form.querySelector('[data-action="device-add-step"]').textContent = "\u66F4\u65B0\u8FD9\u4E00\u6B65";
      guideError("");
      button2.form.querySelector(".photo-target").focus();
      break;
    }
    case "device-remove-step": {
      const index = Number(button2.dataset.index);
      deviceEditor.steps.splice(index, 1);
      if (deviceEditor.stepIndex === index) {
        deviceEditor.stepIndex = null;
        button2.form.elements.step.value = "";
        updatePin(button2.form, null);
        button2.form.querySelector('[data-action="device-add-step"]').textContent = "\u6DFB\u52A0\u8FD9\u4E00\u6B65";
      } else if (deviceEditor.stepIndex !== null && deviceEditor.stepIndex > index) deviceEditor.stepIndex -= 1;
      button2.form.querySelector("#guide-steps").innerHTML = editorStepRows();
      guideError("");
      button2.form.querySelector('[data-action="device-add-step"]').focus();
      break;
    }
    case "device-delete": {
      showDialog("\u5220\u9664\u8FD9\u5F20\u8BBE\u5907\u5361\uFF1F", `<p class="share-preview">${escapeHtml(deviceEditor.name)}</p><div class="dialog-actions"><button type="button" class="button quiet" data-action="close">\u53D6\u6D88</button><button type="button" class="button danger" data-action="device-delete-confirmed">\u5220\u9664</button></div>`);
      break;
    }
    case "device-delete-confirmed": {
      const previous = state.deviceGuides;
      state.deviceGuides = previous.filter((entry) => entry.id !== deviceEditor.id);
      if (!save()) {
        state.deviceGuides = previous;
        dialog.close();
        guideError("\u6D4F\u89C8\u5668\u6682\u65F6\u65E0\u6CD5\u4FDD\u5B58\uFF0C\u8BBE\u5907\u5361\u6CA1\u6709\u5220\u9664\u3002");
        break;
      }
      dialog.close();
      location.hash = "#/family-devices";
      notify("\u8BBE\u5907\u5361\u5DF2\u5220\u9664\u3002");
      break;
    }
    case "voice":
      startVoice(button2);
      break;
    case "example":
      sendMessage(text);
      break;
    case "assistant-retry": {
      const failed = failedReplies.get(route);
      if (failed) void sendMessage(failed.text, true);
      break;
    }
    case "new-reminder":
      draftReminder(owner, null, owner === "family" ? { title: `\u7ED9${state.contactName}\u6253\u7535\u8BDD` } : null);
      break;
    case "reminder-example":
      draftReminder(owner, null, parseReminder(text));
      break;
    case "draft": {
      const message = state.messages[route]?.find((entry) => entry.id === id);
      if (message?.draft) draftReminder(owner, null, message.draft, id);
      break;
    }
    case "edit-reminder":
      if (item) draftReminder(owner, item);
      break;
    case "parse": {
      const form = button2.form;
      setSentence(form.elements.sentence.value, form);
      break;
    }
    case "complete":
      if (item) refresh(finishReminder(item));
      break;
    case "calendar":
      if (item) downloadReminder(item);
      break;
    case "remove-reminder": {
      if (item) showDialog("\u5220\u9664\u8FD9\u6761\u63D0\u9192\uFF1F", `<p class="share-preview">${escapeHtml(item.title)}</p><div class="dialog-actions"><button class="button quiet" type="button" data-action="edit-reminder" data-id="${id}">\u8FD4\u56DE</button><button class="button danger" type="button" data-action="delete-confirmed" data-id="${id}">\u5220\u9664</button></div>`);
      break;
    }
    case "delete-confirmed":
      state.reminders = state.reminders.filter((entry) => entry.id !== id);
      refresh("\u63D0\u9192\u5DF2\u5220\u9664\u3002");
      break;
    case "share":
      void openShareItem("question", id);
      break;
    case "share-device":
      void openShareItem("device", id);
      break;
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const data = new FormData(form);
  switch (form.dataset.form) {
    case "electricity-publish":
      void electricity.submit("publish");
      break;
    case "electricity-help":
      void electricity.submit("help");
      break;
    case "email-login":
      void submitEmailLogin(form, data);
      break;
    case "scene-record":
      if (event.submitter?.value === "analyze") void records.analyze(data);
      else void records.save(data);
      break;
    case "family-shortcut":
      void submitShortcut(form, data);
      break;
    case "family-permission":
      void saveFamilyPermission(form, data);
      break;
    case "join-family":
    case "share-family":
      void familyForm(form, data);
      break;
    case "device-guide":
      saveDeviceGuide(form);
      break;
    case "message":
      sendMessage(data.get("message"));
      break;
    case "persona":
      state.persona = data.get("persona");
      state.speechRate = data.get("speech-rate");
      state.interests = data.get("interests").trim();
      refresh("\u52A9\u624B\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
      break;
    case "care":
      state.monitoring = data.has("monitoring");
      state.quietDays = Number(data.get("days"));
      demoLastSeen = null;
      refresh("\u5173\u6000\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
      break;
    case "contact": {
      const phone = data.get("phone").trim().replace(/[\s-]/g, "");
      const name = data.get("name").trim();
      if (!name || !/^\+?\d{5,18}$/.test(phone)) {
        form.querySelector(".form-error").textContent = "\u8BF7\u586B\u5199\u79F0\u547C\u548C\u53EF\u62E8\u6253\u7684\u7535\u8BDD\u53F7\u7801\u3002";
        return;
      }
      state.contactName = name;
      state.phone = phone;
      refresh("\u5BB6\u4EBA\u7535\u8BDD\u5DF2\u4FDD\u5B58\u3002");
      break;
    }
    case "reminder": {
      const at = (/* @__PURE__ */ new Date(`${data.get("date")}T${data.get("time")}`)).getTime();
      const title = data.get("title").trim();
      const id = form.dataset.id || crypto.randomUUID();
      const previous = state.reminders.find((item2) => item2.id === id);
      if (!title || !Number.isFinite(at) || at <= Date.now() && previous?.at !== at) {
        form.querySelector(".form-error").textContent = "\u8BF7\u586B\u5199\u63D0\u9192\u5185\u5BB9\uFF0C\u5E76\u9009\u62E9\u8FD8\u6CA1\u5230\u7684\u65F6\u95F4\u3002";
        return;
      }
      const repeat = data.get("repeat");
      const item = { id, owner: form.dataset.owner, at, title, repeat, done: repeat === "never" && Boolean(previous?.done), notified: previous?.at === at && previous.notified };
      state.reminders = [...state.reminders.filter((entry) => entry.id !== id), item];
      refresh("\u63D0\u9192\u5DF2\u4FDD\u5B58\u3002");
      break;
    }
  }
});
document.addEventListener("input", (event) => {
  if (event.target.matches("[data-electricity-field], [data-electricity-step]")) electricity.input(event.target);
});
document.addEventListener("change", async (event) => {
  const field = event.target;
  if (field.matches("select[data-electricity-field]")) {
    electricity.input(field);
    return;
  }
  if (field.matches("[data-electricity-file]")) {
    await electricity.file(field);
    return;
  }
  if (field.id === "shortcut-kind") {
    const custom = field.form.querySelector("[data-shortcut-custom]");
    custom.hidden = field.value !== "website";
    for (const input of custom.querySelectorAll("input")) input.required = !custom.hidden;
    field.form.elements.title.required = !custom.hidden;
    field.form.elements.target.disabled = custom.hidden;
    return;
  }
  if (field.name === "persona" && field.form?.dataset.form === "persona") {
    field.form.querySelector(".persona-preview").textContent = personas[field.value].preview;
    return;
  }
  if (field.id === "capture-album" || field.id === "capture-native") {
    await records.readFile(field);
    return;
  }
  if (field.id !== "device-file" || !field.files.length) return;
  const editor = deviceEditor;
  const form = field.form;
  const frame = form.querySelector("#guide-photo");
  const submit = form.querySelector('button[type="submit"]');
  editor.loading = true;
  field.disabled = true;
  submit.disabled = true;
  frame.setAttribute("aria-busy", "true");
  guideError("");
  try {
    const photo = await readDevicePhoto(field.files[0]);
    if (deviceEditor !== editor) return;
    editor.photo = photo;
    editor.pin = null;
    for (const step of editor.steps) {
      step.x = null;
      step.y = null;
    }
    frame.innerHTML = editorPhotoContent(form.elements.name.value || "\u5BB6\u91CC\u7684\u8BBE\u5907");
    form.querySelector("#guide-steps").innerHTML = editorStepRows();
    form.querySelector("#pin-status").textContent = "\u7167\u7247\u5DF2\u5C31\u7EEA\uFF0C\u8BF7\u6807\u8BB0\u6309\u952E\u3002";
  } catch (error) {
    if (deviceEditor === editor) guideError(error instanceof DOMException ? "\u8FD9\u5F20\u7167\u7247\u6253\u4E0D\u5F00\uFF0C\u8BF7\u6362\u4E00\u5F20\u6E05\u695A\u7684\u7167\u7247\u3002" : error.message);
  } finally {
    editor.loading = false;
    field.disabled = false;
    field.value = "";
    submit.disabled = false;
    frame.removeAttribute("aria-busy");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.target.matches('[data-action="electricity-pin"]')) {
    electricity.adjustPin(event);
    return;
  }
  if (!event.target.matches('.photo-target[data-action="device-pin"]')) return;
  const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!offsets[event.key]) return;
  event.preventDefault();
  const [dx, dy] = offsets[event.key];
  const { x, y } = deviceEditor.pin ?? { x: 0.5, y: 0.5 };
  const adjust = (coordinate, offset) => Math.max(0, Math.min(1, coordinate + offset * 0.025));
  updatePin(event.target.form, { x: adjust(x, dx), y: adjust(y, dy) });
});
dialog.addEventListener("close", () => {
  if (!dialog.open) phoneGuide.close();
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
});
function enterScreen(focus = false) {
  if (!account) return;
  const id = routeDeviceId();
  if (recordRoutes.includes(route)) records.open(route, id, location.hash.split("/")[3]);
  else records.close();
  deviceStep = 0;
  deviceEditor = null;
  if (route === "guide" && state.guideRuns[id]?.screen === "done") {
    delete state.guideRuns[id];
    save();
  }
  if (route === "device-editor") {
    const stored = state.deviceGuides.find((item) => item.id === id);
    if (stored || !id) deviceEditor = { name: "", photo: "", steps: [], ...structuredClone(stored ?? {}), pin: null, stepIndex: null, loading: false };
  }
  if (route === "chat" && !state.greeted) {
    state.greeted = true;
    save();
  }
  noteActivity();
  void electricity.open(route, id);
  render();
  if (familyPages.includes(route)) void loadFamily();
  if (route === "electricity-editor" && !id && !family) {
    const active = account;
    void loadFamily().then(() => {
      if (account === active && route === "electricity-editor" && !routeDeviceId()) render();
    });
  }
  if (route === "family-overview") void loadOverview();
  else overview = null;
  if (focus) {
    window.scrollTo(0, 0);
    document.querySelector("#screen-title")?.focus({ preventScroll: true });
  }
  checkReminders();
}
window.addEventListener("hashchange", () => {
  if (dialog.open) dialog.close();
  recognition?.abort();
  stopSpeech();
  route = readRoute();
  if (!cloudSite2 && location.hash === "#/legacy" && !authBusy) {
    void boot();
    return;
  }
  authPanel = false;
  enterScreen(true);
});
document.addEventListener("visibilitychange", () => {
  noteActivity();
  if (account && document.visibilityState === "visible") {
    if (route === "elder") void loadFamily();
    if (["elder", "family", "home-shortcuts", "electricity-cards"].includes(route)) void electricity.refresh();
    if (route === "family-overview") void loadOverview();
  }
  if (account) checkReminders();
});
window.addEventListener("pagehide", records.stopCamera);
window.addEventListener("pagehide", electricity.stopMedia);
window.addEventListener("pagehide", phoneGuide.close);
window.addEventListener("pageshow", (event) => {
  if (event.persisted && route === "capture") void records.action("capture-reset");
});
window.addEventListener("beforeunload", (event) => {
  if (unsyncedCloud()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
setInterval(() => {
  if (account) checkReminders();
}, 1e4);
window.speechSynthesis?.getVoices?.();
if (!cloudSite2) cloudEntry();
void boot();
