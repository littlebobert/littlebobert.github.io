import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const headshotPath = path.join(rootDirectory, 'assets', 'img-color.jpg');
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDirectory, 'assets', 'resume-social.png');

const size = 960;
// Padding, type and spacing are laid out for a 1200px square and scaled to `size`;
// the headshot keeps its absolute size.
const scale = size / 1200;
const padding = Math.round(90 * scale); // left
// The right and bottom edges are tighter so the headshot and text sit closer to them.
const edgePadding = Math.round(120 * scale); // top, right and bottom
const accentBarWidth = Math.round(8 * scale);
const headshotSize = 400;
const headshotGap = Math.round(48 * scale);
const headshotCornerRadius = Math.round(headshotSize * 0.16);
const headshotBorderWidth = 8;
const contentRight = size - edgePadding;
// The headshot sits in the bottom-right corner, inset by the padding.
const headshotLeft = contentRight - headshotSize;
const headshotTop = contentRight - headshotSize;
// Verdana, the same face as the resume page itself.
const fontFamily = 'Verdana';
const svgFontFamily = "Verdana, Geneva, sans-serif";

const textBlocks = [
  { text: 'Justin Garcia', size: 116, weight: 'bold', pangoWeight: 'Bold', color: '#1a1f26', lineHeight: 1.1, spaceAfter: 36 },
  { text: 'Product engineer, iOS and real-time speech AI. Previously at Apple', size: 80, weight: 'normal', pangoWeight: '', color: '#1a1f26', lineHeight: 1.25, spaceAfter: 30 },
  { text: 'Tokyo, Japan', size: 68, weight: 'normal', pangoWeight: '', color: '#6b7480', lineHeight: 1.25, spaceAfter: 0, pinBottom: true },
].map((block) => ({ ...block, size: Math.round(block.size * scale), spaceAfter: Math.round(block.spaceAfter * scale) }));

const measureCache = new Map();
async function measure(text, block) {
  const key = `${block.pangoWeight}|${block.size}|${text}`;
  if (!measureCache.has(key)) {
    const font = [fontFamily, block.pangoWeight, block.size].filter(Boolean).join(' ');
    const { info } = await sharp({ text: { text, font, dpi: 72 } }).png().toBuffer({ resolveWithObject: true });
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
let cursorY = edgePadding;
for (const block of textBlocks) {
  const lineHeight = Math.round(block.size * block.lineHeight);
  let top = cursorY;
  if (block.pinBottom) {
    // Pinned blocks sit in the column beside the headshot with their last
    // line's descenders resting on the same bottom edge as the headshot.
    const wrapped = await wrapBlock(block, headshotTop);
    const descent = Math.round(block.size * 0.22);
    top = contentRight - descent - Math.round(block.size * 0.9) - (wrapped.length - 1) * lineHeight;
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
const headshot = await sharp(await readFile(headshotPath))
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
      `<text x="${line.x}" y="${line.baseline}" font-family="${svgFontFamily}" font-weight="${line.block.weight}" font-size="${line.block.size}" fill="${line.block.color}">${line.text}</text>`,
  )
  .join('\n  ');

const background = Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3f5f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect x="${padding - Math.round(50 * scale)}" y="${edgePadding}" width="${accentBarWidth}" height="${contentRight - edgePadding}" rx="${accentBarWidth / 2}" fill="#3b82f6"/>
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
