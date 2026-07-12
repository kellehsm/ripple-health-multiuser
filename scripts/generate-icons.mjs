import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const sharp = require('/usr/lib/node_modules/sharp-cli/node_modules/sharp');

// Droplet SVG: centered in 1024x1024, ~600px tall
// Four quadrants clipped to droplet shape, white pulse line through center
// Droplet: pointed top, rounded bottom, centered at (512, 512), ~280px wide, 360px tall
// The droplet path: tip at top-center, curves out to sides, rounds at bottom

const CREAM = '#FBFAF7';
const TEAL  = '#1D9E75';
const CORAL = '#D85A30';
const BLUE  = '#378ADD';
const AMBER = '#EF9F27';
const WHITE = '#FFFFFF';

// Droplet: tip at (512, 170), widens, rounded bottom center at (512, 730)
// Width ~280 at equator (y=512), radius at bottom ~160
const DROPLET = `
  M 512 170
  C 512 170, 652 320, 672 490
  C 692 660, 610 740, 512 740
  C 414 740, 332 660, 352 490
  C 372 320, 512 170, 512 170
  Z
`.trim().replace(/\s+/g, ' ');

// Pulse line: horizontal across center of droplet, with an ECG spike
// Entry ~370, flat to 440, spike up to 360 at 480, down to 620 at 510, back to 512 at 540, flat to 654
const PULSE = `M 362 512 L 440 512 L 465 512 L 480 390 L 510 634 L 530 512 L 654 512`;

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
    <rect x="0"   y="0"   width="512" height="512" fill="${TEAL}"  clip-path="url(#topLeft)"/>
    <rect x="512" y="0"   width="512" height="512" fill="${CORAL}" clip-path="url(#topRight)"/>
    <rect x="0"   y="512" width="512" height="512" fill="${BLUE}"  clip-path="url(#bottomLeft)"/>
    <rect x="512" y="512" width="512" height="512" fill="${AMBER}" clip-path="url(#bottomRight)"/>
  </g>

  <!-- pulse line over the droplet -->
  <path d="${PULSE}" fill="none" stroke="${WHITE}" stroke-width="22"
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
  <!-- solid dark droplet -->
  <path d="${DROPLET}" fill="#1A1A1A"/>
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
