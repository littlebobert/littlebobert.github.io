// Inks in a seal: its border and lettering start with no thickness and swell to full
// weight while the seal stays the same size, like a hanko pressed onto paper. Used by
// the hero seal on the home page and the large one on /hanko.
//
// A filter thins the ink: widening the white paper around each stroke makes the border
// and lettering thinner, and the animation shrinks that to nothing. The image needs
// white on every side of its border, including its corners, for the paper to eat into;
// where it's transparent, the filter spreads the red outward instead.
(() => {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let filters = null;
  let nextFilter = 0;

  window.karuiInkIn = (image, delay = 0) => {
    if (reduceMotion.matches) return;
    if (!filters) {
      filters = document.createElementNS(svgNamespace, 'svg');
      filters.setAttribute('width', '0');
      filters.setAttribute('height', '0');
      filters.setAttribute('aria-hidden', 'true');
      filters.style.position = 'absolute';
      document.body.append(filters);
    }
    const run = image.inkRun = {};
    // On each side of a stroke, in the image's own pixels: just enough to thin the border
    // and the thickest strokes to nothing, whatever size the seal is drawn at.
    const startRadius = image.width * 0.042, duration = 700;
    image.style.opacity = 0;
    // Wait for the image, or a slow load would skip the start of the stamp.
    image.decode().catch(() => {}).then(() => setTimeout(() => {
      if (image.inkRun !== run) return;
      const filter = document.createElementNS(svgNamespace, 'filter');
      filter.id = `karui-seal-ink-${nextFilter++}`;
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      const thinning = document.createElementNS(svgNamespace, 'feMorphology');
      thinning.setAttribute('operator', 'dilate');
      thinning.setAttribute('radius', startRadius);
      filter.append(thinning);
      filters.append(filter);
      image.style.filter = `url(#${filter.id})`;
      // Its own layer while it animates, so redrawing the filter every frame repaints
      // only the seal.
      image.style.willChange = 'opacity';
      const start = performance.now();
      const frame = (now) => {
        const progress = image.inkRun === run ? Math.min((now - start) / duration, 1) : 1;
        // Cubic ease-out: quick through the start, where the strokes are still too thin
        // to see, then slowing as the ink settles to full weight.
        const eased = 1 - (1 - progress) ** 3;
        thinning.setAttribute('radius', startRadius * (1 - eased));
        image.style.opacity = Math.min(progress / 0.1, 1);
        if (progress < 1) return requestAnimationFrame(frame);
        // Full weight: drop the filter so the seal stays crisp.
        if (image.inkRun === run) image.style.filter = image.style.opacity = image.style.willChange = '';
        filter.remove();
      };
      requestAnimationFrame(frame);
    }, delay));
  };
})();
