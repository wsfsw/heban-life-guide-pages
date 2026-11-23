const labels = { font: '放大手机字', wifi: '连接无线网' };

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

export function phoneTopic(question) {
  const text = question.trim().replace(/[\s？?。，！!\-]/g, '').toLowerCase();
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(把)?(手机)?(放大|调大|增大)(手机)?(字体|字|字号)(呢|吗)?$/.test(text)
    || /^(手机)?(字体|字|字号)太小(了)?(怎么办)?$/.test(text)) return 'font';
  if (/^(怎么|如何|想|请问|请问怎么|帮我)?(用)?(手机)?(连接|连上|连|接入)(家里|家里的)?(wifi|无线网|无线网络|无线局域网)(呢|吗)?$/.test(text)) return 'wifi';
  return '';
}

export function createPhoneGuide({ dialog, showDialog, api, esc, speak, stopSpeech, getAccount }) {
  let current;
  let player;
  let spoken = false;
  let voiceStatus = '';

  function stop() {
    const active = player;
    player = null;
    if (active) active.pause();
    if (spoken) {
      spoken = false;
      stopSpeech();
    }
  }

  const button = (name, label, style = 'quiet') => `<button type="button" class="button ${style}" data-action="phone-${name}">${label}</button>`;
  const ready = () => current?.steps?.length && current.index < current.steps.length;
  const panel = () => dialog.querySelector('.phone-guide');

  function setStatus(text) {
    voiceStatus = text;
    const target = panel()?.querySelector('.phone-voice-status');
    if (target) target.textContent = text;
  }

  function render(focus = '') {
    const { platform, steps, index, clarification, pending, error, title, auto } = current;
    let body;
    if (!platform) {
      body = `<h3>您用的是哪种手机？</h3><div class="phone-guide-actions">${button('android', '安卓手机', '')}${button('iphone', '苹果手机', '')}</div>`;
    } else if (pending) {
      body = '<p role="status">正在准备手机操作步骤…</p>';
    } else if (error) {
      body = `<p class="form-error" role="alert">${esc(error)}</p><div class="phone-guide-actions">${button('retry', '再试一次', '')}${button('change', '换一种手机')}</div>`;
    } else if (!steps.length) {
      body = `<p class="phone-caption">${esc(clarification)}</p>${button('answer', '回去补充问题', '')}`;
    } else if (index >= steps.length) {
      body = `<h3>已经看完了</h3><div class="phone-guide-actions">${button('restart', '从头再听')}${button('answer', '返回助手', '')}</div>`;
    } else {
      body = `<p class="phone-step-count">${esc(title)} · 第 ${index + 1} 步，共 ${steps.length} 步</p>
        <p class="phone-caption" id="phone-caption" tabindex="-1">${esc(steps[index])}</p>
        <div class="phone-guide-actions">${button('listen', auto ? '再听一遍' : '听这一步', '')}${auto ? button('mute', '关闭声音') : ''}</div>
        <p class="phone-voice-status" role="status">${esc(voiceStatus)}</p>
        <div class="phone-guide-actions phone-step-nav">${index ? button('previous', '上一步') : ''}${button('next', index + 1 < steps.length ? '下一步' : '我做完了', 'primary')}</div>
        <p class="device-help">可以先去手机里操作，回到禾伴会留在这一步。</p>${button('change', '换一种手机')}`;
    }
    const markup = `<div class="phone-guide">${body}</div>`;
    if (dialog.open && panel()) panel().outerHTML = markup;
    else showDialog('听着一步一步做', markup);
    if (focus) panel()?.querySelector(focus)?.focus({ preventScroll: true });
  }

  function open(question, history) {
    if (current?.id !== question.id) {
      stop();
      voiceStatus = '';
      current = { id: question.id, question: question.text, history, owner: getAccount(), platform: '', steps: [], index: 0, auto: false };
    }
    render();
  }

  async function load(platform) {
    stop();
    voiceStatus = '';
    const active = current = { ...current, platform, steps: [], index: 0, auto: false, pending: true, error: '', clarification: '' };
    const topic = phoneTopic(active.question);
    if (topic) {
      Object.assign(active, { steps: phoneLessons[platform][topic], title: labels[topic], topic, pending: false });
      render('#phone-caption');
      return;
    }
    active.topic = '';
    render();
    try {
      const { phoneGuide } = await api({ text: active.question, history: active.history, phonePlatform: platform });
      if (!phoneGuide || !Array.isArray(phoneGuide.steps)) throw new Error('这次没有读到手机操作步骤，请再试一次。');
      Object.assign(active, phoneGuide);
    } catch (error) {
      active.error = error.message;
    } finally {
      active.pending = false;
      if (active === current && active.owner === getAccount() && dialog.open && panel()) render('#phone-caption');
    }
  }

  function nativeVoice(text) {
    spoken = true;
    speak(text, (status) => {
      if (!spoken) return;
      if (status === 'error') setStatus('没有听到声音时，可以先看大字，或用手机自带的浏览器打开禾伴。');
      else setStatus(status === 'playing' ? '正在朗读这一步' : '');
      if (status !== 'playing') spoken = false;
    });
  }

  function play() {
    if (!ready()) return;
    stop();
    setStatus('');
    const { platform, topic, index, steps } = current;
    if (!topic) { nativeVoice(steps[index]); return; }
    const audio = player = new Audio('./' + phoneAudio(platform, topic, index));
    audio.onplaying = () => { if (player === audio) setStatus('正在朗读这一步'); };
    audio.onended = () => { if (player === audio) { player = null; setStatus(''); } };
    audio.play().catch(() => {
      if (player !== audio) return;
      player = null;
      nativeVoice(steps[index]);
    });
  }

  function action(name) {
    if (!current || !panel()) return;
    switch (name) {
      case 'android':
      case 'iphone': void load(name); return;
      case 'retry': void load(current.platform); return;
      case 'change':
        stop();
        current = { ...current, platform: '', auto: false };
        render('.phone-guide-actions button');
        return;
      case 'answer':
        dialog.close();
        setTimeout(() => document.getElementById('message-input')?.focus(), 0);
        return;
      case 'listen':
        current.auto = true;
        render('[data-action="phone-listen"]');
        play();
        return;
      case 'mute':
        stop();
        voiceStatus = '';
        current.auto = false;
        render('[data-action="phone-listen"]');
        return;
      case 'next': current.index++; break;
      case 'previous': current.index--; break;
      case 'restart': current.index = 0; break;
      default: return;
    }
    stop();
    voiceStatus = '';
    render('#phone-caption');
    if (current.auto) play();
  }

  function close() {
    stop();
    voiceStatus = '';
    if (current) current.auto = false;
  }

  return { open, action, close, reset() { close(); current = null; } };
}
