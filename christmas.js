// Christmas mode. The inline script in <head> decides whether it's on (Nov 7 – Dec 26, Japan time)
// and adds `christmas` / `christmas-boot` to <html>. This runs before index.js so the label swaps
// below are what setLanguage() renders.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('christmas')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Pixel art is drawn into grids of one-letter colors, shared by the Tree and the screensaver.
  const COLORS = {
    W: '#fff', c: '#c3c8d6', e: '#d4d4d4', k: '#8a8f9c', K: '#161616',
    L: '#e8595e', R: '#cf3038', r: '#8e1f28', m: '#5c121a',
    H: '#5a9c6a', G: '#39754b', g: '#244c35', n: '#14301f',
    Z: '#ffe08a', Y: '#f2c14e', y: '#b98628', o: '#7a5516',
    t: '#d0a676', b: '#b88955', B: '#80552f', d: '#553518',
    P: '#efb38c', p: '#c98763',
    S: '#e8e5d9', s: '#bcb7a4', z: '#8c8776',
  };
  // Each color's next shade down, for the edges where one solid passes in front of another.
  const SHADE = {
    W: 'e', e: 'k', L: 'R', R: 'r', r: 'm', H: 'G', G: 'g', g: 'n', Z: 'Y', Y: 'y', y: 'o',
    t: 'b', b: 'B', B: 'd', P: 'p', S: 's', s: 'z',
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
  // A finished grid as SVG: one path per color, a run of pixels at a time.
  function gridSvg(rows) {
    const fills = {};
    rows.forEach((row, y) => {
      for (const run of row.matchAll(/([^.])\1*/g)) {
        fills[run[1]] = `${fills[run[1]] || ''}M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
      }
    });
    return Object.entries(fills).map(([cell, d]) => `<path fill="${COLORS[cell]}" d="${d}"/>`).join('');
  }

  const visitorLabel = document.querySelector('.stack-visitor-counter [data-label-en]');
  if (visitorLabel) {
    visitorLabel.dataset.labelEn = 'Nice list<span class="nice-list-detail"> (# of visitors)</span>:';
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
        if (!accessory.offsetHeight) return;
        accessory.style.setProperty('--desk-accessory-top', `${top}px`);
        top += accessory.offsetHeight + 12;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(settings);
    observer.observe(widget);
    document.addEventListener('desk-layout', place);
    widget.querySelector('.close-box').addEventListener('click', () => {
      widget.remove();
      observer.disconnect();
      document.removeEventListener('desk-layout', place);
      place();
      document.dispatchEvent(new Event('desk-layout'));
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

  // Strings of colored lights around the desktop: a swag draped over the About window, one more
  // over each side column on wide screens, and a strand hanging down either side. Each string is
  // a picture of its wire and unlit bulbs, under one layer of glowing bulbs per color, so each
  // color twinkles as one. The Tree's Lights button switches them all (see setUpTree).
  function setUpLights() {
    const desktop = document.querySelector('.desktop');
    const about = document.getElementById('about-slot');
    if (!desktop || !about) return;
    // Blue rather than the Tree's white bulbs, which vanish against the pale desktop.
    const LIT = ['#cf3038', '#5ea768', '#f2c14e', '#5b9be8'];
    const UNLIT = ['#6e2b30', '#3a5c40', '#7d6a35', '#3b5578'];
    const image = (width, height, body) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    };
    // A bulb hangs from (x, y) on its wire: a black socket, then the glass with a glint on it.
    const socket = ([x, y]) => `M${x - 1} ${y - 1}h2v3h-2z`;
    const glass = ([x, y]) => `M${x - 2} ${y + 2}h4v4h-1v1h-2v-1h-1z`;
    const glint = ([x, y]) => `M${x - 1} ${y + 3}h1v2h-1z`;
    // The wire with every bulb unlit, then each color's bulbs lit.
    function pictures(width, height, wire, bulbs) {
      const colored = (color) => bulbs.filter((bulb, i) => i % LIT.length === color);
      const unlit = UNLIT.map((fill, color) => `<path fill="${fill}" d="${colored(color).map(glass).join('')}"/>`);
      const lit = LIT.map((fill, color) => `
        <radialGradient id="glow">
          <stop offset="0" stop-color="${fill}" stop-opacity=".6"/>
          <stop offset="1" stop-color="${fill}" stop-opacity="0"/>
        </radialGradient>
        ${colored(color).map(([x, y]) => `<circle cx="${x}" cy="${y + 4}" r="8" fill="url(#glow)"/>`).join('')}
        <g shape-rendering="crispEdges">
          <path fill="${fill}" d="${colored(color).map(glass).join('')}"/>
          <path fill="#fff" fill-opacity=".7" d="${colored(color).map(glint).join('')}"/>
        </g>`);
      return [
        `<path d="${wire}" fill="none" stroke="#000"/>
        <g shape-rendering="crispEdges"><path d="${bulbs.map(socket).join('')}"/>${unlit.join('')}</g>`,
        ...lit,
      ].map((body) => image(width, height, body));
    }
    function string(className) {
      const element = document.createElement('div');
      element.className = `christmas-string ${className}`;
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = '<i></i>'.repeat(LIT.length);
      return element;
    }
    function hang(element, [unlit, ...lit]) {
      element.style.backgroundImage = unlit;
      [...element.children].forEach((layer, color) => {
        layer.style.backgroundImage = lit[color];
      });
    }
    // A swag hangs from the top corners of its element, a bulb every 30px or so, and is redrawn
    // to fit whenever the element changes width.
    function swag(element) {
      let drawn = 0;
      new ResizeObserver(() => {
        const width = element.offsetWidth;
        if (width === drawn || width < 40) return;
        drawn = width;
        const count = Math.round(width / 30);
        const bulbs = Array.from({ length: count }, (_, i) => {
          const t = (i + 0.5) / count;
          return [Math.round(width * t), Math.round(2 + 80 * t * (1 - t))];
        });
        hang(element, pictures(width, 44, `M0 2Q${width / 2} 42 ${width} 2`, bulbs));
      }).observe(element);
      return element;
    }

    // Draped over About. It lives in #about-slot rather than loose in .desktop, which is a grid on
    // wide screens, where Safari gives an unassigned grid item a different home from Chromium.
    about.prepend(swag(string('christmas-garland')));

    // The rest are absolutely positioned over the whole desktop, out to the page's own edges.
    const frame = document.createElement('div');
    frame.className = 'christmas-lights';
    frame.setAttribute('aria-hidden', 'true');
    // A strand hangs straight down, so its picture is one stretch of wire with four bulbs, repeated.
    // The red one goes last, so a strand doesn't start on the color a swag does right beside it.
    const strand = pictures(20, 120, 'M10 0Q13 15 10 30T10 60T10 90T10 120', [[9, 105], [11, 15], [9, 45], [11, 75]]);
    ['is-left', 'is-right'].forEach((side) => {
      const element = string(`christmas-strand ${side}`);
      hang(element, strand);
      frame.append(element, swag(string(`christmas-swag ${side}`)));
    });
    desktop.append(frame);
    // The strands hang in the page's margin (or, where the desktop is narrower than the page, just
    // outside it), and the side swags run from them to the ends of About's.
    const place = () => {
      frame.style.setProperty('--lights-top', `${desktop.offsetTop}px`);
      frame.style.setProperty('--lights-gutter', `${Math.min(20, desktop.offsetLeft)}px`);
      frame.style.setProperty('--lights-left', `${about.offsetLeft}px`);
      frame.style.setProperty('--lights-right', `${desktop.offsetWidth - about.offsetLeft - about.offsetWidth}px`);
    };
    place();
    new ResizeObserver(place).observe(desktop);
    window.addEventListener('resize', place);
  }

  // The tree: four tiers of boughs lit from the upper left, each shading the one below, with snow on
  // alternate bough tips, a string of lights zigzagging down, a star, a trunk, two presents and a
  // snowy floor. Returns the picture and where its lights hang.
  function drawTree() {
    const grid = makeGrid(64, 76);
    const center = 32;
    // Snow behind everything, then the trunk.
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        const rise = 1 - ((x + 0.5 - center) / 31) ** 2;
        if (rise > 0 && y >= 76 - 6.5 * rise ** 0.6) row[x] = y >= 74 && (x + y) % 2 ? 'e' : 'W';
      });
    });
    rect(grid, 29, 64, 6, 8, 'B');
    rect(grid, 33, 64, 2, 8, 'd');

    // Each tier is [top, bottom, half its width]; the lowest goes in first.
    const tiers = [[44, 64, 25], [32, 51, 20], [21, 38, 15], [12, 26, 10]];
    const strings = [];
    tiers.forEach(([top, bottom, half], tier) => {
      const tips = Math.round(half / 3);
      const across = (dx) => ((dx + half) / (2 * half)) * tips;
      // How far down the boughs reach in this column, and how far out in this row.
      const reach = (dx) => (Math.abs(dx) > half ? -1 : bottom + 3.4 * (1 - Math.abs(2 * (across(dx) % 1) - 1)));
      const edge = (y) => 1 + (half - 1) * Math.min(1, (y - top) / (bottom - top)) ** 1.15;
      // Its shadow on the tiers already drawn.
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const dx = x + 0.5 - center;
          if ('HGg'.includes(cell) && y - 3 >= top && y - 3 <= reach(dx) && Math.abs(dx) <= edge(y - 3)) row[x] = 'n';
        });
      });
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const dx = x + 0.5 - center;
          const hem = reach(dx);
          const side = edge(y);
          if (y < top || y > hem || Math.abs(dx) > side) return;
          const snowy = Math.floor(across(dx)) % 2 === tier % 2 && y > hem - 2.2 && y > bottom - 1;
          const needle = (x * 7 + y * 13) % 11;
          let color = dx < -side + 2.6 ? 'H' : dx > side * 0.4 ? 'g' : 'G';
          if (needle === 0) color = color === 'g' ? 'G' : 'H';
          if (needle === 5 && color === 'G') color = 'g';
          row[x] = snowy ? (y > hem - 1 ? 'e' : 'W') : color;
        });
      });
      // The string of lights crosses each tier on a slant, the other way from the tier below.
      strings.push({ top, bottom, edge, slant: tier % 2 ? -1 : 1, count: Math.round(half / 4) });
    });
    const lights = [];
    strings.forEach(({ top, bottom, edge, slant, count }) => {
      const point = (along) => {
        const y = top + (bottom - top) * (0.48 + 0.4 * along) + 1.5 * Math.sin(Math.PI * along);
        return [Math.round(center + slant * (2 * along - 1) * (edge(y) - 1.5) - 0.5), Math.round(y)];
      };
      for (let i = 0; i <= 40; i += 1) pixels(grid, 'n', [point(i / 40)]);
      for (let i = 0; i < count; i += 1) lights.push(point((i + 0.5) / count));
    });

    // The star.
    [
      '......YY......', '......YY......', '.....YYYY.....', '.....YYYY.....', 'YYYYYYYYYYYYYY', '.YYYYYYYYYYYY.', '..YYYYYYYYYY..',
      '...YYYYYYYY...', '...YYYYYYYY...', '..YYYYYYYYYY..', '..YYYY..YYYY..', '.YYY......YYY.', '.YY........YY.',
    ].forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === 'Y') grid[y][x + 25] = x + y < 9 ? 'Z' : x + y > 17 ? 'y' : 'Y';
      });
    });

    // Presents: red with gold ribbon, and gold with red.
    [[8, 60, 13, 'R', 'r', 'L', 'Y'], [43, 62, 12, 'Y', 'y', 'Z', 'R']].forEach(([x, y, width, paper, shade, lid, ribbon]) => {
      rect(grid, x + 1, y + 2, width - 2, 71 - y, paper);
      rect(grid, x + width - 3, y + 2, 2, 71 - y, shade);
      rect(grid, x, y, width, 3, paper);
      rect(grid, x, y, width, 1, lid);
      rect(grid, x + 1, y + 3, width - 2, 1, shade);
      const middle = x + Math.floor(width / 2) - 1;
      rect(grid, middle, y, 2, 73 - y, ribbon);
      pixels(grid, ribbon, [[middle - 1, y - 1], [middle - 2, y - 2], [middle - 1, y - 2], [middle + 2, y - 1], [middle + 3, y - 2], [middle + 2, y - 2]]);
    });
    // Snow drifted against them.
    grid[73].forEach((cell, x) => {
      if (cell !== '.' && (x * 5) % 7 < 4) grid[73][x] = 'W';
    });
    return {
      rows: grid.map((row) => row.join('')),
      // Only the lights that are still on the boughs, not behind a present.
      lights: lights.filter(([x, y]) => 'HGgn'.includes(grid[y][x]) && 'HGgn'.includes(grid[y + 1][x + 1])),
    };
  }

  // A tiny Tokyo tree for the desktop. Its lights gently chase by default, and its button turns
  // them off, along with every string of lights around the desktop, for visitors who would rather
  // enjoy a quiet, traditional tree.
  function setUpTree() {
    const settings = document.getElementById('appearance-panel');
    if (!settings) return;
    const tree = drawTree();
    // Each light is a 2x2 bulb in a faint halo.
    const lights = tree.lights.map(([x, y], i) => `
      <g class="tree-light tree-light-${i % 3}" fill="${['#cf3038', '#f2c14e', '#e8edff'][i % 3]}">
        <path fill-opacity=".3" d="M${x} ${y - 1}h2v1h1v2h-1v1h-2v-1h-1v-2h1z"/>
        <rect x="${x}" y="${y}" width="2" height="2"/>
      </g>`).join('');

    const widget = document.createElement('div');
    widget.className = 'clock-widget desk-accessory christmas-tree';
    widget.innerHTML = `
      <div class="clock-title-bar">
        <div class="close-box"></div>
        <span class="clock-title" data-label-en="Tree" data-label-ja="ツリー">Tree</span>
      </div>
      <div class="clock-content tree-content">
        <svg class="tree-icon" viewBox="0 0 64 76" width="64" height="76" shape-rendering="crispEdges" aria-hidden="true">
          ${gridSvg(tree.rows)}
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
      root.classList.toggle('christmas-lights-off', !lit);
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
      if (speak.isConnected) {
        // Anchor to Speak's published offset. When the clocks roll up, its placement script moves
        // it first, and the mutation observer below moves Tree with it.
        const published = Number.parseFloat(speak.style.getPropertyValue('--speak-top'));
        top = (Number.isFinite(published) ? published : top) + speak.offsetHeight + 12;
      }
      widget.style.setProperty('--desk-accessory-top', `${top}px`);
    }
    const placement = new ResizeObserver(place);
    [clocks, speak, widget].forEach((element) => placement.observe(element));
    const publishedPlacement = new MutationObserver(place);
    publishedPlacement.observe(speak, { attributes: true, attributeFilter: ['style'] });
    document.addEventListener('desk-layout', place);
    widget.querySelector('.close-box').addEventListener('click', () => {
      placement.disconnect();
      publishedPlacement.disconnect();
      document.removeEventListener('desk-layout', place);
      widget.remove();
      document.dispatchEvent(new Event('christmas-tree-layout'));
      document.dispatchEvent(new Event('desk-layout'));
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

  // Christmas Delivery: Santa’s sleigh and winged presents, a module for the After Hours screensaver.
  // Like the flying things of old screensavers, they are drawn in three-quarter view, heading down
  // and to the left.
  function setUpScreensaver() {
    const PIXEL = 2;
    // The way everything flies: along the sprites' own long axis, one pixel down for every two across.
    const SLOPE = 0.5;
    // A small isometric renderer. Solids live in a space where +Y is the way everything flies (down
    // and to the left on screen), +X is the near side (down and to the right) and +Z is up. Each
    // pixel looks down the (1, 1, 1) diagonal and keeps the nearest solid it meets. Light comes from
    // above and ahead: tops are brightest, the near side darkest. `unit` is sprite pixels per unit.
    function isoRender(grid, originX, originY, unit, solids) {
      const depth = grid.map((row) => row.map(() => -Infinity));
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const sx = (x + 0.5 - originX) / unit;
          const sy = (y + 0.5 - originY) / unit;
          // Where this pixel's line of sight crosses the ground.
          const px = sy + sx / 2;
          const py = sy - sx / 2;
          solids.forEach((solid) => {
            const hit = solid(px, py, unit);
            if (hit && hit[0] > depth[y][x]) [depth[y][x], row[x]] = hit;
          });
        });
      });
      // A pixel just behind something much nearer drops a shade, which outlines overlapping parts.
      const shaded = [];
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (!SHADE[cell]) return;
          const behind = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => depth[y + dy]?.[x + dx] > depth[y][x] + 2.5);
          if (behind) shaded.push([x, y]);
        });
      });
      shaded.forEach(([x, y]) => { grid[y][x] = SHADE[grid[y][x]]; });
    }

    // `paint` is three colors (top, front, near side) or a function of (face, x, y, z).
    function box(x0, y0, z0, x1, y1, z1, paint) {
      return (px, py) => {
        const t = Math.min(x1 - px, y1 - py, z1);
        if (t <= Math.max(x0 - px, y0 - py, z0)) return null;
        const face = t === z1 ? 0 : t === y1 - py ? 1 : 2;
        const color = typeof paint === 'function' ? paint(face, px + t, py + t, t) : paint[face];
        return color ? [t, color] : null;
      };
    }

    // An ellipsoid in three tones (lit, turning away, in shadow), or a function of (tone, x, y, z).
    function ball(cx, cy, cz, rx, ry, rz, paint) {
      return (px, py) => {
        const ox = (px - cx) / rx;
        const oy = (py - cy) / ry;
        const oz = -cz / rz;
        const a = 1 / rx ** 2 + 1 / ry ** 2 + 1 / rz ** 2;
        const b = ox / rx + oy / ry + oz / rz;
        const inside = b * b - a * (ox * ox + oy * oy + oz * oz - 1);
        if (inside < 0) return null;
        const t = (-b + Math.sqrt(inside)) / a;
        const nx = (ox + t / rx) / rx;
        const ny = (oy + t / ry) / ry;
        const nz = (oz + t / rz) / rz;
        const lit = (-0.1 * nx + 0.45 * ny + 0.9 * nz) / Math.hypot(nx, ny, nz);
        const tone = lit > 0.62 ? 0 : lit > 0.12 ? 1 : 2;
        const color = typeof paint === 'function' ? paint(tone, px + t, py + t, t) : paint[tone];
        return color ? [t, color] : null;
      };
    }

    // A rounded limb from one point to another, as a string of balls.
    function limb([ax, ay, az], [bx, by, bz], radius, paint) {
      const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / (radius * 0.7)));
      return Array.from({ length: count + 1 }, (_, i) => {
        const t = i / count;
        return ball(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, radius, radius, radius, paint);
      });
    }

    // A cord from one point to another, a single sprite pixel thick.
    function cord(from, to, color) {
      const flat = ([x, y, z]) => [x - y, (x + y) / 2 - z];
      const [ax, ay] = flat(from);
      const [bx, by] = flat(to);
      const steep = Math.abs(by - ay) > Math.abs(bx - ax);
      return (px, py, unit) => {
        const sx = px - py;
        const sy = (px + py) / 2;
        const along = steep ? (sy - ay) / (by - ay) : (sx - ax) / (bx - ax);
        if (along < 0 || along > 1) return null;
        const off = steep ? ax + (bx - ax) * along - sx : ay + (by - ay) * along - sy;
        return Math.abs(off) * unit <= 0.5 ? [from[2] + (to[2] - from[2]) * along, color] : null;
      };
    }

    // A feathered wing. Its leading edge runs out from the root along `spine` (degrees on screen),
    // and five feathers rake back and outward from it, with rounded tips and a row of coverts.
    // `sweep` is 1 for a wing whose feathers trail clockwise of the spine, -1 for its mirror image.
    function drawWing(grid, rootX, rootY, spine, sweep, long, chord, fill, lineColor) {
      const turn = (spine * Math.PI) / 180;
      const feather = long / 5;
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const dx = x + 0.5 - rootX;
          const dy = y + 0.5 - rootY;
          const back = sweep * (dy * Math.cos(turn) - dx * Math.sin(turn));
          const along = dx * Math.cos(turn) + dy * Math.sin(turn) - back * 0.55;
          const s = along / long;
          if (s < -0.06 || s > 1) return;
          const across = along / feather - Math.floor(along / feather);
          const depth = chord * Math.min(1, 0.6 + 2 * s) * (1 - 0.55 * s * s) - 9 * (across - 0.5) ** 2;
          if (back < -1 - 1.2 * Math.sin(Math.PI * Math.max(0, s)) || back > depth) return;
          const gap = across * feather < 1 && back > depth * 0.45;
          const covert = Math.abs(back - depth * 0.42) < 0.5 && s > 0.1;
          row[x] = gap || covert ? lineColor : fill;
        });
      });
    }

    // A wrapped present with a lid and a bow, on a pair of wings. The far wing goes in first, so the
    // present hides its root, and the near wing goes on top.
    function flyingGift(flap, wrap, ribbon) {
      const grid = makeGrid(54, 46);
      const [originX, originY] = [27, 31];
      const wrapped = (face, x, y, z) => {
        const band = Math.abs(x - 6) < 1.25 || Math.abs(y - 6) < 1.25;
        const color = (band ? ribbon : wrap)[face];
        // The lid's shadow.
        return face && z > 7.9 && z < 9 ? SHADE[color] : color;
      };
      drawWing(grid, originX - 7, originY - 8, [-108, -150, 172][flap], -1, 16, 10, 'e', 'k');
      isoRender(grid, originX, originY, 1, [
        box(0, 0, 0, 12, 12, 9, wrapped),
        box(-1, -1, 9, 13, 13, 12, wrapped),
        ball(8.4, 3.6, 13.4, 2.1, 2.1, 1.8, ribbon),
        ball(3.6, 8.4, 13.4, 2.1, 2.1, 1.8, ribbon),
        ball(6, 6, 13, 1.2, 1.2, 1.3, ribbon),
      ]);
      drawWing(grid, originX + 8, originY - 1, [-72, -30, 12][flap], 1, 18, 11, 'W', 'c');
      return grid.map((row) => row.join(''));
    }

    // Santa at the reins, a sack of presents behind him and one reindeer out in front. `stride` is
    // the reindeer's legs, gathered (0) or stretched out (1).
    function sleigh(stride, unit = 1.2) {
      const grid = makeGrid(Math.round(81.6 * unit), Math.round(53.4 * unit));
      const [originX, originY] = [63.4 * unit, 20 * unit];
      const red = 'LRr';
      const gold = 'ZYy';
      const brown = 'tbB';
      const solids = [];
      // Runners, curling up at the front.
      [1, 11.5].forEach((x) => {
        solids.push(
          box(x, -2, 0, x + 1.5, 30, 1, gold),
          box(x, 30, 0.5, x + 1.5, 32, 2.5, gold),
          box(x, 31.5, 2, x + 1.5, 33, 6, gold),
          box(x, 29.5, 5.5, x + 1.5, 32, 7, gold),
          box(x, 4, 1, x + 1.5, 5.5, 4, gold),
          box(x, 20, 1, x + 1.5, 21.5, 4, gold),
        );
      });
      // The tub: a floor, two swooping sides (the near one pinstriped), a tall back and a
      // dashboard, trimmed in gold.
      const pinstriped = (face, x, y, z) => (face === 2 && z > 6.2 && z < 7.1 ? 'y' : red[face]);
      solids.push(
        box(0, 0, 4, 14, 26, 5.5, 'rrm'),
        box(0, 0, 4, 1.5, 9, 13, red), box(12.5, 0, 4, 14, 9, 13, pinstriped),
        box(0, 9, 4, 1.5, 19, 9, red), box(12.5, 9, 4, 14, 19, 9, pinstriped),
        box(0, 19, 4, 1.5, 26, 11, red), box(12.5, 19, 4, 14, 26, 11, pinstriped),
        box(0, 0, 4, 14, 1.5, 15, red),
        box(0, 24.5, 4, 14, 26, 12, red),
        box(0, 26, 10, 14, 27.5, 13, red),
        box(0, 26, 13, 14, 27.5, 13.8, gold),
        box(0, 0, 15, 14, 1.5, 15.8, gold),
      );
      // The sack, tied with a green cord.
      solids.push(
        ball(7, 6, 12.5, 4.8, 4.4, 6.5, (tone, x, y, z) => (z > 17 && z < 18.2 ? 'GGg' : 'Ssz')[tone]),
        ball(7, 6, 19.6, 2.2, 2.2, 1.6, 'Ssz'),
      );
      // Santa: coat and belt, arms out to the reins, beard, face and hat.
      solids.push(
        ball(7, 14.5, 11.5, 4, 3.6, 5, (tone, x, y, z) => (z > 9.6 && z < 10.8 ? 'KKK' : red)[tone]),
        ...limb([3.6, 15, 13.5], [4.2, 19.5, 14], 1.4, red),
        ...limb([10.4, 15, 13.5], [9.8, 19.5, 14], 1.4, red),
        ball(4.3, 20.4, 14, 1.2, 1.2, 1.2, 'GGg'),
        ball(9.7, 20.4, 14, 1.2, 1.2, 1.2, 'GGg'),
        ball(7, 15.6, 16.2, 3, 2.6, 2.8, 'Wee'),
        ball(7, 15, 18.6, 2.6, 2.6, 3, 'PPp'),
        ball(7, 15, 20.6, 3.1, 3.1, 1.3, 'Wee'),
        ball(7, 14.8, 22, 2.5, 2.5, 1.8, red),
        ball(7, 14.2, 23.5, 1.9, 1.9, 1.6, red),
        ball(7, 13.4, 24.8, 1.3, 1.3, 1.3, red),
        ball(7, 12.8, 26.2, 1.5, 1.5, 1.6, 'Wee'),
      );
      // The reindeer: legs, then body and harness, tail, neck, head, muzzle, red nose and ears.
      const legs = stride
        ? [[41, 37], [41.5, 43], [50, 48.5], [50.5, 54.5]]
        : [[41, 43], [41.5, 39.5], [50, 53], [50.5, 48.5]];
      legs.forEach(([hip, hoof], i) => {
        const x = i % 2 ? 9.2 : 4.8;
        solids.push(
          ...limb([x, hip, 8], [x, hoof, 1.6], 1.1, brown),
          ball(x, hoof, 0.9, 1.2, 1.2, 0.9, 'KKK'),
        );
      });
      solids.push(
        ball(7, 46, 10.5, 3.6, 7.4, 4, (tone, x, y) => (Math.abs(y - 49) < 0.9 ? red : brown)[tone]),
        ball(7, 38.4, 12.6, 1.2, 1.2, 1.5, 'Sss'),
        ...limb([7, 51.5, 12], [7, 54.5, 17], 2.3, brown),
        ball(7, 55.6, 18.6, 2.4, 3, 2.7, brown),
        ball(7, 58.2, 17.6, 1.7, 2, 1.7, 'ttb'),
        ball(7, 60.2, 17.8, 1.2, 1.2, 1.3, red),
        ball(4.7, 54.4, 20.6, 1.3, 0.9, 1.4, brown),
        ball(9.3, 54.4, 20.6, 1.3, 0.9, 1.4, brown),
      );
      // Antlers, and the reins back to Santa's mittens.
      [-1, 1].forEach((side) => {
        solids.push(
          ...limb([7 + side * 1.4, 55, 21], [7 + side * 3, 53.6, 26.5], 0.6, 'SSs'),
          ...limb([7 + side * 2.2, 54.3, 23.6], [7 + side * 4.6, 55.8, 25], 0.6, 'SSs'),
          ...limb([7 + side * 2.7, 53.9, 25.2], [7 + side * 4.4, 52.4, 27.6], 0.6, 'SSs'),
          cord([7 + side * 2.7, 20.4, 14.4], [7 + side * 2.4, 49, 14], 'o'),
        );
      });
      isoRender(grid, originX, originY, unit, solids);
      const at = (x, y, z) => [Math.floor(originX + (x - y) * unit), Math.floor(originY + ((x + y) / 2 - z) * unit)];
      // Eyes, turned a little toward us.
      pixels(grid, 'K', [at(6.5, 17.3, 19.1), at(8.6, 16.9, 19.1), at(9.2, 56.8, 19.4)]);
      return grid.map((row) => row.join(''));
    }

    const frameSvg = (rows, frame) => `<g data-frame="${frame}">${gridSvg(rows)}</g>`;

    // Wrapping paper and ribbon, each as top, front and near-side colors.
    const WRAPS = [['HGg', 'ZYy'], ['LRr', 'Wee'], ['ZYy', 'LRr']];
    // Drawn the first time the screensaver starts, to keep it off the page load.
    let kinds = null;
    function drawKinds() {
      const drawn = {
        sleigh: [{ frames: [0, 1].map((stride) => sleigh(stride)), flap: [0, 1], frameMs: 220, speed: [75, 90], bob: 8 }],
        gift: WRAPS.map(([wrap, ribbon]) => ({
          frames: [0, 1, 2].map((flap) => flyingGift(flap, wrap, ribbon)),
          flap: [0, 1, 2, 1], frameMs: 150, speed: [45, 80], bob: 10,
        })),
      };
      Object.values(drawn).flat().forEach((kind) => {
        const columns = kind.frames[0][0].length;
        const rowCount = kind.frames[0].length;
        kind.width = columns * PIXEL;
        kind.height = rowCount * PIXEL;
        kind.svg = `<svg viewBox="0 0 ${columns} ${rowCount}" width="${kind.width}" height="${kind.height}" shape-rendering="crispEdges">${kind.frames.map(frameSvg).join('')}</svg>`;
      });
      return drawn;
    }

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

    function start() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const density = DENSITIES[options.density];
      const speed = SPEEDS[options.speed];
      kinds ??= drawKinds();
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
          const kind = kinds[name][i % kinds[name].length];
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
          sprite.y += sprite.speed * SLOPE * dt;
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

      return () => {
        cancelAnimationFrame(raf);
        screen.classList.remove('is-on');
        setTimeout(() => screen.remove(), 300);
      };
    }

    // After Hours (tokyo-night.js) runs the idle timer, the Sleep Now corner and the desk accessory.
    // Seasonal modules go first in its list and are the default screensaver while they're around.
    // The preview is the sleigh drawn small, at one sprite pixel per pixel of its little screen.
    const preview = sleigh(0, 0.71);
    const previewSvg = `<svg viewBox="0 0 ${preview[0].length} ${preview.length}" shape-rendering="crispEdges">${frameSvg(preview, 0)}</svg>`;
    window.afterHoursModules = [...(window.afterHoursModules || []), {
      id: 'christmas-delivery',
      season: `christmas-${root.dataset.christmasYear || ''}`,
      name: ['Christmas Delivery', 'クリスマス便'],
      preview: previewSvg,
      settings: [
        { option: 'speed', label: ['Speed', '速さ'], steps: SPEEDS.length },
        { option: 'density', label: ['Density', '数'], steps: DENSITIES.length },
      ],
      options,
      save() {
        try {
          localStorage.setItem('christmas-delivery', JSON.stringify(options));
        } catch (error) {}
      },
      start,
    }];
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
        ['.tree-lights-button', 'Turns the lights on or off, on the tree and all around the desktop. With Reduce Motion, they stay peacefully still either way.', 'ツリーとデスクトップのまわりのライトを点灯・消灯します。視覚効果を減らす設定では、どちらも静かに灯ります。'],
        ['.tokyo-night[data-module="christmas-delivery"] .after-dark-module, .after-dark-module-option[data-module="christmas-delivery"]', 'Christmas Delivery. Leave this Mac alone for 45 seconds and Santa flies presents over Tokyo. It beats sitting in traffic on the Shuto Expressway.', 'クリスマス便。このMacを45秒放っておくと、サンタが東京の空にプレゼントを運びます。首都高で渋滞するより速いはずです。'],
        ['.after-dark-setting[data-module="christmas-delivery"]:has([data-option="speed"])', 'How quickly Santa and the presents fly.', 'サンタとプレゼントの飛ぶ速さ。'],
        ['.after-dark-setting[data-module="christmas-delivery"]:has([data-option="density"])', 'How many presents are in the air at once.', '同時に飛ぶプレゼントの数。'],
        ['.tokyo-night[data-module="christmas-delivery"] .after-dark-sleep', 'Starts Christmas Delivery now. So does moving the pointer into the bottom-left corner.', '今すぐクリスマス便を始めます。ポインタを画面の左下隅に動かしても始まります。'],
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
