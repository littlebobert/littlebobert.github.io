// Screensaver for the rest of the year (halloween.js has its own, with pumpkins, the last week of
// October): Tokyo at night in pixel art, with Tokyo Tower and the Skytree lit up, office windows
// going on and off, twinkling stars, and the odd shooting star. It starts after a while with no
// input, or from the Sleep Now corner, and any input wakes the desktop. The After Hours desk
// accessory under Settings has a preview, a speed slider, and Sleep Now.
(() => {
  const root = document.documentElement;
  const widget = document.getElementById('tokyo-night');
  if (root.classList.contains('halloween')) {
    widget?.remove();
    return;
  }

  const IDLE_MS = 45000;
  const SLEEP_CORNER = 10;
  const PIXEL = 3; // CSS px per art pixel
  const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
  const STORAGE_KEY = 'tokyo-night';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Only start by itself where there's a mouse; on a phone, 45 seconds of reading isn't idle.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const options = { speed: 2 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Number.isInteger(saved.speed) && saved.speed >= 0 && saved.speed < SPEEDS.length) options.speed = saved.speed;
  } catch (error) {}

  // A seeded random, so the city is the same all day and the preview holds still.
  function seeded(seed) {
    let state = seed >>> 0 || 1;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  const japanDay = () => Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 86400000);

  // --- The city, in art pixels.

  const SKY = ['#03050d', '#050915', '#080d1d', '#0b1226', '#0f1730', '#141c3a', '#1b2245', '#252a4f'];

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return [canvas, ctx];
  }

  function buildScene(width, height, seed) {
    const random = seeded(seed);
    const between = (min, max) => min + random() * (max - min);
    const horizon = height - 1;

    // Sky: bands that get warmer toward the city, dithered where they meet.
    const [sky, skyCtx] = makeCanvas(width, height);
    for (let y = 0; y < height; y += 1) {
      const t = Math.pow(y / height, 1.5) * (SKY.length - 1);
      const band = Math.floor(t);
      const blend = t - band;
      for (let x = 0; x < width; x += 1) {
        const dither = ((x + y) % 2 === 0 ? 0.25 : 0.75) < blend;
        skyCtx.fillStyle = SKY[Math.min(SKY.length - 1, band + (dither ? 1 : 0))];
        skyCtx.fillRect(x, y, 1, 1);
      }
    }

    // A crescent moon.
    const moonX = Math.round(width * 0.84);
    const moonY = Math.round(Math.max(6, height * 0.15));
    const moonR = Math.max(3, Math.round(Math.min(width, height) * 0.035));
    for (let y = -moonR; y <= moonR; y += 1) {
      for (let x = -moonR; x <= moonR; x += 1) {
        const inMoon = x * x + y * y <= moonR * moonR;
        const inShadow = (x + moonR * 0.55) ** 2 + (y - moonR * 0.2) ** 2 <= moonR * moonR;
        if (inMoon && !inShadow) {
          skyCtx.fillStyle = x * x + y * y > (moonR - 1) ** 2 ? '#d9cfa8' : '#f6eecd';
          skyCtx.fillRect(moonX + x, moonY + y, 1, 1);
        }
      }
    }

    const stars = [];
    const starCount = Math.round((width * height) / 260);
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.floor(random() * width);
      const y = Math.floor(Math.pow(random(), 1.4) * height * 0.62);
      if (Math.abs(x - moonX) <= moonR + 2 && Math.abs(y - moonY) <= moonR + 2) continue;
      stars.push({ x, y, level: random() < 0.15 ? 2 : random() < 0.5 ? 1 : 0, rate: between(700, 2600), phase: between(0, 10000) });
    }

    const [city, ctx] = makeCanvas(width, height);
    const windows = [];
    const lights = [];
    const towerX = Math.round(width * 0.3);
    const treeX = Math.round(width * 0.74);
    const treeHeight = Math.round(Math.min(height * 0.72, 210));
    const towerHeight = Math.round(treeHeight * 0.53); // 333 m to 634 m

    const WARM = ['#ffd479', '#ffc861', '#ffe2a3'];
    const COOL = ['#cfe6ff', '#b8d6f5'];
    function building(x, w, h, body, unlit, dim, chance) {
      const top = horizon - h;
      ctx.fillStyle = body;
      ctx.fillRect(x, top, w, h);
      for (let wy = top + 2; wy < horizon - 2; wy += 3) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          const on = random() < chance;
          const palette = random() < 0.6 ? WARM : COOL;
          const color = palette[Math.floor(random() * palette.length)];
          const lit = dim ? shade(color, 0.7) : color;
          windows.push({ x: wx, y: wy, lit, unlit, on });
          ctx.fillStyle = on ? lit : unlit;
          ctx.fillRect(wx, wy, 1, 1);
        }
      }
      // Antennas on the tall ones, with a blinking light.
      if (h > height * 0.24 && random() < 0.7) {
        const ax = x + Math.floor(w / 2);
        const tall = Math.round(between(3, 7));
        ctx.fillStyle = body;
        ctx.fillRect(ax, top - tall, 1, tall);
        lights.push({ x: ax, y: top - tall - 1, phase: between(0, 1600) });
      }
    }

    // Keep the landmarks' bases clear of the tallest buildings.
    const clearance = [[towerX, Math.round(towerHeight * 0.17) + 3], [treeX, Math.round(treeHeight * 0.054) + 3]];
    const nearLandmark = (x, w) => clearance.some(([cx, r]) => x < cx + r && x + w > cx - r);

    // Back row: lighter and dimmer, so the front row stands out.
    for (let x = -between(0, 8); x < width;) {
      const w = Math.round(between(6, 18));
      let h = Math.round(between(height * 0.1, height * 0.3));
      if (random() < 0.12) h = Math.round(height * between(0.3, 0.38));
      if (nearLandmark(x, w)) h = Math.min(h, Math.round(height * 0.16));
      building(Math.round(x), w, h, '#131b31', '#1a233d', true, 0.22);
      x += w + Math.round(between(0, 2));
    }

    tokyoTower(ctx, towerX, horizon, towerHeight, lights);
    skytree(ctx, treeX, horizon, treeHeight, lights, seed % 2 === 0);

    // Front row: darker, shorter, brighter windows.
    for (let x = -between(0, 6); x < width;) {
      const w = Math.round(between(5, 15));
      let h = Math.round(between(height * 0.05, height * 0.18));
      if (nearLandmark(x, w)) h = Math.min(h, Math.round(height * 0.08));
      building(Math.round(x), w, h, '#070a15', '#0e1322', false, 0.3);
      x += w + Math.round(between(1, 4));
    }
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, horizon, width, 1);

    return { width, height, sky, city, cityCtx: ctx, stars, windows, lights, random };
  }

  function shade(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const channel = (offset) => Math.round(((value >> offset) & 255) * amount);
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  }

  // Tokyo Tower, lit orange: a tapering lattice on an arched base, two decks, and an antenna.
  function tokyoTower(ctx, cx, base, h, lights) {
    const baseHalf = Math.max(4, Math.round(h * 0.17));
    for (let i = 0; i < h; i += 1) {
      const y = base - 1 - i;
      const t = i / h;
      const half = t > 0.86 ? 0 : (baseHalf - 1) * Math.pow(1 - t / 0.86, 2.2) + 0.6;
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      ctx.fillStyle = '#ffa043';
      ctx.fillRect(left, y, 1, 1);
      ctx.fillRect(right, y, 1, 1);
      for (let x = left + 1; x < right; x += 1) {
        // The arch between the four legs.
        const across = (x - cx) / Math.max(1, half);
        if (t < 0.17 * Math.sqrt(Math.max(0, 1 - across * across))) continue;
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = '#d9671c';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    const deck = (t, height, extra) => {
      const half = (baseHalf - 1) * Math.pow(1 - t / 0.86, 2.2) + 0.6 + extra;
      const y = Math.round(base - 1 - t * h);
      ctx.fillStyle = '#ffcf8f';
      ctx.fillRect(Math.round(cx - half), y - height + 1, Math.round(half * 2) + 1, height);
      ctx.fillStyle = '#fff3d6';
      for (let x = Math.round(cx - half) + 1; x < cx + half; x += 2) ctx.fillRect(x, y - 1, 1, 1);
    };
    deck(0.42, 3, 2);
    deck(0.72, 2, 1.5);
    lights.push({ x: cx, y: base - h - 1, phase: 0 });
  }

  // The Skytree, from its real proportions (634 m): a wide tripod base narrowing in a gentle
  // concave curve to the Tembo Deck pod at 350 m, a smaller Tembo Galleria ring at 450 m, a slim
  // shaft to the antenna section at about 500 m, and a needle on top with a white strobe. Lit on
  // alternating days in Iki (pale blue) or Miyabi (purple, with gold decks), like the real one.
  function skytree(ctx, cx, base, h, lights, iki) {
    const [edge, inner, core, deckLight] = iki
      ? ['#c4e8ff', '#5aa3db', '#e9f7ff', '#f2fbff']
      : ['#dcbcff', '#8a5ccf', '#f4e9ff', '#ffe09a'];
    // Half the width at each height, as a fraction of the tower's height.
    const DECK = [0.535, 0.553];
    const GALLERIA = [0.7, 0.71];
    const profile = (t) => {
      if (t < DECK[0]) return 0.022 + 0.032 * Math.pow(1 - t / DECK[0], 1.7);
      if (t < 0.7) return 0.019 - 0.004 * ((t - DECK[1]) / (0.7 - DECK[1]));
      if (t < 0.78) return 0.014 - 0.003 * ((t - GALLERIA[1]) / (0.78 - GALLERIA[1]));
      if (t < 0.9) return 0.006 - 0.003 * ((t - 0.78) / 0.12);
      return 0;
    };
    const halfAt = (t) => Math.max(t < 0.9 ? 0.6 : 0, profile(t) * h);
    const mod = (n, m) => ((n % m) + m) % m;

    for (let i = 0; i < h; i += 1) {
      const y = base - 1 - i;
      const t = i / h;
      const half = halfAt(t);
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      ctx.fillStyle = t < 0.78 ? edge : inner;
      ctx.fillRect(left, y, 1, 1);
      if (right !== left) ctx.fillRect(right, y, 1, 1);
      for (let x = left + 1; x < right; x += 1) {
        // A diamond truss where the tower is wide enough to show one, with the lit core
        // column (the shinbashira) glowing up the middle.
        if (x === cx && t < DECK[0]) ctx.fillStyle = core;
        else if (right - left >= 6 && !(mod(x + y, 4) === 0 || mod(x - y, 4) === 0)) continue;
        else ctx.fillStyle = inner;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // The decks: a band of windows between lit rims, flaring out from the shaft below.
    const deck = ([from, to], extra) => {
      const bottom = Math.round(base - 1 - from * h);
      const top = Math.round(base - 1 - to * h);
      const half = Math.round(halfAt(from) + extra);
      for (let y = top; y <= bottom + 1; y += 1) {
        const flare = y > bottom ? 1 : 0; // a narrower row under the pod
        const left = cx - half + flare;
        const width = (half - flare) * 2 + 1;
        const rim = y === top || y >= bottom;
        ctx.fillStyle = rim ? edge : deckLight;
        ctx.fillRect(left, y, width, 1);
        if (!rim) {
          ctx.fillStyle = inner;
          for (let x = left + 1; x < left + width - 1; x += 3) ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    deck(DECK, Math.max(2, h * 0.016));
    deck(GALLERIA, Math.max(1, h * 0.008));

    lights.push({ x: cx, y: base - h - 1, phase: 0, color: '#ffffff', flash: 120 });
    lights.push({ x: cx, y: Math.round(base - 1 - 0.78 * h), phase: 800, color: '#ffffff', flash: 120 });
  }

  // --- Drawing a frame.

  const STAR = ['#4c5675', '#97a1c2', '#eef1ff'];

  function drawFrame(ctx, scene, now, shootingStar) {
    ctx.drawImage(scene.sky, 0, 0);
    scene.stars.forEach((star) => {
      const twinkle = Math.sin((now + star.phase) / star.rate);
      const level = Math.max(0, Math.min(2, star.level + (twinkle > 0.8 ? 1 : twinkle < -0.85 ? -1 : 0)));
      ctx.fillStyle = STAR[level];
      ctx.fillRect(star.x, star.y, 1, 1);
      if (level === 2 && star.level === 2 && twinkle > 0.93) {
        ctx.fillStyle = STAR[0];
        ctx.fillRect(star.x - 1, star.y, 1, 1);
        ctx.fillRect(star.x + 1, star.y, 1, 1);
        ctx.fillRect(star.x, star.y - 1, 1, 1);
        ctx.fillRect(star.x, star.y + 1, 1, 1);
      }
    });
    if (shootingStar) {
      for (let i = 0; i < 14; i += 1) {
        const x = Math.round(shootingStar.x + i * 2);
        const y = Math.round(shootingStar.y - i);
        ctx.fillStyle = i < 2 ? '#ffffff' : i < 6 ? '#c9d2f2' : i < 10 ? '#7681a6' : '#3a4363';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.drawImage(scene.city, 0, 0);
    // Red aircraft lights blink; the Skytree's white strobes flash.
    scene.lights.forEach((light) => {
      if ((now + light.phase) % 1600 > (light.flash || 380)) return;
      ctx.fillStyle = light.color || '#ff4433';
      ctx.fillRect(light.x, light.y, 1, 1);
    });
  }

  // --- The screensaver.

  let lastInputAt = Date.now();
  let lastPointer = null;
  let saver = null;

  function start(fromCorner = false) {
    const width = Math.ceil(window.innerWidth / PIXEL);
    const height = Math.ceil(window.innerHeight / PIXEL);
    const speed = SPEEDS[options.speed];

    const screen = document.createElement('div');
    screen.className = 'tokyo-night-screen';
    screen.setAttribute('aria-hidden', 'true');
    const [canvas, ctx] = makeCanvas(width, height);
    canvas.style.width = `${width * PIXEL}px`;
    canvas.style.height = `${height * PIXEL}px`;
    screen.append(canvas);
    document.body.append(screen);
    requestAnimationFrame(() => screen.classList.add('is-on'));

    const scene = buildScene(width, height, japanDay());
    const random = Math.random;
    const between = (min, max) => min + random() * (max - min);

    let shootingStar = null;
    let nextShootingStar = performance.now() + between(3000, 9000) / speed;
    let nextWindow = performance.now() + 400;
    let last = performance.now();
    let raf = 0;

    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!shootingStar && now > nextShootingStar) {
        shootingStar = { x: between(width * 0.2, width), y: between(2, height * 0.3), vx: -150 * speed, vy: 75 * speed, life: 0 };
      }
      if (shootingStar) {
        shootingStar.x += shootingStar.vx * dt;
        shootingStar.y += shootingStar.vy * dt;
        shootingStar.life += dt;
        if (shootingStar.life > 0.7 || shootingStar.x < -30) {
          shootingStar = null;
          nextShootingStar = now + between(6000, 16000) / speed;
        }
      }

      // Somebody works late; somebody goes home.
      if (now > nextWindow && scene.windows.length) {
        nextWindow = now + between(150, 600) / speed;
        const pane = scene.windows[Math.floor(random() * scene.windows.length)];
        if (random() < 0.45) pane.on = !pane.on;
        scene.cityCtx.fillStyle = pane.on ? pane.lit : pane.unlit;
        scene.cityCtx.fillRect(pane.x, pane.y, 1, 1);
      }

      drawFrame(ctx, scene, now, shootingStar);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    saver = {
      startedAt: Date.now(),
      pointer: lastPointer,
      fromCorner,
      stop() {
        cancelAnimationFrame(raf);
        screen.classList.remove('is-on');
        setTimeout(() => screen.remove(), 300);
        saver = null;
        lastInputAt = Date.now();
      },
    };
  }

  // Sleep Now corner: put the mouse in the bottom-left corner to start it now. A quick flick can
  // leave the window without a move inside the corner, so leaving counts too.
  const inSleepCorner = (event) => event.pointerType === 'mouse'
    && event.clientX <= SLEEP_CORNER && event.clientY >= window.innerHeight - SLEEP_CORNER;

  // Wake on any input, and swallow the key that woke it so it doesn't also type or navigate.
  const onInput = (event) => {
    lastInputAt = Date.now();
    if (!saver) {
      if (event.type === 'pointermove') lastPointer = [event.clientX, event.clientY];
      if (inSleepCorner(event) && !reduceMotion.matches) start(true);
      return;
    }
    if (event.type === 'pointerout') return;
    if (event.type === 'pointermove') {
      if (saver.fromCorner && inSleepCorner(event)) return;
      // Ignore the tiny drift a resting mouse or a re-layout can report.
      if (Date.now() - saver.startedAt < 600) return;
      const here = [event.clientX, event.clientY];
      saver.pointer ??= here;
      if (Math.hypot(here[0] - saver.pointer[0], here[1] - saver.pointer[1]) < 6) return;
    }
    if (event.type === 'keydown') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    saver.stop();
  };
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
    window.addEventListener(type, onInput, { capture: true, passive: type !== 'keydown' });
  });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) onInput(event);
  });
  window.addEventListener('scroll', () => { lastInputAt = Date.now(); }, { capture: true, passive: true });
  window.addEventListener('resize', () => saver?.stop());

  setInterval(() => {
    if (saver || document.hidden || Date.now() - lastInputAt < IDLE_MS) return;
    if (reduceMotion.matches || !finePointer.matches) return;
    // Clicks inside the desktop browser or a video land in an iframe, where we can't see them.
    if (document.activeElement?.tagName === 'IFRAME') return;
    // Not in the middle of a call on the Speak phone.
    if (document.querySelector('.speak.is-in-call')) return;
    start();
  }, 1000);

  // --- After Hours desk accessory.

  if (!widget) return;

  const preview = widget.querySelector('.tokyo-night-preview');
  if (preview) {
    const scene = buildScene(preview.width, preview.height, 7);
    const ctx = preview.getContext('2d');
    drawFrame(ctx, scene, 0, null);
  }

  widget.querySelectorAll('input[data-option]').forEach((input) => {
    input.value = String(options[input.dataset.option]);
    input.addEventListener('input', () => {
      options[input.dataset.option] = Number(input.value);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
      } catch (error) {}
    });
  });

  const sleepButton = widget.querySelector('.after-dark-sleep');
  sleepButton.addEventListener('click', () => {
    sleepButton.blur();
    if (!saver) start();
  });
  // With Reduce Motion there's no screensaver, so there's nothing to start.
  const syncMotion = () => { sleepButton.disabled = reduceMotion.matches; };
  reduceMotion.addEventListener('change', syncMotion);
  syncMotion();

  // Placement: under Settings on wide screens, stacked with the other desk accessories.
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
  widget.querySelector('.close-box').addEventListener('click', () => {
    widget.remove();
    placement.disconnect();
    place();
  });
  place();
})();
