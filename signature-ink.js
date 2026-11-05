// Shared by sign.html and the home page's Guestbook: where the portfolio backend is, and how to
// draw signature ink. Ink is {width: 400, height: 200, strokes: [[x, y, t, x, y, t, …], …]}, t in
// ms from the first touch. The admin's live page has the same drawing code
// (workers/portfolio-backend/src/admin.js).
(() => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);

  // Draws ink into an <svg>, all at once or replayed at the pace it was signed, with pauses
  // between strokes shortened and the whole thing squeezed into a few seconds.
  // Returns a function that stops the replay.
  function draw(svg, ink, { animate = false, maxDuration = 4000 } = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', `0 0 ${ink.width} ${ink.height}`);
    svg.replaceChildren();
    let clock = 0;
    const strokes = ink.strokes.map((flat) => {
      const points = [];
      for (let i = 0; i < flat.length; i += 3) points.push([flat[i], flat[i + 1], flat[i + 2]]);
      const first = points[0][2];
      const timed = points.map(([x, y, t]) => [x, y, clock + t - first]);
      clock = timed[timed.length - 1][2] + 150;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '3.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);
      return { points: timed, path };
    });
    const pathData = (points) => (points.length === 1
      ? `M${points[0][0]} ${points[0][1]}h0`
      : `M${points.map(([x, y]) => `${x} ${y}`).join('L')}`);
    const drawUntil = (time) => strokes.forEach(({ points, path }) => {
      const shown = points.filter((point) => point[2] <= time);
      path.setAttribute('d', shown.length ? pathData(shown) : '');
    });
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawUntil(Infinity);
      return () => {};
    }
    const scale = Math.min(1, maxDuration / Math.max(clock, 1));
    const start = performance.now();
    let frame = 0;
    const step = (now) => {
      const time = (now - start) / scale;
      drawUntil(time);
      if (time < clock) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }

  window.SignatureInk = {
    // Served locally by workers/portfolio-backend/test/local-server.mjs when testing.
    apiBase: local ? 'http://localhost:8787' : 'https://portfolio-backend.justin-garcia.workers.dev',
    // Locally, Cloudflare's always-passes test key.
    turnstileSiteKey: local ? '1x00000000000000000000AA' : '0x4AAAAAADzny1gQWxbt_9AA',
    draw,
  };
})();
