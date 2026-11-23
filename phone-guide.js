export const phoneLessons = {
  android: {
    font: ['请打开手机里的“设置”。', '在设置里搜索“字体大小”，点开对应的结果。', '把字号滑块往右移，直到字能看清。'],
    wifi: ['请打开手机里的“设置”。', '找到“无线局域网”或“无线网络”，把它打开。', '点您认识的网络。需要密码时，在手机弹出的连接框里输入。'],
  },
  iphone: {
    font: ['请打开苹果手机的“设置”。', '点“辅助功能”，再点“显示与文字大小”。', '点“更大字体”，把底部的滑块往右移。'],
    wifi: ['请打开苹果手机的“设置”。', '点“无线局域网”，把它打开。', '点您认识的网络。需要密码时，在手机弹出的连接框里输入。'],
  },
};

export const phoneAudio = (platform, topic, index) => `assets/phone-${platform}-${topic}-${index + 1}.mp3`;
const androidTrial = 'https://wsfsw.github.io/heban-life-guide-pages/heban-screen-guide.apk?v=0.2';
const launchAndroid = (path) => `intent://phone/${path}#Intent;scheme=heban-guide;package=cn.heban.guide;S.browser_fallback_url=${encodeURIComponent(androidTrial)};end`;

function quotedTapTarget(instruction) {
  if (/(?:不要|不用|别|不必|禁止)[^，。；]{0,6}(?:点|按)/.test(instruction)) return '';
  const taps = [...instruction.matchAll(/(?:点击|轻点|点按|点)(?:[击看开进]|(?:屏幕|页面)?(?:上方|下方|顶部|底部|左上角|右上角|左下角|右下角|左侧|右侧|中间)的?)?\s*[“「]([^”」]{1,28})[”」]/g)];
  return taps.length === 1 ? taps[0][1].trim() : '';
}

export function androidGuidePath(guide) {
  if (guide.topic === 'font') return 'font';
  if (!guide.steps?.length) return '';
  const app = guide.topic === 'wifi' ? 'settings' : guide.androidApp || '';
  const plan = {
    title: guide.title || (guide.topic === 'wifi' ? '连接无线网' : '手机操作引导'),
    app,
    steps: guide.steps.slice(0, 5).map((text, i) => ({ text, target: guide.targets?.[i] || quotedTapTarget(text),
      ...(guide.apps?.[i] ? { app: guide.apps[i] } : {}) })),
  };
  return 'steps?plan=' + encodeURIComponent(JSON.stringify(plan));
}

export function phoneTopic(question) {
  const text = question.trim().replace(/[\s？?。，！!\-]/g, '').toLowerCase();
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(把)?(手机)?(放大|调大|增大)(手机)?(字体|字|字号)(呢|吗)?$/.test(text)
    || /^(手机)?(字体|字|字号)太小(了)?(怎么办)?$/.test(text)) return 'font';
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(用)?(手机)?(连接|连上|连|接入)(家里|家里的)?(wifi|无线网|无线网络|无线局域网)(呢|吗)?$/.test(text)) return 'wifi';
  return '';
}

export function captionLines(text) {
  const phrases = text.match(/[^，。！？；、]+[，。！？；、]*|[，。！？；、]+/g) ?? [];
  const result = [];
  for (const phrase of phrases) {
    const characters = Array.from(phrase);
    while (characters.length) {
      const chunk = characters.splice(0, 13).join('').trim();
      const last = result.at(-1);
      if (last && Array.from(last + chunk).length <= 13) result[result.length - 1] += chunk;
      else if (chunk) result.push(chunk);
    }
  }
  return result;
}

