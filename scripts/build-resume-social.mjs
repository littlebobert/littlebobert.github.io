import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const headshotPath = path.join(rootDirectory, 'assets', 'img-color.jpg');
// The card is 1200×630 landscape by default: text on the left, headshot on the
// right. Messages fits a preview to the bubble's width, so a wide card takes
// about half the height of the square one, which `--square` still draws.
const wide = !process.argv.includes('--square');
const outputArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const outputPath = outputArgument
  ? path.resolve(outputArgument)
  : path.join(rootDirectory, 'assets', wide ? 'resume-social.png' : 'resume-social-square.png');

const size = 960; // the square card's side
// Everything on the card is drawn at this fraction of its full size and
// centered, so the content reads smaller in link previews with more margin.
const contentScale = 0.96;
const contentInset = (size * (1 - contentScale)) / 2;
// Padding, type and spacing are laid out for a 1200px square and scaled to `size`
// and `contentScale`; the headshot's 400px is scaled by `contentScale` alone.
// The wide card is laid out at its own pixel size, so its scale is 1.
const scale = wide ? 1 : (size / 1200) * contentScale;
const width = wide ? 1200 : size;
const height = wide ? 630 : size;
const padding = wide ? 96 : Math.round(contentInset + 90 * scale); // left
// The right and bottom edges are tighter so the headshot and text sit closer to them.
const edgePadding = wide ? 80 : Math.round(contentInset + 120 * scale); // top, right and bottom
const accentBarWidth = Math.round(8 * scale);
const headshotSize = wide ? height - 2 * edgePadding : Math.round(400 * contentScale);
const headshotGap = Math.round((wide ? 64 : 48) * scale);
const headshotCornerRadius = Math.round(headshotSize * 0.16);
const headshotBorderWidth = wide ? 8 : Math.round(8 * contentScale);
// The source photo is cropped tight around the face, so zoom out by mirroring
// its left and right edges outward before cropping to a square.
const headshotZoomOut = 1.15;
const contentTop = edgePadding;
const contentRight = width - edgePadding;
const contentBottom = height - edgePadding;
// The headshot sits in the bottom-right corner, inset by the padding; on the
// wide card it fills the content height, so every line wraps beside it.
const headshotLeft = contentRight - headshotSize;
const headshotTop = contentBottom - headshotSize;
// Verdana, the same face as the resume page itself.
const fontFamily = 'Verdana';
const svgFontFamily = "Verdana, Geneva, sans-serif";

const textBlocks = (wide ? [
  { text: 'Justin Garcia', size: 64, weight: 'bold', pangoWeight: 'Bold', color: '#1a1f26', lineHeight: 1.1, spaceAfter: 28 },
  { text: 'Apple platforms and real-time speech AI product engineer. Previously at Apple', size: 42, weight: 'normal', pangoWeight: '', color: '#1a1f26', lineHeight: 1.3, spaceAfter: 24 },
  { text: 'Tokyo, Japan', size: 36, weight: 'normal', pangoWeight: '', color: '#6b7480', lineHeight: 1.25, spaceAfter: 0, pinBottom: true },
] : [
  { text: 'Justin Garcia', size: 100, weight: 'bold', pangoWeight: 'Bold', color: '#1a1f26', lineHeight: 1.1, spaceAfter: 36 },
  { text: 'Apple platforms and real-time speech AI product engineer. Previously at Apple', size: 80, weight: 'normal', pangoWeight: '', color: '#1a1f26', lineHeight: 1.25, spaceAfter: 30 },
  { text: 'Tokyo, Japan', size: 68, weight: 'normal', pangoWeight: '', color: '#6b7480', lineHeight: 1.25, spaceAfter: 0, pinBottom: true },
]).map((block) => ({ ...block, size: Math.round(block.size * scale), spaceAfter: Math.round(block.spaceAfter * scale) }));

// Both Pango markup and SVG treat text as XML, so `&` and friends need escaping.
const escapeMarkup = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const measureCache = new Map();
async function measure(text, block) {
  const key = `${block.pangoWeight}|${block.size}|${text}`;
  if (!measureCache.has(key)) {
    const font = [fontFamily, block.pangoWeight, block.size].filter(Boolean).join(' ');
    const { info } = await sharp({ text: { text: escapeMarkup(text), font, dpi: 72 } }).png().toBuffer({ resolveWithObject: true });
    measureCache.set(key, info.width);
  }
  return measureCache.get(key);
}

// Lay text out like a float: lines that would reach into the headshot or the
// gap above it stop short of it with a gap; lines above use the full width.
function lineBox(top, lineHeight) {
  const besideHeadshot = top + lineHeight > headshotTop - headshotGap;
  const width = besideHeadshot ? headshotLeft - headshotGap - padding : contentRight - padding;
  return { top, left: padding, width };
}

