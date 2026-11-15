// Plays each app's pencil-sketch icon on the Self-published card and in the app's pitch window
// while it is on screen, except with Reduce Motion or while the page is hidden. Videos load only
// once first shown; the still underneath shows until a video is playing. A pitch window's sketch
// rewinds when the window closes, so it draws from the start each time the window opens.
(() => {
  const clips = [...document.querySelectorAll('.stack-product-sketch video')];
  if (!clips.length) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set();

  function sync(clip) {
    if (visible.has(clip) && !reduceMotion.matches && !document.hidden) {
      clip.preload = 'auto';
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.classList.remove('is-playing');
      if (!visible.has(clip) && clip.closest('.app-window-sketch')) clip.currentTime = 0;
    }
  }
  const syncAll = () => clips.forEach(sync);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visible.add(target);
      else visible.delete(target);
      sync(target);
    });
  });
  clips.forEach((clip) => {
    clip.addEventListener('playing', () => {
      if (!reduceMotion.matches) clip.classList.add('is-playing');
    });
    observer.observe(clip);
  });
  document.addEventListener('visibilitychange', syncAll);
  reduceMotion.addEventListener('change', syncAll);
})();
