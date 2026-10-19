// Halloween mode. The inline script in <head> decides whether it's on (Oct 25 – Nov 1, Japan time)
// and adds `halloween` / `sad-mac-boot` to <html>. This runs before index.js so the label swaps
// below are what setLanguage() renders.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('halloween')) return;

  const visitorLabel = document.querySelector('.stack-visitor-counter [data-label-en]');
  if (visitorLabel) {
    visitorLabel.dataset.labelEn = 'Souls:';
    visitorLabel.dataset.labelJa = '魂:';
    visitorLabel.textContent = 'Souls:';
  }

  const aboutTitle = document.querySelector('#about-dialog > .title-bar .title-text');
  if (aboutTitle) {
    aboutTitle.dataset.labelEn = 'About this Undead Mac';
    aboutTitle.dataset.labelJa = 'このアンデッドMacについて';
    aboutTitle.textContent = 'About this Undead Mac';
  }

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
})();
