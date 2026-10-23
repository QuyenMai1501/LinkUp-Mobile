import type { ChatBackground } from '@/types/chat';

// Adaptive readability overlay for chat backgrounds — port 1-1 từ Web
// (utils/chatReadability.ts). Solid/gradient colors are measured (luminance +
// hue) so the scrim always separates fixed-color bubbles from the theme;
// image backgrounds get a fixed neutral scrim.

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance 0..1 (WCAG weights). Unparseable → 0.5 (neutral). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hueDeg(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  if (max === r) return ((g - b) / d + (g < b ? 6 : 0)) * 60;
  if (max === g) return ((b - r) / d + 2) * 60;
  return ((r - g) / d + 4) * 60;
}

function gradientStops(value: string): string[] {
  return value.match(/#[0-9a-f]{3}(?![0-9a-f])|#[0-9a-f]{6}/gi) ?? [];
}

function tierAlpha(lum: number): number {
  if (lum > 0.6) return 0.45;
  if (lum < 0.25) return 0.35;
  return 0.3;
}

export interface OverlaySpec {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** Base scrim for a background, before the user strength multiplier. */
export function baseOverlay(bg: ChatBackground | null | undefined): OverlaySpec {
  if (!bg) return { r: 0, g: 0, b: 0, alpha: 0 };
  switch (bg.type) {
    case 'solid':
      return { r: 0, g: 0, b: 0, alpha: tierAlpha(luminance(bg.value)) };
    case 'gradient': {
      const stops = gradientStops(bg.value);
      const lum = stops.length > 0 ? Math.min(...stops.map(luminance)) : 0.5;
      return { r: 0, g: 0, b: 0, alpha: tierAlpha(lum) };
    }
    case 'preset':
    case 'custom':
      return { r: 0, g: 0, b: 0, alpha: 0.5 };
    default:
      return { r: 0, g: 0, b: 0, alpha: 0 };
  }
}

/**
 * Final overlay alpha: adaptive base × user strength percent (30–150),
 * clamped to [0, 0.9]. Missing strength = 100 (as designed).
 */
export function overlayAlpha(
  bg: ChatBackground | null | undefined,
  strength?: number | null,
): number {
  const base = baseOverlay(bg);
  if (base.alpha <= 0) return 0;
  const mult = Math.min(1.5, Math.max(0.3, (strength ?? 100) / 100));
  return Math.min(0.9, base.alpha * mult);
}

/** Chuỗi rgba(r,g,b,a) cho style; null = không cần scrim (alpha 0). */
export function overlayRgba(
  bg: ChatBackground | null | undefined,
  strength?: number | null,
): string | null {
  const base = baseOverlay(bg);
  const alpha = overlayAlpha(bg, strength);
  if (alpha <= 0) return null;
  return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha})`;
}

const CLASH_HUE_MIN = 150;
const CLASH_HUE_MAX = 200;

function stopClashes(value: string): boolean {
  const h = hueDeg(value);
  if (h === null) return false;
  const lum = luminance(value);
  return h >= CLASH_HUE_MIN && h <= CLASH_HUE_MAX && lum >= 0.18 && lum <= 0.75;
}

/**
 * Recommended overlay strength for a freshly picked theme: clashing
 * turquoise-band colors get a boost (130), everything else stays at the
 * designed default (100). Users can still override via the slider.
 */
export function recommendedStrength(bg: ChatBackground | null | undefined): number {
  if (backgroundClashes(bg)) return 130;
  return 100;
}

/**
 * True when a solid/gradient theme sits in the turquoise band at bubble-like
 * lightness — the fixed turquoise bubbles would sink into it. Images are
 * never judged (the overlay handles them); caller shows a non-blocking hint.
 */
export function backgroundClashes(bg: ChatBackground | null | undefined): boolean {
  if (!bg) return false;
  if (bg.type === 'solid') return stopClashes(bg.value);
  if (bg.type === 'gradient') return gradientStops(bg.value).some(stopClashes);
  return false;
}
