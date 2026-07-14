import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const sharp = require('/usr/lib/node_modules/sharp-cli/node_modules/sharp');

// Droplet SVG: centered in 1024x1024, ~600px tall
// Four quadrants clipped to droplet shape, white pulse line through center
// Droplet: pointed top, rounded bottom, centered at (512, 512), ~280px wide, 360px tall
// The droplet path: tip at top-center, curves out to sides, rounds at bottom

const CREAM  = '#FBFAF7';
const TEAL   = '#3FA0A6';   // top-left: activity / steps
const CORAL  = '#E8820E';   // top-right: food / meals
const PURPLE = '#7B3FBF';   // bottom-left: finance
const BERRY  = '#A62A50';   // bottom-right: glucose / HR
const WHITE  = '#FFFFFF';
const BLACK  = '#111111';

// Droplet: shifted down 57px vs old design so bounding box (y=227–797) centers at y=512 in the tile
const DROPLET = `M 512 227 C 512 227, 652 377, 672 547 C 692 717, 610 797, 512 797 C 414 797, 332 717, 352 547 C 372 377, 512 227, 512 227 Z`;

// Pulse horizontal stays at y=512 (quadrant boundary / tile center); spike tips shifted +57 with droplet
const PULSE = `M 362 512 L 440 512 L 465 512 L 480 447 L 510 691 L 530 512 L 654 512`;

function iconSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  ${bg ? `<rect width="1024" height="1024" fill="${CREAM}"/>` : ''}

  <defs>
    <clipPath id="drop">
      <path d="${DROPLET}"/>
    </clipPath>
    <clipPath id="topLeft">
      <rect x="0" y="0" width="512" height="512"/>
    </clipPath>
    <clipPath id="topRight">
      <rect x="512" y="0" width="512" height="512"/>
    </clipPath>
    <clipPath id="bottomLeft">
      <rect x="0" y="512" width="512" height="512"/>
    </clipPath>
    <clipPath id="bottomRight">
      <rect x="512" y="512" width="512" height="512"/>
    </clipPath>
  </defs>

  <!-- four colour quadrants, clipped to droplet -->
  <g clip-path="url(#drop)">
    <rect x="0"   y="0"   width="512" height="512" fill="${TEAL}"   clip-path="url(#topLeft)"/>
    <rect x="512" y="0"   width="512" height="512" fill="${CORAL}"  clip-path="url(#topRight)"/>
    <rect x="0"   y="512" width="512" height="512" fill="${PURPLE}" clip-path="url(#bottomLeft)"/>
    <rect x="512" y="512" width="512" height="512" fill="${BERRY}"  clip-path="url(#bottomRight)"/>
  </g>

  <!-- droplet outline -->
  <path d="${DROPLET}" fill="none" stroke="${BLACK}" stroke-width="4"/>

  <!-- pulse line over the droplet -->
  <path d="${PULSE}" fill="none" stroke="${BLACK}" stroke-width="22"
        stroke-linecap="round" stroke-linejoin="round"
        clip-path="url(#drop)"/>
</svg>`;
}

function monoSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <clipPath id="drop">
      <path d="${DROPLET}"/>
    </clipPath>
  </defs>
  <!-- solid dark droplet with outline -->
  <path d="${DROPLET}" fill="#1A1A1A" stroke="${BLACK}" stroke-width="4"/>
  <!-- pulse line cutout rendered as white on dark -->
  <path d="${PULSE}" fill="none" stroke="${WHITE}" stroke-width="22"
        stroke-linecap="round" stroke-linejoin="round"
        clip-path="url(#drop)"/>
</svg>`;
}

const SIZE = 1024;

async function render(svgStr, outPath) {
  await sharp(Buffer.from(svgStr))
    .resize(SIZE, SIZE)
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}

const base = '/root/wellness-fresh/assets/images';

await render(iconSVG(true),  `${base}/icon.png`);
await render(iconSVG(false), `${base}/android-icon-foreground.png`);
await render(monoSVG(),      `${base}/android-icon-monochrome.png`);

// Solid cream background — just a flat colour image
await sharp({
  create: { width: SIZE, height: SIZE, channels: 4,
             background: { r: 0xFB, g: 0xFA, b: 0xF7, alpha: 1 } }
}).png().toFile(`${base}/android-icon-background.png`);
console.log('wrote', `${base}/android-icon-background.png`);

console.log('All icons generated.');
