import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Kehai's social preview: the faceted glass app icon centred on white, sized like the other
// products' previews. Its cream would fade into the white, so it sits on a soft shadow, as
// Umete's LinkedIn images do.
//
//     node scripts/build-kehai-social.mjs [--linkedin DIR]
//
// With --linkedin, also writes LinkedIn's square icon (1200 x 1200, on white) and link image
// (1200 x 627, on light grey) into DIR, matching Umete's. The icon is the Kehai repository's
// Kehai/Resources/AppIconSource.png, or KEHAI_ICON.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = process.env.KEHAI_ICON ?? path.join(rootDirectory, '..', 'kehai', 'Kehai', 'Resources', 'AppIconSource.png');
const outputPath = path.join(rootDirectory, 'assets', 'kehai-social.png');
const source = await readFile(iconPath);

/** The icon at `size` in its rounded shape, on a soft shadow, on a `width` x `height` canvas. */
async function iconOn({ width, height, size, background }) {
  const radius = Math.round(size * 0.2237);
  const mask = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`);
  const icon = await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const left = Math.round((width - size) / 2);
  const top = Math.round((height - size) / 2);
  const blur = Math.round(size * 0.06);
  const shadow = await sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${left + size * 0.03}" y="${top + size * 0.05}" width="${size * 0.94}" height="${size * 0.96}" rx="${radius}" fill="#000" fill-opacity="0.22"/></svg>`))
    .blur(blur)
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: shadow, left: 0, top: 0 }, { input: icon, left, top }])
    .flatten({ background })
    .png({ compressionLevel: 9 });
}

await (await iconOn({ width: 1200, height: 630, size: 340, background: '#ffffff' })).toFile(outputPath);
console.log(`Created ${outputPath}`);

const linkedinIndex = process.argv.indexOf('--linkedin');
if (linkedinIndex !== -1) {
  const directory = path.resolve(process.argv[linkedinIndex + 1] ?? '.');
  await mkdir(directory, { recursive: true });
  const square = path.join(directory, 'kehai-linkedin-icon.png');
  const link = path.join(directory, 'kehai-linkedin-link.png');
  await (await iconOn({ width: 1200, height: 1200, size: 720, background: '#ffffff' })).toFile(square);
  await (await iconOn({ width: 1200, height: 627, size: 400, background: '#f4f4f2' })).toFile(link);
  console.log(`Created ${square}\nCreated ${link}`);
}
