// Plays the header's pencil sketch of the Karui icon, except with Reduce Motion or
// while the page is hidden. The still underneath shows until the video is playing.
(() => {
  const clip = document.querySelector('.karui-icon video');
  if (!clip) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function sync() {
    if (reduceMotion.matches || document.hidden) {
      clip.pause();
      clip.classList.remove('is-playing');
    } else {
      clip.play().catch(() => {});
    }
  }
  clip.addEventListener('playing', () => {
    if (!reduceMotion.matches) clip.classList.add('is-playing');
  });
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', sync);
  sync();
})();
