/**
 * Analyzes an image buffer to extract dominant colors from the iris/eye region.
 * Returns general color, breakdown, hex codes, and Pantone matches.
 */

const sharp = require('sharp');
const path = require('path');
const pantoneData = require('./data/pantone-eye-colors.json');

// General eye color categories with representative hex ranges
const EYE_COLOR_CATEGORIES = {
  blue: { name: 'Blue', hex: '#4682B4', keywords: ['blue', 'slate', 'steel', 'navy', 'powder', 'sky', 'ice', 'periwinkle', 'dusk'] },
  green: { name: 'Green', hex: '#228B22', keywords: ['green', 'sage', 'olive', 'forest', 'sea', 'moss', 'fern', 'jade', 'teal', 'emerald', 'celadon'] },
  hazel: { name: 'Hazel', hex: '#8E7618', keywords: ['hazel', 'amber', 'gold', 'brown', 'green', 'olive', 'tan', 'khaki', 'honey', 'mustard'] },
  brown: { name: 'Brown', hex: '#634E34', keywords: ['brown', 'chocolate', 'caramel', 'walnut', 'mocha', 'espresso', 'chestnut', 'sienna', 'umber', 'sepia', 'coffee'] },
  gray: { name: 'Gray', hex: '#708090', keywords: ['gray', 'grey', 'slate', 'charcoal', 'silver', 'stone', 'dove', 'ash', 'pewter', 'fog', 'mist'] },
  amber: { name: 'Amber', hex: '#FFBF00', keywords: ['amber', 'gold', 'honey', 'mustard', 'wheat', 'tan'] }
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
 * Delta E (CIE76) color distance - simpler Euclidean in RGB for speed
 */
function colorDistance(hex1, hex2) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if (!a || !b) return Infinity;
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  );
}

/**
 * Find closest Pantone color(s) for a given hex
 */
function findPantoneMatches(hex, count = 3) {
  const withDistance = pantoneData.map(p => ({
    ...p,
    distance: colorDistance(hex, p.hex)
  }));
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, count).map(({ name, hex: pantoneHex, distance }) => ({
    name: name.replace(/-/g, ' '),
    hex: pantoneHex,
    distance: Math.round(distance)
  }));
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
 * Uses stricter hue/saturation ranges so we don't default to gray.
 */
function classifyEyeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return EYE_COLOR_CATEGORIES.gray;

  const { r, g, b } = rgb;
  const { h: hue, s: saturation, l: luminance } = getHSL(r, g, b);

  // Only call it gray when clearly desaturated (very low color)
  if (saturation < 0.1) return EYE_COLOR_CATEGORIES.gray;

  // Blue: hue 200–280 (wider range for blue-gray and true blue)
  if (hue >= 200 && hue <= 280) return EYE_COLOR_CATEGORIES.blue;
  // Blue-green / teal: 170–200
  if (hue >= 170 && hue < 200) return saturation > 0.15 ? EYE_COLOR_CATEGORIES.green : EYE_COLOR_CATEGORIES.blue;
  // Green: 80–170
  if (hue >= 80 && hue < 170) return EYE_COLOR_CATEGORIES.green;
  // Yellow-green / hazel: 50–80
  if (hue >= 50 && hue < 80) return EYE_COLOR_CATEGORIES.hazel;
  // Amber / gold: 35–50
  if (hue >= 35 && hue < 50) return EYE_COLOR_CATEGORIES.amber;
  // Brown / orange: 20–35
  if (hue >= 20 && hue < 35) return EYE_COLOR_CATEGORIES.brown;
  // Red-brown: 0–20 and 340–360
  if (hue >= 0 && hue < 20) return EYE_COLOR_CATEGORIES.brown;
  if (hue >= 340 && hue <= 360) return EYE_COLOR_CATEGORIES.brown;
  // Gray-blue (slate): 240–260 with low sat can stay blue
  if (hue >= 210 && hue <= 270 && saturation < 0.25) return EYE_COLOR_CATEGORIES.blue;

  return EYE_COLOR_CATEGORIES.gray;
}

