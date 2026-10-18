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
    <svg class="sad-mac-icon" viewBox="0 0 22 26" shape-rendering="crispEdges">
      <g fill="#fff">${rects.W}</g>
      <g class="sad-mac-face-sad" fill="#fff">${rects.s}</g>
      <g class="sad-mac-face-risen" fill="#fff">${rects.r}</g>
    </svg>
    <div class="sad-mac-code">0000000F<br>00000666</div>`;
  document.body.prepend(screen);

  let finished = false;
  const timers = [];
  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    screen.classList.add('is-leaving');
    root.classList.remove('sad-mac-boot');
    setTimeout(() => screen.remove(), 400);
    try {
      localStorage.setItem('halloween-sad-mac', root.dataset.halloweenYear || '');
    } catch (error) {}
    window.removeEventListener('keydown', finish);
  }

  timers.push(setTimeout(() => screen.classList.add('is-rising'), 1300));
  timers.push(setTimeout(finish, 2200));
  screen.addEventListener('click', finish);
  window.addEventListener('keydown', finish);
})();
