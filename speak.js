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
        ? t('Call Justin’s virtual assistant.', 'ジャスティンのバーチャルアシスタントに電話してみてください。')
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
      : t('Call Justin’s virtual assistant', 'ジャスティンのバーチャルアシスタントに電話する'));
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

  // --- The phone, in pencil: a 黒電話 drawn the way you'd sketch one, with tapered strokes that
  // overshoot their corners, hatching that follows the form, highlights erased out of the black
  // bakelite, a cast shadow, and a few faint construction lines. While a call is on it's redrawn
  // about eight times a second with fresh wobble, like a flipbook; otherwise it holds still, and
  // always does with Reduce Motion. Drawn in a 220 × 100 sketch, scaled to fit.

  let width = 0;
  let height = 0;
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const wobble = (amount) => (random() - 0.5) * 2 * amount;
  const GRAPHITE = '38, 36, 34';

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  // Catmull-Rom through the points, so outlines are curves rather than polygons.
  function smooth(points, closed = false, steps = 6) {
    const count = points.length;
    const at = (index) => (closed
      ? points[(index + count) % count]
      : points[Math.max(0, Math.min(count - 1, index))]);
    const out = [];
    const last = closed ? count : count - 1;
    for (let i = 0; i < last; i += 1) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([0, 1].map((axis) => 0.5 * (
          2 * p1[axis]
          + (-p0[axis] + p2[axis]) * t
          + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
          + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3)));
      }
    }
    out.push(closed ? out[0] : points[count - 1]);
    return out;
  }

  const ellipse = (cx, cy, rx, ry, from = 0, to = Math.PI * 2, steps = 32) => {
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
      const angle = from + ((to - from) * step) / steps;
      points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
    }
    return points;
  };

  const toPath = (points) => {
    const path = new Path2D();
    points.forEach(([x, y], index) => (index ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    return path;
  };

  // A pencil line: pressure swells in the middle and lifts at the ends, an open stroke runs a
  // little past where it should stop, and a lighter second pass sits just off the first.
  function stroke(points, { weight = 1.2, tone = 0.85, overshoot = 1.6, passes = 2, closed = false } = {}) {
    let line = points;
    if (!closed && line.length > 1 && overshoot) {
      const extend = ([ax, ay], [bx, by]) => {
        const length = Math.hypot(ax - bx, ay - by) || 1;
        return [ax + ((ax - bx) / length) * overshoot, ay + ((ay - by) / length) * overshoot];
      };
      line = [extend(line[0], line[1]), ...line, extend(line[line.length - 1], line[line.length - 2])];
    }
    ctx.lineCap = 'round';
    for (let pass = 0; pass < passes; pass += 1) {
      const phase = random() * 10;
      const drift = [wobble(0.5), wobble(0.5)];
      const jittered = line.map(([x, y], index) => [
        x + Math.sin(index * 0.45 + phase) * 0.45 + drift[0] * pass + wobble(0.12),
        y + Math.cos(index * 0.38 + phase) * 0.45 + drift[1] * pass + wobble(0.12),
      ]);
      for (let i = 1; i < jittered.length; i += 1) {
        const k = i / (jittered.length - 1);
        const pressure = closed ? 0.8 + 0.2 * Math.sin(k * Math.PI * 3 + phase) : 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * k), 0.6);
        ctx.beginPath();
        ctx.moveTo(...jittered[i - 1]);
        ctx.lineTo(...jittered[i]);
        ctx.lineWidth = weight * pressure * (pass ? 0.6 : 1);
        ctx.strokeStyle = `rgba(${GRAPHITE}, ${tone * (pass ? 0.45 : 1)})`;
        ctx.stroke();
      }
    }
  }

  // Hatching inside a shape: short parallel strokes at an angle, broken into dashes of varied
  // length, the way a hand lays down tone.
  function hatch(path, { angle = -0.95, spacing = 2.2, tone = 0.5, weight = 0.7, bounds = [0, 0, 220, 100] } = {}) {
    const [x0, y0, x1, y1] = bounds;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const reach = Math.hypot(x1 - x0, y1 - y0) / 2;
    ctx.save();
    ctx.clip(path);
    ctx.lineCap = 'round';
    for (let offset = -reach; offset <= reach; offset += spacing + wobble(0.35)) {
      let along = -reach;
      while (along < reach) {
        const dash = 7 + random() * 16;
        const sx = cx + nx * offset + dx * along;
        const sy = cy + ny * offset + dy * along;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx * dash, sy + dy * dash);
        ctx.lineWidth = weight * (0.7 + random() * 0.5);
        ctx.strokeStyle = `rgba(${GRAPHITE}, ${tone * (0.75 + random() * 0.35)})`;
        ctx.stroke();
        along += dash + random() * 2.5;
      }
    }
    ctx.restore();
  }

  // An eraser: lifts graphite back off the paper for highlights.
  function erase(draw) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    draw();
    ctx.restore();
  }

  // The handset, around its middle: an arched handle between two cups that open downward.
  function handsetShape() {
    const top = smooth([[-41, -2], [-28, -7], [0, -9], [28, -7], [41, -2]]);
    const bottom = smooth([[37, 3], [20, -1], [0, -2], [-20, -1], [-37, 3]]);
    return {
      handle: [...top, ...bottom],
      top,
      bottom,
      cups: [-46, 46].map((x) => ellipse(x, 3, 11, 7.5)),
    };
  }

  function draw() {
    if (!width || !height) return;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const inCall = ['dialing', 'listening', 'speaking'].includes(state);
    const now = performance.now();
    const still = reduceMotion.matches;
    // A new drawing for each flipbook frame; the same one whenever the phone sits still.
    seed = inCall && !still ? (Math.floor(now / 120) % 100000) + 7 : 42;
    const output = conversation && state === 'speaking' ? safeVolume('getOutputVolume') : 0;
    const micLevel = conversation && state === 'listening' && !textOnly ? safeVolume('getInputVolume') : 0;

    const scale = Math.min(width / 220, height / 100);
    ctx.translate((width - 220 * scale) / 2, (height - 100 * scale) / 2);
    ctx.scale(scale, scale);

    // Construction lines, barely there.
    stroke([[18, 66], [202, 66]], { weight: 0.5, tone: 0.1, passes: 1, overshoot: 0 });
    stroke([[110, 14], [110, 97]], { weight: 0.5, tone: 0.08, passes: 1, overshoot: 0 });

    // The cast shadow on the desk, and the desk's edge.
    const shadow = toPath(ellipse(112, 91.5, 66, 4.6));
    hatch(shadow, { angle: 0.05, spacing: 1.3, tone: 0.32, weight: 0.6, bounds: [40, 84, 184, 98] });
    stroke([[22, 93.5], [96, 93]], { weight: 0.7, tone: 0.35, passes: 1 });
    stroke([[128, 93], [198, 93.5]], { weight: 0.7, tone: 0.35, passes: 1 });

    // The body: a low dome on a flanged base.
    const bodyOutline = smooth([
      [58, 89], [51, 82], [55, 68], [64, 55], [76, 47], [110, 43],
      [144, 47], [156, 55], [165, 68], [169, 82], [162, 89], [110, 90.5],
    ], true);
    const body = toPath(bodyOutline);
    hatch(body, { angle: -0.95, spacing: 1.9, tone: 0.62, bounds: [48, 40, 172, 92] });
    // Cross-hatching where the body turns away from the light, and under the dome.
    ctx.save();
    ctx.clip(body);
    hatch(new Path2D('M 128 40 L 175 40 L 175 92 L 118 92 Z'), { angle: 0.75, spacing: 2.3, tone: 0.4, bounds: [118, 40, 175, 92] });
    hatch(new Path2D('M 40 78 L 180 78 L 180 92 L 40 92 Z'), { angle: 0.12, spacing: 1.7, tone: 0.35, bounds: [40, 78, 180, 92] });
    ctx.restore();
    // Glossy highlights erased out of the bakelite: the shoulder, and a rim of light on the right.
    erase(() => {
      stroke(smooth([[62, 70], [68, 58], [80, 50], [98, 46]]), { weight: 4.2, tone: 0.95, passes: 1, overshoot: 0 });
      stroke(smooth([[66, 73], [74, 59], [86, 52]]), { weight: 1.6, tone: 0.9, passes: 1, overshoot: 0 });
      stroke(smooth([[159, 60], [164, 71], [166, 81]]), { weight: 1.3, tone: 0.8, passes: 1, overshoot: 0 });
    });
    stroke(bodyOutline, { weight: 1.5, tone: 0.9, closed: true });
    stroke(smooth([[57, 84.5], [110, 86], [163, 84.5]]), { weight: 0.8, tone: 0.55 }); // the flange

    // The cradle's two rests on top of the dome.
    [[86, 0], [134, 1]].forEach(([x, lean]) => {
      const rest = smooth([[x - 6, 46.5], [x - 5, 40], [x - 1 + lean, 37.5], [x + 4 + lean, 38.5], [x + 6, 45.5]]);
      hatch(toPath([...rest, [x, 47]]), { angle: -0.95, spacing: 1.6, tone: 0.6, bounds: [x - 8, 35, x + 8, 48] });
      stroke(rest, { weight: 1.1, tone: 0.85 });
    });

    // The dial: paper showing through a finger wheel of ten holes, the center card, and the
    // finger stop. It turns back home while dialing.
    const dial = [110, 66];
    const turn = state === 'dialing' && !still ? -0.55 - Math.sin(now / 240) * 0.55 : 0;
    erase(() => {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(dial[0], dial[1], 16.5, 0, Math.PI * 2);
      ctx.fill();
    });
    hatch(toPath(ellipse(dial[0] + 3, dial[1] + 3, 15, 15)), { angle: -0.95, spacing: 2.6, tone: 0.16, bounds: [94, 50, 128, 84] });
    stroke(ellipse(...dial, 15.5, 15.5), { weight: 1.3, tone: 0.9, closed: true });
    stroke(ellipse(...dial, 13.6, 13.6, -2.6, 2.2, 24), { weight: 0.5, tone: 0.3, passes: 1 });
    for (let hole = 0; hole < 10; hole += 1) {
      const angle = (-40 - hole * 28) * (Math.PI / 180) + turn;
      const hx = dial[0] + Math.cos(angle) * 10.2;
      const hy = dial[1] + Math.sin(angle) * 10.2;
      stroke(ellipse(hx, hy, 2.6, 2.6, 0, Math.PI * 2, 10), { weight: 0.75, tone: 0.75, closed: true, passes: 1 });
      stroke(ellipse(hx, hy, 1.8, 1.8, Math.PI * 0.9, Math.PI * 1.9, 6), { weight: 0.9, tone: 0.5, passes: 1, overshoot: 0 });
    }
    stroke(ellipse(...dial, 4.6, 4.6, 0, Math.PI * 2, 14), { weight: 0.8, tone: 0.7, closed: true, passes: 1 });
    stroke([[dial[0] - 2.4, dial[1] - 0.8], [dial[0] + 2.2, dial[1] - 1]], { weight: 0.5, tone: 0.45, passes: 1, overshoot: 0 });
    stroke([[dial[0] - 1.8, dial[1] + 1.2], [dial[0] + 1.6, dial[1] + 1.1]], { weight: 0.5, tone: 0.45, passes: 1, overshoot: 0 });
    const stop = 22 * (Math.PI / 180);
    stroke(smooth([
      [dial[0] + Math.cos(stop) * 13, dial[1] + Math.sin(stop) * 13],
      [dial[0] + Math.cos(stop) * 17.5, dial[1] + Math.sin(stop) * 17.5],
      [dial[0] + Math.cos(stop + 0.18) * 19, dial[1] + Math.sin(stop + 0.18) * 19],
    ]), { weight: 1.1, tone: 0.85, passes: 1, overshoot: 0 });

    // The handset: resting in the cradle, or lifted and tilted during a call, rattling with the
    // voice on the line.
    const shake = still ? 0 : output * 2.2;
    const lift = inCall ? 1 : 0;
    const origin = [110 - 4 * lift + wobble(shake), 34.5 - 19 * lift + wobble(shake)];
    const tilt = -0.17 * lift + wobble(shake * 0.015);
    const place = ([x, y]) => [
      origin[0] + x * Math.cos(tilt) - y * Math.sin(tilt),
      origin[1] + x * Math.sin(tilt) + y * Math.cos(tilt),
    ];
    const handset = handsetShape();

    // The coiled cord, behind the handset: from the body's side to the mouthpiece, sagging.
    const cordStart = [166, 76];
    const cordEnd = place([47, 10]);
    const sag = [Math.max(cordStart[0], cordEnd[0]) + 20, (cordStart[1] + cordEnd[1]) / 2 + 14];
    const coil = [];
    const turns = 13;
    for (let step = 0; step <= turns * 10; step += 1) {
      const k = step / (turns * 10);
      const x = (1 - k) ** 2 * cordStart[0] + 2 * (1 - k) * k * sag[0] + k ** 2 * cordEnd[0];
      const y = (1 - k) ** 2 * cordStart[1] + 2 * (1 - k) * k * sag[1] + k ** 2 * cordEnd[1];
      const tx = 2 * (1 - k) * (sag[0] - cordStart[0]) + 2 * k * (cordEnd[0] - sag[0]);
      const ty = 2 * (1 - k) * (sag[1] - cordStart[1]) + 2 * k * (cordEnd[1] - sag[1]);
      const length = Math.hypot(tx, ty) || 1;
      const phase = k * turns * Math.PI * 2;
      coil.push([
        x + (-ty / length) * Math.cos(phase) * 2.6 + (tx / length) * Math.sin(phase) * 1.4,
        y + (tx / length) * Math.cos(phase) * 2.6 + (ty / length) * Math.sin(phase) * 1.4,
      ]);
    }
    stroke(coil, { weight: 0.75, tone: 0.7, passes: 1, overshoot: 0 });

    const handlePath = toPath(handset.handle.map(place));
    const cupPaths = handset.cups.map((cup) => toPath(cup.map(place)));
    const reach = [origin[0] - 62, origin[1] - 22, origin[0] + 62, origin[1] + 22];
    // Paper behind the handset, so the body's lines don't show through it.
    erase(() => {
      ctx.fillStyle = '#000';
      [handlePath, ...cupPaths].forEach((path) => ctx.fill(path));
    });
    [handlePath, ...cupPaths].forEach((path) => hatch(path, { angle: -0.95, spacing: 1.6, tone: 0.72, bounds: reach }));
    cupPaths.forEach((path) => {
      ctx.save();
      ctx.clip(path);
      hatch(new Path2D(`M ${reach[0]} ${origin[1] + 3} L ${reach[2]} ${origin[1] + 3} L ${reach[2]} ${reach[3]} L ${reach[0]} ${reach[3]} Z`), {
        angle: 0.7, spacing: 2, tone: 0.4, bounds: reach,
      });
      ctx.restore();
    });
    erase(() => {
      stroke(smooth([[-30, -6.2], [-10, -7.6], [12, -7.4], [28, -5.8]].map(place)), { weight: 1.7, tone: 0.95, passes: 1, overshoot: 0 });
      [-46, 46].forEach((x) => stroke(ellipse(x, 3, 8, 5, Math.PI * 1.1, Math.PI * 1.55, 8).map(place), {
        weight: 1.6, tone: 0.9, passes: 1, overshoot: 0,
      }));
    });
    stroke(handset.top.map(place), { weight: 1.3, tone: 0.9 });
    stroke(handset.bottom.map(place), { weight: 1, tone: 0.75 });
    handset.cups.forEach((cup, index) => {
      stroke(cup.map(place), { weight: 1.3, tone: 0.9, closed: true });
      const x = index ? 46 : -46;
      stroke(ellipse(x, 8.4, 8, 1.8, 0.1, Math.PI - 0.1, 10).map(place), { weight: 0.7, tone: 0.6, passes: 1, overshoot: 0 });
    });

    // Sound from the earpiece while the desk talks; a scribble at the mouthpiece while it listens.
    if (state === 'speaking') {
      const rings = still ? 2 : 1 + Math.round(output * 3);
      for (let ring = 1; ring <= rings; ring += 1) {
        const r = 4 + ring * 4.5;
        stroke(ellipse(-57, 3, r, r, Math.PI * 0.78, Math.PI * 1.22, 8).map(place), { weight: 1, tone: 0.75, passes: 1 });
      }
    }
    if (state === 'listening' && !textOnly) {
      const amplitude = still ? 1.6 : 0.8 + micLevel * 5;
      const scribble = [];
      for (let step = 0; step <= 14; step += 1) {
        scribble.push([59 + step * 1.3, 4 + Math.sin(step * 1.5 + now / 90) * amplitude]);
      }
      stroke(scribble.map(place), { weight: 0.8, tone: 0.6, passes: 1 });
    }
    ctx.restore();
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

  // --- Placement: under the clocks on wide screens. It shares their grid cell, so it's pushed
  // down by their height, and follows them when one is rolled up.

  const clocks = document.querySelector('.clock-row');
  function place() {
    if (clocks) widget.style.setProperty('--speak-top', `${36 + clocks.offsetHeight + 12}px`);
  }

  const placement = new ResizeObserver(place);
  if (clocks) placement.observe(clocks);
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
