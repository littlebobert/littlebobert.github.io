// Speak desk accessory: a black rotary phone (黒電話) that calls a voice agent who knows about
// Justin, his apps, and Tokyo. The portfolio Worker checks Turnstile and the day's allowance, then
// hands out a signed URL for one call to the private ElevenLabs agent (scripts/speak-agent.mjs).
// Calls last at most two minutes. "Type" makes a text-only call, for visitors without a mic.
(() => {
  const widget = document.getElementById('speak');
  if (!widget) return;

  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = local ? 'http://localhost:8787' : 'https://portfolio-backend.justin-garcia.workers.dev';
  const TURNSTILE_SITE_KEY = local ? '1x00000000000000000000AA' : '0x4AAAAAADzny1gQWxbt_9AA';
  // The SDK is big (it carries WebRTC), so it's only fetched when someone calls.
  const CLIENT_URL = 'vendor/elevenlabs-client.js?v=1.35.0';
  const MAX_SECONDS = 120;
  // Same as scripts/speak-agent.mjs, which sets the English one on the agent.
  const FIRST_MESSAGES = {
    en: 'Hi, you’ve reached Justin’s desk. Ask me about him, his apps, or Tokyo.',
    ja: 'はい、ジャスティンのデスクです。本人のこと、アプリのこと、東京のこと、なんでも聞いてください。',
  };

  const phone = widget.querySelector('.speak-phone');
  const canvas = widget.querySelector('.speak-canvas');
  const statusLine = widget.querySelector('.speak-status');
  const transcript = widget.querySelector('.speak-transcript');
  const typeForm = widget.querySelector('.speak-type');
  const input = widget.querySelector('.speak-input');
  const sendButton = widget.querySelector('.speak-send');
  const callButton = widget.querySelector('.speak-call');
  const textCallButton = widget.querySelector('.speak-text-call');
  const turnstileSlot = widget.querySelector('.speak-turnstile');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const language = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
  const t = (en, ja) => (language() === 'ja' ? ja : en);

  // idle → dialing → listening ⇄ speaking → ended. Plus closed (out of calls today) and the
  // message shown after something went wrong, which leaves the phone idle.
  let state = 'idle';
  let notice = null; // [en, ja] shown instead of the state's own line
  let available = true;
  let textOnly = false;
  let conversation = null;
  // Each call gets a number, so callbacks from a call that was hung up are ignored.
  let currentCall = 0;
  let endsAt = 0;
  let timer = 0;

  // --- Words.

  function statusText() {
    if (notice) return t(...notice);
    // Until the call connects, the full two minutes.
    const left = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : MAX_SECONDS;
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    switch (state) {
      case 'dialing': return verifying
        ? t('Check the box below to dial.', '下の確認ボックスを押すとダイヤルします。')
        : t('Dialing…', 'ダイヤル中…');
      case 'listening': return textOnly
        ? t(`Your turn · ${clock}`, `どうぞ · ${clock}`)
        : t(`Listening · ${clock}`, `聞いています · ${clock}`);
      case 'speaking': return t(`Talking · ${clock}`, `話しています · ${clock}`);
      case 'ended': return t('Call ended. Thanks for calling!', '通話が終わりました。ありがとうございました。');
      default: return available
        ? t('Pick up the phone to call Justin’s desk.', '受話器を取ると、ジャスティンのデスクにつながります。')
        : t('The desk is closed for today. Try again tomorrow.', '今日の受付は終わりました。また明日どうぞ。');
    }
  }

  function render() {
    const inCall = ['dialing', 'listening', 'speaking'].includes(state);
    statusLine.textContent = statusText();
    callButton.textContent = inCall ? t('Hang Up', '切る') : t('Call', '電話する');
    callButton.disabled = !available && !inCall;
    textCallButton.textContent = t('Type', '文字で');
    textCallButton.hidden = inCall;
    textCallButton.disabled = !available;
    sendButton.textContent = t('Send', '送信');
    input.placeholder = t('Type to the desk…', 'メッセージを入力…');
    typeForm.hidden = !(inCall && state !== 'dialing');
    transcript.hidden = !transcript.children.length;
    phone.disabled = !available && !inCall;
    phone.setAttribute('aria-label', inCall
      ? t('Hang up', '電話を切る')
      : t('Call Justin’s desk', 'ジャスティンのデスクに電話する'));
    [...transcript.querySelectorAll('.speak-who')].forEach((who) => {
      who.textContent = who.dataset.source === 'user' ? t('You', 'あなた') : t('Desk', 'デスク');
    });
    widget.classList.toggle('is-in-call', inCall);
    draw();
  }

  function addLine(source, text) {
    const message = String(text || '').trim();
    if (!message) return;
    const item = document.createElement('li');
    item.className = `speak-line speak-line--${source}`;
    const who = document.createElement('span');
    who.className = 'speak-who';
    who.dataset.source = source;
    item.append(who, document.createTextNode(` ${message}`));
    transcript.append(item);
    // Keeps the last few lines; the window isn't a chat log.
    while (transcript.children.length > 12) transcript.firstChild.remove();
    render();
    transcript.scrollTop = transcript.scrollHeight;
  }

  // --- The phone, in pencil. Strokes wobble a little and are redrawn a few times a second while
  // a call is on, like a flipbook; still otherwise, and always still with Reduce Motion.

  let width = 0;
  let height = 0;
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const wobble = (amount) => (random() - 0.5) * 2 * amount;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  // A pencil stroke through points: two passes, each a little off.
  function pencil(points, { weight = 1.1, shade = 0.75, closed = false } = {}) {
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        const px = x + wobble(0.7);
        const py = y + wobble(0.7);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (closed) ctx.closePath();
      ctx.lineWidth = weight * (pass ? 0.7 : 1);
      ctx.strokeStyle = `rgba(20, 20, 20, ${shade * (pass ? 0.6 : 1)})`;
      ctx.stroke();
    }
  }

  const ellipse = (cx, cy, rx, ry, rotation = 0, from = 0, to = Math.PI * 2, steps = 28) => {
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
      const angle = from + ((to - from) * step) / steps;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      points.push([
        cx + x * Math.cos(rotation) - y * Math.sin(rotation),
        cy + x * Math.sin(rotation) + y * Math.cos(rotation),
      ]);
    }
    return points;
  };

  // Diagonal graphite hatching inside a path: the phone is black, so it's shaded dark.
  function hatch(path, spacing, shade) {
    ctx.save();
    ctx.beginPath();
    path.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = `rgba(30, 30, 30, ${shade})`;
    for (let offset = -height; offset < width; offset += spacing) {
      ctx.beginPath();
      ctx.moveTo(offset + wobble(1), height + 2);
      ctx.lineTo(offset + height + wobble(1), -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const inCall = ['dialing', 'listening', 'speaking'].includes(state);
    const now = performance.now();
    const still = reduceMotion.matches;
    const output = conversation && state === 'speaking' ? safeVolume('getOutputVolume') : 0;
    const micLevel = conversation && state === 'listening' && !textOnly ? safeVolume('getInputVolume') : 0;
    const cx = width / 2;
    const base = height - 8;

    // The body: a rounded trapezoid, darker than the paper.
    const body = [
      [cx - 56, base], [cx + 56, base], [cx + 50, base - 22], [cx + 36, base - 46],
      [cx - 36, base - 46], [cx - 50, base - 22],
    ];
    hatch(body, 3, 0.45);
    pencil(body, { closed: true, weight: 1.4 });

    // The dial. It turns back home while dialing.
    const dialX = cx;
    const dialY = base - 22;
    const turn = state === 'dialing' && !still ? Math.sin(now / 260) * 0.9 : 0;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dialX, dialY, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    pencil(ellipse(dialX, dialY, 17, 17), { weight: 1.2 });
    pencil(ellipse(dialX, dialY, 6, 6, 0, 0, Math.PI * 2, 14), { weight: 0.9 });
    for (let hole = 0; hole < 10; hole += 1) {
      const angle = -Math.PI * 0.35 + turn - hole * ((Math.PI * 1.6) / 9);
      pencil(ellipse(dialX + Math.cos(angle) * 12, dialY + Math.sin(angle) * 12, 2.6, 2.6, 0, 0, Math.PI * 2, 8), {
        weight: 0.8,
        shade: 0.6,
      });
    }

    // The cradle's two prongs.
    pencil([[cx - 30, base - 46], [cx - 33, base - 54], [cx - 26, base - 54]], { weight: 1.2 });
    pencil([[cx + 30, base - 46], [cx + 33, base - 54], [cx + 26, base - 54]], { weight: 1.2 });

    // The handset: on the cradle, or lifted and tilted during a call, rattling with the voice.
    const lift = inCall ? 20 : 0;
    const shake = still ? 0 : output * 2.5;
    const hx = cx + (inCall ? -6 : 0) + wobble(shake);
    const hy = base - 58 - lift + wobble(shake);
    const tilt = (inCall ? -0.22 : 0) + wobble(shake * 0.02);
    const along = (d, across = 0) => [
      hx + Math.cos(tilt) * d - Math.sin(tilt) * across,
      hy + Math.sin(tilt) * d + Math.cos(tilt) * across,
    ];
    const handle = [along(-40, -4), along(40, -4), along(40, 3), along(-40, 3)];
    hatch(handle, 2.5, 0.55);
    pencil(handle, { closed: true, weight: 1.2 });
    [-44, 44].forEach((end) => {
      const [ex, ey] = along(end, 6);
      const cup = ellipse(ex, ey, 11, 7, tilt);
      hatch(cup, 2.5, 0.55);
      pencil(cup, { weight: 1.3 });
    });

    // The curly cord, from the body to the mouthpiece end.
    const [cordX, cordY] = along(44, 12);
    const cord = [];
    const startX = cx + 54;
    const startY = base - 10;
    for (let step = 0; step <= 40; step += 1) {
      const k = step / 40;
      const x = startX + (cordX - startX) * k + 10 * Math.sin(Math.PI * k);
      const y = startY + (cordY - startY) * k;
      cord.push([x + Math.cos(k * Math.PI * 14) * 2.2, y + Math.sin(k * Math.PI * 14) * 2.2]);
    }
    pencil(cord, { weight: 0.8, shade: 0.6 });

    // Sound coming out of the earpiece while the desk talks; a squiggle at the mouthpiece while
    // it listens to you.
    if (state === 'speaking') {
      const [ex, ey] = along(-52, 4);
      const rings = still ? 2 : 1 + Math.round(output * 3);
      for (let ring = 1; ring <= rings; ring += 1) {
        pencil(ellipse(ex, ey, 6 + ring * 5, 6 + ring * 5, 0, Math.PI * 0.75, Math.PI * 1.25, 8), {
          weight: 0.9,
          shade: 0.7,
        });
      }
    }
    if (state === 'listening' && !textOnly) {
      const [mx, my] = along(58, 6);
      const squiggle = [];
      const amplitude = still ? 2 : 1 + micLevel * 6;
      for (let step = 0; step <= 12; step += 1) {
        squiggle.push([mx + step * 1.6, my - 4 + Math.sin(step * 1.4 + now / 90) * amplitude]);
      }
      pencil(squiggle, { weight: 0.8, shade: 0.6 });
    }
  }

  function safeVolume(method) {
    try {
      return Math.min(1, Math.max(0, Number(conversation[method]()) || 0));
    } catch (error) {
      return 0;
    }
  }

  let frame = 0;
  let lastFrame = 0;
  function animate(time) {
    frame = 0;
    const inCall = ['dialing', 'listening', 'speaking'].includes(state);
    if (!inCall || reduceMotion.matches || document.hidden || !widget.isConnected) return;
    // About eight drawings a second, like a flipbook.
    if (time - lastFrame > 120) {
      lastFrame = time;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function startAnimating() {
    if (!frame) frame = requestAnimationFrame(animate);
  }

  // --- Human verification. Cloudflare's managed check, shown only if it needs a tap.

  let turnstileId = null;
  let verifying = false; // Cloudflare is showing its check and wants a tap
  let token = '';
  let tokenWaiters = [];

  async function renderTurnstile() {
    if (turnstileId !== null) return;
    for (let attempt = 0; attempt < 100 && !window.turnstile; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.turnstile || turnstileId !== null) return;
    turnstileId = window.turnstile.render(turnstileSlot, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'speak-call',
      appearance: 'interaction-only',
      'before-interactive-callback'() {
        verifying = true;
        render();
      },
      'after-interactive-callback'() {
        verifying = false;
        render();
      },
      callback(value) {
        token = value;
        tokenWaiters.forEach(({ resolve }) => resolve(value));
        tokenWaiters = [];
      },
      'expired-callback'() {
        token = '';
      },
      'error-callback'() {
        token = '';
      },
    });
  }

  function freshToken() {
    renderTurnstile();
    if (token) return Promise.resolve(token);
    return new Promise((resolve, reject) => {
      tokenWaiters.push({ resolve });
      // Long enough for a person to notice the check and tap it.
      setTimeout(() => reject(new Error('verification')), 120000);
    });
  }

  function spendToken() {
    token = '';
    if (window.turnstile && turnstileId !== null) window.turnstile.reset(turnstileId);
  }

  // --- The SDK, loaded on the first call.

  let clientLoading = null;
  function loadClient() {
    if (window.ElevenLabsClient) return Promise.resolve(window.ElevenLabsClient);
    clientLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CLIENT_URL;
      script.onload = () => (window.ElevenLabsClient ? resolve(window.ElevenLabsClient) : reject(new Error('client')));
      script.onerror = () => {
        clientLoading = null;
        script.remove();
        reject(new Error('client'));
      };
      document.head.append(script);
    });
    return clientLoading;
  }

  // --- Calling.

  class CallError extends Error {
    constructor(notice, closed = false) {
      super(notice[0]);
      this.notice = notice;
      this.closed = closed;
    }
  }

  async function requestCall() {
    let turnstileToken;
    try {
      turnstileToken = await freshToken();
    } catch (error) {
      throw new CallError(['Couldn’t check that you’re human. Try again.', '確認できませんでした。もう一度どうぞ。']);
    }
    spendToken();
    let response;
    try {
      response = await fetch(`${API}/api/v1/speak/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken }),
      });
    } catch (error) {
      throw new CallError(['No line. Check your connection.', '回線がつながりません。接続を確認してください。']);
    }
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.signedUrl) return result.signedUrl;
    if (result.code === 'busy' || result.code === 'unavailable') {
      throw new CallError(['The desk is closed for today. Try again tomorrow.', '今日の受付は終わりました。また明日どうぞ。'], true);
    }
    if (response.status === 429) {
      throw new CallError(['That’s a lot of calls. Wait a minute and try again.', '少し待ってから、もう一度おかけください。']);
    }
    if (response.status === 400) {
      throw new CallError(['Couldn’t check that you’re human. Try again.', '確認できませんでした。もう一度どうぞ。']);
    }
    throw new CallError(['The line is down. Try again later.', '回線が混み合っています。しばらくしてからどうぞ。']);
  }

  // Asks for the mic before a call is spent, so a "no" costs nothing.
  async function checkMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CallError(['This browser can’t use a microphone here. Try Type.', 'このブラウザではマイクを使えません。「文字で」をどうぞ。']);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      throw new CallError(['The desk needs your microphone to hear you. Or try Type.', 'マイクを許可してください。または「文字で」をどうぞ。']);
    }
  }

  function setState(next) {
    state = next;
    render();
    startAnimating();
  }

  async function call(withText) {
    if (state === 'dialing' || conversation || !available) return;
    const callId = ++currentCall;
    const current = () => callId === currentCall;
    textOnly = withText;
    endsAt = 0;
    notice = null;
    transcript.replaceChildren();
    setState('dialing');
    const lang = language();
    try {
      if (!textOnly) await checkMicrophone();
      const [client, signedUrl] = await Promise.all([
        loadClient().catch(() => {
          throw new CallError(['The phone didn’t load. Try again.', '電話を読み込めませんでした。もう一度どうぞ。']);
        }),
        requestCall(),
      ]);
      if (!current()) return; // hung up while dialing
      const session = await client.Conversation.startSession({
        signedUrl,
        connectionType: 'websocket',
        // Top level picks a text conversation (no mic); the override tells the agent.
        textOnly,
        overrides: {
          agent: { language: lang, firstMessage: FIRST_MESSAGES[lang] },
          ...(textOnly ? { conversation: { textOnly: true } } : {}),
        },
        onConnect() {
          if (!current()) return;
          endsAt = Date.now() + MAX_SECONDS * 1000;
          clearInterval(timer);
          timer = setInterval(tick, 250);
          setState(textOnly ? 'speaking' : 'listening');
          if (textOnly) input.focus();
        },
        onModeChange({ mode }) {
          if (!current()) return;
          setState(mode === 'speaking' ? 'speaking' : 'listening');
        },
        onMessage(message) {
          if (!current()) return;
          const source = message.source || message.role;
          addLine(source === 'user' ? 'user' : 'ai', message.message);
          // Text-only calls have no audio to switch modes, so a reply means it's your turn.
          if (textOnly && source !== 'user') setState('listening');
        },
        onError(message) {
          console.warn('Speak:', message);
        },
        onDisconnect() {
          if (current()) finish();
        },
      });
      if (current()) conversation = session;
      else session.endSession().catch(() => {});
    } catch (error) {
      if (!current()) return;
      conversation = null;
      if (error instanceof CallError) {
        notice = error.notice;
        if (error.closed) available = false;
      } else {
        console.warn('Speak:', error);
        notice = ['The line is down. Try again later.', '回線が混み合っています。しばらくしてからどうぞ。'];
      }
      setState('idle');
    }
  }

  function tick() {
    if (Date.now() >= endsAt) {
      hangUp();
      return;
    }
    statusLine.textContent = statusText();
  }

  function finish() {
    currentCall += 1;
    clearInterval(timer);
    conversation = null;
    if (state !== 'idle') setState('ended');
  }

  function hangUp() {
    const ending = conversation;
    conversation = null;
    currentCall += 1;
    clearInterval(timer);
    setState(state === 'dialing' ? 'idle' : 'ended');
    ending?.endSession().catch(() => {});
  }

  function toggleCall() {
    if (['dialing', 'listening', 'speaking'].includes(state)) hangUp();
    else call(false);
  }

  phone.addEventListener('click', toggleCall);
  callButton.addEventListener('click', toggleCall);
  textCallButton.addEventListener('click', () => call(true));
  typeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !conversation) return;
    conversation.sendUserMessage(text);
    // The SDK doesn't echo typed messages back, so they're added here.
    addLine('user', text);
    if (textOnly) setState('speaking');
    input.value = '';
  });

  // --- Whether the desk is open today, checked once the phone is first on screen.

  async function checkAvailability() {
    try {
      const response = await fetch(`${API}/api/v1/speak/status`);
      if (!response.ok) return;
      const result = await response.json();
      available = Boolean(result.available);
      if (state === 'idle') render();
    } catch (error) {}
  }

  // --- Placement: under Settings on wide screens, stacked with any other desk accessories.

  const settings = document.getElementById('appearance-panel');
  function place() {
    if (!settings) return;
    let top = 36 + settings.offsetHeight + 12;
    document.querySelectorAll('.desk-accessory').forEach((accessory) => {
      accessory.style.setProperty('--desk-accessory-top', `${top}px`);
      top += accessory.offsetHeight + 12;
    });
  }

  const placement = new ResizeObserver(place);
  if (settings) placement.observe(settings);
  placement.observe(widget);
  new ResizeObserver(resize).observe(canvas);
  const visibility = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting) return;
    visibility.disconnect();
    checkAvailability();
  });
  visibility.observe(widget);

  widget.querySelector('.close-box').addEventListener('click', () => {
    if (conversation) hangUp();
    widget.remove();
    placement.disconnect();
    visibility.disconnect();
    place();
  });

  document.addEventListener('site-language-change', render);
  document.addEventListener('visibilitychange', startAnimating);
  reduceMotion.addEventListener('change', () => {
    draw();
    startAnimating();
  });
  window.addEventListener('pagehide', () => {
    if (conversation) hangUp();
  });

  render();
  place();
})();
