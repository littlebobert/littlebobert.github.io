import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(rootDirectory, 'assets', 'shadan-icon.png');
const outputPath = path.join(rootDirectory, 'assets', 'shadan-social.png');
const iconSize = 340;
// The macOS icon has a transparent margin around its rounded tile (100 px on each
// side of the 1024 px artwork); crop to the tile so it fills the same space as
// the other products' icons. The tile's own shape and dark fill need no border.
const iconTileInset = 100;
const iconTileSize = 1024 - iconTileInset * 2;
const icon = await sharp(await readFile(iconPath))
  .extract({ left: iconTileInset, top: iconTileInset, width: iconTileSize, height: iconTileSize })
  .resize(iconSize, iconSize, { fit: 'cover' })
  .png()
  .toBuffer();

const background = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#ffffff"/>
</svg>
`);

await sharp(background)
  .composite([
    { input: icon, left: 430, top: 145 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Created ${outputPath}`);
