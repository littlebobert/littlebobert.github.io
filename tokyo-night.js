// After Hours, the screensaver, and Tokyo Sky, its module for the whole year: Tokyo's skyline in
// pixel art, under Tokyo's sky as it is right now. The sun follows the
// real sunrise and sunset, so it's day, dusk, or night when it is in Tokyo; the moon shows its real
// phase and rises and sets about when it does; and the weather is the current weather from
// Open-Meteo: clouds, overcast, fog, drizzle, rain, snow, or thunderstorms. Office windows go on
// and off, Tokyo Tower and the Skytree are lit at night, and a star falls now and then.
//
// It starts after a while with no input, or from the Sleep Now corner, and any input wakes the
// desktop. The After Hours desk accessory under Settings has a preview, the module's sliders, and
// Sleep Now. Seasonal modes add their own modules to window.afterHoursModules before this runs
// (christmas.js adds Christmas Delivery); the seasonal one is the default in its season, and the
// accessory gets a list for switching between them. Year-round modules (paper-planes.js adds Paper
// Planes) go after Tokyo Sky, which stays the default. Halloween still has its own In the Dark. To see any sky: ?tokyo-sky=day|dawn|dusk|night|HH:MM, ?tokyo-weather=clear|clouds|
// overcast|fog|drizzle|rain|snow|storm, ?tokyo-moon=0–1 (0 new, 0.5 full).
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
  const TOKYO = { latitude: 35.6762, longitude: 139.6503 };
  const HOUR = 60 * 60 * 1000;
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
  const japanDay = (ms = Date.now()) => Math.floor((ms + 9 * HOUR) / 86400000);
  const japanHours = (ms) => (((ms + 9 * HOUR) / HOUR) % 24 + 24) % 24;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  // --- Colors.

  const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);
  const css = (color) => `rgb(${color.map((value) => Math.round(value)).join(', ')})`;
  const mixHex = (a, b, t) => css(mix(rgb(a), rgb(b), t));

  // --- Tokyo right now.

  const params = new URLSearchParams(location.search);
  const forcedSky = params.get('tokyo-sky');
  const forcedWeather = params.get('tokyo-weather');
  const forcedMoon = params.has('tokyo-moon') ? clamp(Number(params.get('tokyo-moon')), 0, 0.999) : null;

  // Until Open-Meteo answers: sunrise and sunset from the time of year, which is close enough.
  function estimatedSun(ms) {
    const day = japanDay(ms);
    const date = new Date(day * 86400000);
    const dayOfYear = (day * 86400000 - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000;
    const year = Math.cos((2 * Math.PI * (dayOfYear - 172)) / 365.25);
    const midnight = day * 86400000 - 9 * HOUR;
    return { sunrise: midnight + (5.65 - 1.2 * year) * HOUR, sunset: midnight + (17.75 + 1.27 * year) * HOUR };
  }

  let conditions = { ...estimatedSun(Date.now()), code: 0, cloud: 0, wind: 8, live: false };
  const CONDITIONS_KEY = 'tokyo-sky-conditions';
  let conditionsLoading = null;

  function loadConditions() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CONDITIONS_KEY) || 'null');
      if (cached && Date.now() - cached.at < 15 * 60 * 1000) {
        conditions = cached.conditions;
        return Promise.resolve(conditions);
      }
    } catch (error) {}
    conditionsLoading ||= (async () => {
      try {
        const query = new URLSearchParams({
          latitude: TOKYO.latitude,
          longitude: TOKYO.longitude,
          current: 'weather_code,cloud_cover,wind_speed_10m',
          daily: 'sunrise,sunset',
          timezone: 'Asia/Tokyo',
          forecast_days: '1',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
        if (!response.ok) throw new Error(`Weather ${response.status}`);
        const data = await response.json();
        const local = (value) => Date.parse(`${value}:00+09:00`);
        conditions = {
          sunrise: local(data.daily.sunrise[0]),
          sunset: local(data.daily.sunset[0]),
          code: Number(data.current.weather_code) || 0,
          cloud: Number(data.current.cloud_cover) || 0,
          wind: Number(data.current.wind_speed_10m) || 0,
          live: true,
        };
        sessionStorage.setItem(CONDITIONS_KEY, JSON.stringify({ at: Date.now(), conditions }));
      } catch (error) {
        // Keep the estimate; the sky still follows the sun.
      } finally {
        conditionsLoading = null;
      }
      return conditions;
    })();
    return conditionsLoading;
  }

  // The time the sky is drawn for: now, or the one asked for in the URL.
  function skyTime() {
    const now = Date.now();
    if (!forcedSky) return now;
    const { sunrise, sunset } = conditions;
    const midnight = japanDay(now) * 86400000 - 9 * HOUR;
    if (forcedSky === 'day') return midnight + 12.5 * HOUR;
    if (forcedSky === 'dawn') return sunrise - 12 * 60 * 1000;
    if (forcedSky === 'dusk') return sunset + 10 * 60 * 1000;
    if (forcedSky === 'night') return midnight + 22.5 * HOUR;
    const [hours, minutes] = forcedSky.split(':').map(Number);
    return Number.isFinite(hours) ? midnight + (hours + (minutes || 0) / 60) * HOUR : now;
  }

  // How light it is (0 night to 1 day) and how much sunrise or sunset color is in the sky.
  function daylight(ms) {
    const { sunrise, sunset } = conditions;
    const minutes = (value) => (ms - value) / 60000;
    const fromRise = minutes(sunrise);
    const fromSet = minutes(sunset);
    let light;
    if (fromRise < -35 || fromSet > 35) light = 0;
    else if (fromRise < 45) light = clamp((fromRise + 35) / 80);
    else if (fromSet > -45) light = clamp((35 - fromSet) / 80);
    else light = 1;
    const glow = Math.max(clamp(1 - Math.abs(fromRise - 5) / 55), clamp(1 - Math.abs(fromSet + 5) / 55));
    const sun = ms > sunrise && ms < sunset ? (ms - sunrise) / (sunset - sunrise) : null;
    return { light, glow, sun };
  }

  // The moon's age as a fraction of its 29.53-day cycle: 0 new, 0.5 full. From a known new moon.
  function moonPhase(ms) {
    if (forcedMoon !== null) return forcedMoon;
    const synodic = 29.530588853 * 86400000;
    const knownNew = Date.UTC(2000, 0, 6, 18, 14);
    return ((((ms - knownNew) / synodic) % 1) + 1) % 1;
  }

  // WMO weather codes, by what they look like.
  function weatherKind(code) {
    if (forcedWeather) return forcedWeather;
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3) return 'overcast';
    if (code === 2) return 'clouds';
    return 'clear';
  }

  function weather() {
    const kind = weatherKind(conditions.code);
    const cover = forcedWeather
      ? { clear: 0.05, clouds: 0.45, overcast: 0.95, fog: 0.7, drizzle: 0.9, rain: 0.95, snow: 0.9, storm: 1 }[kind] ?? 0
      : clamp(conditions.cloud / 100);
    // How gray and heavy the sky is.
    const gloom = { overcast: 0.65, fog: 0.75, drizzle: 0.7, rain: 0.8, snow: 0.7, storm: 0.9 }[kind]
      ?? clamp((cover - 0.75) * 2) * 0.5;
    return { kind, cover, gloom, wind: conditions.wind };
  }

  // --- The scene, in art pixels.

  const SKIES = {
    night: ['#03050d', '#0b1226', '#252a4f'],
    day: ['#3b7bc8', '#6ea8e0', '#c2dff2'],
    glow: ['#26386a', '#b9637d', '#ffb066'],
    nightGloom: ['#0b0d15', '#151824', '#2b2d3f'],
    dayGloom: ['#8995a4', '#a5afba', '#c4cad1'],
  };
  const BAYER = [0, 0.5, 0.75, 0.25];

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return [canvas, ctx];
  }

  function buildScene(width, height, seed, ms) {
    const random = seeded(seed);
    const between = (min, max) => min + random() * (max - min);
    const horizon = height - 1;
    const { light, glow, sun } = daylight(ms);
    const sky = weather();
    const gloom = sky.gloom;

    // The sky: three colors from night to day, warmed at sunrise and sunset, grayed by weather,
    // and quantized with a little ordered dithering so it stays pixel art.
    const stops = [0, 1, 2].map((index) => {
      let color = mix(rgb(SKIES.night[index]), rgb(SKIES.day[index]), light);
      color = mix(color, rgb(SKIES.glow[index]), glow * 0.85 * (1 - gloom * 0.6));
      return mix(color, mix(rgb(SKIES.nightGloom[index]), rgb(SKIES.dayGloom[index]), light), gloom);
    });
    const skyAt = (y) => {
      const t = y / height;
      return t < 0.6 ? mix(stops[0], stops[1], t / 0.6) : mix(stops[1], stops[2], (t - 0.6) / 0.4);
    };
    const [skyCanvas, skyCtx] = makeCanvas(width, height);
    const image = skyCtx.createImageData(width, height);
    const STEP = 7;
    for (let y = 0; y < height; y += 1) {
      const color = skyAt(y);
      for (let x = 0; x < width; x += 1) {
        const dither = BAYER[(y & 1) * 2 + (x & 1)] * STEP;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          image.data[offset + channel] = Math.min(255, Math.floor((color[channel] + dither) / STEP) * STEP);
        }
        image.data[offset + 3] = 255;
      }
    }
    skyCtx.putImageData(image, 0, 0);

    // The sun, low and orange near the horizon, washed out behind heavy cloud.
    if (sun !== null) {
      const high = Math.sin(Math.PI * sun);
      const sx = Math.round(width * (0.06 + 0.88 * sun));
      const sy = Math.round(height * (0.66 - 0.5 * high));
      const r = Math.round(4 + 3 * (1 - high) + Math.min(width, height) * 0.006);
      const [core, rim] = high < 0.3 ? ['#ffd27f', '#ff9e52'] : ['#fff7d6', '#ffe08a'];
      const behind = skyAt(sy);
      for (let y = -r; y <= r; y += 1) {
        for (let x = -r; x <= r; x += 1) {
          const d = x * x + y * y;
          if (d > r * r) continue;
          skyCtx.fillStyle = css(mix(rgb(d > (r - 1) ** 2 ? rim : core), behind, gloom * 0.85));
          skyCtx.fillRect(sx + x, sy + y, 1, 1);
        }
      }
    }

    // The moon: its real phase, placed by how far it is from crossing the sky's highest point
    // (a new moon crosses at noon, a full one at midnight). Pale by day, gone behind overcast.
    const phase = moonPhase(ms);
    const illuminated = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const transit = (12 + phase * 24) % 24;
    const hourAngle = ((japanHours(ms) - transit + 36) % 24) - 12;
    let moon = null;
    if (Math.abs(hourAngle) < 6 && illuminated > 0.03 && gloom < 0.7) {
      const along = (hourAngle + 6) / 12;
      moon = {
        x: Math.round(width * (0.06 + 0.88 * along)),
        y: Math.round(height * (0.6 - 0.48 * Math.sin(Math.PI * along))),
        r: Math.max(3, Math.round(Math.min(width, height) * 0.035)),
      };
      const waxing = phase < 0.5;
      const k = Math.cos(2 * Math.PI * phase);
      const [bright, edge] = light > 0.5 ? ['#eef1f7', '#d5dbe6'] : ['#f6eecd', '#d9cfa8'];
      for (let y = -moon.r; y <= moon.r; y += 1) {
        for (let x = -moon.r; x <= moon.r; x += 1) {
          const d = x * x + y * y;
          if (d > moon.r * moon.r) continue;
          const across = Math.sqrt(Math.max(0, 1 - (y / moon.r) ** 2));
          const sunlit = waxing ? x / moon.r > across * k : x / moon.r < -across * k;
          let color;
          if (sunlit) color = rgb(d > (moon.r - 1) ** 2 ? edge : bright);
          else if (light < 0.5) color = mix(skyAt(moon.y + y), [44, 52, 86], 0.35); // earthshine
          else continue;
          skyCtx.fillStyle = css(mix(color, skyAt(moon.y + y), gloom * 0.6 + light * 0.25));
          skyCtx.fillRect(moon.x + x, moon.y + y, 1, 1);
        }
      }
    }

    // Stars: fewer as it gets light or cloudy.
    const stars = [];
    const starCount = Math.round(((width * height) / 260) * (1 - light) ** 2 * (1 - gloom) * (1 - sky.cover * 0.6));
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.floor(random() * width);
      const y = Math.floor(Math.pow(random(), 1.4) * height * 0.62);
      if (moon && Math.abs(x - moon.x) <= moon.r + 2 && Math.abs(y - moon.y) <= moon.r + 2) continue;
      stars.push({ x, y, level: random() < 0.15 ? 2 : random() < 0.5 ? 1 : 0, rate: between(700, 2600), phase: between(0, 10000) });
    }

    // Clouds: puffs with a lit top and a darker underside. At night the underside catches the
    // city's glow; at sunrise and sunset the tops turn pink.
    const cloudTop = mix(mix(rgb('#1d2340'), rgb('#ffffff'), light), rgb('#ffc9a8'), glow * 0.7);
    const cloudBottom = mix(mix(rgb('#2d2d49'), rgb('#cfd8e2'), light), rgb('#8d6f98'), glow * 0.6);
    const grayTop = mix(rgb('#1a1c28'), rgb('#bcc3cc'), light);
    const grayBottom = mix(rgb('#25263a'), rgb('#98a2ae'), light);
    const clouds = [];
    const cloudCount = Math.round(sky.cover * 10 * (width / 427)) + (gloom > 0.5 ? 4 : 0);
    for (let i = 0; i < cloudCount; i += 1) {
      const w = Math.round(between(18, 58) * (gloom > 0.5 ? 1.4 : 1));
      const h = Math.max(6, Math.round(w * between(0.26, 0.36)));
      const [sprite, spriteCtx] = makeCanvas(w, h);
      const puffCount = Math.max(3, Math.round(w / 9));
      const puffs = Array.from({ length: puffCount }, (_, index) => ({
        x: (w * (index + 0.5)) / puffCount + between(-2, 2),
        y: h - h * between(0.3, 0.45),
        r: h * (index === 0 || index === puffCount - 1 ? between(0.25, 0.4) : between(0.4, 0.75)),
      }));
      const top = mix(cloudTop, grayTop, gloom);
      const bottom = mix(cloudBottom, grayBottom, gloom);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const inside = puffs.some((puff) => (x - puff.x) ** 2 + (y - puff.y) ** 2 <= puff.r ** 2);
          if (!inside) continue;
          spriteCtx.fillStyle = css(y > h * 0.62 ? bottom : top);
          spriteCtx.fillRect(x, y, 1, 1);
        }
      }
      clouds.push({ sprite, x: between(-w, width), y: between(1, height * (gloom > 0.5 ? 0.5 : 0.42)), w, depth: between(0.6, 1.2) });
    }

    // The city: windows mostly dark in daylight, and the landmarks lit only after dark.
    const [city, ctx] = makeCanvas(width, height);
    const windows = [];
    const lights = [];
    const towerX = Math.round(width * 0.3);
    const treeX = Math.round(width * 0.74);
    const treeHeight = Math.round(Math.min(height * 0.72, 210));
    const towerHeight = Math.round(treeHeight * 0.53); // 333 m to 634 m
    const dusk = glow * (1 - light * 0.5);

    const WARM = ['#ffd479', '#ffc861', '#ffe2a3'];
    const COOL = ['#cfe6ff', '#b8d6f5'];
    function building(x, w, h, row, chance) {
      const back = row === 'back';
      const body = css(mix(mix(rgb(back ? '#131b31' : '#070a15'), rgb(back ? '#7f8fa6' : '#56637a'), light), rgb('#3a2f45'), dusk * 0.35));
      const unlit = css(mix(rgb(back ? '#1a233d' : '#0e1322'), rgb(back ? '#a3b5ca' : '#8195ad'), light));
      const top = horizon - h;
      ctx.fillStyle = body;
      ctx.fillRect(x, top, w, h);
      for (let wy = top + 2; wy < horizon - 2; wy += 3) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          const on = random() < chance * (1 - light * 0.93);
          const palette = random() < 0.6 ? WARM : COOL;
          const color = palette[Math.floor(random() * palette.length)];
          const glowColor = back ? css(mix(rgb(color), [0, 0, 0], 0.3)) : color;
          windows.push({ x: wx, y: wy, lit: glowColor, unlit, on });
          ctx.fillStyle = on ? glowColor : unlit;
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

    // Back row: hazier, so the front row stands out.
    for (let x = -between(0, 8); x < width;) {
      const w = Math.round(between(6, 18));
      let h = Math.round(between(height * 0.1, height * 0.3));
      if (random() < 0.12) h = Math.round(height * between(0.3, 0.38));
      if (nearLandmark(x, w)) h = Math.min(h, Math.round(height * 0.16));
      building(Math.round(x), w, h, 'back', 0.22);
      x += w + Math.round(between(0, 2));
    }

    const lit = light < 0.45;
    tokyoTower(ctx, towerX, horizon, towerHeight, lights, lit);
    skytree(ctx, treeX, horizon, treeHeight, lights, lit, japanDay(ms) % 2 === 0);

    // Front row: darker and shorter.
    for (let x = -between(0, 6); x < width;) {
      const w = Math.round(between(5, 15));
      let h = Math.round(between(height * 0.05, height * 0.18));
      if (nearLandmark(x, w)) h = Math.min(h, Math.round(height * 0.08));
      building(Math.round(x), w, h, 'front', 0.3);
      x += w + Math.round(between(1, 4));
    }
    ctx.fillStyle = css(mix(rgb('#04060c'), rgb('#3d4656'), light));
    ctx.fillRect(0, horizon, width, 1);

    return {
      width, height, sky: skyCanvas, city, cityCtx: ctx, stars, clouds, windows, lights,
      light, glow, weather: sky, night: light < 0.25,
    };
  }

  // Tokyo Tower: after dark, lit orange; by day, its international orange and white bands.
  function tokyoTower(ctx, cx, base, h, lights, lit) {
    const baseHalf = Math.max(4, Math.round(h * 0.17));
    const colors = (t) => {
      if (lit) return ['#ffa043', '#d9671c'];
      const band = Math.floor((t / 0.86) * 9);
      return band % 2 === 0 ? ['#e2582c', '#b8441f'] : ['#f1efe8', '#c9c6bd'];
    };
    for (let i = 0; i < h; i += 1) {
      const y = base - 1 - i;
      const t = i / h;
      const half = t > 0.86 ? 0 : (baseHalf - 1) * Math.pow(1 - t / 0.86, 2.2) + 0.6;
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      const [edge, lattice] = colors(t);
      ctx.fillStyle = edge;
      ctx.fillRect(left, y, 1, 1);
      ctx.fillRect(right, y, 1, 1);
      for (let x = left + 1; x < right; x += 1) {
        // The arch between the four legs.
        const across = (x - cx) / Math.max(1, half);
        if (t < 0.17 * Math.sqrt(Math.max(0, 1 - across * across))) continue;
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = lattice;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    const deck = (t, height, extra) => {
      const half = (baseHalf - 1) * Math.pow(1 - t / 0.86, 2.2) + 0.6 + extra;
      const y = Math.round(base - 1 - t * h);
      ctx.fillStyle = lit ? '#ffcf8f' : '#d9dde2';
      ctx.fillRect(Math.round(cx - half), y - height + 1, Math.round(half * 2) + 1, height);
      ctx.fillStyle = lit ? '#fff3d6' : '#8fa3b8';
      for (let x = Math.round(cx - half) + 1; x < cx + half; x += 2) ctx.fillRect(x, y - 1, 1, 1);
    };
    deck(0.42, 3, 2);
    deck(0.72, 2, 1.5);
    lights.push({ x: cx, y: base - h - 1, phase: 0 });
  }

  // The Skytree, from its real proportions (634 m): a wide tripod base narrowing in a gentle
  // concave curve to the Tembo Deck pod at 350 m, a smaller Tembo Galleria ring at 450 m, a slim
  // shaft to the antenna section at about 500 m, and a needle on top with a white strobe. By day
  // it's Skytree White; after dark it's lit on alternating days in Iki (pale blue) or Miyabi
  // (purple, with gold decks), like the real one.
  function skytree(ctx, cx, base, h, lights, lit, iki) {
    let palette;
    if (!lit) palette = ['#eef2f5', '#b7c1cb', '#c9d1d9', '#9fb3c8'];
    else if (iki) palette = ['#c4e8ff', '#5aa3db', '#e9f7ff', '#f2fbff'];
    else palette = ['#dcbcff', '#8a5ccf', '#f4e9ff', '#ffe09a'];
    const [edge, inner, core, deckLight] = palette;
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
        // A diamond truss where the tower is wide enough to show one, with the core column
        // (the shinbashira) up the middle.
        if (x === cx && t < DECK[0]) ctx.fillStyle = core;
        else if (right - left >= 6 && !(mod(x + y, 4) === 0 || mod(x - y, 4) === 0)) continue;
        else ctx.fillStyle = inner;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // The decks: a band of windows between rims, flaring out from the shaft below.
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

  // --- Weather that moves: rain, snow, lightning.

  function makePrecipitation(scene, random) {
    const { kind } = scene.weather;
    const area = (scene.width * scene.height) / 114000;
    const between = (min, max) => min + random() * (max - min);
    const count = Math.round(({ drizzle: 70, rain: 190, storm: 280, snow: 140 }[kind] || 0) * area);
    return Array.from({ length: count }, () => ({
      x: between(0, scene.width),
      y: between(-scene.height, scene.height),
      speed: kind === 'snow' ? between(10, 24) : between(kind === 'drizzle' ? 110 : 170, kind === 'drizzle' ? 150 : 240),
      phase: between(0, 1000),
      big: random() < 0.25,
    }));
  }

  // --- Drawing a frame.

  const STAR = ['#4c5675', '#97a1c2', '#eef1ff'];

  function drawFrame(ctx, scene, now, extras = {}) {
    const { shootingStar, precipitation = [], flash = 0 } = extras;
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
    scene.clouds.forEach((cloud) => ctx.drawImage(cloud.sprite, Math.round(cloud.x), Math.round(cloud.y)));
    ctx.drawImage(scene.city, 0, 0);
    // Red aircraft lights blink; the Skytree's white strobes flash.
    scene.lights.forEach((light) => {
      if ((now + light.phase) % 1600 > (light.flash || 380)) return;
      ctx.fillStyle = light.color || '#ff4433';
      ctx.fillRect(light.x, light.y, 1, 1);
    });

    const { kind } = scene.weather;
    if (kind === 'fog') {
      // Haze, thickest at street level.
      const fog = css(mix(rgb('#30354a'), rgb('#d4d9de'), scene.light));
      const top = Math.round(scene.height * 0.35);
      ctx.fillStyle = fog;
      for (let y = top; y < scene.height; y += 1) {
        ctx.globalAlpha = 0.82 * ((y - top) / (scene.height - top)) ** 1.1;
        ctx.fillRect(0, y, scene.width, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (precipitation.length) {
      if (kind === 'snow') {
        ctx.fillStyle = '#f4f7fb';
        precipitation.forEach((flake) => ctx.fillRect(Math.round(flake.x), Math.round(flake.y), flake.big ? 2 : 1, flake.big ? 2 : 1));
      } else {
        ctx.fillStyle = css(mix(rgb('#6f7ea6'), rgb('#a9bccf'), scene.light));
        ctx.globalAlpha = 0.7;
        precipitation.forEach((drop) => {
          const length = kind === 'drizzle' ? 2 : 3;
          ctx.fillRect(Math.round(drop.x), Math.round(drop.y), 1, length);
        });
        ctx.globalAlpha = 1;
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#e8ecff';
      ctx.fillRect(0, 0, scene.width, scene.height);
      ctx.globalAlpha = 1;
    }
    if (extras.bolt) {
      ctx.fillStyle = '#ffffff';
      extras.bolt.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    }
  }

  // --- The Tokyo Sky module. Starting it returns a function that stops it.

  function startTokyoSky() {
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

    const random = Math.random;
    const between = (min, max) => min + random() * (max - min);
    let scene = buildScene(width, height, japanDay(), skyTime());
    let precipitation = makePrecipitation(scene, random);
    // When fresher weather arrives, or the light changes as the sun moves, redraw the scene.
    const rebuild = () => {
      const next = buildScene(width, height, japanDay(), skyTime());
      if (next.weather.kind !== scene.weather.kind) precipitation = makePrecipitation(next, random);
      next.clouds.forEach((cloud, index) => {
        if (scene.clouds[index]) cloud.x = scene.clouds[index].x;
      });
      scene = next;
    };
    let running = true;
    loadConditions().then(() => {
      if (running && conditions.live) rebuild();
    });
    const refresh = setInterval(() => {
      const { light, glow } = daylight(skyTime());
      if (Math.abs(light - scene.light) > 0.03 || Math.abs(glow - scene.glow) > 0.05) rebuild();
    }, 30 * 1000);

    let shootingStar = null;
    let nextShootingStar = performance.now() + between(3000, 9000) / speed;
    let nextWindow = performance.now() + 400;
    let nextLightning = performance.now() + between(2500, 7000);
    let lightning = null;
    let last = performance.now();
    let raf = 0;

    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { kind, wind } = scene.weather;

      // Clouds drift with the wind, nearer ones faster.
      const drift = Math.max(1.5, wind * 0.22) * speed;
      scene.clouds.forEach((cloud) => {
        cloud.x -= drift * cloud.depth * dt;
        if (cloud.x < -cloud.w) cloud.x = scene.width + between(0, 20);
      });

      precipitation.forEach((particle) => {
        particle.y += particle.speed * dt;
        if (kind === 'snow') particle.x += Math.sin((now + particle.phase) / 700) * 6 * dt - drift * 0.4 * dt;
        else particle.x -= particle.speed * 0.18 * dt;
        if (particle.y > scene.height) {
          particle.y = -between(2, 30);
          particle.x = between(0, scene.width + 30);
        }
        if (particle.x < -4) particle.x += scene.width + 8;
      });

      // Shooting stars only on clear nights.
      const starry = scene.night && scene.weather.gloom < 0.3 && scene.weather.cover < 0.6;
      if (!shootingStar && starry && now > nextShootingStar) {
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

      // Lightning in a thunderstorm: a flash, a flicker, and a jagged bolt into the city.
      let flash = 0;
      if (kind === 'storm' && !lightning && now > nextLightning) {
        const bolt = [];
        let x = Math.round(between(width * 0.1, width * 0.9));
        for (let y = Math.round(height * 0.12); y < height * 0.78; y += 1) {
          if (random() < 0.35) x += random() < 0.5 ? -1 : 1;
          bolt.push([x, y]);
        }
        lightning = { at: now, bolt };
      }
      if (lightning) {
        const age = now - lightning.at;
        flash = age < 70 ? 0.55 : age < 130 ? 0 : age < 190 ? 0.3 : 0;
        if (age > 260) {
          lightning = null;
          nextLightning = now + between(3500, 11000);
        }
      }

      // Somebody works late; somebody goes home.
      if (now > nextWindow && scene.windows.length) {
        nextWindow = now + between(150, 600) / speed;
        const pane = scene.windows[Math.floor(random() * scene.windows.length)];
        if (random() < 0.45 * (1 - scene.light * 0.8)) pane.on = !pane.on;
        else if (pane.on && random() < scene.light) pane.on = false;
        scene.cityCtx.fillStyle = pane.on ? pane.lit : pane.unlit;
        scene.cityCtx.fillRect(pane.x, pane.y, 1, 1);
      }

      drawFrame(ctx, scene, now, {
        shootingStar,
        precipitation,
        flash,
        bolt: lightning && now - lightning.at < 200 ? lightning.bolt : null,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(refresh);
      screen.classList.remove('is-on');
      setTimeout(() => screen.remove(), 300);
    };
  }

  // --- After Hours: the chosen module, after a while with no input or from the corner.

  // Seasonal modules first, then Tokyo Sky, then the other year-round ones.
  const added = window.afterHoursModules || [];
  const modules = [
    ...added.filter((module) => module.season),
    {
      id: 'tokyo-sky',
      options,
      save() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
        } catch (error) {}
      },
      start: startTokyoSky,
    },
    ...added.filter((module) => !module.season),
  ];
  // A seasonal module is the default during its season. Picking another one sticks until the
  // season is over, so next year's starts out as the default again.
  const MODULE_KEY = 'after-hours-module';
  const season = modules[0].season || '';
  let current = modules[0];
  try {
    const saved = JSON.parse(localStorage.getItem(MODULE_KEY) || 'null');
    if (saved?.season === season) current = modules.find((module) => module.id === saved.id) || current;
  } catch (error) {}

  const booting = () => root.classList.contains('christmas-boot');
  let lastInputAt = Date.now();
  let lastPointer = null;
  let saver = null;

  function start(fromCorner = false) {
    if (saver || reduceMotion.matches) return;
    const stop = current.start();
    saver = {
      startedAt: Date.now(),
      pointer: lastPointer,
      fromCorner,
      stop() {
        stop();
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
      if (inSleepCorner(event) && !booting()) start(true);
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
    if (booting() || reduceMotion.matches || !finePointer.matches) return;
    // Clicks inside the desktop browser or a video land in an iframe, where we can't see them.
    if (document.activeElement?.tagName === 'IFRAME') return;
    // Not in the middle of a call on the Speak phone.
    if (document.querySelector('.speak.is-in-call')) return;
    start();
  }, 1000);

  // --- After Hours desk accessory.

  if (!widget) return;

  // Seasonal modules bring their own preview, sliders, and name. index.js has already put the
  // page's own labels in the current language, so these keep up with it themselves.
  const language = () => (root.lang === 'ja' ? 'ja' : 'en');
  const localized = [];
  function renderLabel([element, text, attribute]) {
    const value = text[language() === 'ja' ? 1 : 0];
    if (attribute) element.setAttribute(attribute, value);
    else element.textContent = value;
  }
  function localize(element, text, attribute) {
    localized.push([element, text, attribute]);
    renderLabel(localized[localized.length - 1]);
  }
  document.addEventListener('site-language-change', () => localized.forEach(renderLabel));

  const moduleRow = widget.querySelector('.after-dark-module');
  const tokyoPreview = widget.querySelector('.tokyo-night-preview');
  const sleepButton = widget.querySelector('.after-dark-sleep');
  modules.filter((module) => module.preview).forEach((module) => {
    const preview = document.createElement('div');
    preview.className = 'after-dark-preview';
    preview.dataset.module = module.id;
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = module.preview;
    tokyoPreview.before(preview);
    module.settings.forEach(({ option, label, steps }) => {
      const row = document.createElement('label');
      row.className = 'after-dark-setting';
      row.dataset.module = module.id;
      row.innerHTML = `
        <span></span>
        <span class="after-dark-slider">
          <input type="range" min="0" max="${steps - 1}" step="1" data-option="${option}">
          <span class="after-dark-ticks" aria-hidden="true">${'<i></i>'.repeat(steps)}</span>
        </span>`;
      localize(row.firstElementChild, label);
      sleepButton.before(row);
    });
  });

  // With more than one module, the name becomes a list to pick from, like After Dark's.
  function show() {
    widget.dataset.module = current.id;
    widget.querySelectorAll('.after-dark-preview[data-module], .after-dark-setting[data-module]').forEach((element) => {
      element.hidden = element.dataset.module !== current.id;
    });
  }
  if (modules.length > 1) {
    const tokyoName = moduleRow.querySelector('.after-dark-module-name');
    const list = document.createElement('div');
    list.className = 'after-dark-modules';
    list.setAttribute('role', 'radiogroup');
    localize(list, ['Screensaver', 'スクリーンセーバー'], 'aria-label');
    modules.forEach((module) => {
      const option = document.createElement('label');
      option.className = 'after-dark-module-option';
      option.dataset.module = module.id;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'after-hours-module';
      radio.value = module.id;
      radio.checked = module === current;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        current = module;
        show();
        try {
          localStorage.setItem(MODULE_KEY, JSON.stringify({ id: module.id, season }));
        } catch (error) {}
      });
      let name = tokyoName;
      if (module.name) {
        name = document.createElement('span');
        name.className = 'after-dark-module-name';
        localize(name, module.name);
      }
      option.append(radio, name);
      list.append(option);
    });
    moduleRow.append(list);
  }
  show();

  // The preview shows Tokyo's sky right now too, once the weather is in.
  const preview = widget.querySelector('.tokyo-night-preview');
  function drawPreview() {
    if (!preview) return;
    const scene = buildScene(preview.width, preview.height, 7, skyTime());
    drawFrame(preview.getContext('2d'), scene, 0);
  }
  drawPreview();
  const previewWatch = new IntersectionObserver((entries) => {
    if (!entries[entries.length - 1].isIntersecting) return;
    previewWatch.disconnect();
    loadConditions().then(drawPreview);
  });
  previewWatch.observe(widget);
  setInterval(() => {
    if (!document.hidden && widget.isConnected) loadConditions().then(drawPreview);
  }, 15 * 60 * 1000);

  widget.querySelectorAll('input[data-option]').forEach((input) => {
    const module = modules.find(({ id }) => id === input.closest('[data-module]').dataset.module);
    input.value = String(module.options[input.dataset.option]);
    input.addEventListener('input', () => {
      module.options[input.dataset.option] = Number(input.value);
      module.save();
    });
  });

  sleepButton.addEventListener('click', () => {
    sleepButton.blur();
    if (!saver) start();
  });
  // With Reduce Motion there's no screensaver, so there's nothing to start.
  const syncMotion = () => { sleepButton.disabled = reduceMotion.matches; };
  reduceMotion.addEventListener('change', syncMotion);
  syncMotion();

  // Placement: under Settings on wide screens, stacked with the other desk accessories (but not
  // Christmas Tree, which sits on the left).
  const settings = document.getElementById('appearance-panel');
  function place() {
    if (!settings) return;
    let top = 36 + settings.offsetHeight + 12;
    document.querySelectorAll('.desk-accessory:not(.christmas-tree)').forEach((accessory) => {
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
