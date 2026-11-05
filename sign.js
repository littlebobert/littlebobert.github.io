// onemorething.tokyo/sign: the in-person guestbook. People at an event scan the QR code on
// Justin's phone, sign with a finger, and the signature turns up on his live page
// (portfolio-backend /admin/live). It goes public in the Guestbook once he approves it.
(() => {
  const { apiBase, turnstileSiteKey, draw } = window.SignatureInk;
  const WIDTH = 400;
  const HEIGHT = 200;
  const MAX_POINTS = 3000;
  const MAX_STROKES = 120;
  const PENDING_KEY = 'sign-pending';

  const form = document.getElementById('sign-form');
  const paper = document.getElementById('paper');
  const canvas = document.getElementById('canvas');
  const hint = document.getElementById('paper-hint');
  const undoButton = document.getElementById('undo');
  const clearButton = document.getElementById('clear');
  const nameInput = document.getElementById('name');
  const noteInput = document.getElementById('note');
  const submitButton = document.getElementById('submit');
  const status = document.getElementById('status');
  const eventLine = document.getElementById('event');
  const thanks = document.getElementById('thanks');
  const ctx = canvas.getContext('2d');

  // --- Language: Japanese for Japanese browsers, switchable, remembered.

  let language = 'en';
  try {
    language = localStorage.getItem('site-language')
      || ((navigator.languages || [navigator.language]).some((l) => /^ja\b/i.test(l)) ? 'ja' : 'en');
  } catch (error) {}
  let eventName = '';

  const text = (en, ja) => (language === 'ja' ? ja : en);

  function applyLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-en]').forEach((element) => {
      element.textContent = element.dataset[language] ?? element.dataset.en;
    });
    document.querySelectorAll('[data-language]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    document.title = text('Sign my guestbook', 'ゲストブックにサイン');
    canvas.setAttribute('aria-label', text('Signature pad', 'サイン欄'));
    if (eventName) eventLine.textContent = text(`At ${eventName}`, `${eventName}にて`);
  }

  document.querySelectorAll('[data-language]').forEach((button) => {
    button.addEventListener('click', () => {
      language = button.dataset.language;
      try {
        localStorage.setItem('site-language', language);
      } catch (error) {}
      applyLanguage();
    });
  });

  // --- The pad. Points are kept in the 400×200 box the backend stores.

  let strokes = [];
  let current = null;
  let sending = false;
  let startedAt = 0;
  const pointCount = () => strokes.reduce((total, stroke) => total + stroke.length / 3, 0);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    const scale = canvas.width / WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#111';
    ctx.fillStyle = '#111';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach((stroke) => {
      ctx.beginPath();
      ctx.moveTo(stroke[0], stroke[1]);
      if (stroke.length === 3) ctx.lineTo(stroke[0] + 0.01, stroke[1]);
      for (let i = 3; i < stroke.length; i += 3) ctx.lineTo(stroke[i], stroke[i + 1]);
      ctx.stroke();
    });
    const hasInk = strokes.length > 0;
    hint.hidden = hasInk;
    undoButton.disabled = !hasInk;
    clearButton.disabled = !hasInk;
    submitButton.disabled = !hasInk || sending;
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
    return [
      clamp(((event.clientX - rect.left) / rect.width) * WIDTH, WIDTH),
      clamp(((event.clientY - rect.top) / rect.height) * HEIGHT, HEIGHT),
      Math.max(0, Math.round(event.timeStamp - startedAt)),
    ];
  }

  function addPoint(event) {
    if (pointCount() >= MAX_POINTS) return;
    const [x, y, t] = pointFrom(event);
    const n = current.length;
    // Skip points that barely moved, which keeps long signatures small.
    if (n && Math.hypot(x - current[n - 3], y - current[n - 2]) < 1.5) return;
    current.push(x, y, t);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (current || strokes.length >= MAX_STROKES || pointCount() >= MAX_POINTS) return;
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {}
    if (!strokes.length) startedAt = event.timeStamp;
    current = [];
    strokes.push(current);
    addPoint(event);
    redraw();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!current) return;
    const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    (events.length ? events : [event]).forEach(addPoint);
    redraw();
  });

  const endStroke = () => {
    current = null;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  undoButton.addEventListener('click', () => {
    strokes.pop();
    if (!strokes.length) startedAt = 0;
    redraw();
  });
  clearButton.addEventListener('click', () => {
    strokes = [];
    startedAt = 0;
    redraw();
  });

  new ResizeObserver(resize).observe(paper);

  // --- Human verification. Cloudflare's managed check, shown only if it needs a tap.

  let widgetId = null;
  let token = '';
  let tokenWaiters = [];

  async function renderTurnstile() {
    for (let attempt = 0; attempt < 100 && !window.turnstile; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.turnstile) return;
    widgetId = window.turnstile.render('#turnstile', {
      sitekey: turnstileSiteKey,
      action: 'guestbook-signature',
      appearance: 'interaction-only',
      callback(value) {
        token = value;
        tokenWaiters.forEach((resolve) => resolve(value));
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
    if (token) return Promise.resolve(token);
    return new Promise((resolve, reject) => {
      tokenWaiters.push(resolve);
      setTimeout(() => reject(new Error('verification')), 30000);
    });
  }

  function spendToken() {
    token = '';
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  // --- Sending. A signature that can't be sent (bad event Wi-Fi) is kept and retried.

  let retryTimer = 0;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function savePending(payload) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    } catch (error) {}
  }

  function clearPending() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch (error) {}
  }

  async function send(payload) {
    sending = true;
    submitButton.disabled = true;
    clearTimeout(retryTimer);
    setStatus(text('Sending…', '送信中…'));
    try {
      const turnstileToken = await freshToken();
      spendToken();
      const response = await fetch(`${apiBase}/api/submissions/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, turnstileToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok || response.status === 409) {
        clearPending();
        showThanks(payload.ink, response.ok ? result.event : null);
        return;
      }
      if (response.status === 400) {
        // Something the server won't take as is; trying again won't help.
        clearPending();
        sending = false;
        redraw();
        setStatus(result.error || text('That didn’t work. Please try again.', 'うまくいきませんでした。もう一度お試しください。'), true);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      savePending(payload);
      setStatus(text('Couldn’t send it yet. Trying again…', 'まだ送信できません。再試行しています…'), true);
      retryTimer = setTimeout(() => send(payload), 5000);
    }
  }

  // Back online: try a waiting signature now instead of at the next retry.
  window.addEventListener('online', () => {
    const pending = readPending();
    if (pending && thanks.hidden) send(pending);
  });

  function readPending() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!strokes.length || sending) return;
    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: nameInput.value.trim(),
      note: noteInput.value.trim(),
      ink: { strokes: strokes.filter((stroke) => stroke.length) },
    };
    send(payload);
  });

  let stopReplay = () => {};

  function showThanks(ink, liveEvent) {
    sending = false;
    setStatus('');
    form.hidden = true;
    thanks.hidden = false;
    const name = nameInput.value.trim();
    const title = document.getElementById('thanks-title');
    title.dataset.en = name ? `Thank you, ${name}!` : 'Thank you!';
    title.dataset.ja = name ? `${name}さん、ありがとうございます！` : 'ありがとうございます！';
    // Only during an event is Justin's live page showing it.
    const show = document.getElementById('thanks-show');
    show.dataset.en = liveEvent ? 'It’s on my phone now. Show me!' : 'I’ll see it soon.';
    show.dataset.ja = liveEvent ? '今、私のスマホに届きました。見せてください！' : 'すぐに確認します。';
    applyLanguage();
    stopReplay = draw(document.getElementById('thanks-ink'), { width: WIDTH, height: HEIGHT, ...ink }, { animate: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('again').addEventListener('click', () => {
    stopReplay();
    strokes = [];
    startedAt = 0;
    noteInput.value = '';
    thanks.hidden = true;
    form.hidden = false;
    setStatus('');
    resize();
  });

  // --- The page's own QR code, for passing it on to the next person.

  const qrOverlay = document.getElementById('qr-overlay');
  const qrOpen = document.getElementById('qr-open');
  const qrClose = document.getElementById('qr-close');

  function openQr() {
    document.getElementById('qr-image').alt = text('QR code for onemorething.tokyo/sign', 'onemorething.tokyo/sign のQRコード');
    qrClose.setAttribute('aria-label', text('Close', '閉じる'));
    qrOverlay.hidden = false;
    qrClose.focus();
  }

  function closeQr() {
    qrOverlay.hidden = true;
    qrOpen.focus();
  }

  qrOpen.addEventListener('click', openQr);
  qrClose.addEventListener('click', closeQr);
  qrOverlay.addEventListener('click', (event) => {
    if (event.target === qrOverlay) closeQr();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !qrOverlay.hidden) closeQr();
  });

  // --- Start.

  applyLanguage();
  renderTurnstile();
  fetch(`${apiBase}/api/v1/sign/current`, { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      eventName = data?.event?.name || '';
      eventLine.hidden = !eventName;
      applyLanguage();
    })
    .catch(() => {});

  // A signature left unsent last time goes out as soon as the page is back.
  const pending = readPending();
  if (pending) {
    strokes = pending.ink.strokes;
    nameInput.value = pending.name || '';
    noteInput.value = pending.note || '';
    redraw();
    send(pending);
  }
})();
