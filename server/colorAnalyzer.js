/**
 * Eye color analyzer modeled after Unika's approach:
 * - Samples only the iris (annulus: ring between pupil and sclera)
 * - Returns percentage breakdown of each color/shade present (named shades)
 * - Uses LAB color space and delta E for perceptual accuracy
 * - Supports violet, hazel (brown+green mix), and precise shade names
 */

const sharp = require('sharp');
const path = require('path');
const pantoneData = require('./data/pantone-eye-colors.json');

// General eye color categories (Unika-style: blue, green, brown, gray, violet, etc.)
const EYE_COLOR_CATEGORIES = {
  blue: { name: 'Blue', hex: '#4682B4' },
  green: { name: 'Green', hex: '#228B22' },
  hazel: { name: 'Hazel', hex: '#8E7618' },
  brown: { name: 'Brown', hex: '#634E34' },
  gray: { name: 'Gray', hex: '#708090' },
  amber: { name: 'Amber', hex: '#FFBF00' },
  violet: { name: 'Violet', hex: '#5A5C9E' }
};

/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * RGB to LAB (perceptual color space for accurate matching)
 */
function rgbToLab(r, g, b) {
  let rn = r / 255, gn = g / 255, bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  let x = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) / 0.95047;
  let y = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722) / 1.0;
  let z = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
}

/**
 * Delta E (CIE76) perceptual color distance - more accurate than RGB
 */
function deltaE76(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return Infinity;
  const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * Find closest Pantone color(s) for a given hex (perceptual delta E)
 */
function findPantoneMatches(hex, count = 3) {
  const withDistance = pantoneData.map(p => ({
    ...p,
    distance: deltaE76(hex, p.hex)
  }));
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, count).map(({ name, hex: pantoneHex, distance }) => ({
    name: name.replace(/-/g, ' '),
    hex: pantoneHex,
    distance: Math.round(distance)
  }));
}

/**
 * Find single best Pantone name for a hex (for Unika-style named breakdown)
 */
function findBestPantoneName(hex) {
  const matches = findPantoneMatches(hex, 1);
  return matches.length ? matches[0].name : null;
}

/**
 * Get hue (0-360), saturation (0-1), luminance (0-1) from RGB
 */
function getHSL(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let s = 0, h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = (bn - rn) / d + 2 / 6;
    else h = (rn - gn) / d + 4 / 6;
    h *= 360;
  }
  return { h: h, s: s, l: l };
}

/**
 * Classify a hex into general eye color category.
 * Includes violet (Unika-style) and refined hue bands.
 */
function classifyEyeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return EYE_COLOR_CATEGORIES.gray;

  const { r, g, b } = rgb;
  const { h: hue, s: saturation, l: luminance } = getHSL(r, g, b);

  if (saturation < 0.1) return EYE_COLOR_CATEGORIES.gray;

  // Violet / blue-violet: 260–300 (distinct from blue)
  if (hue >= 260 && hue <= 300) return EYE_COLOR_CATEGORIES.violet;
  // Blue: 200–260
  if (hue >= 200 && hue < 260) return EYE_COLOR_CATEGORIES.blue;
  // Blue-green / teal: 170–200
  if (hue >= 170 && hue < 200) return saturation > 0.15 ? EYE_COLOR_CATEGORIES.green : EYE_COLOR_CATEGORIES.blue;
  // Green: 80–170
  if (hue >= 80 && hue < 170) return EYE_COLOR_CATEGORIES.green;
  // Yellow-green / hazel band: 50–80
  if (hue >= 50 && hue < 80) return EYE_COLOR_CATEGORIES.hazel;
  // Amber / gold: 35–50
  if (hue >= 35 && hue < 50) return EYE_COLOR_CATEGORIES.amber;
  // Brown / orange: 20–35
  if (hue >= 20 && hue < 35) return EYE_COLOR_CATEGORIES.brown;
  // Red-brown: 0–20 and 340–360
  if (hue >= 0 && hue < 20) return EYE_COLOR_CATEGORIES.brown;
  if (hue >= 340 && hue <= 360) return EYE_COLOR_CATEGORIES.brown;
  // Slate / gray-blue: 210–270, low sat
  if (hue >= 210 && hue <= 270 && saturation < 0.25) return EYE_COLOR_CATEGORIES.blue;

  return EYE_COLOR_CATEGORIES.gray;
}

