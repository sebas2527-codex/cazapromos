const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function aplicarMarco(relPath, descuento) {
  const abs = path.join(__dirname, '..', 'public', relPath);
  if (!fs.existsSync(abs)) return relPath;
  const meta = await sharp(abs).metadata();
  const w = meta.width, h = meta.height;
  const svg = Buffer.from(`<svg width="${w}" height="${h}">
    <rect x="8" y="8" width="${w-16}" height="${h-16}" fill="none" stroke="#0E9BA4" stroke-width="6" rx="24"/>
    <rect x="${w-158}" y="24" width="134" height="66" rx="14" fill="#0E9BA4"/>
    <text x="${w-91}" y="68" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#fff" text-anchor="middle">-${descuento}%</text>
    <text x="24" y="${h-26}" font-family="Arial, sans-serif" font-size="24" fill="#0E9BA4" font-weight="bold">CazaPromos</text>
  </svg>`);
  const base = path.basename(abs);
  const out = path.join(path.dirname(abs), base.replace(/(\.\w+)$/, '-m$1'));
  await sharp(abs).composite([{ input: svg, top: 0, left: 0 }]).toFile(out);
  return relPath.replace(base, path.basename(out));
}

module.exports = { aplicarMarco };