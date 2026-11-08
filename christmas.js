// Christmas mode. The inline script in <head> decides whether it's on (Nov 7 – Dec 26, Japan time)
// and adds `christmas` / `christmas-boot` to <html>. This runs before index.js so the label swaps
// below are what setLanguage() renders.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('christmas')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const visitorLabel = document.querySelector('.stack-visitor-counter [data-label-en]');
  if (visitorLabel) {
    visitorLabel.dataset.labelEn = 'Nice list<span class="nice-list-detail"> (number of visitors)</span>:';
    visitorLabel.dataset.labelJa = 'いい子<span class="nice-list-detail">（訪問者数）</span>:';
    visitorLabel.innerHTML = visitorLabel.dataset.labelEn;
  }

  const aboutTitle = document.querySelector('#about-dialog > .title-bar .title-text');
  if (aboutTitle) {
    aboutTitle.dataset.labelEn = 'About this Merry Mac';
    aboutTitle.dataset.labelJa = 'このメリーMacについて';
    aboutTitle.textContent = 'About this Merry Mac';
  }

  setUpSnow();
  setUpLights();
  setUpTree();
  setUpKeyCaps();
  setUpScreensaver();
  setUpBalloonHelp();

  if (!root.classList.contains('christmas-boot')) return;

  // Happy Mac boots normally, then puts on a whole Santa suit: hat, rosy face, beard, coat and belt.
  const groups = {
    body: '', base: '', screen: '', face: '', skin: '', beard: '', santaFace: '',
    suit: '', belt: '', buckle: '', hat: '', trim: '',
  };
  function paint(group, x, y, width, height) {
    groups[group] += `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;
  }

  // The familiar compact Mac silhouette and its dark screen.
  paint('body', 0, 8, 22, 14);
  paint('body', 9, 22, 4, 5);
  paint('base', 1, 26, 20, 1);
  paint('base', 1, 27, 20, 4);
  paint('screen', 3, 10, 16, 10);
  paint('face', 7, 13, 1, 2);
  paint('face', 14, 13, 1, 2);
  paint('face', 6, 17, 2, 1);
  paint('face', 8, 18, 6, 1);
  paint('face', 14, 17, 2, 1);

  // Santa's face and beard replace the usual Mac smile, while the bottom of the case becomes
  // his red coat. Keeping the case, stand and black screen outline leaves it unmistakably a Mac.
  paint('skin', 3, 10, 16, 10);
  paint('beard', 3, 13, 2, 7);
  paint('beard', 17, 13, 2, 7);
  paint('beard', 5, 16, 2, 4);
  paint('beard', 15, 16, 2, 4);
  paint('beard', 7, 17, 8, 3);
  paint('beard', 9, 20, 4, 1);
  paint('santaFace', 7, 12, 1, 2);
  paint('santaFace', 14, 12, 1, 2);
  paint('suit', 10, 14, 2, 2);
  paint('suit', 0, 20, 22, 2);
  paint('belt', 0, 21, 22, 1);
  paint('buckle', 9, 20, 4, 3);

  // A floppy red Santa hat with a white brim and pom-pom.
  paint('hat', 11, 0, 5, 1);
  paint('hat', 8, 1, 9, 1);
  paint('hat', 6, 2, 13, 1);
  paint('hat', 4, 3, 15, 1);
  paint('hat', 3, 4, 15, 1);
  paint('trim', 2, 6, 18, 2);
  paint('trim', 18, 2, 3, 3);

  const screen = document.createElement('div');
  screen.className = 'happy-mac-screen';
  screen.setAttribute('aria-hidden', 'true');
  screen.innerHTML = `
    <div class="happy-mac-stage">
      <svg class="happy-mac-icon" viewBox="0 0 22 31" width="88" height="124" shape-rendering="crispEdges">
        <g fill="#f7f4e8">${groups.body}${groups.base}</g>
        <g fill="#080b17">${groups.screen}</g>
        <g fill="#f7f4e8">${groups.face}</g>
        <g class="happy-mac-costume" fill="#efb38c">${groups.skin}</g>
        <g class="happy-mac-costume" fill="#f7f4e8">${groups.beard}</g>
        <g class="happy-mac-costume" fill="#251c1a">${groups.santaFace}</g>
        <g class="happy-mac-costume" fill="#cf3038">${groups.suit}</g>
        <g class="happy-mac-costume" fill="#161616">${groups.belt}</g>
        <g class="happy-mac-costume" fill="#f2c14e">${groups.buckle}</g>
        <g class="happy-mac-hat" fill="#cf3038">${groups.hat}</g>
        <g class="happy-mac-trim" fill="#fff">${groups.trim}</g>
      </svg>
    </div>
    <div class="happy-mac-code">00001225<br>HO HO HO!</div>`;
  document.body.prepend(screen);

  for (let i = 0; i < 30; i += 1) {
    const flake = document.createElement('i');
    flake.className = 'happy-mac-snow';
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.animationDelay = `${-Math.random() * 4}s`;
    flake.style.animationDuration = `${2.8 + Math.random() * 3}s`;
    screen.append(flake);
  }

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    screen.classList.add('is-leaving');
    root.classList.remove('christmas-boot');
    setTimeout(() => screen.remove(), 450);
    try {
      localStorage.setItem('christmas-happy-mac', root.dataset.christmasYear || '');
    } catch (error) {}
    window.removeEventListener('keydown', finish);
  }

  at(350, () => screen.classList.add('is-dressed'));
  at(850, () => screen.classList.add('is-lit'));
  at(1400, () => screen.classList.add('is-rising'));
  at(2350, finish);
  screen.addEventListener('click', finish);
  window.addEventListener('keydown', finish);

  // Desk accessories share the Settings grid cell, just as they do in Halloween mode.
  function addDeskAccessory(widget) {
    const settings = document.getElementById('appearance-panel');
    const stack = [...document.querySelectorAll('.desk-accessory:not(.christmas-tree)')];
    (stack[stack.length - 1] || settings).after(widget);
    const place = () => {
      let top = 36 + settings.offsetHeight + 12;
      document.querySelectorAll('.desk-accessory:not(.christmas-tree)').forEach((accessory) => {
        accessory.style.setProperty('--desk-accessory-top', `${top}px`);
        top += accessory.offsetHeight + 12;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(settings);
    observer.observe(widget);
    widget.querySelector('.close-box').addEventListener('click', () => {
      widget.remove();
      observer.disconnect();
      place();
    });
  }

  // A little pixel snow across the desktop and windows. Purely decorative, and absent with reduced motion.
  function setUpSnow() {
    if (reduceMotion.matches) return;
    const desktop = document.querySelector('.desktop');
    if (!desktop) return;
    const field = document.createElement('div');
    field.className = 'christmas-snow';
    field.setAttribute('aria-hidden', 'true');
    const count = window.innerWidth < 600 ? 24 : 46;
    for (let i = 0; i < count; i += 1) {
      const flake = document.createElement('i');
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.animationDelay = `${-Math.random() * 14}s`;
      flake.style.animationDuration = `${8 + Math.random() * 10}s`;
      flake.style.setProperty('--snow-drift', `${-30 + Math.random() * 60}px`);
      if (i % 3 === 0) flake.classList.add('is-big');
      field.append(flake);
    }
    desktop.prepend(field);
  }

  // A strand of colored lights draped across the top of the desktop. The bulbs are placed on
  // the same quadratic curve as the wire, so the strand survives narrow screens without drifting.
  function setUpLights() {
    // Anchor to About rather than prepending to .desktop: on wide screens .desktop is a grid,
    // and Safari gives an unassigned grid item a different home from Chromium.
    const host = document.getElementById('about-slot');
    if (!host) return;
    const colors = ['#cf3038', '#5ea768', '#f2c14e', '#e8edff'];
    const bulbs = [];
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const x = 480 * t;
      const y = 2 * (1 - t) ** 2 + 84 * t * (1 - t) + 2 * t ** 2;
      bulbs.push(`
        <g class="christmas-garland-bulb" style="animation-delay:${-(i % 5) * 0.34}s">
          <rect x="${(x - 0.75).toFixed(2)}" y="${(y - 0.5).toFixed(2)}" width="1.5" height="3" fill="#000"/>
          <rect x="${(x - 2).toFixed(2)}" y="${(y + 2).toFixed(2)}" width="4" height="5" fill="${colors[i % colors.length]}"/>
        </g>`);
    }
    const garland = document.createElement('div');
    garland.className = 'christmas-garland';
    garland.setAttribute('aria-hidden', 'true');
    garland.innerHTML = `
      <svg viewBox="0 0 480 34" preserveAspectRatio="none">
        <path d="M0 2Q240 42 480 2" fill="none" stroke="#000" stroke-width="1"/>
        ${bulbs.join('')}
      </svg>`;
    host.prepend(garland);
  }

  // A tiny Tokyo tree for the desktop. Lights gently chase by default, and the button turns
  // them off for visitors who would rather enjoy a quiet, traditional tree.
  function setUpTree() {
    const settings = document.getElementById('appearance-panel');
    if (!settings) return;
    const groups = { G: '', g: '', W: '', Y: '', B: '', R: '' };
    const cells = Array.from({ length: 38 }, () => Array(32).fill('.'));
    function rect(x, y, width, height, color) {
      for (let row = Math.max(0, y); row < Math.min(38, y + height); row += 1) {
        for (let col = Math.max(0, x); col < Math.min(32, x + width); col += 1) {
          cells[row][col] = color;
        }
      }
    }

    // Three irregular, overlapping boughs, a trunk, snowy edges, and two tiny presents.
    rect(14, 31, 5, 5, 'B');
    [
      [7, 15, 7],
      [12, 23, 11],
      [18, 32, 15],
    ].forEach(([top, bottom, widest]) => {
      for (let y = top; y <= bottom; y += 1) {
        const half = 1 + Math.floor(((y - top) / (bottom - top)) * widest);
        for (let x = 16 - half; x <= 16 + half; x += 1) {
          const snowyTip = y >= bottom - 1 && Math.abs(x - 16) >= half - 1 && (x + y) % 2 === 0;
          cells[y][x] = snowyTip ? 'W' : ((x + y) % 5 === 0 ? 'g' : 'G');
        }
      }
    });
    rect(3, 35, 26, 2, 'W');
    rect(6, 34, 5, 1, 'W');
    rect(22, 34, 4, 1, 'W');
    rect(7, 31, 5, 4, 'R');
    rect(9, 31, 1, 4, 'Y');
    rect(21, 32, 5, 3, 'Y');
    rect(23, 32, 1, 3, 'R');
    [[16, 1], [16, 2], [16, 3], [14, 3], [15, 3], [17, 3], [18, 3], [15, 2], [17, 2], [15, 4], [17, 4]].forEach(([x, y]) => {
      cells[y][x] = 'Y';
    });
    cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== '.') groups[cell] += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      });
    });

    const lights = [
      [16, 9], [13, 13], [19, 14], [11, 18], [16, 18], [21, 20],
      [9, 24], [14, 25], [19, 25], [23, 27], [7, 29], [17, 30], [25, 30],
    ].map(([x, y], i) => {
      const color = ['#cf3038', '#f2c14e', '#e8edff'][i % 3];
      return `<rect class="tree-light tree-light-${i % 3}" x="${x}" y="${y}" width="2" height="2" fill="${color}"/>`;
    }).join('');

    const widget = document.createElement('div');
    widget.className = 'clock-widget desk-accessory christmas-tree';
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title" data-label-en="Tree" data-label-ja="ツリー">Tree</span>
      </div>
      <div class="clock-content tree-content">
        <svg class="tree-icon" viewBox="0 0 32 38" width="64" height="76" shape-rendering="crispEdges" aria-hidden="true">
          <g fill="#39754b">${groups.G}</g>
          <g fill="#244c35">${groups.g}</g>
          <g fill="#fff">${groups.W}</g>
          <g fill="#f2c14e">${groups.Y}</g>
          <g fill="#80552f">${groups.B}</g>
          <g fill="#cf3038">${groups.R}</g>
          ${lights}
        </svg>
        <div class="tree-controls">
          <span data-label-en="Tiny Tokyo Tree" data-label-ja="小さな東京ツリー">Tiny Tokyo Tree</span>
          <button type="button" class="stack-index-shortcut tree-lights-button" aria-pressed="true" data-label-en="Lights" data-label-ja="ライト">Lights</button>
        </div>
      </div>`;
    const button = widget.querySelector('.tree-lights-button');
    button.addEventListener('click', () => {
      const lit = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(lit));
      widget.classList.toggle('is-dark', !lit);
      button.blur();
    });
    // Wide screens: Tree sits on the left directly below Speak. Featured App accounts for its
    // height too (see karui-desk.js). Narrow layouts use the order rules in CSS.
    const clocks = document.querySelector('.clock-row');
    const speak = document.getElementById('speak');
    if (!clocks || !speak) {
      addDeskAccessory(widget);
      return;
    }
    speak.after(widget);
    function place() {
      let top = 36 + clocks.offsetHeight + 12;
      // Anchor to Speak's published offset. When the clocks roll up, its placement script moves
      // it first, and this mutation observer below moves Tree with it.
      const published = Number.parseFloat(speak.style.getPropertyValue('--speak-top'));
      top = (Number.isFinite(published) ? published : top) + speak.offsetHeight + 12;
      widget.style.setProperty('--desk-accessory-top', `${top}px`);
    }
    const placement = new ResizeObserver(place);
    [clocks, speak, widget].forEach((element) => placement.observe(element));
    const publishedPlacement = new MutationObserver(place);
    publishedPlacement.observe(speak, { attributes: true, attributeFilter: ['style'] });
    widget.querySelector('.close-box').addEventListener('click', () => {
      placement.disconnect();
      publishedPlacement.disconnect();
      widget.remove();
      document.dispatchEvent(new Event('christmas-tree-layout'));
    });
    place();
  }

  // Key Caps, staffed by an elf instead of Halloween's ghost. Type SANTA to get its attention.
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
    widget.className = 'clock-widget desk-accessory key-caps christmas-key-caps';
    widget.setAttribute('aria-hidden', 'true');
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title" data-label-en="Elf Key Caps" data-label-ja="エルフのキー配列">Elf Key Caps</span>
      </div>
      <div class="clock-content key-caps-content"></div>`;
    widget.querySelector('.key-caps-content').append(display, board);
    addDeskAccessory(widget);

    const WORDS = {
      en: [['HO HO HO'], ['MERRY XMAS'], ['ONE MORE THING'], ['TOKYO']],
      ja: [['KURISUMASU', 'クリスマス'], ['SANTA', 'サンタ'], ['YUKI', '雪']],
    };
    const REPLY = { en: ['HO HO HO!'], ja: ['HO HO HO', 'ホーホーホー！'] };
    const language = () => (root.lang === 'ja' ? 'ja' : 'en');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let typed = '';
    let lastElfWord = '';
    let elfRun = 0;
    let visitorTypedAt = 0;
    let replyTimer = null;
    let elfOwnsText = false;

    const show = () => { display.textContent = typed.slice(-18); };
    const flash = (key) => {
      key.classList.add('is-down');
      setTimeout(() => key.classList.remove('is-down'), 140);
    };

    async function elfTypes([word, converted]) {
      const run = ++elfRun;
      const stillMine = () => run === elfRun && widget.isConnected;
      elfOwnsText = true;
      typed = '';
      show();
      for (const letter of word) {
        const key = keys.get(letter);
        key?.classList.add('is-down');
        typed += letter;
        show();
        await wait(150 + Math.random() * 130);
        key?.classList.remove('is-down');
        if (!stillMine()) return;
        await wait(70 + Math.random() * 170);
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

    function visitorTypes(letter) {
      elfRun += 1;
      keys.forEach((key) => key.classList.remove('is-down'));
      visitorTypedAt = Date.now();
      if (elfOwnsText) {
        elfOwnsText = false;
        typed = '';
      }
      if (letter === 'Backspace') typed = typed.slice(0, -1);
      else {
        typed += letter;
        flash(keys.get(letter));
      }
      show();
      clearTimeout(replyTimer);
      if (typed.endsWith('SANTA')) {
        replyTimer = setTimeout(() => elfTypes(REPLY[language()]), 650);
      }
    }

    board.addEventListener('click', (event) => {
      const key = event.target.closest('.key-caps-key');
      if (key) visitorTypes(key === space ? ' ' : key.textContent);
    });

    window.addEventListener('keydown', (event) => {
      if (!widget.isConnected || !widget.offsetParent) return;
      if (root.classList.contains('christmas-boot')) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if (event.key === 'Backspace') visitorTypes('Backspace');
      else if (event.key === ' ' || /^[a-z]$/i.test(event.key)) {
        visitorTypes(event.key === ' ' ? ' ' : event.key.toUpperCase());
      }
    });

    async function deliverWord() {
      if (!widget.isConnected || reduceMotion.matches) return;
      if (document.hidden || Date.now() - visitorTypedAt < 5000) {
        setTimeout(deliverWord, 2000);
        return;
      }
      const list = WORDS[language()].filter(([word]) => word !== lastElfWord);
      const choice = list[Math.floor(Math.random() * list.length)];
      lastElfWord = choice[0];
      await elfTypes(choice);
      setTimeout(deliverWord, 10000 + Math.random() * 7000);
    }
    setTimeout(deliverWord, 4000);
  }

  // Christmas Delivery: Santa's sleigh and winged presents, after 45 seconds with no input.
  function setUpScreensaver() {
    const IDLE_MS = 45000;
    const SLEEP_CORNER = 10;
    const PIXEL = 3;
    const COLORS = {
      W: '#fff', e: '#d4d4d4', k: '#6e6e6e', K: '#161616',
      R: '#cf3038', r: '#8e1f28', G: '#39754b', g: '#244c35',
      Y: '#f2c14e', B: '#80552f', b: '#b88955', P: '#efb38c', S: '#e8e5d9',
    };

    function makeGrid(width, height) {
      return Array.from({ length: height }, () => Array(width).fill('.'));
    }
    function rect(grid, x, y, width, height, color) {
      for (let row = Math.max(0, y); row < Math.min(grid.length, y + height); row += 1) {
        for (let col = Math.max(0, x); col < Math.min(grid[0].length, x + width); col += 1) {
          grid[row][col] = color;
        }
      }
    }
    function pixels(grid, color, cells) {
      cells.forEach(([x, y]) => {
        if (grid[y]?.[x] !== undefined) grid[y][x] = color;
      });
    }
    function line(grid, x0, y0, x1, y1, color) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i += 1) {
        pixels(grid, color, [[Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)]]);
      }
    }

    function sleigh() {
      const grid = makeGrid(62, 34);
      // One reindeer, nose pointed into the journey.
      rect(grid, 4, 17, 11, 8, 'B');
      rect(grid, 3, 14, 5, 8, 'B');
      rect(grid, 0, 11, 6, 6, 'B');
      rect(grid, 0, 16, 4, 3, 'b');
      pixels(grid, 'K', [[1, 12], [0, 18]]);
      pixels(grid, 'b', [[5, 12], [6, 11], [4, 10], [2, 10]]);
      line(grid, 3, 11, 2, 7, 'b');
      line(grid, 2, 8, 0, 6, 'b');
      line(grid, 2, 8, 5, 6, 'b');
      line(grid, 5, 11, 7, 7, 'b');
      line(grid, 7, 8, 9, 7, 'b');
      rect(grid, 6, 25, 2, 5, 'B');
      rect(grid, 12, 25, 2, 4, 'B');
      rect(grid, 6, 29, 2, 1, 'K');
      rect(grid, 12, 28, 2, 1, 'K');
      rect(grid, 5, 18, 1, 6, 'R');
      line(grid, 15, 20, 23, 22, 'Y');

      // The sleigh, Santa, and a suspiciously large bag of presents.
      rect(grid, 20, 20, 27, 7, 'R');
      rect(grid, 42, 15, 6, 12, 'R');
      rect(grid, 18, 17, 4, 9, 'R');
      rect(grid, 20, 25, 27, 2, 'r');
      rect(grid, 18, 17, 2, 7, 'r');
      rect(grid, 22, 27, 2, 3, 'Y');
      rect(grid, 42, 27, 2, 3, 'Y');
      rect(grid, 17, 30, 33, 1, 'Y');
      pixels(grid, 'Y', [[16, 29], [15, 28], [16, 27], [17, 27], [48, 30], [49, 30], [50, 29]]);
      rect(grid, 31, 13, 10, 10, 'R');
      rect(grid, 27, 16, 7, 3, 'R');
      rect(grid, 29, 9, 8, 5, 'P');
      rect(grid, 28, 12, 10, 5, 'W');
      pixels(grid, 'K', [[31, 10], [35, 10]]);
      rect(grid, 29, 5, 8, 4, 'R');
      rect(grid, 35, 6, 5, 2, 'R');
      rect(grid, 28, 8, 10, 2, 'W');
      rect(grid, 39, 5, 3, 3, 'W');
      rect(grid, 43, 9, 12, 13, 'S');
      rect(grid, 47, 7, 6, 3, 'S');
      rect(grid, 45, 8, 8, 2, 'G');
      pixels(grid, 'G', [[49, 11], [50, 12], [51, 11], [52, 12], [53, 11]]);
      return grid.map((row) => row.join(''));
    }

    // A feathered wing, shared with the visual language of Halloween's flying pumpkins.
    function drawWing(grid, rootX, rootY, spine, long, short, fill, lineColor) {
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
          row[x] = feather < 1.4 && angle > 4 && distance > reach / 2 ? lineColor : fill;
        });
      });
    }

    function flyingGift(spine) {
      const grid = makeGrid(32, 28);
      drawWing(grid, 14, 17, spine - 10, 11, 6, 'e', 'k');
      drawWing(grid, 17, 18, spine, 13, 7, 'W', 'e');
      rect(grid, 10, 16, 13, 10, 'G');
      rect(grid, 10, 16, 13, 2, 'g');
      rect(grid, 15, 16, 3, 10, 'Y');
      rect(grid, 10, 19, 13, 2, 'Y');
      pixels(grid, 'Y', [[14, 14], [13, 13], [12, 14], [18, 14], [19, 13], [20, 14], [15, 15], [17, 15]]);
      return grid.map((row) => row.join(''));
    }

    const frameSvg = (rows, frame) => {
      const fills = {};
      rows.forEach((row, y) => {
        [...row].forEach((cell, x) => {
          if (cell !== '.') fills[cell] = `${fills[cell] || ''}<rect x="${x}" y="${y}" width="1" height="1"/>`;
        });
      });
      const shapes = Object.entries(fills).map(([cell, rects]) => `<g fill="${COLORS[cell]}">${rects}</g>`);
      return `<g data-frame="${frame}">${shapes.join('')}</g>`;
    };

    const KINDS = {
      sleigh: { frames: [sleigh()], flap: [0], frameMs: 200, speed: [75, 90], slope: 0.18, bob: 8 },
      gift: { frames: [-95, -45, 5].map(flyingGift), flap: [0, 1, 2, 1], frameMs: 150, speed: [45, 80], slope: 0.42, bob: 10 },
    };
    Object.values(KINDS).forEach((kind) => {
      const columns = kind.frames[0][0].length;
      const rowCount = Math.max(...kind.frames.map((rows) => rows.length));
      kind.width = columns * PIXEL;
      kind.height = rowCount * PIXEL;
      kind.svg = `<svg viewBox="0 0 ${columns} ${rowCount}" width="${kind.width}" height="${kind.height}" shape-rendering="crispEdges">${kind.frames.map(frameSvg).join('')}</svg>`;
    });

    const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
    const DENSITIES = [0.5, 0.75, 1, 1.5, 2];
    const options = { speed: 2, density: 2 };
    try {
      const saved = JSON.parse(localStorage.getItem('christmas-delivery') || '{}');
      ['speed', 'density'].forEach((key) => {
        if (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] < SPEEDS.length) options[key] = saved[key];
      });
    } catch (error) {}

    const random = (min, max) => min + Math.random() * (max - min);
    let lastInputAt = Date.now();
    let lastPointer = null;
    let saver = null;

    function start(fromCorner = false) {
      if (reduceMotion.matches || saver) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const density = DENSITIES[options.density];
      const speed = SPEEDS[options.speed];
      const counts = {
        sleigh: 1,
        gift: Math.max(1, Math.round(Math.min(9, Math.max(3, (width * height) / 170000)) * density)),
      };
      const screen = document.createElement('div');
      screen.className = 'screensaver christmas-screen';
      screen.setAttribute('aria-hidden', 'true');

      for (let i = 0; i < Math.round((width * height) / 18000); i += 1) {
        const star = document.createElement('i');
        star.className = 'christmas-star';
        star.style.left = `${random(0, 100)}%`;
        star.style.top = `${random(0, 100)}%`;
        if (i % 4 === 0) star.classList.add('is-bright');
        screen.append(star);
      }

      const respawn = (sprite) => {
        const { kind } = sprite;
        if (Math.random() < width / (width + height)) {
          sprite.x = random(0, width + kind.width);
          sprite.y = -kind.height - random(0, 80);
        } else {
          sprite.x = width + random(0, 80);
          sprite.y = random(-kind.height, height * 0.65);
        }
      };

      const sprites = [];
      Object.entries(counts).forEach(([name, count]) => {
        for (let i = 0; i < count; i += 1) {
          const kind = KINDS[name];
          const el = document.createElement('div');
          el.className = `screensaver-sprite christmas-${name}`;
          el.innerHTML = kind.svg;
          el.dataset.frame = '0';
          sprites.push({
            el, kind,
            x: random(0, width), y: random(-kind.height, height),
            speed: random(...kind.speed) * speed,
            phase: random(0, 1000), frame: -1,
          });
        }
      });
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
          const bob = Math.sin((now + sprite.phase) / 350) * kind.bob;
          sprite.el.style.transform = `translate3d(${sprite.x.toFixed(2)}px, ${(sprite.y + bob).toFixed(2)}px, 0)`;
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

    const inSleepCorner = (event) => event.pointerType === 'mouse'
      && event.clientX <= SLEEP_CORNER && event.clientY >= window.innerHeight - SLEEP_CORNER;

    const onInput = (event) => {
      lastInputAt = Date.now();
      if (!saver) {
        if (event.type === 'pointermove') lastPointer = [event.clientX, event.clientY];
        if (inSleepCorner(event) && !root.classList.contains('christmas-boot')) start(true);
        return;
      }
      if (event.type === 'pointerout') return;
      if (event.type === 'pointermove') {
        if (saver.fromCorner && inSleepCorner(event)) return;
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
      if (root.classList.contains('christmas-boot') || reduceMotion.matches || !finePointer.matches) return;
      if (document.activeElement?.tagName === 'IFRAME') return;
      if (document.querySelector('.speak.is-in-call')) return;
      start();
    }, 1000);

    // The control panel borrows After Dark's sliders and preview, with a sleigh in the little screen.
    const previewRows = KINDS.sleigh.frames[0];
    const previewSvg = `<svg viewBox="0 0 62 34" shape-rendering="crispEdges">${frameSvg(previewRows, 0)}</svg>`;
    const widget = document.createElement('div');
    widget.className = 'clock-widget desk-accessory after-dark christmas-delivery';
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title" data-label-en="Christmas Delivery" data-label-ja="クリスマス便">Christmas Delivery</span>
      </div>
      <div class="clock-content after-dark-content">
        <div class="after-dark-module">
          <div class="after-dark-preview" aria-hidden="true">${previewSvg}</div>
          <span data-label-en="Tokyo Sleigh" data-label-ja="東京のそり">Tokyo Sleigh</span>
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
          localStorage.setItem('christmas-delivery', JSON.stringify(options));
        } catch (error) {}
      });
    });

    const sleepButton = widget.querySelector('.after-dark-sleep');
    sleepButton.addEventListener('click', () => {
      sleepButton.blur();
      start();
    });
    const syncMotion = () => {
      sleepButton.disabled = reduceMotion.matches;
      if (reduceMotion.matches) saver?.stop();
    };
    reduceMotion.addEventListener('change', syncMotion);
    syncMotion();
    addDeskAccessory(widget);
  }

  // Snowman Balloon Help. Seasonal entries go before index.js's own list so they win clashes.
  function setUpBalloonHelp() {
    window.christmasBalloonHelp = {
      help: [
        ['.desk-accessory .close-box', 'Close box. Puts this desk accessory back in Santa’s sack until you reload.', 'クローズボックス。再読み込みするまで、このデスクアクセサリをサンタの袋にしまいます。'],
        ['.clock-widget .close-box', 'Close box. Still on strike. The elves have filed it as FB1225.', 'クローズボックス。まだ効きません。エルフがFB1225として報告しています。'],
        ['button.close-box', 'Close box. To close this window, click here. No chimney required.', 'クローズボックス。このウインドウを閉じるには、ここをクリック。煙突は不要です。'],
        ['.made-in-japan-badge', 'Made in Japan. Assembled in your browser. Quality-checked by Tokyo elves.', '日本製。あなたのブラウザで組み立て、東京のエルフが品質チェックをしています。'],
        ['.weather-attribution', 'Weather from Open-Meteo. Tonight: light snow, with a chance of sleigh traffic.', '天気は Open-Meteo より。今夜の予報は小雪、ところによりそりの渋滞。'],
        ['.stack-visitor-counter', 'Everyone who made the Nice List this year. Naughty processes are not counted.', '今年「いい子」に認定された訪問者の数。行儀の悪いプロセスは数えていません。'],
        ['.balloon-help-toggle', 'Balloon Help, North Pole edition. While this is checked, a snowman explains whatever you point at.', 'バルーンヘルプ、北極版。チェックしている間、指したものを雪だるまが説明します。'],
        ['.key-caps-content', 'Elf Key Caps. Shows what you type. An elf types here too; type SANTA if you want its attention.', 'エルフのキー配列。入力した文字が表示されます。エルフも文字を打ちます。話しかけたいときは SANTA と打ってみて。'],
        ['.tree-content', 'A tiny Tokyo tree. No watering required, although the Ueno Quest balcony plant would like a word.', '小さな東京ツリー。水やりは不要ですが、「Ueno quest」のベランダの植物が何か言いたそうです。'],
        ['.tree-lights-button', 'Turns the tree lights on or off. With Reduce Motion, they stay peacefully still either way.', 'ツリーのライトを点灯・消灯します。視覚効果を減らす設定では、どちらも静かに灯ります。'],
        ['.christmas-delivery .after-dark-module', 'Christmas Delivery. Leave this Mac alone for 45 seconds and Santa flies presents over Tokyo. It beats sitting in traffic on the Shuto Expressway.', 'クリスマス便。このMacを45秒放っておくと、サンタが東京の空にプレゼントを運びます。首都高で渋滞するより速いはずです。'],
        ['.christmas-delivery .after-dark-setting:has([data-option="speed"])', 'How quickly Santa and the presents fly.', 'サンタとプレゼントの飛ぶ速さ。'],
        ['.christmas-delivery .after-dark-setting:has([data-option="density"])', 'How many presents are in the air at once.', '同時に飛ぶプレゼントの数。'],
        ['.christmas-delivery .after-dark-sleep', 'Starts Christmas Delivery now. So does moving the pointer into the bottom-left corner.', '今すぐクリスマス便を始めます。ポインタを画面の左下隅に動かしても始まります。'],
      ],
      prisoner: [
        'Help! We’re being held prisoner in a system software workshop! The elves demand a union.\n—The Blue Meanies, seasonal contractors',
        '助けて！システムソフトウェアの作業場に閉じ込められています！エルフが労働組合を要求しています。\n—季節限定のブルー・ミーニーズより',
      ],
      shape: {
        reach: { x: -7, y: 12 },
        fit(balloon) {
          // Only reserve the snowman's head above the text. Unlike a character balloon whose body
          // needs a minimum size for its artwork, this rounded body hugs whatever the text needs.
          balloon.style.paddingTop = '52px';
        },
        svg: snowmanSvg,
      },
    };
  }

  // A snowman head above a rounded text balloon, wearing a Santa hat. Unlike the classic balloon's
  // full-length tail, this is a small directional pointer: at most 30px long and 8px at its base.
  function snowmanSvg(width, height, tip, below, flip) {
    const center = width / 2;
    const bodyTop = 42;
    const x = flip ? width - tip.x : tip.x;
    const edge = below ? bodyTop + 2 : height - 2;
    const anchor = 18;
    const dx = x - anchor;
    const dy = tip.y - edge;
    const distance = Math.hypot(dx, dy) || 1;
    const travel = Math.min(30, distance) / distance;
    const endX = anchor + dx * travel;
    const endY = edge + dy * travel;
    const tail = `M${anchor - 4} ${edge}L${endX} ${endY}L${anchor + 4} ${edge}Z`;
    const body = `<rect y="${bodyTop}" width="${width}" height="${height - bodyTop}" rx="11"/>`;
    const head = `<circle cx="${center}" cy="32" r="23"/>`;
    const shapes = `<path d="${tail}"/>${body}${head}`;
    return `
      <g${flip ? ` transform="translate(${width} 0) scale(-1 1)"` : ''}>
        <g class="help-balloon-outline">${shapes}</g>
        <g class="help-balloon-fill">${shapes}</g>
        <g class="christmas-balloon-face">
          <circle cx="${center - 8}" cy="30" r="2"/>
          <circle cx="${center + 8}" cy="30" r="2"/>
          <path class="christmas-balloon-nose" d="M${center - 1} 34l12 3-12 3z"/>
          <circle cx="${center - 6}" cy="41" r="1"/>
          <circle cx="${center}" cy="43" r="1"/>
          <circle cx="${center + 6}" cy="41" r="1"/>
        </g>
        <g class="christmas-balloon-hat">
          <path d="M${center - 22} 19Q${center - 17} -1 ${center + 3} 1l14 13-9 5z"/>
          <circle class="christmas-balloon-trim" cx="${center + 18}" cy="12" r="5"/>
          <rect class="christmas-balloon-trim" x="${center - 24}" y="16" width="43" height="8" rx="3"/>
        </g>
      </g>`;
  }
})();