/**
 * Find approximate pupil center: darkest region in center of image (Unika-style: natural lighting).
 */
function findPupilCenter(pixels, width, height) {
  const bytesPerPixel = 4;
  const cx = width / 2;
  const cy = height / 2;
  const searchRadius = Math.min(width, height) * 0.35;
  let bestX = cx;
  let bestY = cy;
  let bestLum = 1;
  const step = 2;

  for (let dy = -searchRadius; dy <= searchRadius; dy += step) {
    for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const i = (y * width + x) * bytesPerPixel;
      if (i + 2 >= pixels.length) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const { l: luminance } = getHSL(r, g, b);
      if (luminance < bestLum) {
        bestLum = luminance;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { cx: bestX, cy: bestY };
}

/**
 * Sample only the iris annulus (ring between pupil and sclera) for accurate eye color.
 * Unika-style: analyze the actual iris, not center rectangle.
 */
function getDominantColors(pixels, width, height, numColors = 10) {
  const bytesPerPixel = 4;
  const { cx, cy } = findPupilCenter(pixels, width, height);
  const maxRadius = Math.min(width, height) * 0.45;
  const innerRadius = maxRadius * 0.22;  // exclude pupil
  const outerRadius = maxRadius * 0.85;  // exclude sclera/skin
  const samples = [];
  const step = 1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < innerRadius || r > outerRadius) continue;
      const i = (y * width + x) * bytesPerPixel;
      if (i + 3 >= pixels.length) continue;
      const rv = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] !== undefined ? pixels[i + 3] : 255;
      if (a < 200) continue;
      const { l: luminance, s: saturation } = getHSL(rv, g, b);
      if (luminance > 0.88 || luminance < 0.08) continue;  // exclude sclera and pupil
      if (saturation < 0.04) continue;
      samples.push({ r: rv, g, b });
    }
  }

  if (samples.length < 20) {
    // Fallback: center rectangle with same filters (e.g. no clear iris)
    const xMin = Math.floor(width * 0.25);
    const xMax = Math.floor(width * 0.75);
    const yMin = Math.floor(height * 0.25);
    const yMax = Math.floor(height * 0.75);
    for (let y = yMin; y < yMax; y += 2) {
      for (let x = xMin; x < xMax; x += 2) {
        const i = (y * width + x) * bytesPerPixel;
        if (i + 3 >= pixels.length) continue;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (a < 200) continue;
        const { l: luminance, s: saturation } = getHSL(r, g, b);
        if (luminance > 0.92 || luminance < 0.06 || saturation < 0.05) continue;
        samples.push({ r, g, b });
      }
    }
  }

  if (samples.length === 0) {
    return [{ hex: '#708090', percentage: 100 }];
  }

  // Cluster in LAB for perceptual grouping (finer shades like Unika)
  const bucketSize = 20;
  const buckets = new Map();
  for (const { r, g, b } of samples) {
    const lab = rgbToLab(r, g, b);
    const Lb = Math.floor(lab.L / 4);
    const ab = Math.floor((lab.a + 128) / 16);
    const bb = Math.floor((lab.b + 128) / 16);
    const key = `${Lb}_${ab}_${bb}`;
    if (!buckets.has(key)) {
      buckets.set(key, { rSum: 0, gSum: 0, bSum: 0, count: 0 });
    }
    const bucket = buckets.get(key);
    bucket.rSum += r;
    bucket.gSum += g;
    bucket.bSum += b;
    bucket.count += 1;
  }

  const sorted = [...buckets.entries()]
    .map(([_, v]) => ({
      r: Math.round(v.rSum / v.count),
      g: Math.round(v.gSum / v.count),
      b: Math.round(v.bSum / v.count),
      count: v.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, numColors);

  const total = sorted.reduce((sum, s) => sum + s.count, 0);
  return sorted.map(s => ({
    hex: rgbToHex(s.r, s.g, s.b),
    percentage: Math.round((s.count / total) * 100)
  }));
}

/**
 * Build Unika-style named shade breakdown: aggregate by Pantone shade name, sum percentages.
 * Returns array of { name, percentage, hex } for "Slate Blue 42%, Hazel 28%, ..."
 */
function buildNamedShadeBreakdown(dominantColors) {
  const byName = new Map();
  for (const c of dominantColors) {
    const name = findBestPantoneName(c.hex);
    const key = name || c.hex;
    if (!byName.has(key)) {
      byName.set(key, { name: name || c.hex, percentage: 0, hex: c.hex });
    }
    const entry = byName.get(key);
    entry.percentage += c.percentage;
    entry.hex = c.hex; // keep representative hex
  }
  return [...byName.values()]
    .map(e => ({ ...e, percentage: Math.round(e.percentage) }))
    .filter(e => e.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Pick general eye color: prefer most saturated among top dominants.
 * If both brown and green are significant (Unika hazel), return Hazel.
 */
function pickGeneralColor(dominantColors, namedBreakdown) {
  if (!dominantColors.length) return { hex: '#708090', category: EYE_COLOR_CATEGORIES.gray };
  let best = dominantColors[0];
  let bestSat = 0;
  const brownNames = ['brown', 'chocolate', 'caramel', 'walnut', 'mocha', 'espresso', 'chestnut', 'sienna', 'umber', 'sepia', 'coffee', 'hazel', 'hazelnut', 'toffee', 'golden brown', 'amber brown', 'cocoa', 'black olive'];
  const greenNames = ['green', 'sage', 'olive', 'forest', 'sea', 'moss', 'fern', 'jade', 'teal', 'emerald', 'celadon', 'gray green', 'green haze', 'pine'];
  let brownPct = 0;
  let greenPct = 0;
  for (const e of (namedBreakdown || [])) {
    const n = (e.name || '').toLowerCase();
    if (brownNames.some(b => n.includes(b))) brownPct += e.percentage || 0;
    if (greenNames.some(g => n.includes(g))) greenPct += e.percentage || 0;
  }
  if (brownPct >= 15 && greenPct >= 15) {
    return { hex: EYE_COLOR_CATEGORIES.hazel.hex, category: EYE_COLOR_CATEGORIES.hazel };
  }
  for (const c of dominantColors.slice(0, 6)) {
    const rgb = hexToRgb(c.hex);
    if (!rgb) continue;
    const { s } = getHSL(rgb.r, rgb.g, rgb.b);
    if (s > bestSat) {
      bestSat = s;
      best = c;
    }
  }
  const category = classifyEyeColor(best.hex);
  return { hex: best.hex, category };
}

/**
 * Main analysis (Unika-style): iris annulus sampling, named shade percentages, perceptual LAB.
 */
async function analyzeEyeColor(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 400;
  const height = metadata.height || 400;

  const resizedW = Math.min(280, width);
  const resizedH = Math.min(280, height);
  const { data } = await sharp(imageBuffer)
    .resize(resizedW, resizedH)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const dominantColors = getDominantColors(data, resizedW, resizedH, 10);

  const shadeBreakdown = buildNamedShadeBreakdown(dominantColors);
  const { hex: primaryHex, category: generalCategory } = pickGeneralColor(dominantColors, shadeBreakdown);

  const breakdown = dominantColors.map(c => ({
    hex: c.hex,
    percentage: c.percentage,
    shadeName: findBestPantoneName(c.hex),
    pantoneMatches: findPantoneMatches(c.hex, 2)
  }));

  const allPantoneForGeneral = findPantoneMatches(generalCategory.hex, 5);

  return {
    generalColor: {
      name: generalCategory.name,
      hex: primaryHex,
      colorCode: primaryHex
    },
    breakdown,
    shadeBreakdown,
    pantoneMatches: allPantoneForGeneral,
    colorCode: primaryHex
  };
}

module.exports = { analyzeEyeColor, findPantoneMatches, rgbToHex, hexToRgb };