export function createPhoneGuide({ caption, api, esc, speak, stopSpeech, render }) {
  let current;
  let visible = false;
  let player;
  let narration;
  let lines = [];
  let lineIndex = 0;
  const line = caption.querySelector('span');

  function showLine(index) {
    lineIndex = index;
    const text = lines[index] ?? '';
    if (line.textContent !== text) line.textContent = text;
    caption.hidden = !visible || !text;
  }

  function stop() {
    const audio = player;
    player = null;
    audio?.pause();
    if (narration) {
      narration = null;
      stopSpeech();
    }
  }

  const button = (name, label) => `<button type="button" class="text-button" data-action="phone-${name}">${label}</button>`;
  const ready = () => visible && current?.steps?.length && current.index < current.steps.length;

  function androidLinks(path) {
    if (!/Android/i.test(navigator.userAgent)) return `<a class="text-button" href="${androidTrial}">在安卓手机安装屏幕引导</a>`;
    const href = esc(launchAndroid(path));
    return `<div class="phone-background-actions"><a class="button" data-action="phone-handoff" href="${href}">开启跨应用引导</a>
      <a class="text-button" href="${androidTrial}">下载安装包</a></div>`;
  }

  function directLink(question) {
    return phoneTopic(question) === 'font' ? androidLinks('font') : '';
  }

  function controls(id) {
    if (!visible || current?.id !== id) return '';
    const { platform, pending, error, steps, index, clarification, muted } = current;
    let content;
    if (!platform) content = button('android', '安卓手机') + button('iphone', '苹果手机');
    else if (pending) content = '<span role="status">正在准备步骤…</span>';
    else if (error) content = `<span role="alert">${esc(error)}</span>${button('retry', '重试')}`;
    else if (!steps.length) content = `<span role="status">${esc(clarification)}</span>`;
    else if (index >= steps.length) content = '<span role="status">已完成</span>' + button('restart', '再来一次');
    else content = (index ? button('previous', '上一步') : '') + button('listen', '重听')
      + (muted ? '' : button('mute', '关声音')) + (muted && lineIndex < lines.length - 1 ? button('more', '下一句') : '')
      + button('next', index + 1 < steps.length ? '下一步' : '做完了');
    const path = platform === 'android' ? androidGuidePath(current) : '';
    return `<div class="phone-guide-controls" aria-label="字幕和进度">${content}
      ${platform && !pending ? button('change', '换手机') : ''}${button('end', '结束')}${path ? androidLinks(path) : ''}</div>`;
  }

  function playNative(start) {
    const active = narration = {};
    function playLine(index) {
      if (narration !== active || !ready()) return;
      showLine(index);
      speak(lines[index], (status) => {
        if (narration !== active) return;
        if (status === 'ended' && index + 1 < lines.length) playLine(index + 1);
        else if (status === 'ended' || status === 'error') {
          narration = null;
          if (status === 'error') { current.muted = true; render(); }
        }
      });
    }
    playLine(start);
  }

  function play() {
    if (!ready()) return;
    stop();
    const { platform, topic, index } = current;
    if (!topic) { playNative(0); return; }
    const audio = player = new Audio('./' + phoneAudio(platform, topic, index));
    const weights = lines.map((text) => Array.from(text).length);
    const total = weights.reduce((sum, value) => sum + value, 0);
    audio.ontimeupdate = () => {
      if (player !== audio || !Number.isFinite(audio.duration) || !audio.duration) return;
      let position = audio.currentTime / audio.duration * total;
      const index = weights.findIndex((weight) => { position -= weight; return position < 0; });
      showLine(index === -1 ? lines.length - 1 : index);
    };
    audio.onended = () => { if (player === audio) { player = null; showLine(lines.length - 1); } };
    audio.play().catch(() => {
      if (player !== audio) return;
      player = null;
      playNative(0);
    });
  }

  function step(focus = '') {
    stop();
    lines = ready() ? captionLines(current.steps[current.index]) : [];
    showLine(0);
    render();
    if (focus) document.querySelector(`[data-action="phone-${focus}"]`)?.focus({ preventScroll: true });
    if (ready() && !current.muted) play();
  }

  async function load(platform) {
    const active = current = { ...current, platform, steps: [], index: 0, pending: true, error: '', clarification: '',
      topic: '', title: '', androidApp: '', targets: [], apps: [] };
    const topic = phoneTopic(active.question);
    if (topic) {
      Object.assign(active, { steps: phoneLessons[platform][topic], topic, pending: false });
      step();
      return;
    }
    step();
    try {
      const { phoneGuide } = await api({ text: active.question, history: active.history, phonePlatform: platform });
      if (!phoneGuide || !Array.isArray(phoneGuide.steps)) throw new Error('没有找到操作步骤，请再试一次。');
      Object.assign(active, phoneGuide);
    } catch (failure) { active.error = failure.message; }
    finally {
      active.pending = false;
      if (active === current && visible) step();
    }
  }

  function open(question, history) {
    visible = true;
    if (current?.id === question.id) { step(); return; }
    current = { id: question.id, question: question.text, history, platform: '', steps: [], index: 0, muted: false };
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad/.test(ua) ? 'iphone' : /Android/i.test(ua) ? 'android' : '';
    if (platform) void load(platform);
    else step();
  }

  function action(name) {
    if (name === 'handoff') { stop(); stopSpeech(); return; }
    if (!visible || !current) return;
    switch (name) {
      case 'android':
      case 'iphone': void load(name); return;
      case 'retry': void load(current.platform); return;
      case 'change':
        current = { ...current, platform: '', steps: [], index: 0, pending: false };
        step('android');
        return;
      case 'end': close(); render(); return;
      case 'listen': current.muted = false; step('listen'); return;
      case 'mute':
        stop();
        current.muted = true;
        showLine(0);
        render();
        return;
      case 'more':
        if (lineIndex + 1 < lines.length) showLine(lineIndex + 1);
        render();
        return;
      case 'next': if (ready()) current.index++; break;
      case 'previous': if (current.index > 0) current.index--; break;
      case 'restart': current.index = 0; break;
      default: return;
    }
    step('next');
  }

  function close() {
    visible = false;
    stop();
    showLine(0);
  }
  return { open, action, controls, directLink, close, reset() { close(); current = null; } };
}
