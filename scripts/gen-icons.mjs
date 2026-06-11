// Generates the raster brand assets from the vector mark.
// Run with: npm install --no-save sharp && node scripts/gen-icons.mjs
import sharp from 'sharp';

const HEART = 'M256 444C150 360 84 290 84 208 84 148 130 108 182 108c30 0 58 16 74 46 16-30 44-46 74-46 52 0 98 40 98 100 0 82-66 152-172 236Z';

const mark = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <g transform="translate(-39 26)">
      <path d="${HEART}" fill="#A01C40"/>
      <g transform="translate(318 16) scale(0.37)">
        <path d="${HEART}" fill="#D62246"/>
      </g>
    </g>
  </g>`;

// Apple touch icons must not be transparent.
const square = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FFFFFF"/>
  ${mark(pad, pad, (size - pad * 2) / 512)}
</svg>`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  ${mark(414, 20, 0.73)}
  <text x="600" y="565" font-family="Liberation Serif" font-style="italic" font-weight="700" font-size="118" fill="#A01C40" text-anchor="middle">FilWest</text>
</svg>`;

await sharp(Buffer.from(square(180, 18))).png().toFile('public/apple-touch-icon.png');
await sharp(Buffer.from(square(512, 48))).png().toFile('public/icon-512.png');
await sharp(Buffer.from(og)).png().toFile('public/og-image.png');
console.log('done: apple-touch-icon.png, icon-512.png, og-image.png');
