// Seismograph desk accessory: a drum recorder fed by P2PQuake's relay of the Japan Meteorological
// Agency's earthquake reports. The pen hums along, and shakes about as hard as the selected quake
// was felt. A new quake plays itself; clicking one in the list plays it back.
(() => {
  const widget = document.getElementById('seismograph');
  if (!widget) return;

  const API_URL = 'https://api.p2pquake.net/v2/history?codes=551&limit=40';
  const POLL_MS = 60 * 1000;
  const LIST_LENGTH = 5;
  const SPEED = 24; // paper speed, CSS px per second
  const PEN_GAP = 12; // unwritten paper to the right of the pen

  const paper = widget.querySelector('.seismograph-paper');
  const canvas = widget.querySelector('.seismograph-canvas');
  const latest = widget.querySelector('.seismograph-latest');
  const list = widget.querySelector('.seismograph-list');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const language = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');

  // --- Shindo, Japan's 0–7 intensity scale, as P2PQuake encodes it.

  const SHINDO = {
    10: ['1', '1'], 20: ['2', '2'], 30: ['3', '3'], 40: ['4', '4'],
    45: ['5−', '5弱'], 50: ['5+', '5強'], 55: ['6−', '6弱'], 60: ['6+', '6強'], 70: ['7', '7'],
  };
  const shindoLabel = (scale) => SHINDO[scale]?.[language() === 'ja' ? 1 : 0] ?? '?';
  // How far the pen swings, in px from the center line, before it hits the stops.
  const SWING = { 10: 8, 20: 13, 30: 18, 40: 23, 45: 27, 50: 30, 55: 33, 60: 36, 70: 40 };

  const TSUNAMI = {
    Checking: ['Checking for a tsunami', '津波の有無を調査中'],
    NonEffective: ['Slight sea level changes', '若干の海面変動'],
    Watch: ['Tsunami advisory', '津波注意報'],
    Warning: ['Tsunami warning', '津波警報'],
  };

  // --- Place names. JMA's hypocenter names come only in Japanese, so English is built from the
  // common patterns: a prefecture or Hokkaido subregion, maybe a region, then a direction and 部
  // or 沖. Anything else stays in Japanese.

  const PREFECTURES = {
    青森: 'Aomori', 岩手: 'Iwate', 宮城: 'Miyagi', 秋田: 'Akita', 山形: 'Yamagata', 福島: 'Fukushima',
    茨城: 'Ibaraki', 栃木: 'Tochigi', 群馬: 'Gunma', 埼玉: 'Saitama', 千葉: 'Chiba', 神奈川: 'Kanagawa',
    新潟: 'Niigata', 富山: 'Toyama', 石川: 'Ishikawa', 福井: 'Fukui', 山梨: 'Yamanashi', 長野: 'Nagano',
    岐阜: 'Gifu', 静岡: 'Shizuoka', 愛知: 'Aichi', 三重: 'Mie', 滋賀: 'Shiga', 兵庫: 'Hyogo', 奈良: 'Nara',
    和歌山: 'Wakayama', 鳥取: 'Tottori', 島根: 'Shimane', 岡山: 'Okayama', 広島: 'Hiroshima',
    山口: 'Yamaguchi', 徳島: 'Tokushima', 香川: 'Kagawa', 愛媛: 'Ehime', 高知: 'Kochi', 福岡: 'Fukuoka',
    佐賀: 'Saga', 長崎: 'Nagasaki', 熊本: 'Kumamoto', 大分: 'Oita', 宮崎: 'Miyazaki', 鹿児島: 'Kagoshima',
    沖縄: 'Okinawa',
  };
  const HOKKAIDO = {
    石狩: 'Ishikari', 渡島: 'Oshima', 檜山: 'Hiyama', 後志: 'Shiribeshi', 空知: 'Sorachi', 上川: 'Kamikawa',
    留萌: 'Rumoi', 宗谷: 'Soya', 網走: 'Abashiri', 胆振: 'Iburi', 日高: 'Hidaka', 十勝: 'Tokachi',
    釧路: 'Kushiro', 根室: 'Nemuro',
  };
  const PENINSULAS = {
    根室半島: 'the Nemuro Peninsula', 渡島半島: 'the Oshima Peninsula', 積丹半島: 'the Shakotan Peninsula',
    知床半島: 'the Shiretoko Peninsula', 男鹿半島: 'the Oga Peninsula', 牡鹿半島: 'the Oshika Peninsula',
    房総半島: 'the Boso Peninsula', 伊豆半島: 'the Izu Peninsula', 能登半島: 'the Noto Peninsula',
    紀伊半島: 'the Kii Peninsula', 薩摩半島: 'the Satsuma Peninsula', 大隅半島: 'the Osumi Peninsula',
    国東半島: 'the Kunisaki Peninsula',
  };
  const ISLANDS = {
    硫黄島: 'Iwo Jima', 父島: 'Chichijima', 母島: 'Hahajima', 鳥島: 'Torishima', 八丈島: 'Hachijojima',
    三宅島: 'Miyakejima', 伊豆大島: 'Izu Oshima', '新島・神津島': 'Niijima and Kozushima',
    種子島: 'Tanegashima', 屋久島: 'Yakushima', トカラ列島: 'the Tokara Islands', 奄美大島: 'Amami Oshima',
    沖縄本島: 'Okinawa Island', 宮古島: 'Miyakojima', 石垣島: 'Ishigakijima', 西表島: 'Iriomote',
    与那国島: 'Yonaguni', 大東島: 'the Daito Islands', 択捉島: 'Etorofu', 国後島: 'Kunashiri',
    色丹島: 'Shikotan', 佐渡: 'Sado', 対馬: 'Tsushima', 五島列島: 'the Goto Islands', 台湾: 'Taiwan',
  };
  const REGIONS = {
    薩摩地方: 'Satsuma', 大隅地方: 'Osumi', '天草・芦北地方': 'Amakusa–Ashikita', 阿蘇地方: 'Aso',
    球磨地方: 'Kuma', 飛騨地方: 'Hida', 美濃: 'Mino', 会津: 'Aizu', 中通り: 'Nakadori', 浜通り: 'Hamadori',
    上越地方: 'Joetsu', 中越地方: 'Chuetsu', 下越地方: 'Kaetsu', 能登地方: 'Noto', 加賀地方: 'Kaga',
    津軽: 'Tsugaru', 下北: 'Shimokita', 三八上北地方: 'Sanpachi–Kamikita', 庄内地方: 'Shonai',
    置賜地方: 'Okitama', 村山地方: 'Murayama', 最上地方: 'Mogami', 伊豆地方: 'Izu', 多摩: 'Tama',
    内陸: 'inland', 沿岸: 'coastal',
  };
  const FIXED = {
    日向灘: 'Hyuga Sea', 天草灘: 'Amakusa Sea', 遠州灘: 'Enshu Sea', 熊野灘: 'Kumano Sea', 伊予灘: 'Iyo Sea',
    安芸灘: 'Aki Sea', 周防灘: 'Suo Sea', 播磨灘: 'Harima Sea', 有明海: 'Ariake Sea', 東京湾: 'Tokyo Bay',
    相模湾: 'Sagami Bay', 駿河湾: 'Suruga Bay', 大阪湾: 'Osaka Bay', 若狭湾: 'Wakasa Bay', 富山湾: 'Toyama Bay',
    陸奥湾: 'Mutsu Bay', 内浦湾: 'Uchiura Bay', 橘湾: 'Tachibana Bay', 紀伊水道: 'Kii Channel',
    豊後水道: 'Bungo Channel', 三陸沖: 'Off Sanriku', 浦河沖: 'Off Urakawa, Hokkaido',
    苫小牧沖: 'Off Tomakomai, Hokkaido', 東京都23区: 'Tokyo’s 23 wards', 熊本県熊本地方: 'Around Kumamoto City',
  };
  const DIRECTIONS = {
    北: 'northern', 南: 'southern', 東: 'eastern', 西: 'western', 中: 'central',
    北東: 'northeastern', 北西: 'northwestern', 南東: 'southeastern', 南西: 'southwestern',
    中北: 'north-central', 中南: 'south-central', 中東: 'east-central', 中西: 'west-central',
  };
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function englishPlace(name) {
    if (!name) return '';
    if (FIXED[name]) return FIXED[name];
    const near = name.match(/^(.+?)(近海|付近)$/);
    if (near) return ISLANDS[near[1]] ? `Near ${ISLANDS[near[1]]}` : null;

    let area = null;
    let rest = name;
    const prefecture = name.match(/^(東京都|北海道|京都府|大阪府|(.{2,3}?)県)/);
    if (prefecture) {
      const key = prefecture[2] || prefecture[1].slice(0, 2);
      area = PREFECTURES[key] || { 東京: 'Tokyo', 北海: 'Hokkaido', 京都: 'Kyoto', 大阪: 'Osaka' }[key];
      rest = name.slice(prefecture[1].length);
    }
    let region = '';
    if (!area) {
      // Peninsulas first, so 根室半島 isn't read as the Hokkaido subregion 根室.
      const lookups = [[PENINSULAS], [ISLANDS], [HOKKAIDO, (en) => { region = en; return 'Hokkaido'; }]];
      for (const [table, place = (en) => en] of lookups) {
        const key = Object.keys(table).find((candidate) => name.startsWith(candidate));
        if (key) {
          area = place(table[key]);
          rest = name.slice(key.length).replace(/^地方/, '');
          break;
        }
      }
    }
    if (!area) return null;
    if (!region) {
      const key = Object.keys(REGIONS).find((candidate) => rest.startsWith(candidate));
      if (key) {
        region = REGIONS[key];
        rest = rest.slice(key.length);
      }
    }

    const where = region === 'inland' || region === 'coastal'
      ? `${region} ${area}`
      : region ? `${region}, ${area}` : area;
    if (rest === '') return capitalize(where);
    const part = rest.match(/^(北東|北西|南東|南西|中北|中南|中東|中西|北|南|東|西|中)部$/);
    if (part) return capitalize(`${DIRECTIONS[part[1]]} ${where}`);
    const off = rest.match(/^(北東|北西|南東|南西|北|南|東|西)?方?沖$/);
    if (off) {
      const direction = off[1] ? `${DIRECTIONS[off[1]]} ` : '';
      return where.startsWith('the ')
        ? `Off the ${direction}${where.slice(4)}`
        : `Off ${direction}${where}`;
    }
    return null;
  }

  const placeName = (quake) => {
    if (!quake.name) return language() === 'ja' ? '震源を調査中' : 'Locating…';
    return language() === 'ja' ? quake.name : (englishPlace(quake.name) || quake.name);
  };

  // --- Reports. A felt quake usually arrives as an intensity report (ScalePrompt), then its
  // hypocenter (Destination), then the details (DetailScale), so they're merged by quake time.

  const parseJst = (text) => new Date(`${text.replace(/\//g, '-').replace(' ', 'T')}+09:00`);
  const isTokyoWard = (point) => point.pref === '東京都' && (/区$/.test(point.addr) || /(23|２３)区/.test(point.addr));

  function mergeReports(reports) {
    const quakes = new Map();
    for (const report of reports) {
      const earthquake = report.earthquake;
      if (report.code !== 551 || !earthquake?.time || report.issue?.type === 'Foreign') continue;
      let quake = quakes.get(earthquake.time);
      if (!quake) {
        quake = {
          key: earthquake.time, time: parseJst(earthquake.time), scale: -1, tokyoScale: -1,
          name: '', magnitude: -1, depth: -1, tsunami: earthquake.domesticTsunami,
        };
        quakes.set(earthquake.time, quake);
      }
      // Reports come newest first, so the first hypocenter and tsunami status seen are the latest.
      quake.scale = Math.max(quake.scale, earthquake.maxScale ?? -1);
      const hypocenter = earthquake.hypocenter;
      if (hypocenter?.name && !quake.name) {
        quake.name = hypocenter.name;
        quake.magnitude = hypocenter.magnitude;
        quake.depth = hypocenter.depth;
      }
      (report.points || []).filter(isTokyoWard).forEach((point) => {
        quake.tokyoScale = Math.max(quake.tokyoScale, point.scale);
      });
    }
    return [...quakes.values()].filter((quake) => quake.scale > 0).sort((a, b) => b.time - a.time);
  }

  // --- Text.

  const jstDay = (date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const jstTime = (date) => date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const jstDate = (date) => (language() === 'ja'
    ? date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' })
    : date.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' }));
  const isToday = (date) => jstDay(date) === jstDay(new Date());

  function ago(date) {
    const minutes = Math.max(0, Math.round((Date.now() - date) / 60000));
    const ja = language() === 'ja';
    if (minutes < 1) return ja ? 'たった今' : 'just now';
    if (minutes < 60) return ja ? `${minutes}分前` : `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return ja ? `${hours}時間前` : `${hours} h ago`;
  }

  function line(className, text) {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    return element;
  }

  // A line of facts joined by " · ", which wraps only between them.
  function factsLine(facts) {
    const element = document.createElement('div');
    element.className = 'seismograph-meta';
    facts.filter(Boolean).forEach((fact, i) => {
      if (i) element.append(' · ');
      const span = document.createElement('span');
      span.className = 'seismograph-fact';
      span.textContent = fact;
      element.append(span);
    });
    return element;
  }

  let quakes = [];
  let selectedKey = null;
  let loadFailed = false;

  function render() {
    const ja = language() === 'ja';
    const quake = quakes.find((candidate) => candidate.key === selectedKey) || quakes[0];
    if (!quake) {
      latest.replaceChildren(line('seismograph-meta', loadFailed
        ? (ja ? '地震情報を読み込めません' : 'Can’t reach earthquake reports')
        : '-'));
      list.replaceChildren();
      return;
    }

    const headline = document.createElement('div');
    headline.className = 'seismograph-headline';
    headline.append(
      line('seismograph-shindo', `${ja ? '震度' : 'Shindo '}${shindoLabel(quake.scale)}`),
      line('seismograph-magnitude', quake.magnitude > 0 ? `M${quake.magnitude.toFixed(1)}` : ''),
    );
    const place = line('seismograph-place', placeName(quake));
    if (!ja && quake.name) place.title = quake.name;

    const when = isToday(quake.time)
      ? [`${jstTime(quake.time)}${ja ? '' : ' JST'}`, ago(quake.time)]
      : [`${jstDate(quake.time)} ${jstTime(quake.time)}${ja ? '' : ' JST'}`];
    let depth = '';
    if (quake.depth === 0) depth = ja ? 'ごく浅い' : 'very shallow';
    else if (quake.depth > 0) depth = ja ? `深さ${quake.depth}km` : `${quake.depth} km deep`;
    const lines = [headline, place, factsLine([...when, depth])];
    if (quake.tokyoScale > 0) {
      lines.push(line('seismograph-meta', ja
        ? `東京23区：震度${shindoLabel(quake.tokyoScale)}`
        : `Tokyo’s 23 wards: Shindo ${shindoLabel(quake.tokyoScale)}`));
    }
    if (TSUNAMI[quake.tsunami]) lines.push(line('seismograph-alert', TSUNAMI[quake.tsunami][ja ? 1 : 0]));
    latest.replaceChildren(...lines);

    list.replaceChildren(...quakes.slice(0, LIST_LENGTH).map((item) => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seismograph-row';
      button.setAttribute('aria-pressed', item.key === quake.key ? 'true' : 'false');
      button.append(
        line('seismograph-row-time', isToday(item.time) ? jstTime(item.time) : jstDate(item.time)),
        line('seismograph-row-scale', shindoLabel(item.scale)),
        line('seismograph-row-place', placeName(item)),
      );
      button.addEventListener('click', () => {
        select(item.key);
        button.blur();
      });
      row.append(button);
      return row;
    }));
  }

  // --- The recorder.

  let width = 0;
  let height = 0;
  let columns = []; // pen offsets from the center line, oldest first, one per CSS px
  let ticks = []; // true where a 10-second mark falls
  let paperTime = 0; // seconds of paper that have gone by
  let carry = 0;
  let wave = null; // the quake being played

  // A seeded random number generator, so a quake draws the same shape each time it plays.
  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function play(quake) {
    if (!quake) return;
    const random = seeded([...quake.key].reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619), 2166136261));
    const magnitude = quake.magnitude > 0 ? quake.magnitude : 3;
    const depth = quake.depth >= 0 ? quake.depth : 30;
    wave = {
      start: paperTime + 0.3,
      swing: SWING[quake.scale] || 6,
      // The S wave trails the P wave by more the deeper the quake.
      lag: Math.min(4, 0.8 + depth / 90),
      decay: Math.min(4.5, 0.6 + magnitude * 0.45),
      partials: [0, 1, 2].map(() => ({ frequency: 2 + random() * 4, phase: random() * Math.PI * 2 })),
    };
    if (reduceMotion.matches) drawStill();
  }

  function waveAt(t) {
    const elapsed = t - wave.start;
    if (elapsed < 0) return 0;
    if (elapsed > wave.lag + wave.decay * 6) {
      wave = null;
      return 0;
    }
    const rise = (x, k) => (x <= 0 ? 0 : 1 - Math.exp(-x / k));
    const p = 0.25 * rise(elapsed, 0.1) * Math.exp(-elapsed / 1.2);
    const sElapsed = elapsed - wave.lag;
    const s = sElapsed <= 0 ? 0 : rise(sElapsed, 0.3) * Math.exp(-sElapsed / wave.decay);
    const [a, b, c] = wave.partials;
    const shake = 0.5 * Math.sin(2 * Math.PI * a.frequency * t + a.phase)
      + 0.3 * Math.sin(2 * Math.PI * b.frequency * t + b.phase)
      + 0.2 * Math.sin(2 * Math.PI * c.frequency * 1.7 * t + c.phase)
      + 0.35 * (Math.random() - 0.5);
    return wave.swing * (p + s) * shake;
  }

  function advance() {
    paperTime += 1 / SPEED;
    // Microseisms: the ground never quite holds still.
    let offset = 0.45 * Math.sin(paperTime * 1.9) + 0.3 * Math.sin(paperTime * 0.7 + 1) + (Math.random() - 0.5) * 0.8;
    if (wave) offset += waveAt(paperTime);
    const stop = height / 2 - 3;
    columns.push(Math.max(-stop, Math.min(stop, offset)));
    ticks.push(Math.floor(paperTime / 10) !== Math.floor((paperTime - 1 / SPEED) / 10));
    const length = Math.max(0, width - PEN_GAP);
    while (columns.length > length) {
      columns.shift();
      ticks.shift();
    }
  }

  function draw() {
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    const middle = Math.floor(height / 2);
    // Ruled paper: dotted lines every 8 px, a little denser on the center line.
    for (let y = middle % 8; y < height; y += 8) {
      for (let x = 0; x < width; x += y === middle ? 2 : 4) ctx.fillRect(x, y, 1, 1);
    }
    const penX = width - PEN_GAP;
    const left = penX - columns.length;
    ticks.forEach((tick, i) => {
      if (!tick) return;
      for (let y = 0; y < height; y += 3) ctx.fillRect(left + i, y, 1, 1);
    });
    // The trace, with each step joined to the last so fast swings stay solid.
    let previous = null;
    columns.forEach((offset, i) => {
      const y = Math.round(middle + offset);
      const from = previous ?? y;
      ctx.fillRect(left + i, Math.min(from, y), 1, Math.abs(from - y) + 1);
      previous = y;
    });
    // The pen: a tip on the paper and its arm running off to the right.
    const penY = previous ?? middle;
    ctx.fillRect(penX, penY - 1, 3, 3);
    ctx.fillRect(penX + 3, penY, width - penX - 3, 1);
  }

  // With reduced motion, the paper is drawn once, with the whole quake on it.
  function drawStill() {
    columns = [];
    ticks = [];
    const length = Math.max(0, width - PEN_GAP);
    if (wave) wave.start = paperTime + 0.6;
    for (let i = 0; i < length * 3 && (columns.length < length || wave); i += 1) advance();
    draw();
  }

  function resize() {
    const rect = paper.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (reduceMotion.matches) {
      drawStill();
      return;
    }
    // Fill the paper with quiet ground the first time, so it never starts blank.
    while (columns.length < width - PEN_GAP) advance();
    draw();
  }

  let running = false;
  let onScreen = false;
  let frame = 0;
  let lastFrame = 0;
  let replayWhenSeen = false;

  function tick(now) {
    // Up to a second per frame, so a throttled page keeps paper speed, and a long stall skips ahead.
    carry += Math.min(1, (now - lastFrame) / 1000) * SPEED;
    lastFrame = now;
    while (carry >= 1) {
      carry -= 1;
      advance();
    }
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updateRunning() {
    const shouldRun = widget.isConnected && onScreen && !document.hidden && !reduceMotion.matches;
    if (shouldRun && !running) {
      running = true;
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
      if (replayWhenSeen) {
        replayWhenSeen = false;
        // Give the page's boot a moment, so the first quake isn't over before anyone looks.
        setTimeout(() => play(quakes.find((quake) => quake.key === selectedKey)), 1200);
      }
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
  }

  function select(key) {
    selectedKey = key;
    render();
    const quake = quakes.find((candidate) => candidate.key === key);
    if (running || reduceMotion.matches) play(quake);
    else replayWhenSeen = true;
  }

  // --- Loading.

  let lastLoad = 0;

  async function load() {
    lastLoad = Date.now();
    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const merged = mergeReports(await response.json());
      loadFailed = false;
      const newest = merged[0];
      const isNew = newest && quakes[0] && newest.key !== quakes[0].key && newest.time > quakes[0].time;
      quakes = merged;
      if (!newest) render();
      else if (!selectedKey || isNew || !quakes.some((quake) => quake.key === selectedKey)) select(newest.key);
      else render();
    } catch (error) {
      loadFailed = true;
      if (!quakes.length) render();
    }
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
  new ResizeObserver(resize).observe(paper);
  new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    updateRunning();
  }).observe(paper);

  widget.querySelector('.close-box').addEventListener('click', () => {
    widget.remove();
    placement.disconnect();
    place();
    updateRunning();
  });

  document.addEventListener('visibilitychange', () => {
    updateRunning();
    if (!document.hidden && Date.now() - lastLoad > POLL_MS) load();
  });
  document.addEventListener('site-language-change', render);
  reduceMotion.addEventListener('change', () => {
    updateRunning();
    if (reduceMotion.matches) drawStill();
  });
  setInterval(() => {
    if (!document.hidden && widget.isConnected) load();
  }, POLL_MS);
  // Keeps "12 min ago" current between loads.
  setInterval(() => {
    if (!document.hidden && widget.isConnected && quakes.length) render();
  }, 30 * 1000);

  render();
  place();
  load();
})();