/**
 * Extract dominant colors from pixel array, sampling only from the center (iris area).
 * Excludes sclera (very light) and very dark pixels so the result reflects iris color.
 */
function getDominantColors(pixels, width, height, numColors = 8) {
  const samples = [];
  const bytesPerPixel = 4;
  // Sample only from center 50% of image (where the eye guide is)
  const xMin = Math.floor(width * 0.25);
  const xMax = Math.floor(width * 0.75);
  const yMin = Math.floor(height * 0.25);
  const yMax = Math.floor(height * 0.75);
  const step = 2; // sample every 2nd pixel in center for speed

  for (let y = yMin; y < yMax; y += step) {
    for (let x = xMin; x < xMax; x += step) {
      const i = (y * width + x) * bytesPerPixel;
      if (i + 3 >= pixels.length) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] !== undefined ? pixels[i + 3] : 255;
      if (a < 200) continue;
      const { l: luminance, s: saturation } = getHSL(r, g, b);
      // Skip sclera (white of eye) and near-black
      if (luminance > 0.92 || luminance < 0.06) continue;
      // Skip very desaturated (skin often falls here when lighting is flat)
      if (saturation < 0.05) continue;
      samples.push({ r, g, b });
    }
  }

  if (samples.length === 0) {
    // Fallback: sample whole image with same filters
    for (let i = 0; i < pixels.length; i += bytesPerPixel * 2) {
      if (i + 3 >= pixels.length) continue;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      if (a < 200) continue;
      const { l: luminance, s: saturation } = getHSL(r, g, b);
      if (luminance > 0.92 || luminance < 0.06 || saturation < 0.05) continue;
      samples.push({ r, g, b });
    }
  }

  if (samples.length === 0) {
    return [{ hex: '#708090', percentage: 100 }];
  }

  const bucketSize = 24; // finer buckets for more color nuance
  const buckets = new Map();
  for (const { r, g, b } of samples) {
    const key = `${Math.floor(r / bucketSize)}_${Math.floor(g / bucketSize)}_${Math.floor(b / bucketSize)}`;
    const centerR = Math.floor(r / bucketSize) * bucketSize + bucketSize / 2;
    const centerG = Math.floor(g / bucketSize) * bucketSize + bucketSize / 2;
    const centerB = Math.floor(b / bucketSize) * bucketSize + bucketSize / 2;
    if (!buckets.has(key)) {
      buckets.set(key, { r: centerR, g: centerG, b: centerB, count: 0 });
    }
    buckets.get(key).count += 1;
  }

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, numColors);

  const total = sorted.reduce((sum, s) => sum + s.count, 0);
  return sorted.map(s => ({
    hex: rgbToHex(s.r, s.g, s.b),
    percentage: Math.round((s.count / total) * 100)
  }));
}

/**
 * Pick the best color for "general" eye label: prefer the most saturated among top dominants
 * (iris is more saturated than skin/whites).
 */
function pickGeneralColor(dominantColors) {
  if (!dominantColors.length) return { hex: '#708090', category: EYE_COLOR_CATEGORIES.gray };
  let best = dominantColors[0];
  let bestSat = 0;
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
 * Main analysis: accepts image buffer, returns full result
 */
async function analyzeEyeColor(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 400;
  const height = metadata.height || 400;

  const resizedW = Math.min(200, width);
  const resizedH = Math.min(200, height);
  const { data } = await sharp(imageBuffer)
    .resize(resizedW, resizedH)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const dominantColors = getDominantColors(data, resizedW, resizedH, 8);

  // General color = most saturated among top dominants (iris is more saturated than skin)
  const { hex: primaryHex, category: generalCategory } = pickGeneralColor(dominantColors);

  const breakdown = dominantColors.map(c => ({
    hex: c.hex,
    percentage: c.percentage,
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
    pantoneMatches: allPantoneForGeneral,
    colorCode: primaryHex
  };
}

module.exports = { analyzeEyeColor, findPantoneMatches, rgbToHex, hexToRgb };
