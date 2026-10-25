// Halloween mode. The inline script in <head> decides whether it's on (Oct 25 – Nov 1, Japan time)
// and adds `halloween` / `sad-mac-boot` to <html>. This runs before index.js so the label swaps
// below are what setLanguage() renders.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('halloween')) return;

  const visitorLabel = document.querySelector('.stack-visitor-counter [data-label-en]');
  if (visitorLabel) {
    visitorLabel.dataset.labelEn = 'Souls<span class="souls-detail"> (number of visitors)</span>:';
    visitorLabel.dataset.labelJa = '魂<span class="souls-detail">（訪問者数）</span>:';
    visitorLabel.innerHTML = visitorLabel.dataset.labelEn;
  }

  const aboutTitle = document.querySelector('#about-dialog > .title-bar .title-text');
  if (aboutTitle) {
    aboutTitle.dataset.labelEn = 'About this Undead Mac';
    aboutTitle.dataset.labelJa = 'このアンデッドMacについて';
    aboutTitle.textContent = 'About this Undead Mac';
  }

  setUpKeyCaps();
  setUpScreensaver();

  if (!root.classList.contains('sad-mac-boot')) return;

  // Sad Mac, drawn on a 22 x 26 grid. "W" is lit, "s" is lit only while sad, "r" only once it rises.
  const SAD_MAC = [
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWW................WWW',
    'WWW................WWW',
    'WWW................WWW',
    'WWW...s.s....s.s...WWW',
    'WWW....s......s....WWW',
    'WWW...s.s....s.s...WWW',
    'WWW................WWW',
    'WWW................WWW',
    'WWW......ssss......WWW',
    'WWW.....s....s.....WWW',
    'WWW....s......s....WWW',
    'WWW................WWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWW.......WWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    '......................',
    '.WWWWWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWWW.',
  ];
  // Risen face: one eye still X'd out, the other open, and a stitched grin.
  const RISEN = [
    [5, 6], [5, 8], [6, 7], [7, 6], [7, 8],
    [5, 13], [5, 14], [6, 13], [6, 14],
    [10, 7], [11, 8], [11, 9], [11, 10], [11, 11], [11, 12], [11, 13], [10, 14], [12, 9], [12, 11],
  ];

  const rects = { W: '', s: '', r: '' };
  SAD_MAC.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (rects[cell] !== undefined) rects[cell] += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    });
  });
  RISEN.forEach(([y, x]) => { rects.r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });

  const screen = document.createElement('div');
  screen.className = 'sad-mac-screen';
  screen.setAttribute('aria-hidden', 'true');
  screen.innerHTML = `
    <div class="sad-mac-stage">
      <svg class="sad-mac-icon" viewBox="0 0 22 26" shape-rendering="crispEdges">
        <g fill="#fff">${rects.W}</g>
        <g class="sad-mac-face-sad" fill="#fff">${rects.s}</g>
        <g class="sad-mac-face-risen" fill="#fff">${rects.r}</g>
      </svg>
    </div>
    <div class="sad-mac-code"><span class="sad-mac-code-line">0000000F</span><br>00000666</div>`;
  document.body.prepend(screen);

  const stage = screen.querySelector('.sad-mac-stage');
  const codeLine = screen.querySelector('.sad-mac-code-line');
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let scramble = null;
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    clearInterval(scramble);
    screen.classList.add('is-leaving');
    root.classList.remove('sad-mac-boot');
    setTimeout(() => screen.remove(), 450);
    try {
      localStorage.setItem('halloween-sad-mac', root.dataset.halloweenYear || '');
    } catch (error) {}
    window.removeEventListener('keydown', finish);
  }

  const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  // Pixel particles flying off the Mac: dirt falls from its base, sparks fly up from its top.
  function scatter(count, className, place) {
    for (let i = 0; i < count; i += 1) {
      const bit = document.createElement('span');
      bit.className = className;
      const { left, dx, dy, delay } = place();
      bit.style.left = `${left}px`;
      bit.style.setProperty('--dx', `${dx * 4}px`);
      bit.style.setProperty('--dy', `${dy * 4}px`);
      bit.style.animationDelay = `${delay}ms`;
      stage.append(bit);
    }
  }

  // A jagged pixel lightning bolt from the top of the screen down to the top of the Mac,
  // drawn on a 4px grid with Bresenham lines so it matches the icon's pixels.
  function lightningBolt() {
    // One extra row so the bolt always starts just above the top edge.
    const rows = Math.ceil(stage.getBoundingClientRect().top / 4) + 1;
    if (rows < 6) return null;
    const cols = 40;
    const middle = cols / 2;
    const clampX = (x) => Math.min(cols - 3, Math.max(2, x));
    const segments = Math.max(4, Math.round(rows / 10));
    const trunk = [[clampX(middle + rand(-8, 8)), 0]];
    for (let i = 1; i < segments; i += 1) {
      trunk.push([clampX(middle + rand(-9, 9)), Math.round((rows * i) / segments) + rand(-1, 1)]);
    }
    trunk.push([middle + 1, rows - 1]);

    const [forkX, forkY] = trunk[Math.floor(segments / 2)];
    const side = forkX < middle ? -1 : 1;
    const fork = [[forkX, forkY]];
    for (let i = 0; i < 3; i += 1) {
      const [x, y] = fork[fork.length - 1];
      fork.push([clampX(x + side * rand(2, 5)), Math.min(rows - 4, y + rand(3, 6))]);
    }

    const cells = (points) => {
      const lit = new Set();
      for (let i = 1; i < points.length; i += 1) {
        let [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          lit.add(`${x0},${y0}`);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      }
      return [...lit].map((cell) => {
        const [x, y] = cell.split(',');
        return `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }).join('');
    };

    const bolt = document.createElement('div');
    bolt.className = 'sad-mac-bolt';
    bolt.style.width = `${cols * 4}px`;
    bolt.style.height = `${rows * 4}px`;
    bolt.innerHTML = `
      <svg viewBox="0 0 ${cols} ${rows}" width="${cols * 4}" height="${rows * 4}" shape-rendering="crispEdges">
        <g fill="#fff" opacity="0.6">${cells(fork)}</g>
        <g fill="#fff">${cells(trunk)}</g>
      </svg>`;
    stage.append(bolt);
    return bolt;
  }

  // 1. Lightning strikes the Mac; the error code scrambles into DEADBEEF.
  let bolt = null;
  at(450, () => { bolt = lightningBolt(); });
  at(590, () => {
    screen.classList.add('is-charged');
    scatter(8, 'sad-mac-bit is-spark', () => ({
      left: 40 + rand(-4, 4), dx: rand(-10, 10), dy: -rand(2, 9), delay: rand(0, 2) * 40,
    }));
    const hex = '0123456789ABCDEF';
    let ticks = 0;
    scramble = setInterval(() => {
      ticks += 1;
      if (ticks > 10) {
        clearInterval(scramble);
        codeLine.textContent = 'DEADBEEF';
        return;
      }
      codeLine.textContent = Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');
    }, 40);
  });
  at(700, () => bolt?.classList.add('is-restriking'));
  at(860, () => bolt?.classList.add('is-fading'));
  at(1050, () => screen.classList.remove('is-charged'));
  at(1150, () => bolt?.remove());

  // 2. Reanimation: jolts, with the face flickering faster between dead and risen (ends risen).
  at(700, () => screen.classList.add('is-jolting'));
  [0, 180, 300, 380, 440, 490, 530, 560, 590].forEach((offset) => {
    at(700 + offset, () => screen.classList.toggle('is-risen-face'));
  });

  // 3. Rise: lifts off the ground in pixel steps, shaking off dirt.
  at(1500, () => {
    screen.classList.remove('is-jolting');
    screen.classList.add('is-rising');
    scatter(9, 'sad-mac-bit', () => ({
      left: rand(2, 20) * 4, dx: rand(-8, 8), dy: rand(6, 13), delay: rand(0, 4) * 60,
    }));
  });

  at(2500, finish);
  screen.addEventListener('click', finish);
  window.addEventListener('keydown', finish);

  // Desk accessories share the Settings grid cell, so they stack below Settings in the order
  // they're added, and move when Settings or one of them is rolled up or closed.
  function addDeskAccessory(widget) {
    const settings = document.getElementById('appearance-panel');
    const stack = [...document.querySelectorAll('.desk-accessory')];
    (stack[stack.length - 1] || settings).after(widget);
    const place = () => {
      let top = 36 + settings.offsetHeight + 12;
      document.querySelectorAll('.desk-accessory').forEach((accessory) => {
        accessory.style.marginTop = `${top}px`;
        top += accessory.offsetHeight + 12;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(settings);
    observer.observe(widget);
    widget.querySelector('.close-box').addEventListener('click', () => {
      widget.remove();
      place();
    });
  }

  // Key Caps desk accessory under Settings. Every so often a ghost types on it.
  function setUpKeyCaps() {
    const settings = document.getElementById('appearance-panel');
    if (!settings) return;

    const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const keys = new Map();
    const board = document.createElement('div');
    board.className = 'key-caps-board';
    ROWS.forEach((row, rowIndex) => {
      [...row].forEach((letter, i) => {
        const key = document.createElement('span');
        key.className = 'key-caps-key';
        key.textContent = letter;
        key.style.gridRow = String(rowIndex + 1);
        key.style.gridColumn = `${rowIndex + 1 + i * 2} / span 2`;
        keys.set(letter, key);
        board.append(key);
      });
    });
    const space = document.createElement('span');
    space.className = 'key-caps-key key-caps-space';
    keys.set(' ', space);
    board.append(space);

    const display = document.createElement('div');
    display.className = 'key-caps-display';

    const widget = document.createElement('div');
    widget.className = 'clock-widget desk-accessory key-caps';
    widget.setAttribute('aria-hidden', 'true');
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title" data-label-en="Key Caps" data-label-ja="キー配列">Key Caps</span>
      </div>
      <div class="clock-content key-caps-content"></div>`;
    widget.querySelector('.key-caps-content').append(display, board);
    addDeskAccessory(widget);

    // What the ghost types. In Japanese it types romaji, then "converts" it like an input method.
    const WORDS = {
      en: [['HELLO'], ['BRAINS'], ['STAY HUNGRY'], ['BOO']],
      ja: [['ZONBI', 'ゾンビ'], ['OBAKE', 'おばけ'], ['NOUMISO', '脳みそ']],
    };
    // Type BOO at it and you scare the ghost.
    const SCARED = { en: ['AAAH', 'AAAH!'], ja: ['KYAA', 'キャー！'] };
    const language = () => (root.lang === 'ja' ? 'ja' : 'en');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let typed = '';
    let lastGhostWord = '';
    let ghostRun = 0;
    let visitorTypedAt = 0;
    let replyTimer = null;
    let ghostOwnsText = false;

    const show = () => { display.textContent = typed.slice(-18); };
    const flash = (key) => {
      key.classList.add('is-down');
      setTimeout(() => key.classList.remove('is-down'), 140);
    };

    async function ghostTypes([word, converted]) {
      const run = ++ghostRun;
      const stillMine = () => run === ghostRun && widget.isConnected;
      ghostOwnsText = true;
      typed = '';
      show();
      for (const letter of word) {
        const key = keys.get(letter);
        key?.classList.add('is-down');
        typed += letter;
        show();
        await wait(180 + Math.random() * 160);
        key?.classList.remove('is-down');
        if (!stillMine()) return;
        await wait(90 + Math.random() * 220);
        if (!stillMine()) return;
      }
      await wait(1100);
      if (!stillMine()) return;
      if (converted) {
        typed = converted;
        show();
        await wait(1300);
        if (!stillMine()) return;
      }
      typed = '';
      show();
    }

    // The visitor types (keyboard or mouse). This takes the keyboard away from the ghost mid-word.
    function visitorTypes(letter) {
      ghostRun += 1;
      keys.forEach((key) => key.classList.remove('is-down'));
      visitorTypedAt = Date.now();
      if (ghostOwnsText) {
        ghostOwnsText = false;
        typed = '';
      }
      if (letter === 'Backspace') {
        typed = typed.slice(0, -1);
      } else {
        typed += letter;
        flash(keys.get(letter));
      }
      show();
      clearTimeout(replyTimer);
      if (typed.endsWith('BOO')) {
        replyTimer = setTimeout(() => ghostTypes(SCARED[language()]), 700);
      }
    }

    board.addEventListener('click', (event) => {
      const key = event.target.closest('.key-caps-key');
      if (key) visitorTypes(key === space ? ' ' : key.textContent);
    });

    window.addEventListener('keydown', (event) => {
      if (!widget.isConnected || !widget.offsetParent) return;
      if (root.classList.contains('sad-mac-boot')) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if (event.key === 'Backspace') {
        visitorTypes('Backspace');
      } else if (event.key === ' ' || /^[a-z]$/i.test(event.key)) {
        visitorTypes(event.key === ' ' ? ' ' : event.key.toUpperCase());
      }
    });

    // The ghost shows up every so often, but waits while someone is typing.
    async function haunt() {
      if (!widget.isConnected) return;
      if (document.hidden || Date.now() - visitorTypedAt < 5000) {
        setTimeout(haunt, 2000);
        return;
      }
      const list = WORDS[language()].filter(([word]) => word !== lastGhostWord);
      const choice = list[Math.floor(Math.random() * list.length)];
      lastGhostWord = choice[0];
      await ghostTypes(choice);
      setTimeout(haunt, 9000 + Math.random() * 7000);
    }
    setTimeout(haunt, 3500);
  }

  // Screensaver after a while with no input: winged jack-o'-lanterns and bats
  // flying down and to the left, like the old flying toasters. Any input wakes the desktop.
  function setUpScreensaver() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const IDLE_MS = 45000;
    const SLEEP_CORNER = 10;
    const PIXEL = 3;

    // Colors by letter. "y" is candlelight, which flickers (see .screensaver-glow).
    const COLORS = {
      W: '#fff', e: '#d4d4d4', g: '#a8a8a8', k: '#6e6e6e',
      H: '#ffb050', O: '#ff8a1f', M: '#d96a12', D: '#9c440b', c: '#e07f1c',
      G: '#6f8f3a', J: '#45601f', b: '#777', B: '#555', N: '#3a3a3a',
    };

    // Where the face is carved, by longitude and latitude on the pumpkin (radians, 0 at the
    // face's center), so it wraps around the curve: triangle eyes and nose, and a grin with teeth.
    function isCarved(lon, lat) {
      const eye = (center) => {
        const down = lat + 0.5;
        return down >= 0 && down <= 0.36 && Math.abs(lon - center) <= (0.24 * down) / 0.36;
      };
      if (eye(-0.38) || eye(0.38)) return true;
      const noseDown = lat + 0.06;
      if (noseDown >= 0 && noseDown <= 0.16 && Math.abs(lon) <= (0.1 * noseDown) / 0.16 + 0.01) return true;
      if (Math.abs(lon) >= 0.72) return false;
      const top = 0.3 - 0.5 * lon * lon;
      const bottom = top + 0.32 * (1 - (lon / 0.74) ** 2);
      if (lat <= top || lat >= bottom) return false;
      const upperTooth = Math.abs(Math.abs(lon) - 0.24) < 0.08 && lat < top + 0.1;
      const lowerTooth = Math.abs(lon) < 0.08 && lat > bottom - 0.1;
      return !upperTooth && !lowerTooth;
    }

    // A jack-o'-lantern in three-quarter view, turned toward the way it flies (down and to the left),
    // lit from the upper left, with darker grooves between its lobes.
    function drawPumpkin(grid, left, top, width, height) {
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const turn = 0.35;
      const holes = new Set();
      for (let y = top; y < top + height; y += 1) {
        for (let x = left; x < left + width; x += 1) {
          const u = (x + 0.5 - centerX) / (width / 2);
          const v = (y + 0.5 - centerY) / (height / 2);
          const lobes = 1 - 0.04 * Math.abs(Math.cos(Math.atan2(v, u) * 5));
          if (u * u + v * v > lobes * lobes) continue;
          const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
          const lon = Math.atan2(u, z) + turn;
          const lat = Math.asin(Math.min(1, v));
          if (isCarved(lon, lat)) {
            holes.add(`${x},${y}`);
            grid[y][x] = 'y';
            continue;
          }
          const groove = Math.exp(-(Math.sin(lon * 5) ** 2) / 0.025) * (1 - v * v);
          const shade = -0.55 * u - 0.6 * v + 0.58 * z - 0.45 * groove;
          grid[y][x] = shade > 0.7 ? 'H' : shade > 0.3 ? 'O' : shade > -0.1 ? 'M' : 'D';
        }
      }
      // The cut's inner wall shows along the top and right of each hole.
      holes.forEach((cell) => {
        const [x, y] = cell.split(',').map(Number);
        if (!holes.has(`${x},${y - 1}`) || !holes.has(`${x + 1},${y}`)) grid[y][x] = 'c';
      });
      const stemX = Math.round(centerX + 1);
      [[0, 0], [0, -1], [1, -2], [1, -3], [2, -4]].forEach(([dx, dy]) => {
        grid[top + 1 + dy][stemX + dx] = 'G';
        grid[top + 1 + dy][stemX + dx + 1] = 'G';
        grid[top + 1 + dy][stemX + dx + 2] = 'J';
      });
    }

    // A feathered wing: a fan from its root, longest at the leading edge, with notched feather
    // tips and shafts. `spine` is the leading edge's angle in degrees.
    function drawWing(grid, rootX, rootY, spine, long, short, fill, line) {
      const span = 72;
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const distance = Math.hypot(x + 0.5 - rootX, y + 0.5 - rootY);
          const angle = ((Math.atan2(y + 0.5 - rootY, x + 0.5 - rootX) * 180) / Math.PI - spine + 540) % 360 - 180;
          if (angle < -5 || angle > span) return;
          const t = Math.max(0, angle) / span;
          const reach = long - t * (long - short);
          const feather = (angle + 5) % 12;
          if (distance > reach - (feather > 8 ? 2.5 * (1 - t / 2) : 0)) return;
          row[x] = feather < 1.4 && angle > 4 && distance > reach / 2 ? line : fill;
        });
      });
    }

    // Wings up, level, then down. The far wing is drawn first, in grey, behind the pumpkin.
    function flyingPumpkin(spine) {
      const grid = Array.from({ length: 46 }, () => Array(52).fill('.'));
      drawWing(grid, 20, 24, spine - 10, 18, 10, 'g', 'k');
      drawPumpkin(grid, 1, 20, 30, 24);
      drawWing(grid, 25, 27, spine, 24, 13, 'W', 'e');
      return grid.map((row) => row.join(''));
    }

    // A bat's wing: skin stretched between finger bones, sagging between their tips.
    function drawBatWing(grid, rootX, rootY, spine, long, short, fill, bone) {
      const span = 80;
      const gap = 20;
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const distance = Math.hypot(x + 0.5 - rootX, y + 0.5 - rootY);
          const angle = ((Math.atan2(y + 0.5 - rootY, x + 0.5 - rootX) * 180) / Math.PI - spine + 540) % 360 - 180;
          if (angle < -3 || angle > span) return;
          const a = Math.max(0, angle);
          const between = (a % gap) / gap;
          const reach = (long - (a / span) * (long - short)) * (1 - 0.2 * Math.sin(Math.PI * between));
          if (distance > reach) return;
          const nearest = Math.min(span - gap, Math.round(angle / gap) * gap);
          const offBone = distance * Math.abs(Math.sin(((angle - nearest) * Math.PI) / 180));
          row[x] = offBone < 0.5 && distance > 2 ? bone : fill;
        });
      });
    }

    // A bat in three-quarter view, head down and to the left, lit from the upper left.
    function flyingBat(spine) {
      const grid = Array.from({ length: 24 }, () => Array(32).fill('.'));
      drawBatWing(grid, 10.5, 10.5, spine - 12, 12, 6, 'N', 'B');
      const blob = (centerX, centerY, radiusX, radiusY, dark) => {
        grid.forEach((row, y) => {
          row.forEach((cell, x) => {
            const u = (x + 0.5 - centerX) / radiusX;
            const v = (y + 0.5 - centerY) / radiusY;
            if (u * u + v * v > 1) return;
            const shade = -0.6 * u - 0.7 * v;
            row[x] = shade > 0.32 ? 'b' : shade > dark ? 'B' : 'N';
          });
        });
      };
      blob(12.5, 14, 4.8, 3.8, -0.4);
      blob(8, 16.5, 3, 2.7, -0.5);
      [[4, 11], [5, 12], [5, 13], [6, 13], [6, 14]].forEach(([x, y]) => { grid[y][x] = 'b'; });
      [[9, 11], [9, 12], [9, 13], [10, 13], [10, 14]].forEach(([x, y]) => { grid[y][x] = 'B'; });
      grid[16][6] = 'y';
      grid[16][9] = 'y';
      drawBatWing(grid, 12.5, 11.5, spine, 17, 8, 'B', 'b');
      return grid.map((row) => row.join(''));
    }

    const frameSvg = (rows, frame) => {
      const fills = {};
      rows.forEach((row, y) => {
        [...row].forEach((cell, x) => {
          if (cell !== '.') fills[cell] = `${fills[cell] || ''}<rect x="${x}" y="${y}" width="1" height="1"/>`;
        });
      });
      const groups = Object.entries(fills).map(([cell, rects]) => (
        cell === 'y' ? `<g class="screensaver-glow">${rects}</g>` : `<g fill="${COLORS[cell]}">${rects}</g>`
      ));
      return `<g data-frame="${frame}">${groups.join('')}</g>`;
    };

    // Each kind: its flap frames, how long each frame shows, and its speed and heading.
    const KINDS = {
      pumpkin: { frames: [-95, -45, 5].map(flyingPumpkin), flap: [0, 1, 2, 1], frameMs: 130, speed: [55, 90], slope: 0.5 },
      bat: { frames: [-100, -40, 15].map(flyingBat), flap: [0, 1, 2, 1], frameMs: 70, speed: [120, 170], slope: 0.25, bob: 10 },
    };
    Object.values(KINDS).forEach((kind) => {
      const columns = kind.frames[0][0].length;
      const rowCount = Math.max(...kind.frames.map((rows) => rows.length));
      kind.width = columns * PIXEL;
      kind.height = rowCount * PIXEL;
      kind.svg = `<svg viewBox="0 0 ${columns} ${rowCount}" width="${kind.width}" height="${kind.height}" shape-rendering="crispEdges">${kind.frames.map(frameSvg).join('')}</svg>`;
    });

    // Settings from the In the Dark desk accessory, as steps on its sliders.
    const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
    const DENSITIES = [0.5, 0.75, 1, 1.5, 2];
    const options = { speed: 2, density: 2 };
    try {
      const saved = JSON.parse(localStorage.getItem('after-dark') || '{}');
      ['speed', 'density'].forEach((key) => {
        if (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] < SPEEDS.length) options[key] = saved[key];
      });
    } catch (error) {}

    const random = (min, max) => min + Math.random() * (max - min);
    let lastInputAt = Date.now();
    let lastPointer = null;
    let saver = null;

    function start(fromCorner = false) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const density = DENSITIES[options.density];
      const speed = SPEEDS[options.speed];
      const pumpkins = Math.max(1, Math.round(Math.min(10, Math.max(3, (width * height) / 130000)) * density));
      const counts = {
        pumpkin: pumpkins,
        bat: Math.max(1, Math.round((width < 600 ? 1 : 3) * density)),
      };

      const screen = document.createElement('div');
      screen.className = 'screensaver';
      screen.setAttribute('aria-hidden', 'true');

      // Re-enter from the top or right edge, weighted by how long each edge is.
      const respawn = (sprite) => {
        const { kind } = sprite;
        if (Math.random() < width / (width + height)) {
          sprite.x = random(0, width + kind.width);
          sprite.y = -kind.height - random(0, 80);
        } else {
          sprite.x = width + random(0, 80);
          sprite.y = random(-kind.height, height * 0.7);
        }
      };

      const sprites = [];
      Object.entries(counts).forEach(([name, count]) => {
        for (let i = 0; i < count; i += 1) {
          const kind = KINDS[name];
          const el = document.createElement('div');
          el.className = 'screensaver-sprite';
          el.innerHTML = kind.svg;
          el.querySelectorAll('.screensaver-glow').forEach((glow) => {
            glow.style.animationDelay = `${-random(0, 2)}s`;
          });
          const sprite = {
            el, kind,
            x: random(0, width), y: random(-kind.height, height),
            speed: random(...kind.speed) * speed,
            phase: random(0, 1000), frame: -1,
          };
          sprites.push(sprite);
        }
      });
      // Shuffle so bats pass in front of and behind the pumpkins.
      sprites.sort(() => Math.random() - 0.5).forEach((sprite) => screen.append(sprite.el));
      document.body.append(screen);
      requestAnimationFrame(() => screen.classList.add('is-on'));

      let last = performance.now();
      let raf = 0;
      const tick = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        sprites.forEach((sprite) => {
          const { kind } = sprite;
          sprite.x -= sprite.speed * dt;
          sprite.y += sprite.speed * kind.slope * dt;
          if (sprite.x < -kind.width || sprite.y > height) respawn(sprite);
          const bob = kind.bob ? Math.sin((now + sprite.phase) / 190) * kind.bob : 0;
          sprite.el.style.transform = `translate3d(${sprite.x.toFixed(2)}px, ${(sprite.y + bob).toFixed(2)}px, 0)`;
          // Wings beat a little faster when they fly faster.
          const beat = Math.floor(((now + sprite.phase) * Math.sqrt(speed)) / kind.frameMs);
          const frame = kind.flap[beat % kind.flap.length];
          if (frame !== sprite.frame) {
            sprite.frame = frame;
            sprite.el.dataset.frame = String(frame);
          }
        });
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

    // Sleep Now corner, like After Dark's: put the mouse in the bottom-left corner to start it now.
    // A quick flick can leave the window without a move inside the corner, so leaving counts too.
    const inSleepCorner = (event) => event.pointerType === 'mouse'
      && event.clientX <= SLEEP_CORNER && event.clientY >= window.innerHeight - SLEEP_CORNER;

    // Wake on any input, and swallow the key that woke it so it doesn't also type or navigate.
    const onInput = (event) => {
      lastInputAt = Date.now();
      if (!saver) {
        if (event.type === 'pointermove') lastPointer = [event.clientX, event.clientY];
        if (inSleepCorner(event) && !root.classList.contains('sad-mac-boot')) start(true);
        return;
      }
      if (event.type === 'pointerout') return;
      if (event.type === 'pointermove') {
        // Stay asleep while the mouse rests in the Sleep Now corner.
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

    setInterval(() => {
      if (saver || document.hidden || Date.now() - lastInputAt < IDLE_MS) return;
      if (root.classList.contains('sad-mac-boot')) return;
      // Clicks inside the desktop browser or a video land in an iframe, where we can't see them.
      if (document.activeElement?.tagName === 'IFRAME') return;
      start();
    }, 1000);

    // "In the Dark" desk accessory, after the After Dark control panel: a little screen showing
    // the module, speed and density sliders, and Sleep Now.
    // The preview is the pumpkin with its wings level, cropped to its pixels so it sits centered.
    const previewRows = KINDS.pumpkin.frames[1];
    const lit = previewRows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '.' ? [] : [[x, y]])));
    const left = Math.min(...lit.map(([x]) => x));
    const top = Math.min(...lit.map(([, y]) => y));
    const width = Math.max(...lit.map(([x]) => x)) + 1 - left;
    const height = Math.max(...lit.map(([, y]) => y)) + 1 - top;
    const previewSvg = `<svg viewBox="${left} ${top} ${width} ${height}" shape-rendering="crispEdges">${frameSvg(previewRows, 1)}</svg>`;

    const widget = document.createElement('div');
    widget.className = 'clock-widget desk-accessory after-dark';
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title">In the Dark</span>
      </div>
      <div class="clock-content after-dark-content">
        <div class="after-dark-module">
          <div class="after-dark-preview" aria-hidden="true">${previewSvg}</div>
          <span data-label-en="Flying Pumpkins" data-label-ja="空飛ぶカボチャ">Flying Pumpkins</span>
        </div>
        <label class="after-dark-setting">
          <span data-label-en="Speed" data-label-ja="速さ">Speed</span>
          <span class="after-dark-slider">
            <input type="range" min="0" max="${SPEEDS.length - 1}" step="1" data-option="speed">
            <span class="after-dark-ticks" aria-hidden="true">${'<i></i>'.repeat(SPEEDS.length)}</span>
          </span>
        </label>
        <label class="after-dark-setting">
          <span data-label-en="Density" data-label-ja="数">Density</span>
          <span class="after-dark-slider">
            <input type="range" min="0" max="${DENSITIES.length - 1}" step="1" data-option="density">
            <span class="after-dark-ticks" aria-hidden="true">${'<i></i>'.repeat(DENSITIES.length)}</span>
          </span>
        </label>
        <button type="button" class="stack-index-shortcut after-dark-sleep" data-label-en="Sleep Now" data-label-ja="今すぐスリープ">Sleep Now</button>
      </div>`;

    widget.querySelectorAll('input[data-option]').forEach((input) => {
      input.value = String(options[input.dataset.option]);
      input.addEventListener('input', () => {
        options[input.dataset.option] = Number(input.value);
        try {
          localStorage.setItem('after-dark', JSON.stringify(options));
        } catch (error) {}
      });
    });

    const sleepButton = widget.querySelector('.after-dark-sleep');
    sleepButton.addEventListener('click', () => {
      sleepButton.blur();
      if (!saver) start();
    });


    addDeskAccessory(widget);
  }
})();
