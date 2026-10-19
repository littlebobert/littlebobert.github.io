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

  // 1. Lightning: two inverted flashes while the error code scrambles into DEADBEEF.
  [[450, 530], [600, 660]].forEach(([on, off]) => {
    at(on, () => screen.classList.add('is-flash'));
    at(off, () => screen.classList.remove('is-flash'));
  });
  at(450, () => {
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

  // 2. Reanimation: jolts, with the face flickering faster between dead and risen (ends risen).
  at(700, () => screen.classList.add('is-jolting'));
  [0, 180, 300, 380, 440, 490, 530, 560, 590].forEach((offset) => {
    at(700 + offset, () => screen.classList.toggle('is-risen-face'));
  });

  // 3. Rise: lifts off the ground in pixel steps, shaking off dirt.
  at(1500, () => {
    screen.classList.remove('is-jolting');
    screen.classList.add('is-rising');
    for (let i = 0; i < 9; i += 1) {
      const dirt = document.createElement('span');
      dirt.className = 'sad-mac-dirt';
      dirt.style.left = `${8 + Math.random() * 72}px`;
      dirt.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 16) * 4}px`);
      dirt.style.setProperty('--dy', `${(6 + Math.floor(Math.random() * 8)) * 4}px`);
      dirt.style.animationDelay = `${Math.floor(Math.random() * 5) * 60}ms`;
      stage.append(dirt);
    }
  });

  at(2500, finish);
  screen.addEventListener('click', finish);
  window.addEventListener('keydown', finish);
})();
