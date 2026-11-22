export const lifeGuides = [
  {
    id: 'parcel', version: 1, title: '快递柜取件', icon: 'parcel',
    summary: '找取件码，看看柜门没开怎么办',
    starts: ['home', 'code', 'blocked'],
    success: '这次取件指引走完了。',
    help: ['看看柜体上公示的客服电话或求助按钮。', '如果旁边有值守驿站，可以请工作人员帮您看当前画面。'],
    steps: {
      home: {
        title: '柜机首页', text: '在柜机画面上找到「取件」。',
        preview: { label: '快递柜首页', labels: ['取件', '寄件'], focus: 0 },
        options: [{ label: '看到输入取件码的地方', to: 'code' }, { label: '点取件后不知道从哪找码', to: 'notice' }],
      },
      code: {
        title: '输入取件码', text: '找到原来的取件通知，在柜机上输入通知里的取件码。',
        preview: { label: '柜机取件页', labels: ['输入取件码', '确认取件'], focus: 0 },
        options: [{ label: '柜门开了', to: 'collect' }, { label: '柜门没开', to: 'blocked', countFailure: true }, { label: '我找不到取件码', to: 'notice' }],
      },
      blocked: {
        title: '柜门没开', text: '如果柜机提示「取件码有误」，先核对原取件通知。',
        preview: { label: '柜机提示示意', labels: ['取件码有误', '重新输入'], focus: 0 },
        options: [{ label: '我想回去核对', to: 'code' }, { label: '仍打不开，找人帮忙', to: 'help' }],
      },
      notice: {
        title: '找取件通知', text: '打开原来的短信或快递通知，找写着「取件码」的一行，再回到柜机。',
        preview: { label: '取件通知示意', labels: ['柜机位置', '取件码'], focus: 1 },
        options: [{ label: '找到了取件码', to: 'code' }, { label: '还是找不到', to: 'help' }],
      },
      collect: {
        title: '柜门已打开', text: '找到打开的柜门，拿出自己的包裹。拿到后关好柜门。',
        preview: { label: '柜机结果示意', labels: ['柜门已打开'], focus: 0 },
        options: [{ label: '拿到包裹了', to: 'done' }, { label: '里面没有我的包裹', to: 'help' }],
      },
    },
  },
  {
    id: 'bill', version: 1, title: '查电费账单', icon: 'bill',
    summary: '找到账单日期和电费金额',
    starts: ['services', 'statement', 'payment'],
    success: '这次查账指引走完了。',
    help: ['回到您平时使用的供电服务入口，找「帮助」或「客服」。', '也可以拿着旧账单，到熟悉的便民点或供电营业厅询问。'],
    steps: {
      services: {
        title: '看到生活缴费', text: '在您平时使用的官方服务里找「电费」，再找「账单」或「账单查询」。',
        preview: { label: '生活服务入口示意', labels: ['电费', '水费', '燃气费'], focus: 0 },
        options: [{ label: '我看到电费账单了', to: 'statement' }, { label: '进了付款页面', to: 'payment' }, { label: '页面让我先绑户号', to: 'account' }],
      },
      statement: {
        title: '看到电费账单', text: '找到本期账期和金额。只想查一下的话，看到这两项就可以停。',
        preview: { label: '账单页面示意', labels: ['本期账期', '本期金额'], focus: 0 },
        options: [{ label: '已看到本期账期和金额', to: 'done' }, { label: '没找到本期账单', to: 'period' }],
      },
      payment: {
        title: '到了付款页面', text: '先返回上一页，再找「账单」或「账单查询」。',
        preview: { label: '付款页面示意', labels: ['返回', '付款确认'], focus: 0 },
        options: [{ label: '回到查询页了', to: 'statement' }, { label: '回去还是看不懂', to: 'help' }],
      },
      account: {
        title: '页面要求绑定户号', text: '先看看旧账单或您家原来的缴费记录上有没有「户号」。需要绑定时，在官方页面填写。',
        preview: { label: '旧账单示意', labels: ['户号', '账期'], focus: 0 },
        options: [{ label: '已经看到电费账单了', to: 'statement' }, { label: '我还是找不到户号', to: 'help' }],
      },
      period: {
        title: '账单里没有本期', text: '看一下账期是否选对。仍没有本期信息时，可以向供电服务确认。',
        preview: { label: '账期选择示意', labels: ['选择账期', '历史账单'], focus: 0 },
        options: [{ label: '找到本期账单', to: 'statement' }, { label: '还是没有本期', to: 'help' }],
      },
    },
  },
];

const maxGuideAge = 24 * 60 * 60_000;
const guideTerminals = ['pick', 'help', 'done'];
const guideStepExists = (guide, screen) => Object.hasOwn(guide.steps, screen) || guideTerminals.includes(screen);

export function readGuideRun(guide, previous, now = Date.now()) {
  if (previous?.version === guide.version && Number.isFinite(previous.updatedAt)
    && now - previous.updatedAt < maxGuideAge && guideStepExists(guide, previous.screen)
    && Array.isArray(previous.history) && previous.history.every((screen) => guideStepExists(guide, screen))) return previous;
  return { version: guide.version, screen: 'pick', history: [], failed: 0, updatedAt: now };
}

export function setGuideScreen(guide, run, screen, countFailure = false) {
  if (!guideStepExists(guide, screen) || screen === run.screen) return run;
  const failed = (run.failed || 0) + Number(countFailure);
  return {
    ...run, screen: countFailure && failed >= 2 ? 'help' : screen, failed,
    history: [...run.history, run.screen].slice(-20), updatedAt: Date.now(),
  };
}

export function previousGuideScreen(run) {
  const screen = run.history.at(-1);
  return screen ? { ...run, screen, history: run.history.slice(0, -1), updatedAt: Date.now() } : run;
}