// Wrap each block greedily so lines fill from the top. If that would leave a
// single orphaned word on the last line, pull one word down from the line
// above it (when the result still fits).
async function wrapBlock(block, top) {
  const lineHeight = Math.round(block.size * block.lineHeight);
  const boxAt = (index) => lineBox(top + index * lineHeight, lineHeight);
  const fits = async (words, index) => (await measure(words.join(' '), block)) <= boxAt(index).width;

  const wrapped = [];
  let current = [];
  const remaining = block.text.split(' ');
  while (remaining.length > 0) {
    const candidate = [...current, remaining[0]];
    if (current.length === 0 || (await fits(candidate, wrapped.length))) {
      current.push(remaining.shift());
    } else {
      wrapped.push(current);
      current = [];
    }
  }
  if (current.length > 0) wrapped.push(current);

  const last = wrapped.at(-1);
  const previous = wrapped.at(-2);
  if (wrapped.length > 1 && last.length === 1 && previous.length > 2) {
    const moved = [previous.at(-1), ...last];
    if (await fits(moved, wrapped.length - 1)) {
      previous.pop();
      wrapped[wrapped.length - 1] = moved;
    }
  }
  return wrapped;
}

const lines = [];
let cursorY = contentTop;
for (const block of textBlocks) {
  const lineHeight = Math.round(block.size * block.lineHeight);
  let top = cursorY;
  if (block.pinBottom) {
    // Pinned blocks sit in the column beside the headshot with their last
    // line's descenders resting on the same bottom edge as the headshot.
    const wrapped = await wrapBlock(block, headshotTop);
    const descent = Math.round(block.size * 0.22);
    top = contentBottom - descent - Math.round(block.size * 0.9) - (wrapped.length - 1) * lineHeight;
    if (top < cursorY) {
      throw new Error(`Pinned block "${block.text}" collides with the text above it`);
    }
  }
  for (const lineWords of await wrapBlock(block, top)) {
    const box = lineBox(top, lineHeight);
    lines.push({ text: lineWords.join(' '), block, x: box.left, baseline: top + Math.round(block.size * 0.9) });
    top += lineHeight;
  }
  cursorY = top + block.spaceAfter;
}

for (const line of lines) {
  const width = await measure(line.text, line.block);
  if (line.x + width > contentRight) {
    throw new Error(`Line "${line.text}" overflows the right padding by ${line.x + width - contentRight}px`);
  }
}

const roundedCornerMask = Buffer.from(`
<svg width="${headshotSize}" height="${headshotSize}" viewBox="0 0 ${headshotSize} ${headshotSize}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${headshotSize}" height="${headshotSize}" rx="${headshotCornerRadius}" fill="#ffffff"/>
</svg>
`);
const headshotSource = await readFile(headshotPath);
const { width: headshotSourceWidth } = await sharp(headshotSource).metadata();
const headshotSidePadding = Math.round((headshotSourceWidth * (headshotZoomOut - 1)) / 2);
const zoomedOutHeadshot = await sharp(headshotSource)
  .extend({ left: headshotSidePadding, right: headshotSidePadding, extendWith: 'mirror' })
  .toBuffer();
const headshot = await sharp(zoomedOutHeadshot)
  .resize(headshotSize, headshotSize, { fit: 'cover', position: 'top' })
  .composite([{ input: roundedCornerMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

const headshotBorder = Buffer.from(`
<svg width="${headshotSize}" height="${headshotSize}" viewBox="0 0 ${headshotSize} ${headshotSize}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${headshotBorderWidth / 2}"
    y="${headshotBorderWidth / 2}"
    width="${headshotSize - headshotBorderWidth}"
    height="${headshotSize - headshotBorderWidth}"
    rx="${headshotCornerRadius - headshotBorderWidth / 2}"
    fill="none"
    stroke="#dfe5ea"
    stroke-width="${headshotBorderWidth}"
  />
</svg>
`);

const textElements = lines
  .map(
    (line) =>
      `<text x="${line.x}" y="${line.baseline}" font-family="${svgFontFamily}" font-weight="${line.block.weight}" font-size="${line.block.size}" fill="${line.block.color}">${escapeMarkup(line.text)}</text>`,
  )
  .join('\n  ');

const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3f5f7"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="${padding - Math.round(50 * scale)}" y="${contentTop}" width="${accentBarWidth}" height="${contentBottom - contentTop}" rx="${accentBarWidth / 2}" fill="#3b82f6"/>
  ${textElements}
</svg>
`);

await sharp(background)
  .composite([
    { input: headshot, left: headshotLeft, top: headshotTop },
    { input: headshotBorder, left: headshotLeft, top: headshotTop },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
