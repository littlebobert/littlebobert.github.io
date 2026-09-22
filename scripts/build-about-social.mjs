// Rebuilds assets/about-social.png (the onemorething.tokyo link preview) with
// the About desktop icon drawn larger. The photo and the "About" label are
// lifted from the original screenshot-based image, kept in the scratch copy at
// assets/about-social-source.png, and scaled up; the icon frame, shadow and
// checkerboard are redrawn at the new scale.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDirectory, 'assets', 'about-social-source.png');
const outputPath = path.join(rootDirectory, 'assets', 'about-social.png');

const width = 1200;
const height = 630;
const scale = 1.5;

// Geometry of the icon in the source image (measured pixel by pixel).
const source = {
  photo: { left: 521, top: 215, size: 152 },
  border: 4,
  inset: 1,
  shadow: 6,
  label: { left: 529, top: 385, width: 137, height: 34 },
  labelGap: 14, // from the bottom of the icon frame to the top of the label box
};

const checkerCell = 4;
const checkerLight = 255;
const checkerDark = 204;

const photoSize = Math.round(source.photo.size * scale);
const border = Math.round(source.border * scale);
const inset = Math.round(source.inset * scale);
const shadow = Math.round(source.shadow * scale);
const frameSize = border + photoSize + inset + border;
const labelWidth = Math.round(source.label.width * scale);
const labelHeight = Math.round(source.label.height * scale);
const labelGap = Math.round(source.labelGap * scale);

const totalWidth = frameSize + shadow;
const totalHeight = frameSize + shadow + labelGap + labelHeight;
const frameLeft = Math.round((width - totalWidth) / 2);
const frameTop = Math.round((height - totalHeight) / 2);
const labelLeft = Math.round((width - labelWidth) / 2);
const labelTop = frameTop + frameSize + labelGap;

const checker = Buffer.alloc(width * height);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const dark = (Math.floor(x / checkerCell) + Math.floor(y / checkerCell)) % 2 === 0;
    checker[y * width + x] = dark ? checkerDark : checkerLight;
  }
}

const photo = await sharp(sourcePath)
  .extract({ left: source.photo.left, top: source.photo.top, width: source.photo.size, height: source.photo.size })
  .resize(photoSize, photoSize, { kernel: 'lanczos3' })
  .png()
  .toBuffer();

// The label is pure black on white, so re-threshold it after scaling to keep
// the pixel edges crisp.
const label = await sharp(sourcePath)
  .extract(source.label)
  .resize(labelWidth, labelHeight, { kernel: 'lanczos3' })
  .greyscale()
  .threshold(128)
  .png()
  .toBuffer();

const frame = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${frameLeft + shadow}" y="${frameTop + shadow}" width="${frameSize}" height="${frameSize}" fill="#000"/>
  <rect x="${frameLeft}" y="${frameTop}" width="${frameSize}" height="${frameSize}" fill="#000"/>
  <rect x="${frameLeft + border}" y="${frameTop + border}" width="${photoSize + inset}" height="${photoSize + inset}" fill="#fff"/>
</svg>
`);

await sharp(checker, { raw: { width, height, channels: 1 } })
  .png()
  .composite([
    { input: frame, left: 0, top: 0 },
    { input: photo, left: frameLeft + border, top: frameTop + border },
    { input: label, left: labelLeft, top: labelTop },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
