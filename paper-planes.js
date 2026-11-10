// Paper Planes, an After Hours module for the whole year (tokyo-night.js runs the idle timer, the
// Sleep Now corner and the desk accessory). A Tokyo side street at night in sixteen dithered
// grays, like an old grayscale Mac: a two-story wooden house, an alley with a utility pole and a
// street lamp, a ramen shop, a vending machine, and a small apartment block over a corner store,
// with the city and the Skytree fading into the haze behind. Paper planes glide in from the left and
// live off what's there. They porpoise the way real ones do; warm air from the air conditioners, the vending
// machine and the ramen shop's kitchen fan carries them up; gusts shove them around; a plane that
// clips a wire flips over and flutters down (and the crows on it leave); and anything that runs out
// of air lands on a roof or the street and skids, slides down the tiles and off the eaves, or
// crumples into a wall or a sign and drops. A nod to Glider, the classic Mac game that flew a paper
// airplane on the warm air from a house's heating vents.
(() => {
  const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
  const DENSITIES = [0.5, 0.75, 1, 1.5, 2];
  const STORAGE_KEY = 'paper-planes';
  const options = { speed: 2, density: 2 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    ['speed', 'density'].forEach((key) => {
      if (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] < SPEEDS.length) options[key] = saved[key];
    });
  } catch (error) {}

  function seeded(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const tone = (shade, alpha = 1) => `rgba(${Math.round(shade)},${Math.round(shade)},${Math.round(shade)},${alpha})`;

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return [canvas, canvas.getContext('2d', { willReadFrequently: true })];
  }

  // Sixteen grays, like an old grayscale Mac. The scene is painted with soft light, then each pixel
  // is snapped to one of these, with a light ordered (Bayer) dither between neighboring grays, so
  // gradients like the sky and the pools of light get a fine pattern instead of hard bands. The
  // pattern follows the screen, not the region, so a repainted window lines up with the rest.
  const LEVELS = 15;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  function posterize(ctx, x, y, w, h) {
    const image = ctx.getImageData(x, y, w, h);
    const { data } = image;
    for (let row = 0, i = 0; row < h; row += 1) {
      const by = ((y + row) & 3) * 4;
      for (let col = 0; col < w; col += 1, i += 4) {
        const level = (data[i] / 255) * LEVELS + BAYER[by + ((x + col) & 3)];
        const shade = Math.round((Math.min(LEVELS, Math.max(0, Math.round(level))) * 255) / LEVELS);
        data[i] = shade;
        data[i + 1] = shade;
        data[i + 2] = shade;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, x, y);
  }

  // The plane, nose to the right, 22 art pixels long at scale 1: the far wing peeking over the top,
  // the keel folded down underneath, and the near wing, which catches the most light.
  const PLANE = [
    [[-9.2, -2.2], [11, 0], [-3.5, -0.4], 182],
    [[-4.8, 0], [11, 0], [-7, 3.5], 214],
    [[-11, -4], [11, 0], [-4.8, 0], 255],
  ];

  const trace = (ctx, [a, b, c]) => {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...c);
    ctx.closePath();
  };

  function drawPlane(ctx, x, y, angle, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Heading left, it's the same plane facing the other way, not upside down.
    ctx.scale(scale, Math.cos(angle) < 0 ? -scale : scale);
    ctx.lineJoin = 'round';
    // A dark edge first, so the plane sits in front of everything behind it.
    ctx.strokeStyle = tone(10, 0.85);
    ctx.lineWidth = 2.5 / scale;
    PLANE.forEach((shape) => {
      trace(ctx, shape);
      ctx.stroke();
    });
    ctx.strokeStyle = tone(120);
    ctx.lineWidth = 0.7 / scale;
    PLANE.forEach((shape) => {
      trace(ctx, shape);
      ctx.fillStyle = tone(shape[3]);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  // A plane after it hits a wall: a wad of paper with a crease or two.
  function drawWad(ctx, wad) {
    ctx.save();
    ctx.translate(wad.x, wad.y);
    ctx.rotate(wad.spin);
    ctx.beginPath();
    wad.shape.forEach((r, i) => {
      const a = (i / wad.shape.length) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    });
    ctx.closePath();
    ctx.fillStyle = tone(236);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = tone(20);
    ctx.stroke();
    ctx.strokeStyle = tone(140);
    ctx.beginPath();
    ctx.moveTo(-wad.r * 0.5, -wad.r * 0.2);
    ctx.lineTo(wad.r * 0.1, wad.r * 0.3);
    ctx.lineTo(wad.r * 0.5, -wad.r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  // A crow, perched or flapping, u art pixels to its unit.
  function drawCrow(ctx, crow, u) {
    ctx.save();
    ctx.translate(Math.round(crow.x), Math.round(crow.y));
    if (crow.facing < 0) ctx.scale(-1, 1);
    ctx.fillStyle = tone(8);
    ctx.beginPath();
    if (crow.state === 'perched') {
      ctx.ellipse(0, -3 * u, 2.6 * u, 2 * u, -0.3, 0, Math.PI * 2);
      ctx.moveTo(2 * u, -5.5 * u);
      ctx.arc(2.2 * u, -5.4 * u, 1.3 * u, 0, Math.PI * 2);
      ctx.moveTo(-2 * u, -2.5 * u);
      ctx.lineTo(-5 * u, -0.8 * u);
      ctx.lineTo(-2 * u, -1.2 * u);
      ctx.moveTo(3.2 * u, -5.8 * u);
      ctx.lineTo(5 * u, -5.2 * u);
      ctx.lineTo(3.2 * u, -4.8 * u);
    } else {
      const up = Math.floor(crow.flap * 9) % 2 === 0;
      ctx.ellipse(0, 0, 3 * u, 1.4 * u, 0, 0, Math.PI * 2);
      ctx.moveTo(2.5 * u, -0.5 * u);
      ctx.arc(3 * u, -0.6 * u, 1.1 * u, 0, Math.PI * 2);
      ctx.moveTo(-1.5 * u, 0);
      ctx.lineTo(-5 * u, up ? -1 * u : 1 * u);
      ctx.lineTo(-2.5 * u, 0.8 * u);
      ctx.moveTo(-1 * u, 0);
      ctx.lineTo(0.5 * u, up ? -5 * u : 4 * u);
      ctx.lineTo(1.5 * u, 0);
    }
    // A faint edge of moonlight.
    ctx.strokeStyle = tone(80, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  // The street. Everything solid also goes into a mask, which is what planes land on and run into;
  // vents are where warm air rises, wires are what planes snag, perches are where crows sit, and
  // windows are what light up and go dark. The moon is up on the right, so right-hand edges catch
  // its light.
  function buildScene(width, height, random) {
    const rand = (min, max) => min + random() * (max - min);
    const [canvas, ctx] = makeCanvas(width, height);
    const [, mask] = makeCanvas(width, height);
    mask.fillStyle = '#fff';
    const u = Math.max(1, Math.round(height / 180)); // the size of the smallest details
    const G = height - Math.round(height * 0.08); // the street
    const X = (f) => Math.round(f * width);
    const Y = (f) => Math.round(G - f * height); // f is the height above the street, of the screen

    const paint = (fill) => (typeof fill === 'number' ? tone(fill) : fill);
    function rect(x, y, w, h, fill, solid = false) {
      [x, y, w, h] = [x, y, w, h].map(Math.round);
      ctx.fillStyle = paint(fill);
      ctx.fillRect(x, y, w, h);
      if (solid) mask.fillRect(x, y, w, h);
    }
    function poly(points, fill, solid = false) {
      const path = new Path2D();
      points.forEach(([px, py], i) => (i ? path.lineTo(px, py) : path.moveTo(px, py)));
      path.closePath();
      ctx.fillStyle = paint(fill);
      ctx.fill(path);
      if (solid) mask.fill(path);
      return path;
    }
    function ellipse(x, y, rx, ry, fill, solid = false) {
      const path = new Path2D();
      path.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = paint(fill);
      ctx.fill(path);
      if (solid) mask.fill(path);
      return path;
    }
    const down = (y, h, ...stops) => {
      const gradient = ctx.createLinearGradient(0, y, 0, y + h);
      stops.forEach((stop, i) => gradient.addColorStop(i / (stops.length - 1), paint(stop)));
      return gradient;
    };
    const across = (x, w, ...stops) => {
      const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
      stops.forEach((stop, i) => gradient.addColorStop(i / (stops.length - 1), paint(stop)));
      return gradient;
    };
    function glow(x, y, r, shade, alpha) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, tone(shade, alpha));
      gradient.addColorStop(1, tone(shade, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // A pool of light on the street, flattened by perspective.
    function pool(x, r, alpha) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, G, width, height - G);
      ctx.clip();
      ctx.translate(x, G + u);
      ctx.scale(1, 0.22);
      glow(0, 0, r, 190, alpha);
      ctx.restore();
    }
    // Blocky marks that read as lettering from across the street.
    function marks(x, y, w, h, count, vertical, shade) {
      ctx.fillStyle = tone(shade);
      for (let i = 0; i < count; i += 1) {
        const cx = vertical ? x + w / 2 : x + ((i + 0.5) * w) / count;
        const cy = vertical ? y + ((i + 0.5) * h) / count : y + h / 2;
        const s = Math.max(1.5, (vertical ? w : h) * 0.3);
        ctx.fillRect(Math.round(cx - s), Math.round(cy - s * 0.2), Math.round(s * 2), Math.max(1, u));
        ctx.fillRect(Math.round(cx - s * 0.2), Math.round(cy - s), Math.max(1, u), Math.round(s * 2));
        if (random() < 0.6) ctx.fillRect(Math.round(cx + s * 0.35), Math.round(cy + s * 0.25), Math.max(1, u), Math.round(s * 0.8));
        if (random() < 0.5) ctx.fillRect(Math.round(cx - s * 0.8), Math.round(cy - s * 0.7), Math.round(s * 0.6), Math.max(1, u));
      }
    }

    const vents = [];
    const windows = [];
    const fans = [];
    // An apartment or shop window, lit with curtains drawn partway, or dark with a glint of sky.
    function addWindow(x, y, w, h, lit = random() < 0.5) {
      const win = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), lit, curtain: rand(0.15, 0.35), plant: random() < 0.25 };
      win.draw = () => {
        rect(win.x - 1, win.y - 1, win.w + 2, win.h + 2, 22);
        if (win.lit) {
          rect(win.x, win.y, win.w, win.h, down(win.y, win.h, 214, 182));
          const c = Math.round(win.w * win.curtain);
          rect(win.x, win.y, c, win.h, 150);
          rect(win.x + win.w - c, win.y, c, win.h, 150);
          if (win.plant) ellipse(win.x + win.w * 0.5, win.y + win.h - 2 * u, 2.5 * u, 2 * u, 90);
        } else {
          rect(win.x, win.y, win.w, win.h, 26);
          ctx.fillStyle = tone(44);
          for (let k = 0; k < win.h; k += 1) ctx.fillRect(win.x + Math.round(win.w * 0.6) - k, win.y + k, Math.max(1, u), 1);
          rect(win.x, win.y, win.w, win.h * 0.5, tone(255, 0.03));
        }
        rect(win.x + Math.round(win.w / 2), win.y, 1, win.h, 30);
        rect(win.x - 1, win.y + win.h + 1, win.w + 2, u, 90);
      };
      win.draw();
      windows.push(win);
    }
    // A shoji window, lit from inside, with its soft light on the wall around it.
    function shoji(x, y, w, h) {
      glow(x + w / 2, y + h / 2, w * 0.9, 180, 0.12);
      rect(x - u, y - u, w + 2 * u, h + 2 * u, 26);
      rect(x, y, w, h, down(y, h, 222, 196));
      ctx.fillStyle = tone(150);
      const step = Math.max(2, 3 * u);
      for (let lx = x + step; lx < x + w - 1; lx += step) ctx.fillRect(Math.round(lx), y, 1, h);
      for (let ly = y + step + u; ly < y + h - 1; ly += step + u) ctx.fillRect(x, Math.round(ly), w, 1);
    }
    // An outdoor air conditioner on a bracket, with its fan, and the warm air it puts out.
    function airConditioner(x, y, lift = 1.1) {
      const w = 9 * u;
      const h = 6 * u;
      rect(x + u, y + h, w, u, tone(0, 0.35));
      rect(x, y, w, h, across(x, w, 128, 160, 142), true);
      rect(x, y, w, 1, 192);
      ellipse(x + w * 0.38, y + h / 2, h * 0.34, h * 0.34, 72);
      ellipse(x + w * 0.38, y + h / 2, h * 0.18, h * 0.18, 96);
      ctx.fillStyle = tone(108);
      for (let ly = y + u; ly < y + h - u; ly += u + 1) ctx.fillRect(Math.round(x + w * 0.7), ly, Math.round(w * 0.2), 1);
      vents.push({ cx: x + w / 2, top: y, width: 16 * u, lift, reach: height * 0.28, kind: 'heat' });
    }

    // The sky: deep at the top, with the city's glow low down, the moon, and a few thin clouds.
    rect(0, 0, width, G, down(0, G, 12, 26, 44, 78));
    for (let i = 0; i < (width * height) / 2400; i += 1) {
      const sy = rand(0, height * 0.42);
      rect(Math.floor(rand(0, width)), Math.floor(sy), 1, 1, tone(rand(120, 240), 1 - sy / (height * 0.5)));
    }
    const moon = { x: width * 0.8, y: height * 0.13, r: Math.max(3, height * 0.05) };
    glow(moon.x, moon.y, moon.r * 6, 170, 0.16);
    glow(moon.x, moon.y, moon.r * 2.2, 210, 0.22);
    ellipse(moon.x, moon.y, moon.r, moon.r, 232);
    [[-0.35, -0.2, 0.25], [0.3, 0.25, 0.2], [0.05, 0.5, 0.12], [0.35, -0.4, 0.12]].forEach(([dx, dy, r]) => {
      ellipse(moon.x + dx * moon.r, moon.y + dy * moon.r, r * moon.r, r * moon.r, 206);
    });
    for (let i = 0; i < 3; i += 1) {
      const cy = height * rand(0.12, 0.34);
      const cx = rand(-0.1, 0.9) * width;
      for (let k = 0; k < 5; k += 1) {
        const ex = cx + k * width * 0.05 + rand(-6, 6);
        ellipse(ex, cy + rand(-2, 2) * u, width * rand(0.04, 0.08), height * 0.012, tone(60, 0.5));
        ellipse(ex + u, cy - height * 0.006, width * 0.04, height * 0.005, tone(110, Math.max(0, 0.35 - Math.abs(ex - moon.x) / width)));
      }
    }

    // The city further off, in two layers fading into the haze, with the Skytree behind it all.
    const skytree = X(0.53);
    poly([[skytree - 5 * u, G], [skytree - 1.5 * u, Y(0.66)], [skytree + 1.5 * u, Y(0.66)], [skytree + 5 * u, G]], 56);
    rect(skytree - 3.5 * u, Y(0.62), 7 * u, 3 * u, 60);
    rect(skytree - 2.5 * u, Y(0.71), 5 * u, 2 * u, 60);
    rect(skytree - 0.5 * u, Y(0.84), u + 1, Y(0.66) - Y(0.84), 58);
    rect(skytree - 3.5 * u, Y(0.62) + u, 7 * u, 1, 150);
    rect(skytree - 2.5 * u, Y(0.71) + u, 5 * u, 1, 130);
    for (let layer = 0; layer < 2; layer += 1) {
      const shade = layer ? 34 : 50;
      for (let x = Math.round(-rand(0, 20)); x < width;) {
        const w = Math.round(rand(0.03, 0.08) * width);
        const top = Y(layer ? rand(0.2, 0.45) : rand(0.3, 0.6));
        rect(x, top, w, G - top, shade);
        rect(x + w - 1, top, 1, G - top, shade + 10);
        if (random() < 0.3) rect(x + w * 0.3, top - 3 * u, 4 * u, 3 * u, shade);
        for (let wy = top + 3 * u; wy < G - 2 * u; wy += 4 * u) {
          for (let wx = x + 2 * u; wx < x + w - 2 * u; wx += 3 * u) {
            if (random() < (layer ? 0.16 : 0.1)) rect(wx, wy, u, u, layer ? rand(120, 190) : rand(80, 110));
          }
        }
        x += w + (random() < 0.3 ? Math.round(rand(2, 8) * u) : 0);
      }
      rect(0, Y(0.45), width, G - Y(0.45), down(Y(0.45), G - Y(0.45), tone(90, 0), tone(90, layer ? 0.18 : 0.3)));
    }

    // The street: asphalt, a curb catching the light, and a manhole cover.
    rect(0, G, width, height - G, down(G, height - G, 44, 24), true);
    rect(0, G, width, u, 96);
    rect(0, G + u, width, 1, 18);
    ellipse(X(0.5), G + (height - G) * 0.55, 7 * u, 1.6 * u, 52);
    ellipse(X(0.5), G + (height - G) * 0.55, 5 * u, 1, 36);

    // The wooden house: dark boards, shoji upstairs, a lattice door and potted plants, a little
    // roof over the side door, a tiled roof with deep eaves, and an air conditioner off the side.
    const hx = X(0.02);
    const hw = X(0.25);
    const hTop = Y(0.33);
    const hMid = Y(0.16);
    const eave = 7 * u;
    const ridge = Y(0.44);
    rect(hx, hTop, hw, G - hTop, 44, true);
    for (let bx = hx; bx < hx + hw; bx += 4 * u) {
      rect(bx + 1, hTop, 4 * u - 1, G - hTop, 40 + rand(0, 12));
      rect(bx, hTop, 1, G - hTop, 28);
    }
    rect(hx + hw - 1, hTop, 1, G - hTop, 92);
    rect(hx, hMid - u, hw, 2 * u, 30);
    rect(hx, hMid + u, hw, 3 * u, tone(0, 0.3));
    shoji(hx + hw * 0.12, hTop + 0.05 * height, hw * 0.3, height * 0.08);
    shoji(hx + hw * 0.55, hTop + 0.05 * height, hw * 0.3, height * 0.08);
    shoji(hx + hw * 0.12, hMid + 0.035 * height, hw * 0.28, height * 0.07);
    const door = { x: hx + hw * 0.55, w: hw * 0.22, h: height * 0.12 };
    glow(door.x + door.w / 2, G - door.h * 0.6, door.w * 1.2, 190, 0.14);
    rect(door.x - u, G - door.h - u, door.w + 2 * u, door.h + u, 24);
    rect(door.x, G - door.h, door.w, door.h, down(G - door.h, door.h, 196, 166));
    ctx.fillStyle = tone(108);
    for (let lx = door.x + 2 * u; lx < door.x + door.w; lx += 2 * u) ctx.fillRect(Math.round(lx), Math.round(G - door.h), 1, Math.round(door.h));
    rect(door.x + door.w / 2, G - door.h, 1, door.h, 60);
    rect(door.x - 2 * u, G - door.h - 3 * u, door.w + 4 * u, 2 * u, 34);
    glow(door.x + door.w + 3 * u, G - door.h - 5 * u, 6 * u, 230, 0.4);
    ellipse(door.x + door.w + 3 * u, G - door.h - 5 * u, u * 1.2, u * 1.6, 236);
    [hx + hw * 0.08, hx + hw * 0.2, hx + hw * 0.32].forEach((potX, i) => {
      const potH = (3 + (i % 2)) * u;
      const leaves = 3 + i;
      for (let k = 0; k < leaves; k += 1) {
        ellipse(potX + 2 * u + rand(-2, 2) * u, G - potH - rand(2, 6) * u, rand(1.5, 2.5) * u, rand(1, 1.8) * u, k % 2 ? 30 : 46);
      }
      rect(potX, G - potH, 4 * u, potH, across(potX, 4 * u, 62, 84, 58));
      rect(potX - 0.5 * u, G - potH, 5 * u, u, 92);
    });
    poly([[hx + hw, hMid - 4 * u], [hx + hw + 9 * u, hMid], [hx + hw + 9 * u, hMid + 2 * u], [hx + hw, hMid + 2 * u]], 36, true);
    poly([[hx + hw, hMid - 4 * u], [hx + hw + 9 * u, hMid], [hx + hw + 9 * u, hMid + 1], [hx + hw, hMid - 4 * u + 1]], 104);
    rect(hx, hTop, hw, 7 * u, down(hTop, 7 * u, tone(0, 0.55), tone(0, 0)));
    const roof = poly([[hx - eave, hTop + 3 * u], [hx + hw / 2, ridge], [hx + hw + eave, hTop + 3 * u], [hx + hw + eave, hTop + 5 * u], [hx - eave, hTop + 5 * u]], 30, true);
    ctx.save();
    ctx.clip(roof);
    for (let ly = ridge; ly < hTop + 6 * u; ly += 3 * u) {
      rect(hx - eave, ly, hw + 2 * eave, 1, 52);
      rect(hx - eave, ly + 1, hw + 2 * eave, 1, 18);
    }
    for (let lx = hx - eave; lx < hx + hw + eave; lx += 3 * u) rect(lx, ridge, 1, hTop + 6 * u - ridge, tone(0, 0.25));
    rect(hx + hw / 2, ridge, hw / 2 + eave, hTop + 6 * u - ridge, across(hx + hw / 2, hw / 2 + eave, tone(150, 0), tone(150, 0.12)));
    ctx.restore();
    ctx.strokeStyle = tone(150);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + hw / 2, ridge + 0.5);
    ctx.lineTo(hx + hw + eave, hTop + 3 * u + 0.5);
    ctx.stroke();
    ctx.strokeStyle = tone(64);
    ctx.beginPath();
    ctx.moveTo(hx - eave, hTop + 3 * u + 0.5);
    ctx.lineTo(hx + hw / 2, ridge + 0.5);
    ctx.stroke();
    rect(hx - eave, hTop + 5 * u - 1, hw + 2 * eave, 1, 64);
    rect(hx + hw / 2 - 3 * u, ridge - 2 * u, 6 * u, 3 * u, 34, true);
    rect(hx + hw / 2 - 3 * u, ridge - 2 * u, 6 * u, 1, 124);
    airConditioner(hx + hw, Y(0.24));
    // A bicycle parked in the alley, with a basket.
    const bx = hx + hw + X(0.02);
    const wheel = 4 * u;
    ctx.strokeStyle = tone(100);
    ctx.lineWidth = 1;
    [bx + wheel, bx + wheel * 3.6].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, G - wheel, wheel, 0, Math.PI * 2);
      ctx.stroke();
      rect(cx, G - wheel, 1, 1, 130);
    });
    ctx.beginPath();
    ctx.moveTo(bx + wheel, G - wheel);
    ctx.lineTo(bx + wheel * 2.2, G - wheel * 2.2);
    ctx.lineTo(bx + wheel * 3.6, G - wheel);
    ctx.lineTo(bx + wheel * 2.4, G - wheel);
    ctx.closePath();
    ctx.moveTo(bx + wheel * 3.4, G - wheel * 2.6);
    ctx.lineTo(bx + wheel * 3.6, G - wheel);
    ctx.stroke();
    rect(bx + wheel * 1.8, G - wheel * 2.5, 2 * u, u, 60);
    rect(bx + wheel * 3.4, G - wheel * 2.9, 3 * u, 2 * u, 86);
    mask.fillRect(bx, G - wheel * 2.4, wheel * 4.6, wheel * 2.4);

    // The utility pole, with its crossarm, insulators, transformer, an ad, and a street lamp.
    const px = X(0.31);
    const poleTop = Y(0.62);
    rect(px, poleTop, 3 * u, G - poleTop, across(px, 3 * u, 44, 70, 104), true);
    for (let sy = poleTop + 10 * u; sy < Y(0.1); sy += 6 * u) rect(sy % (12 * u) < 6 * u ? px - u : px + 3 * u, sy, u, 1, 90);
    const armY = Y(0.58);
    rect(px - 7 * u, armY, 17 * u, u + 1, 52, true);
    rect(px - 7 * u, armY, 17 * u, 1, 110);
    [px - 6 * u, px - 2 * u, px + 5 * u, px + 8 * u].forEach((ix) => rect(ix, armY - u, u, u, 168));
    rect(px + 3 * u, Y(0.5), 5 * u, 8 * u, across(px + 3 * u, 5 * u, 62, 96, 120), true);
    rect(px + 3 * u, Y(0.5) + 2 * u, 5 * u, 1, 50);
    rect(px + 3 * u, Y(0.5) + 5 * u, 5 * u, 1, 50);
    rect(px, Y(0.17), 3 * u, height * 0.06, 168);
    marks(px, Y(0.17), 3 * u, height * 0.06, 3, true, 60);
    const lamp = { x: px + 10 * u, y: Y(0.27) };
    rect(px + 3 * u, lamp.y - u, 7 * u, 1, 70);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lamp.x - u, lamp.y);
    ctx.lineTo(lamp.x + 2 * u, lamp.y);
    ctx.lineTo(lamp.x + 14 * u, G);
    ctx.lineTo(lamp.x - 13 * u, G);
    ctx.closePath();
    ctx.fillStyle = down(lamp.y, G - lamp.y, tone(220, 0.16), tone(220, 0.02));
    ctx.fill();
    ctx.restore();
    glow(lamp.x + 0.5 * u, lamp.y + u, 7 * u, 235, 0.3);
    rect(lamp.x - u, lamp.y - u, 3 * u, u, 60);
    rect(lamp.x - 0.5 * u, lamp.y, 2 * u, u, 245);
    pool(lamp.x, 22 * u, 0.35);

    // The ramen shop: plaster walls, a lit sign hanging off the side, a red lantern, a shop sign,
    // the noren with customers behind it, a cat in an upstairs window, the kitchen fan high on the
    // far wall, and a water tank on the roof.
    const rx = X(0.36);
    const rw = X(0.23);
    const rTop = Y(0.37);
    rect(rx, rTop, rw, G - rTop, 52, true);
    for (let i = 0; i < (rw * (G - rTop)) / 30; i += 1) rect(rx + rand(0, rw), rTop + rand(0, G - rTop), 1, 1, rand(44, 62));
    rect(rx + rw - 1, rTop, 1, G - rTop, 90);
    rect(rx - 2 * u, rTop - 2 * u, rw + 4 * u, 2 * u, 62, true);
    rect(rx - 2 * u, rTop - 2 * u, rw + 4 * u, 1, 126);
    rect(rx, rTop, rw, 4 * u, down(rTop, 4 * u, tone(0, 0.4), tone(0, 0)));
    addWindow(rx + rw * 0.55, rTop + 0.05 * height, rw * 0.3, height * 0.07);
    const catWin = { x: rx + rw * 0.15, y: rTop + 0.05 * height, w: rw * 0.3, h: height * 0.07 };
    rect(catWin.x - 1, catWin.y - 1, catWin.w + 2, catWin.h + 2, 22);
    rect(catWin.x, catWin.y, catWin.w, catWin.h, down(catWin.y, catWin.h, 200, 170));
    const cat = { x: catWin.x + catWin.w * 0.3, y: catWin.y + catWin.h };
    ellipse(cat.x, cat.y - 2.5 * u, 2.6 * u, 2.5 * u, 20);
    ellipse(cat.x + 0.5 * u, cat.y - 5.5 * u, 1.7 * u, 1.6 * u, 20);
    poly([[cat.x - 0.8 * u, cat.y - 6.5 * u], [cat.x - 0.2 * u, cat.y - 8.4 * u], [cat.x + 0.6 * u, cat.y - 6.6 * u]], 20);
    poly([[cat.x + 0.6 * u, cat.y - 6.6 * u], [cat.x + 1.6 * u, cat.y - 8.4 * u], [cat.x + 2 * u, cat.y - 6.2 * u]], 20);
    rect(cat.x + 2 * u, cat.y - 1.5 * u, 3 * u, u, 20);
    rect(catWin.x - 1, catWin.y + catWin.h + 1, catWin.w + 2, u, 90);
    rect(rx, Y(0.19) - 2 * u, rw, 2 * u, 34, false);
    const board = { x: rx + rw * 0.1, y: Y(0.175), w: rw * 0.8, h: height * 0.045 };
    glow(board.x + board.w / 2, board.y + board.h / 2, board.w * 0.7, 200, 0.1);
    rect(board.x - u, board.y - u, board.w + 2 * u, board.h + 2 * u, 30);
    rect(board.x, board.y, board.w, board.h, down(board.y, board.h, 214, 190));
    marks(board.x, board.y, board.w, board.h, 4, false, 40);
    const norenTop = G - height * 0.11;
    const doorX = rx + rw * 0.28;
    const doorW = rw * 0.44;
    rect(doorX, norenTop, doorW, G - norenTop, down(norenTop, G - norenTop, 178, 150));
    rect(doorX, G - height * 0.035, doorW, height * 0.035, 96);
    [0.25, 0.6].forEach((f, i) => {
      const hx2 = doorX + doorW * f;
      ellipse(hx2, norenTop + height * 0.06, 1.8 * u, 2 * u, 40);
      rect(hx2 - 2 * u, norenTop + height * 0.068, 4 * u, height * 0.03, 40);
      if (i === 0) rect(hx2 + 2 * u, norenTop + height * 0.07, 2 * u, u, 40);
    });
    for (let k = 0; k < 4; k += 1) {
      const nx = doorX + (k * doorW) / 4 + 0.5;
      rect(nx, norenTop, doorW / 4 - 1, height * 0.055, down(norenTop, height * 0.055, 226, 206));
    }
    marks(doorX, norenTop + u, doorW, height * 0.045, 2, false, 52);
    rect(doorX - u, norenTop - u, doorW + 2 * u, u, 30);
    pool(doorX + doorW / 2, 24 * u, 0.42);
    const sign = { x: rx - 9 * u, y: Y(0.34), w: 8 * u, h: height * 0.13 };
    glow(sign.x + sign.w / 2, sign.y + sign.h / 2, sign.h * 0.8, 210, 0.13);
    rect(sign.x - u, sign.y - u, sign.w + 2 * u, sign.h + 2 * u, 34, true);
    rect(sign.x, sign.y, sign.w, sign.h, down(sign.y, sign.h, 236, 206), true);
    marks(sign.x, sign.y, sign.w, sign.h, 3, true, 34);
    rect(rx - u, Y(0.33), u, u, 40, true);
    rect(rx - u, Y(0.22), u, u, 40, true);
    const lantern = { x: rx - 6 * u, y: Y(0.12), rx: 3.5 * u, ry: 5 * u };
    rect(rx - 8 * u, lantern.y - lantern.ry - 2 * u, 8 * u, u, 40);
    glow(lantern.x, lantern.y, lantern.ry * 3.2, 220, 0.3);
    const lanternPath = ellipse(lantern.x, lantern.y, lantern.rx, lantern.ry, 0, true);
    const shine = ctx.createRadialGradient(lantern.x - u, lantern.y - u, 0, lantern.x, lantern.y, lantern.ry);
    shine.addColorStop(0, tone(250));
    shine.addColorStop(1, tone(176));
    ctx.fillStyle = shine;
    ctx.fill(lanternPath);
    ctx.save();
    ctx.clip(lanternPath);
    for (let ly = lantern.y - lantern.ry; ly < lantern.y + lantern.ry; ly += 2 * u) rect(lantern.x - lantern.rx, ly, lantern.rx * 2, 1, tone(120, 0.5));
    ctx.restore();
    marks(lantern.x - lantern.rx * 0.5, lantern.y - lantern.ry * 0.4, lantern.rx, lantern.ry * 0.8, 1, true, 60);
    rect(lantern.x - lantern.rx * 0.6, lantern.y - lantern.ry - u, lantern.rx * 1.2, 1 + u, 30, true);
    rect(lantern.x - lantern.rx * 0.6, lantern.y + lantern.ry - 1, lantern.rx * 1.2, 1 + u, 30, true);
    pool(lantern.x, 12 * u, 0.25);
    const fan = { x: rx + rw, y: Y(0.3), size: 8 * u };
    rect(fan.x, fan.y + fan.size, fan.size * 0.5, 9 * u, down(fan.y + fan.size, 9 * u, tone(0, 0.45), tone(0, 0)));
    rect(fan.x, fan.y, fan.size, fan.size, across(fan.x, fan.size, 92, 128, 110), true);
    rect(fan.x, fan.y, fan.size, 1, 160);
    ellipse(fan.x + fan.size / 2, fan.y + fan.size / 2, fan.size * 0.38, fan.size * 0.38, 46);
    fans.push({ x: fan.x + fan.size / 2, y: fan.y + fan.size / 2, r: fan.size * 0.34 });
    vents.push({ cx: fan.x + fan.size / 2 + 2 * u, top: fan.y, width: 22 * u, lift: 2.1, reach: height * 0.45, kind: 'steam' });
    const tank = { x: rx + rw * 0.55, w: 10 * u, h: 7 * u };
    const tankTop = rTop - 2 * u - tank.h - 3 * u;
    rect(tank.x, tankTop, tank.w, tank.h, across(tank.x, tank.w, 54, 80, 112, 70), true);
    ellipse(tank.x + tank.w / 2, tankTop, tank.w / 2, u, 116);
    rect(tank.x, tankTop + tank.h * 0.5, tank.w, 1, 50);
    rect(tank.x + u, rTop - 2 * u - 3 * u, u, 3 * u, 40, true);
    rect(tank.x + tank.w - 2 * u, rTop - 2 * u - 3 * u, u, 3 * u, 40, true);

    // A vending machine in the next alley, glowing, with a little warm air off the top.
    const vw = 9 * u;
    const vh = Math.round(height * 0.1);
    const vx = rx + rw + 2 * u;
    glow(vx + vw / 2, G - vh / 2, vh * 1.1, 210, 0.2);
    rect(vx, G - vh, vw, vh, across(vx, vw, 150, 192, 172), true);
    rect(vx + u, G - vh + u, vw - 2 * u, vh * 0.62, down(G - vh, vh * 0.62, 246, 222));
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const cx = vx + 1.6 * u + col * 2.4 * u;
        const cy = G - vh + 2 * u + row * 3.2 * u;
        rect(cx, cy, 1.4 * u, 2 * u, [120, 150, 96][(row + col) % 3]);
        rect(cx, cy, 1.4 * u, 1, 210);
      }
    }
    rect(vx + u, G - vh * 0.3, vw - 2 * u, u, 110);
    rect(vx + 2 * u, G - 4 * u, vw - 4 * u, 2 * u, 40);
    pool(vx + vw / 2, 16 * u, 0.45);
    vents.push({ cx: vx + vw / 2, top: G - vh, width: 12 * u, lift: 0.7, reach: height * 0.15, kind: 'heat' });

    // The apartment block: concrete panels, balconies with air conditioners and laundry on the
    // near side, a corner store downstairs under a striped awning, and an antenna on the roof.
    const ax = X(0.66);
    const aw = X(0.3);
    const aTop = Y(0.6);
    rect(ax, aTop, aw, G - aTop, across(ax, aw, 62, 56, 50), true);
    for (let k = 1; k < 6; k += 1) rect(ax + (aw * k) / 6, aTop, 1, G - aTop, 46);
    rect(ax + aw - 1, aTop, 1, G - aTop, 100);
    rect(ax - 2 * u, aTop - 2 * u, aw + 4 * u, 2 * u, 68, true);
    rect(ax - 2 * u, aTop - 2 * u, aw + 4 * u, 1, 130);
    const floors = [Y(0.2), Y(0.33), Y(0.46)];
    floors.forEach((fy) => {
      rect(ax, fy, aw, 1, 40);
      rect(ax, fy + 1, aw, 1, 74);
      for (let i = 0; i < 3; i += 1) addWindow(ax + aw * (0.12 + i * 0.3), fy - height * 0.1, aw * 0.18, height * 0.075);
    });
    [floors[0], floors[2]].forEach((fy, i) => {
      rect(ax - 10 * u, fy - u, 10 * u, 2 * u, 70, true);
      rect(ax - 10 * u, fy - u, 10 * u, 1, 120);
      rect(ax - 10 * u, fy - 6 * u, u, 5 * u, 96, true);
      rect(ax - 10 * u, fy - 6 * u, 10 * u, u, 96);
      for (let bx2 = ax - 8 * u; bx2 < ax; bx2 += 2 * u) rect(bx2, fy - 5 * u, 1, 4 * u, tone(90, 0.6));
      if (i === 1) {
        rect(ax - 7 * u, fy - 6 * u, 3 * u, 5 * u, down(fy - 6 * u, 5 * u, 200, 170));
        rect(ax - 3.5 * u, fy - 6 * u, 2 * u, 3 * u, 150);
      }
      airConditioner(ax - 9 * u + u, fy - u - 6 * u, 1.2);
    });
    const store = { x: ax + aw * 0.06, w: aw * 0.5, h: height * 0.11 };
    glow(store.x + store.w / 2, G - store.h / 2, store.w * 0.8, 200, 0.15);
    rect(store.x - u, G - store.h - u, store.w + 2 * u, store.h + u, 26);
    rect(store.x, G - store.h, store.w, store.h, down(G - store.h, store.h, 236, 204));
    for (let ly = G - store.h + store.h * 0.3; ly < G - 2 * u; ly += store.h * 0.22) {
      rect(store.x, ly, store.w, 1, 130);
      for (let lx = store.x + u; lx < store.x + store.w - u; lx += 2 * u) if (random() < 0.7) rect(lx, ly - u, u, u, rand(110, 170));
    }
    rect(store.x + store.w * 0.5, G - store.h, 1, store.h, 120);
    rect(store.x - u, G - store.h - 4 * u, store.w + 2 * u, 3 * u, 186);
    rect(store.x - u, G - store.h - 2 * u, store.w + 2 * u, u, 120);
    pool(store.x + store.w / 2, 34 * u, 0.4);
    const awningTop = Y(0.155);
    const awning = poly([[ax, awningTop], [ax - 13 * u, awningTop + 5 * u], [ax - 13 * u, awningTop + 7 * u], [ax, awningTop + 2 * u]], 176, true);
    ctx.save();
    ctx.clip(awning);
    for (let lx = ax - 13 * u; lx < ax; lx += 4 * u) rect(lx, awningTop, 2 * u, 8 * u, 104);
    ctx.restore();
    rect(ax - 13 * u, awningTop + 7 * u, 13 * u, u, tone(0, 0.3));
    rect(ax + aw * 0.7, aTop - 2 * u - 16 * u, u, 16 * u, 96, true);
    rect(ax + aw * 0.7 - 4 * u, aTop - 2 * u - 12 * u, 9 * u, u, 96, true);
    rect(ax + aw * 0.7 - 2 * u, aTop - 2 * u - 8 * u, 5 * u, u, 96);

    // A block wall to the end of the street.
    const wallX = ax + aw;
    const wallTop = Y(0.07);
    rect(wallX, wallTop, width - wallX + 2, G - wallTop, 64, true);
    for (let row = 0, ly = wallTop + 2 * u; ly < G; row += 1, ly += 3 * u) {
      rect(wallX, ly, width - wallX, 1, 50);
      for (let lx = wallX + (row % 2 ? 3 * u : 0); lx < width; lx += 6 * u) rect(lx, ly, 1, 3 * u, 50);
    }
    rect(wallX, wallTop, width - wallX, 2 * u, 92);

    // Wires: two from the pole off to the left, and two across to the apartment block.
    const sag = (x0, y0, x1, y1, depth) => {
      const points = [];
      for (let x = Math.round(x0); x <= Math.round(x1); x += 1) {
        const t = (x - x0) / (x1 - x0 || 1);
        points.push([x, y0 + (y1 - y0) * t + depth * 4 * t * (1 - t)]);
      }
      return points;
    };
    const wires = [
      sag(0, Y(0.52), px - 6 * u, armY, 9 * u),
      sag(0, Y(0.45), px, Y(0.5) + 2 * u, 7 * u),
      sag(px + 9 * u, armY, ax, Y(0.5), 10 * u),
      sag(px + 6 * u, Y(0.5) + 2 * u, ax, Y(0.43), 6 * u),
    ].map((points) => ({ points, shake: 0 }));
    const perches = [[0, 0.35], [0, 0.6], [2, 0.3], [2, 0.55], [3, 0.7]].map(([wire, t]) => ({ wire, i: Math.round(t * (wires[wire].points.length - 1)) }));

    posterize(ctx, 0, 0, width, height);
    const solid = new Uint8Array(width * height);
    const maskData = mask.getImageData(0, 0, width, height).data;
    for (let i = 0; i < solid.length; i += 1) solid[i] = maskData[i * 4 + 3] > 127 ? 1 : 0;
    // Lighting or darkening a window repaints just that window.
    function toggleWindow(win) {
      win.lit = !win.lit;
      win.draw();
      posterize(ctx, win.x - 1, win.y - 1, win.w + 2, win.h + 2 + u);
    }
    return { canvas, width, height, u, G, solid, vents, wires, perches, windows, fans, toggleWindow, light: { x: ax + aw * 0.7, y: aTop - 2 * u - 17 * u } };
  }

  function drawWire(ctx, wire, clock) {
    ctx.fillStyle = tone(10);
    const n = wire.points.length;
    let last = null;
    wire.points.forEach(([x, y], i) => {
      const t = i / (n - 1);
      const wobble = wire.shake * Math.sin(Math.PI * t) * Math.sin(clock * 30) * 4;
      const py = Math.round(y + wobble);
      const from = last === null ? py : last;
      ctx.fillRect(x, Math.min(from, py), 1, Math.abs(py - from) + 1);
      last = py;
    });
  }

  function start() {
    const PIXEL = Math.max(2, Math.ceil(window.innerWidth / 720));
    const width = Math.ceil(window.innerWidth / PIXEL);
    const height = Math.ceil(window.innerHeight / PIXEL);
    const speed = SPEEDS[options.speed];
    const density = DENSITIES[options.density];
    const random = Math.random;
    const rand = (min, max) => min + random() * (max - min);
    const scene = buildScene(width, height, random);
    const { u } = scene;

    const screen = document.createElement('div');
    screen.className = 'screensaver paper-planes-screen';
    screen.setAttribute('aria-hidden', 'true');
    const [canvas, view] = makeCanvas(width, height);
    canvas.style.width = `${width * PIXEL}px`;
    canvas.style.height = `${height * PIXEL}px`;
    screen.append(canvas);
    document.body.append(screen);
    requestAnimationFrame(() => screen.classList.add('is-on'));
    const ink = view;

    // Flight, in art pixels and seconds. The angle is the plane's pitch, positive nose down.
    const S = 88 / (22 * PIXEL); // planes about 88 CSS pixels long, the nearest thing on screen
    const cruise = 0.06 * width;
    const g = 1.5 * cruise;
    const lift = g / (cruise * cruise);
    const drag = lift / 3.5; // a glide ratio of 3.5, about right for paper
    const count = Math.max(1, Math.round(Math.min(5, Math.max(2, (width * height) / 60000)) * density));

    let clock = 0;
    let gust = null;
    let nextGust = rand(3, 7);
    let nextWindow = 0.5;
    let nextLaunch = 0;
    const planes = [];
    const wisps = [];
    const streaks = [];
    const crows = scene.perches.map((perch) => ({ perch, state: 'perched', facing: random() < 0.5 ? 1 : -1, flap: 0, timer: 0 }));
    const perchAt = (crow) => scene.wires[crow.perch.wire].points[crow.perch.i];
    crows.forEach((crow) => ([crow.x, crow.y] = perchAt(crow)));

    const solidAt = (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (yi >= height) return true;
      if (xi < 0 || xi >= width || yi < 0) return false;
      return scene.solid[yi * width + xi] === 1;
    };
    // The top of whatever surface is near (x, y), if there is one within reach.
    const surfaceAt = (x, y, reach = 12) => {
      let yi = Math.round(y);
      if (solidAt(x, yi)) {
        for (let k = 0; k < reach; k += 1, yi -= 1) if (!solidAt(x, yi - 1)) return yi;
        return null;
      }
      for (let k = 0; k < reach; k += 1, yi += 1) if (solidAt(x, yi + 1)) return yi + 1;
      return null;
    };
    const updraft = (x, y) => {
      let w = 0;
      scene.vents.forEach((vent) => {
        const dx = Math.abs(x - vent.cx) / (vent.width / 2);
        if (dx >= 1 || y > vent.top) return;
        w += vent.lift * cruise * (1 - dx * dx) * Math.exp(-(vent.top - y) / vent.reach);
      });
      return w;
    };
    const windAt = (y) => {
      if (!gust) return 0;
      const t = (clock - gust.at) / gust.length;
      const d = Math.abs(y - gust.y) / gust.half;
      if (t >= 1 || d >= 1) return 0;
      return gust.dir * gust.strength * Math.sin(Math.PI * t) * (1 - d * d);
    };

    const launch = (x = -12 * S) => planes.push({
      state: 'flying',
      x,
      y: height * rand(0.08, 0.36),
      v: cruise * rand(0.95, 1.2),
      a: rand(-0.15, 0.2),
      timer: 0,
    });
    for (let i = 0; i < Math.ceil(count / 2); i += 1) launch(rand(0, width * 0.3));

    const nose = (p) => [p.x + Math.cos(p.a) * 11 * S, p.y + Math.sin(p.a) * 11 * S];
    const FOOT = () => 3 * S;

    function land(p, vx) {
      const top = surfaceAt(p.x, p.y + FOOT(), 3 * FOOT() + 6);
      Object.assign(p, { state: 'landed', vx, timer: 0 });
      if (top !== null) p.y = top - FOOT();
    }

    function crumple(p, prevX, prevY, fromAbove) {
      const r = 3.2 * S;
      Object.assign(p, {
        state: 'wad',
        r,
        x: prevX,
        y: prevY,
        vx: fromAbove ? 0.2 * p.v * Math.cos(p.a) : -0.25 * p.v * Math.cos(p.a),
        vy: fromAbove ? -0.3 * cruise : 0,
        spin: 0,
        resting: false,
        timer: 0,
        shape: Array.from({ length: 8 }, () => r * rand(0.75, 1.1)),
      });
    }

    // A wire across the path of the nose this step?
    function snagged(x0, y0, x1, y1) {
      const lo = Math.min(x0, x1);
      const hi = Math.max(x0, x1);
      return scene.wires.find((wire) => {
        const first = wire.points[0][0];
        const last = wire.points[wire.points.length - 1][0];
        if (hi < first || lo > last) return false;
        for (let x = Math.max(first, Math.floor(lo)); x <= Math.min(last, Math.ceil(hi)); x += 1) {
          const wy = wire.points[x - first][1];
          const t = x1 === x0 ? 0.5 : (x - x0) / (x1 - x0);
          const py = y0 + (y1 - y0) * Math.min(1, Math.max(0, t));
          if (Math.abs(py - wy) < 1.5) return true;
        }
        return false;
      });
    }

    function fly(p, dt) {
      const [lastNoseX, lastNoseY] = nose(p);
      const lastFoot = p.y + FOOT();
      const prevX = p.x;
      const prevY = p.y;
      const w = updraft(p.x, p.y);
      const wind = windAt(p.y);
      p.v += (g * Math.sin(p.a) - drag * p.v * p.v) * dt;
      p.v = Math.max(p.v, cruise * 0.15);
      p.a -= ((lift * p.v * p.v - g * Math.cos(p.a)) / p.v) * dt;
      // Rising air lifts the nose too, and a gust buffets it.
      p.a -= (0.6 * w / p.v) * dt;
      if (wind) p.a += (random() - 0.5) * 3 * (Math.abs(wind) / cruise) * dt;
      p.a = ((((p.a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      p.x += (p.v * Math.cos(p.a) + wind) * dt;
      p.y += (p.v * Math.sin(p.a) - w) * dt;
      const [nx, ny] = nose(p);

      // Brushing a wire twangs it; about half the time it also flips the plane over, and it
      // flutters down.
      const wire = snagged(lastNoseX, lastNoseY, nx, ny);
      if (wire && wire.shake < 0.9) {
        wire.shake = 1;
        if (random() < 0.5) {
          Object.assign(p, { state: 'tumble', vx: 0.3 * p.v * Math.cos(p.a), vy: -0.25 * cruise, spin: (random() < 0.5 ? -1 : 1) * rand(7, 11) });
          return;
        }
      }

      // Coming down onto something at a shallow angle is a landing, whether the nose or the belly
      // touches first. Anything steeper, or into the side of something, crumples it.
      const footY = p.y + FOOT();
      const hitNose = solidAt(nx, ny);
      if (hitNose || solidAt(p.x, footY)) {
        const [cx, cy, before] = hitNose ? [nx, ny, lastNoseY] : [p.x, footY, lastFoot];
        const top = surfaceAt(cx, cy);
        const fromAbove = top !== null && before <= top + 1;
        const l = surfaceAt(cx - 3, cy);
        const r = surfaceAt(cx + 3, cy);
        const slope = l !== null && r !== null ? Math.atan((r - l) / 6) : 0;
        if (fromAbove && Math.abs(p.a - slope) < 0.8) return land(p, p.v * Math.cos(p.a) + wind);
        return crumple(p, prevX, prevY, fromAbove);
      }
      if (p.x > width + 20 * S || p.x < -60 * S || p.y < -height * 0.5) p.gone = true;
    }

    // On the ground: skid to a stop on the flat, slide down a slope, drop off an edge.
    function skid(p, dt) {
      const foot = p.y + FOOT();
      const l = surfaceAt(p.x - 3, foot);
      const r = surfaceAt(p.x + 3, foot);
      const slope = l !== null && r !== null ? (r - l) / 6 : 0;
      const steep = Math.abs(slope) > 0.2;
      p.vx += g * 0.8 * Math.sin(Math.atan(slope)) * dt;
      const friction = (steep ? 0.25 : 1.2) * cruise * dt;
      p.vx = Math.sign(p.vx) * Math.max(0, Math.abs(p.vx) - friction);
      p.a += (Math.atan(slope) - p.a) * Math.min(1, dt * 10);
      if (Math.abs(p.vx) > 0.5) {
        const x = p.x + p.vx * dt;
        const top = surfaceAt(x, foot);
        if (top === null || top - foot > 4) {
          Object.assign(p, { state: 'flying', x, v: Math.max(Math.abs(p.vx), 0.45 * cruise), a: p.vx >= 0 ? 0.45 : Math.PI - 0.45 });
          return;
        }
        if (foot - top > 4) p.vx = 0;
        else {
          p.x = x;
          p.y = top - FOOT();
        }
        return;
      }
      if (!steep) p.timer += dt;
    }

    function tumble(p, dt) {
      p.vy = Math.min(p.vy + g * dt, 0.55 * cruise);
      p.vx *= 1 - Math.min(1, dt * 0.8);
      p.x += (p.vx + windAt(p.y) + Math.sin(clock * 5 + p.spin) * 0.25 * cruise) * dt;
      p.y += p.vy * dt;
      p.a += p.spin * dt;
      if (solidAt(p.x, p.y + FOOT())) {
        p.a = 0;
        land(p, 0);
      }
      if (p.x > width + 20 * S || p.x < -60 * S) p.gone = true;
    }

    function fall(p, dt) {
      if (p.resting) {
        p.timer += dt;
        return;
      }
      p.vy += 2 * g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += (p.vx * 0.3 + 2) * dt;
      if (solidAt(p.x, p.y + p.r)) {
        const top = surfaceAt(p.x, p.y + p.r, 40);
        if (top !== null) p.y = top - p.r;
        p.resting = true;
      }
    }

    // Crows leave when a plane comes close or their wire twangs, and come back a while later.
    function crowsStep(dt) {
      crows.forEach((crow) => {
        crow.flap += dt;
        if (crow.state === 'perched') {
          const wire = scene.wires[crow.perch.wire];
          const near = planes.find((p) => p.state === 'flying' && Math.hypot(p.x - crow.x, p.y - crow.y) < 26 * S);
          if (near || wire.shake > 0.3) {
            crow.state = 'away';
            crow.facing = near && near.x > crow.x ? -1 : random() < 0.5 ? 1 : -1;
            crow.vx = crow.facing * cruise * rand(0.8, 1.1);
            crow.vy = -cruise * rand(0.4, 0.7);
            crow.timer = 0;
          }
          return;
        }
        if (crow.state === 'away') {
          crow.x += crow.vx * dt;
          crow.y += crow.vy * dt;
          crow.timer += dt;
          if (crow.timer > rand(10, 16) && (crow.x < -20 || crow.x > width + 20 || crow.y < -20)) {
            crow.state = 'returning';
            const [tx, ty] = perchAt(crow);
            crow.from = [tx + (random() < 0.5 ? -1 : 1) * width * 0.4, -10];
            crow.facing = tx > crow.from[0] ? 1 : -1;
            crow.timer = 0;
          }
          return;
        }
        const [tx, ty] = perchAt(crow);
        const t = Math.min(1, crow.timer / 3);
        crow.timer += dt;
        const ease = 1 - (1 - t) ** 2;
        crow.x = crow.from[0] + (tx - crow.from[0]) * ease;
        crow.y = crow.from[1] + (ty - crow.from[1]) * ease;
        if (t >= 1) crow.state = 'perched';
      });
    }

    // Planes that have landed or crumpled sit a moment, blink, and are gone.
    const REST = 2.5;
    const BLINK = 1;
    const visible = (p) => p.timer < REST || Math.floor((p.timer - REST) * 7) % 2 === 0;

    let last = performance.now();
    let raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * speed;
      last = now;
      clock += dt;

      // Gusts come down the street at one height or another, and you can see them as streaks.
      if (!gust && clock > nextGust) {
        gust = { at: clock, length: rand(2.5, 4), y: height * rand(0.1, 0.6), half: height * rand(0.07, 0.13), dir: random() < 0.7 ? 1 : -1, strength: cruise * rand(0.7, 1.2) };
      }
      if (gust && clock - gust.at > gust.length) {
        gust = null;
        nextGust = clock + rand(5, 11);
      }
      if (gust && random() < dt * 30) {
        streaks.push({ x: rand(-20, width + 20), y: gust.y + rand(-0.85, 0.85) * gust.half, length: rand(6, 18), life: 0 });
      }
      for (let i = streaks.length - 1; i >= 0; i -= 1) {
        const streak = streaks[i];
        streak.x += windAt(streak.y) * 3 * dt;
        streak.life += dt;
        if (streak.life > 0.7 || !windAt(streak.y)) streaks.splice(i, 1);
      }

      // Warm air shimmering up from the air conditioners and the vending machine, and steam
      // from the ramen shop's kitchen fan.
      scene.vents.forEach((vent) => {
        const rate = vent.kind === 'steam' ? 3 : 5 * vent.lift;
        if (random() < rate * dt) {
          wisps.push({ kind: vent.kind, x: vent.cx + rand(-0.2, 0.2) * vent.width, y: vent.top, life: 0, max: vent.kind === 'steam' ? rand(2.5, 3.5) : rand(1, 1.8), phase: rand(0, 6), r: u * 1.5 });
        }
      });
      for (let i = wisps.length - 1; i >= 0; i -= 1) {
        const wisp = wisps[i];
        wisp.life += dt;
        wisp.y -= (updraft(wisp.x, wisp.y) * 0.8 + cruise * 0.1) * dt;
        wisp.x += (windAt(wisp.y) + Math.sin(clock * 3 + wisp.phase) * 5) * dt;
        wisp.r += dt * 1.8 * u;
        if (wisp.life > wisp.max) wisps.splice(i, 1);
      }
      scene.wires.forEach((wire) => { wire.shake = Math.max(0, wire.shake - dt * 0.8); });

      // Somebody comes home; somebody goes to bed.
      if (clock > nextWindow && scene.windows.length) {
        nextWindow = clock + rand(1.5, 4);
        scene.toggleWindow(scene.windows[Math.floor(random() * scene.windows.length)]);
      }

      if (planes.filter((p) => p.state === 'flying').length < count && clock > nextLaunch) {
        launch();
        nextLaunch = clock + rand(1.2, 3.5);
      }
      planes.forEach((p) => {
        if (p.state === 'flying') fly(p, dt);
        else if (p.state === 'landed') skid(p, dt);
        else if (p.state === 'tumble') tumble(p, dt);
        else fall(p, dt);
        if (p.timer > REST + BLINK) p.gone = true;
      });
      for (let i = planes.length - 1; i >= 0; i -= 1) if (planes[i].gone) planes.splice(i, 1);
      crowsStep(dt);

      // The scene, then what moves over it.
      ink.drawImage(scene.canvas, 0, 0);
      wisps.forEach((wisp) => {
        const t = wisp.life / wisp.max;
        if (wisp.kind === 'steam') {
          // Steam: soft puffs that spread and thin out as they rise.
          ink.fillStyle = tone(225, 0.32 * (1 - t));
          ink.beginPath();
          ink.arc(wisp.x, wisp.y, wisp.r, 0, Math.PI * 2);
          ink.fill();
        } else {
          ink.fillStyle = tone(190, 0.55 * (1 - t));
          ink.fillRect(Math.round(wisp.x), Math.round(wisp.y), 1, 2);
        }
      });
      scene.fans.forEach((fan) => {
        ink.strokeStyle = tone(110);
        ink.lineWidth = 1;
        ink.beginPath();
        for (let k = 0; k < 2; k += 1) {
          const a = clock * 9 + (k * Math.PI) / 2;
          ink.moveTo(fan.x - Math.cos(a) * fan.r, fan.y - Math.sin(a) * fan.r);
          ink.lineTo(fan.x + Math.cos(a) * fan.r, fan.y + Math.sin(a) * fan.r);
        }
        ink.stroke();
      });
      scene.wires.forEach((wire) => drawWire(ink, wire, clock));
      ink.fillStyle = tone(170, 0.45);
      streaks.forEach((streak) => ink.fillRect(Math.round(streak.x), Math.round(streak.y), Math.round(streak.length), 1));
      if (Math.floor(clock * 1.2) % 2 === 0) {
        ink.fillStyle = tone(230, 0.25);
        ink.beginPath();
        ink.arc(scene.light.x, scene.light.y, 3 * u, 0, Math.PI * 2);
        ink.fill();
        ink.fillStyle = tone(250);
        ink.fillRect(Math.round(scene.light.x) - u, Math.round(scene.light.y) - u, 2 * u, 2 * u);
      }
      crows.forEach((crow) => drawCrow(ink, crow, u));
      planes.forEach((p) => {
        if (!visible(p)) return;
        if (p.state === 'wad') drawWad(ink, p);
        else drawPlane(ink, p.x, p.y, p.a, S);
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

  // The desk accessory's preview: the street in miniature with a plane, at twice the preview's
  // size so it's sharp on a Retina screen.
  function previewImage() {
    const scene = buildScene(124, 92, seeded(11));
    const ctx = scene.canvas.getContext('2d');
    scene.wires.forEach((wire) => drawWire(ctx, wire, 0));
    drawPlane(ctx, 34, 22, 0.15, 0.85);
    return scene.canvas.toDataURL();
  }

  // Year-round modules come after Tokyo Sky in After Hours' list, so Tokyo Sky stays the default.
  window.afterHoursModules = [...(window.afterHoursModules || []), {
    id: 'paper-planes',
    name: ['Paper Planes', '紙飛行機'],
    preview: `<img src="${previewImage()}" alt="">`,
    settings: [
      { option: 'speed', label: ['Speed', '速さ'], steps: SPEEDS.length },
      { option: 'density', label: ['Density', '数'], steps: DENSITIES.length },
    ],
    options,
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
      } catch (error) {}
    },
    start,
  }];
})();
