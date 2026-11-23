import { readDevicePhoto } from './devices.js';

const path = '/api/family/cards';
const cardLink = (id) => 'electricity-card/' + id;
const editLink = (id) => 'electricity-editor/' + id;
const newStep = (text = '') => ({ id: crypto.randomUUID(), text, photo: '', x: null, y: null, audio: '' });
const button = (action, label, kind = 'quiet', extra = '') =>
  `<button class="button ${kind}" type="button" data-action="electricity-${action}" ${extra}>${label}</button>`;
const audioTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const pictureInputTypes = 'image/jpeg,image/png,image/webp';

function dataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败，请重新选择。'));
    reader.readAsDataURL(file);
  });
}

async function readAudio(file) {
  const type = file.type.split(';')[0];
  if (!audioTypes.includes(type) || file.size > 265_000) throw new Error('请选择小于 260 KB 的短录音，支持 MP3、M4A、WAV、WebM 和 OGG。');
  return dataUrl(file);
}

export function createElectricityCards({ api, escapeHtml, pageHeader, loginAction, render, speak, stopSpeech, account: getAccount, family: getFamily }) {
  const esc = escapeHtml;
  const element = () => document.querySelector('.electricity-screen');
  let cards = [];
  let section = '';
  let selected = '';
  let data;
  let draft;
  let help;
  let index = 0;
  let preview = false;
  let finished = false;
  let sent = false;
  let error = '';
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
    stopSpeech();
  }

  function cancelRecording() {
    const current = recording;
    if (!current) return;
    recording = null;
    clearTimeout(current.timer);
    current.stream?.getTracks().forEach((track) => track.stop());
    if (current.recorder?.state === 'recording') current.recorder.stop();
  }

  function reset() {
    cards = [];
    loaded = false;
    listLoad = null;
    cachedCard = null;
    section = '';
    cancelRecording();
    stopAudio();
    context = {};
  }

  async function loadList(show = false) {
    if (getAccount()?.guest) return;
    if (listLoad) {
      await listLoad;
      if (show && section === 'electricity-cards') render();
      return;
    }
    const account = getAccount();
    const active = context;
    const job = api(path).then((result) => {
      if (getAccount() !== account) return;
      cards = result.cards;
      loaded = true;
      if (cachedCard && !cards.some((item) => item.id === cachedCard.id)) cachedCard = null;
    }).catch((failure) => {
      if (context === active && !loaded) error = failure.message;
    }).finally(() => {
      if (listLoad === job) listLoad = null;
      if (getAccount() === account && (show && context === active
        || ['elder', 'home-shortcuts', 'family'].includes(section))) render();
    });
    listLoad = job;
    return job;
  }

  function startDraft(card) {
    return card ? { ...card, steps: structuredClone(card.steps) } : { title: '查老家电费', recipient: '',
      steps: [newStep('打开家里平时用的缴费服务。'), newStep('找到“电费”或“用电账单”，点进去。'), newStep('看清户名和月份，再查看这月的用电和账单。')] };
  }

  async function open(route, id = '') {
    cancelRecording();
    stopAudio();
    section = route;
    selected = id;
    const active = context = {};
    data = draft = help = null;
    index = 0;
    finished = preview = sent = busy = false;
    error = '';
    if (['elder', 'home-shortcuts', 'family'].includes(route)) { void loadList(); return; }
    if (!route.startsWith('electricity-') || getAccount()?.guest) return;
    if (route === 'electricity-cards') { void loadList(true); return; }
    if (!id && route === 'electricity-editor') { draft = startDraft(); return; }
    try {
      const card = await api(path + '/' + id);
      if (active !== context) return;
      if (route === 'electricity-editor') {
        if (card.direction !== 'sent') throw new Error('请让制作这张卡的家人来修改。');
        draft = startDraft(card);
        index = Math.max(0, draft.steps.findIndex((step) => step.id === draft.issue?.stepId));
      } else {
        if (card.direction !== 'received') throw new Error('请在家属端预览这张操作卡。');
        data = card;
        cachedCard = card;
      }
    } catch (failure) {
      if (active !== context) return;
      if (!failure.status && route === 'electricity-card' && cachedCard?.id === id) {
        data = cachedCard;
        error = '网络暂时连不上，正在看上次打开的版本。';
      } else {
        if (cachedCard?.id === id) cachedCard = null;
        error = failure.message;
      }
    }
    if (active === context) render();
  }

  const back = () => section === 'electricity-card' ? 'elder' : 'electricity-cards';
  const photo = (src, pin, editable = false) => {
    if (!src) return '';
    const mark = pin?.x != null ? `<span class="photo-pin" style="--left:${pin.x * 100}%;--top:${pin.y * 100}%" aria-hidden="true"></span>` : '';
    const tag = editable ? 'button' : 'div';
    return `<div class="photo-board electricity-photo"><${tag} class="photo-target" ${editable ? 'type="button" data-action="electricity-pin" aria-label="在截图上标出位置"' : ''}><img class="device-photo-image" src="${esc(src)}" alt="${editable ? '待标记的操作截图' : '这一步的操作截图'}">${mark}</${tag}></div>`;
  };
  const message = () => `<p class="form-error" role="alert">${esc(error)}</p>`;
  const renderStep = (focus) => {
    render();
    element()?.querySelector(focus)?.focus({ preventScroll: true });
  };

  function screenList() {
    const account = getAccount();
    const sentCards = cards.filter((item) => item.direction === 'sent');
    const links = getFamily()?.links ?? [];
    const available = links.filter((link) => !sentCards.some((item) => item.recipient === link.id));
    const body = account.guest
      ? `<p class="empty-card">登录禾伴并连接家人后，就能把操作卡送到对方首页。</p>${loginAction('用邮箱登录', 'button', 'electricity-cards')}`
      : `${sentCards.length ? `<ul class="record-list">${sentCards.map((item) => `<li class="shortcut-row"><div><strong>${esc(item.title)}</strong>
        <span>${item.needsHelp ? '家人说有一步画面不一样' : esc(links.find((link) => link.id === item.recipient)?.name ?? '已发送给家人')}</span></div>
        <a class="button quiet" href="#/${editLink(item.id)}">${item.needsHelp ? '查看求助' : '修改'}</a></li>`).join('')}</ul>` : ''}
          ${loaded && available.length ? '<a class="button" href="#/electricity-editor">新建查电费卡</a>'
        : !links.length ? '<a class="button quiet" href="#/connections">先连接家人</a>' : ''}
        ${!loaded && !error ? '<p role="status">正在读取操作卡…</p>' : ''}${message()}${error ? button('list-reload', '重新读取') : ''}`;
    return `${pageHeader('查电费操作卡', 'family')}<main class="surface electricity-screen stack">${body}</main>`;
  }

  function screenEditor() {
    const links = (getFamily()?.links ?? []).filter((link) => !cards.some((item) => item.direction === 'sent' && item.recipient === link.id));
    const step = draft.steps[index];
    const flagged = draft.issue?.stepId === step.id;
    return `${pageHeader(draft.id ? '修改查电费卡' : '制作查电费卡', back())}<main class="surface electricity-screen guide-editor">
      <form data-form="electricity-publish">
        ${draft.id ? '' : `<label for="electricity-recipient">发给谁？</label>
          <select id="electricity-recipient" data-electricity-field="recipient" required>
          <option value="">选一位家人</option>${links.map((link) => `<option value="${esc(link.id)}" ${draft.recipient === link.id ? 'selected' : ''}>${esc(link.name)}</option>`).join('')}</select>
          ${links.length ? '' : '<a class="section-link" href="#/connections">先连接家人</a>'}`}
        <label for="electricity-title">首页按钮叫什么？</label><input id="electricity-title" data-electricity-field="title" maxlength="26" value="${esc(draft.title)}" required>
        <div class="electricity-step-tabs" aria-label="选择要编辑的步骤">${draft.steps.map((_, i) => button('select', `第 ${i + 1} 步`, i === index ? '' : 'quiet', `data-index="${i}" aria-pressed="${i === index}"`)).join('')}
          ${draft.steps.length < 5 ? button('add', '加一步') : ''}</div>
        ${flagged ? `<section class="empty-card electricity-notice"><strong>家人说这一步的画面不一样</strong>${draft.issue.photo ? photo(draft.issue.photo) : ''}</section>` : ''}
        <label for="electricity-text">这一步要做什么？</label><textarea id="electricity-text" rows="2" data-electricity-step="text" maxlength="100">${esc(step.text)}</textarea>
        <label for="electricity-screenshot">选一张实际操作的截图</label><input id="electricity-screenshot" type="file" accept="${pictureInputTypes}" data-electricity-file="photo">
        ${step.photo ? `<p class="device-help">点图上要按的位置，也可以用方向键标记。${step.x === null ? '' : '已标好位置。'}</p>${photo(step.photo, step, true)}` : '<p class="device-help">请先遮住户号、姓名等个人信息，再选图。</p>'}
        <div class="electricity-actions">${recording ? button('stop-recording', recording.recorder ? '结束录音' : '取消录音')
        : button('record', step.audio ? '重新录一句' : '录一句家人的话')}
          ${step.audio ? button('listen', '试听录音') + button('remove-audio', '移除录音') : ''}</div>
        <details><summary>选择已有录音</summary><input aria-label="选择已有短录音" type="file" accept="audio/*,.m4a" data-electricity-file="audio"></details>
        ${draft.steps.length > 1 ? button('remove', '移除这一步') : ''}
        ${message()}
        <div class="electricity-actions">${button('preview', '按长辈看到的样子预览', 'quiet')}
          <button class="button" type="submit" ${busy || recording ? 'disabled' : ''}>${busy ? '正在发送…' : draft.id ? '保存新版' : '发送到长辈首页'}</button></div>
      </form></main>`;
  }

  function screenReader(card) {
    const step = card.steps[index];
    const title = preview ? '预览操作卡' : card.title;
    const closePreview = preview ? button('edit', '返回编辑') : '';
    const body = finished ? `<div class="empty-card"><h2>已走完这张卡</h2><p>下次可以从首页再打开。</p></div>
      ${preview ? closePreview : '<a class="button" href="#/elder">回首页</a>'}${button('start-over', '再看一遍')}`
      : `<p class="electricity-progress">第 ${index + 1} 步，共 ${card.steps.length} 步</p>
        ${photo(step.photo, step)}<h2 id="electricity-instruction" tabindex="-1">${esc(step.text)}</h2>
        ${button('listen', step.audio ? '听家人说' : '听这一步')}
        <div class="electricity-reader-nav">${index > 0 ? button('previous', '上一步') : ''}${button('next', index + 1 === card.steps.length ? '我做完了' : '下一步', '')}</div>
        ${preview ? closePreview : help ? `<form data-form="electricity-help" class="electricity-help">
          <h3>请家人看看第 ${index + 1} 步</h3><p>家人会知道您卡在哪一步。您也可以加一张现在的截图。</p>
          <label for="electricity-help-photo">现在的截图（选填）</label><input id="electricity-help-photo" type="file" accept="${pictureInputTypes}" data-electricity-file="help">
          ${help.photo ? photo(help.photo) + button('clear-help-photo', '移除截图') : ''}
          <div class="electricity-actions"><button class="button" type="submit" ${busy ? 'disabled' : ''}>${busy ? '正在发送…' : '发给家人'}</button>${button('cancel-help', '取消')}</div>
        </form>` : sent ? '<p role="status" class="empty-card">已请家人看看这一步。有新版时，从首页打开就能看到。</p>'
        : button('open-help', '我看到的画面不一样')}`;
    return `${pageHeader(title, preview ? 'electricity-cards' : 'elder')}<main class="surface electricity-screen electricity-reader stack">${body}${message()}</main>`;
  }

  function screen() {
    if (section === 'electricity-cards') return screenList();
    if (getAccount().guest) return `${pageHeader('查电费操作卡', back())}<main class="surface electricity-screen stack">
      <p class="empty-card">请登录禾伴，查看家人分享的操作卡。</p>${loginAction('用邮箱登录', 'button', 'electricity-cards')}</main>`;
    if (draft) return preview ? screenReader(draft) : screenEditor();
    if (data) return screenReader(data);
    return `${pageHeader('查电费操作卡', back())}<main class="surface electricity-screen stack">
      ${error ? message() + button('reload', '重新打开') : '<p role="status">正在打开操作卡…</p>'}</main>`;
  }

  function homeEntries() {
    return cards.filter((item) => item.direction === 'received' && !item.hidden).map((item) => ({
      id: item.id, place: 'electricity', link: cardLink(item.id), title: item.title,
      subtitle: item.revision > 1 ? '家人已更新' : '家人教我查电费', glyph: 'bill', color: 'mint',
    }));
  }

  const hiddenEntries = () => cards.filter((item) => item.direction === 'received' && item.hidden);
  const needsHelp = () => cards.filter((item) => item.direction === 'sent' && item.needsHelp).length;

  async function visibility(id, hidden, control) {
    control.disabled = true;
    const active = getAccount();
    try {
      await api(path + '/' + id + '/visibility', 'PATCH', { hidden });
      if (getAccount() !== active) return;
      cards = cards.map((item) => item.id === id ? { ...item, hidden } : item);
      render();
    } catch (failure) {
      control.disabled = false;
      throw failure;
    }
  }

  function validateDraft() {
    const invalid = draft.steps.findIndex((step) => !step.text.trim() || !step.photo || step.x === null);
    if (!draft.title.trim()) throw new Error('请填写首页按钮的名字。');
    if (invalid !== -1) {
      index = invalid;
      throw new Error(`请写好第 ${index + 1} 步的说明，选一张截图并标上位置。`);
    }
  }

  function listen() {
    const step = (draft ?? data)?.steps[index];
    if (!step) return;
    stopAudio();
    if (!step.audio) { speak(step.text); return; }
    const player = audio = new Audio(step.audio);
    player.play().catch(() => { if (audio === player) speak(step.text); });
  }

  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('这里暂时无法录音，可以选择已有录音。');
    const active = recording = {};
    const step = draft.steps[index];
    render();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active !== recording) { stream.getTracks().forEach((track) => track.stop()); return; }
      active.stream = stream;
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = active.recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 48_000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (active !== recording) return;
        cancelRecording();
        error = '这次录音失败了，请再录一次。';
        render();
      };
      recorder.onstop = async () => {
        clearTimeout(active.timer);
        stream.getTracks().forEach((track) => track.stop());
        if (active !== recording) return;
        try {
          const file = new Blob(chunks, { type: recorder.mimeType.split(';')[0] });
          if (!file.size) throw new Error('没有录到声音，请再试一次。');
          const value = await readAudio(file);
          if (active === recording) step.audio = value;
        } catch (failure) { if (active === recording) error = failure.message; }
        finally { if (active === recording) { recording = null; render(); } }
      };
      recorder.start();
      active.timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 18_000);
      render();
    } catch (failure) {
      if (active !== recording) return;
      cancelRecording();
      throw new Error(failure.name === 'NotAllowedError' ? '请允许使用麦克风，或者选择已有录音。' : '暂时无法录音，可以选择已有录音。');
    }
  }

  async function action(name, control, event) {
    if (busy) return;
    const active = context;
    error = '';
    try {
      switch (name) {
        case 'list-reload': await loadList(true); return;
        case 'reload': void open(section, selected); render(); return;
        case 'listen': listen(); return;
        case 'stop-recording':
          if (recording?.recorder?.state === 'recording') { control.disabled = true; recording.recorder.stop(); return; }
          cancelRecording();
          break;
        default:
          if (recording) return;
          switch (name) {
            case 'record': stopAudio(); await record(); return;
            case 'preview': validateDraft(); preview = true; index = 0; finished = false; break;
            case 'edit': preview = false; index = 0; finished = false; break;
            case 'select': index = Number(control.dataset.index); break;
            case 'add': draft.steps.push(newStep()); index = draft.steps.length - 1; break;
            case 'remove': draft.steps.splice(index, 1); index = Math.min(index, draft.steps.length - 1); break;
            case 'remove-audio': draft.steps[index].audio = ''; break;
            case 'pin': {
              const bounds = control.getBoundingClientRect();
              const center = event.detail === 0;
              draft.steps[index].x = center ? 0.5 : Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
              draft.steps[index].y = center ? 0.5 : Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
              break;
            }
            case 'next': if (index + 1 === (draft ?? data).steps.length) finished = true; else index++; help = null; sent = false; break;
            case 'previous': index--; help = null; sent = false; break;
            case 'start-over': index = 0; finished = false; help = null; sent = false; break;
            case 'open-help': help = { photo: '' }; break;
            case 'cancel-help': help = null; break;
            case 'clear-help-photo': help.photo = ''; break;
          }
      }
      stopAudio();
      renderStep(name === 'open-help' ? '#electricity-help-photo' : ['next', 'previous', 'start-over', 'preview'].includes(name) ? '#electricity-instruction' : '');
    } catch (failure) {
      if (active !== context) return;
      error = failure.message;
      render();
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
    const target = mode === 'help' ? help : draft.steps[index];
    busy = true;
    field.disabled = true;
    try {
      if (mode === 'audio') target.audio = await readAudio(selectedFile);
      else {
        target.photo = await readDevicePhoto(selectedFile);
        if (mode === 'photo') target.x = target.y = null;
      }
      if (active === context) error = '';
    } catch (failure) { if (active === context) error = failure.message; }
    finally {
      if (active === context) { busy = false; render(); }
    }
  }

  async function submit(mode) {
    if (busy || recording) return;
    const active = context;
    try {
      if (mode === 'publish') {
        validateDraft();
        if (!draft.recipient) throw new Error('请先选择一位家人。');
      }
      busy = true;
      error = '';
      render();
      if (mode === 'publish') {
        await api(draft.id ? path + '/' + draft.id : path, draft.id ? 'PUT' : 'POST',
          { title: draft.title, steps: draft.steps, revision: draft.revision, recipient: draft.recipient });
        if (active === context) {
          loaded = false;
          location.hash = '#/electricity-cards';
        }
      } else {
        await api(path + '/' + data.id + '/help', 'POST', { stepId: data.steps[index].id, revision: data.revision, photo: help.photo });
        if (active === context) { help = null; sent = true; }
      }
    } catch (failure) { if (active === context) error = failure.message; }
    finally { if (active === context) { busy = false; render(); } }
  }

  return { reset, open, screen, homeEntries, hiddenEntries, needsHelp, visibility, action, input, file, submit, adjustPin,
    refresh: () => loadList(section === 'electricity-cards'), stopMedia: () => { cancelRecording(); stopAudio(); } };
}
