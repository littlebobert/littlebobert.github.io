// Screensaver for the rest of the year (halloween.js has its own, with pumpkins, the last week of
// October): Tokyo at night in pixel art, with Tokyo Tower and the Skytree lit up, office windows
// going on and off, twinkling stars, the odd shooting star, and paper cranes flying over it all.
// It starts after a while with no input, or from the Sleep Now corner, and any input wakes the
// desktop. The After Hours desk accessory under Settings has a preview, sliders, and Sleep Now.
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
  const DENSITIES = [0.5, 0.75, 1, 1.5, 2];
  const STORAGE_KEY = 'tokyo-night';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Only start by itself where there's a mouse; on a phone, 45 seconds of reading isn't idle.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const options = { speed: 2, density: 2 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    ['speed', 'density'].forEach((key) => {
      if (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] < SPEEDS.length) options[key] = saved[key];
    });
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

  // --- Paper cranes, drawn as triangles on a 24 × 17 grid, flying left. Three wing positions.

  const CRANE_W = 24;
  const CRANE_H = 17;
  // Origami paper: [light, fold, shade].
  const PAPERS = [
    ['#f05a4f', '#c8433b', '#932c27'],
    ['#f4f1e8', '#d3cec0', '#a29d90'],
    ['#f6a3bd', '#d77f9c', '#a85b75'],
    ['#f0c75e', '#cfa43f', '#9a7629'],
    ['#5cc2b6', '#3f9b90', '#2b6f68'],
    ['#6d9be0', '#4e78b8', '#375589'],
  ];

  function triangle(grid, [ax, ay], [bx, by], [cx, cy], tone) {
    const side = (px, py, x0, y0, x1, y1) => (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
    for (let y = 0; y < CRANE_H; y += 1) {
      for (let x = 0; x < CRANE_W; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d1 = side(px, py, ax, ay, bx, by);
        const d2 = side(px, py, bx, by, cx, cy);
        const d3 = side(px, py, cx, cy, ax, ay);
        const negative = d1 < 0 || d2 < 0 || d3 < 0;
        const positive = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(negative && positive)) grid[y][x] = tone;
      }
    }
  }

  // Tones: 0 light, 1 fold, 2 shade.
  const WINGS = {
    up: { back: [[11, 9], [15, 9], [17, 0]], front: [[[10, 9], [12, 9], [11, 0]], [[12, 9], [14, 9], [11, 0]]] },
    level: { back: [[11, 9], [15, 9], [20, 3]], front: [[[10, 9], [13, 10], [18, 5]], [[13, 10], [15, 10], [18, 5]]] },
    down: { back: [[11, 10], [15, 10], [17, 16]], front: [[[10, 10], [12, 10], [12, 16]], [[12, 10], [14, 10], [12, 16]]] },
  };

  function craneGrid(wing) {
    const grid = Array.from({ length: CRANE_H }, () => Array(CRANE_W).fill(-1));
    const { back, front } = WINGS[wing];
    triangle(grid, ...back, 2);
    triangle(grid, [7, 10], [17, 10], [12, 7], 0); // body, top
    triangle(grid, [7, 10], [17, 10], [12, 13], 2); // body, underside
    // The neck and tail rise steeply on either side, the crane's V.
    triangle(grid, [7, 10], [10, 10], [4, 1], 0); // neck
    triangle(grid, [4, 1], [5, 3], [1, 4], 1); // head and beak
    triangle(grid, [14, 10], [17, 10], [21, 1], 1); // tail
    triangle(grid, ...front[0], 0);
    triangle(grid, ...front[1], 1);
    return grid;
  }

  const CRANE_FRAMES = ['up', 'level', 'down'].map(craneGrid);
  const FLAP = [0, 1, 2, 1];

  // One small canvas per paper and wing position.
  const craneSprites = PAPERS.map((paper) => CRANE_FRAMES.map((grid) => {
    const sprite = document.createElement('canvas');
    sprite.width = CRANE_W;
    sprite.height = CRANE_H;
    const ctx = sprite.getContext('2d');
    grid.forEach((row, y) => row.forEach((tone, x) => {
      if (tone < 0) return;
      ctx.fillStyle = paper[tone];
      ctx.fillRect(x, y, 1, 1);
    }));
    return sprite;
  }));

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

    const nearLandmark = (x, w) => [towerX, treeX].some((cx) => x < cx + 9 && x + w > cx - 9);

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

  // The Skytree: a tripod base narrowing to a slim shaft, two observation decks, and a long
  // antenna. Lit on alternating days in Iki (pale blue) or Miyabi (purple), like the real one.
  function skytree(ctx, cx, base, h, lights, iki) {
    const [edge, inner, deckColor] = iki
      ? ['#a6dcff', '#5d9fd1', '#e3f4ff']
      : ['#cfa7ff', '#8a63c9', '#f1e5ff'];
    const baseHalf = Math.max(3, Math.round(h * 0.05));
    for (let i = 0; i < h; i += 1) {
      const y = base - 1 - i;
      const t = i / h;
      let half;
      if (t > 0.8) half = 0;
      else if (t > 0.72) half = 0.6;
      else half = 1.9 + (baseHalf - 1.9) * Math.pow(Math.max(0, 1 - t / 0.14), 1.6);
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      ctx.fillStyle = edge;
      ctx.fillRect(left, y, 1, 1);
      ctx.fillRect(right, y, 1, 1);
      ctx.fillStyle = inner;
      for (let x = left + 1; x < right; x += 1) {
        if ((x + y) % 2 === 0 || t > 0.14) ctx.fillRect(x, y, 1, 1);
      }
    }
    const deck = (t, height, half) => {
      const y = Math.round(base - 1 - t * h);
      ctx.fillStyle = deckColor;
      ctx.fillRect(cx - half, y - height + 1, half * 2 + 1, height);
      ctx.fillStyle = inner;
      ctx.fillRect(cx - half, y - height + 1, half * 2 + 1, 1);
    };
    deck(0.55, 5, Math.max(4, Math.round(h * 0.035)));
    deck(0.7, 3, Math.max(3, Math.round(h * 0.026)));
    lights.push({ x: cx, y: base - h - 1, phase: 700 });
    lights.push({ x: cx, y: Math.round(base - 1 - 0.55 * h) - 4, phase: 1100 });
  }

  // --- Drawing a frame.

  const STAR = ['#4c5675', '#97a1c2', '#eef1ff'];

  function drawFrame(ctx, scene, now, cranes, shootingStar) {
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
    scene.lights.forEach((light) => {
      if ((now + light.phase) % 1600 > 380) return;
      ctx.fillStyle = '#ff4433';
      ctx.fillRect(light.x, light.y, 1, 1);
    });
    cranes.forEach((crane) => {
      ctx.drawImage(craneSprites[crane.paper][crane.frame], Math.round(crane.x), Math.round(crane.y + crane.bob));
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
    const density = DENSITIES[options.density];

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

    const craneCount = Math.max(1, Math.round(Math.min(9, Math.max(3, (width * height) / 16000)) * density));
    // Cranes come in from the right or the top, mostly over the sky.
    const respawn = (crane, anywhere = false) => {
      crane.paper = Math.floor(random() * PAPERS.length);
      crane.speed = between(18, 32) * speed;
      crane.slope = between(0.05, 0.2);
      if (anywhere) {
        crane.x = between(0, width);
        crane.y = between(0, height * 0.55);
      } else if (random() < width / (width + height * 0.6)) {
        crane.x = between(width * 0.2, width + CRANE_W);
        crane.y = -CRANE_H - between(0, 20);
      } else {
        crane.x = width + between(0, 30);
        crane.y = between(0, height * 0.45);
      }
    };
    const cranes = Array.from({ length: craneCount }, () => {
      const crane = { phase: between(0, 1000), frame: 1, bob: 0 };
      respawn(crane, true);
      return crane;
    });

    let shootingStar = null;
    let nextShootingStar = performance.now() + between(3000, 9000) / speed;
    let nextWindow = performance.now() + 400;
    let last = performance.now();
    let raf = 0;

    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      cranes.forEach((crane) => {
        crane.x -= crane.speed * dt;
        crane.y += crane.speed * crane.slope * dt;
        if (crane.x < -CRANE_W || crane.y > height) respawn(crane);
        crane.bob = Math.sin((now + crane.phase) / 420) * 1.5;
        const beat = Math.floor(((now + crane.phase) * Math.sqrt(speed)) / 170);
        crane.frame = FLAP[beat % FLAP.length];
      });

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
        nextWindow = now + between(150, 600);
        const pane = scene.windows[Math.floor(random() * scene.windows.length)];
        if (random() < 0.45) pane.on = !pane.on;
        scene.cityCtx.fillStyle = pane.on ? pane.lit : pane.unlit;
        scene.cityCtx.fillRect(pane.x, pane.y, 1, 1);
      }

      drawFrame(ctx, scene, now, cranes, shootingStar);
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
    drawFrame(ctx, scene, 0, [{ paper: 0, frame: 0, x: 6, y: 3, bob: 0 }], null);
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
