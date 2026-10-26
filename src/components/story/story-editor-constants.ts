import { Platform } from 'react-native';
import { matchFont, type SkFont, type Transforms3d } from '@shopify/react-native-skia';

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/** Web logical canvas = 405px wide → multiply web px values by C for canvas space. */
const C = CANVAS_W / 405;

/** Canvas px per web px — panels show web-scale numbers (18–120) while storing canvas px. */
export const CANVAS_PER_WEB = C;

export interface StoryTransform {
  scale: number;
  tx: number;
  ty: number;
}

export const IDENTITY_TRANSFORM: StoryTransform = { scale: 1, tx: 0, ty: 0 };

export const TEXT_SIZE_MIN = Math.round(18 * C);
export const TEXT_SIZE_MAX = Math.round(120 * C);

export type FontKey = 'default' | 'serif' | 'mono';

const FONT_FAMILIES: Record<FontKey, string> =
  Platform.OS === 'ios'
    ? { default: 'Helvetica Neue', serif: 'Georgia', mono: 'Courier New' }
    : { default: 'sans-serif', serif: 'serif', mono: 'monospace' };

export const FONT_OPTIONS: { key: FontKey; label: string }[] = [
  { key: 'default', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono', label: 'Mono' },
];

export interface TextPanelStyle {
  fontFamily: FontKey;
  fontSize: number;
  fill: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  underline: boolean;
  gradient: { from: string; to: string } | null;
  stroke: string | null;
  strokeWidth: number;
  highlight: string | null;
}

export const DEFAULT_TEXT_STYLE: TextPanelStyle = {
  fontFamily: 'default',
  fontSize: Math.round(40 * C),
  fill: '#FFFFFF',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textAlign: 'center',
  underline: false,
  gradient: null,
  stroke: null,
  strokeWidth: 0,
  highlight: null,
};

export interface TypePreset {
  id: string;
  label: string;
  style: Partial<TextPanelStyle>;
}

export const TYPE_PRESETS: TypePreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    style: { fontWeight: 'bold', fill: '#FFFFFF', gradient: null, stroke: null, strokeWidth: 0, highlight: null },
  },
  {
    id: 'gradient',
    label: 'Gradient',
    style: { gradient: { from: '#FFD600', to: '#FF6F00' }, stroke: null, strokeWidth: 0, highlight: null, fill: '#FFFFFF' },
  },
  {
    id: 'neon',
    label: 'Neon',
    style: { gradient: { from: '#00F5FF', to: '#9C27B0' }, stroke: '#000000', strokeWidth: Math.round(6 * C), highlight: null, fill: '#FFFFFF' },
  },
  {
    id: 'outline',
    label: 'Outline',
    style: { fill: '#FFFFFF', gradient: null, stroke: '#000000', strokeWidth: Math.round(10 * C), highlight: null },
  },
  {
    id: 'caption',
    label: 'Caption',
    style: { fill: '#FFFFFF', gradient: null, stroke: null, strokeWidth: 0, highlight: '#000000', textAlign: 'left' },
  },
  {
    id: 'playful',
    label: 'Playful',
    style: { fontFamily: 'serif', gradient: { from: '#FFECB3', to: '#FFB300' }, stroke: '#000000', strokeWidth: Math.round(4 * C), highlight: null, fontSize: Math.round(56 * C) },
  },
];

export const COLOR_PRESETS = [
  '#FFFFFF',
  '#000000',
  '#12A5A1',
  '#FF6F00',
  '#E91E63',
  '#F44336',
  '#FFD600',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
];

export const OUTLINE_COLORS = ['#000000', '#FFFFFF', '#FFD600', '#E91E63', '#12A5A1'];
export const HIGHLIGHT_COLORS = ['#000000', '#FFD600', '#FFECB3', '#4CAF50', '#2196F3'];

export interface StickerDef {
  id: string;
  emoji: string;
}

export const STICKERS: StickerDef[] = [
  { id: 'like', emoji: '👍' },
  { id: 'heart', emoji: '❤️' },
  { id: 'laugh', emoji: '😂' },
  { id: 'fire', emoji: '🔥' },
  { id: 'party', emoji: '🎉' },
  { id: 'cool', emoji: '😎' },
  { id: 'crown', emoji: '👑' },
  { id: 'bolt', emoji: '⚡' },
  { id: 'gem', emoji: '💎' },
  { id: 'rocket', emoji: '🚀' },
  { id: 'rainbow', emoji: '🌈' },
  { id: 'cat', emoji: '🐱' },
  { id: 'flower', emoji: '🌸' },
  { id: 'star', emoji: '⭐' },
  { id: 'sun', emoji: '☀️' },
  { id: 'chat', emoji: '💬' },
  { id: 'music', emoji: '🎵' },
  { id: 'trophy', emoji: '🏆' },
];

export const STICKER_ASSETS: Record<string, number> = {
  like: require('@/assets/images/stickers/like.png'),
  heart: require('@/assets/images/stickers/heart.png'),
  laugh: require('@/assets/images/stickers/laugh.png'),
  fire: require('@/assets/images/stickers/fire.png'),
  party: require('@/assets/images/stickers/party.png'),
  cool: require('@/assets/images/stickers/cool.png'),
  crown: require('@/assets/images/stickers/crown.png'),
  bolt: require('@/assets/images/stickers/bolt.png'),
  gem: require('@/assets/images/stickers/gem.png'),
  rocket: require('@/assets/images/stickers/rocket.png'),
  rainbow: require('@/assets/images/stickers/rainbow.png'),
  cat: require('@/assets/images/stickers/cat.png'),
  flower: require('@/assets/images/stickers/flower.png'),
  star: require('@/assets/images/stickers/star.png'),
  sun: require('@/assets/images/stickers/sun.png'),
  chat: require('@/assets/images/stickers/chat.png'),
  music: require('@/assets/images/stickers/music.png'),
  trophy: require('@/assets/images/stickers/trophy.png'),
};

/** Sticker drawn size in canvas px (web: 120px box on 405 canvas). */
export const STICKER_BASE = Math.round(120 * C);

export interface LayerBase {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  style: TextPanelStyle;
}

export interface StickerLayer extends LayerBase {
  type: 'sticker';
  stickerId: string;
}

export type StoryLayer = TextLayer | StickerLayer;

export interface StoryEditorDoc {
  bg: StoryTransform;
  layers: StoryLayer[];
  strokes: Stroke[];
  filter: StoryFilterState;
}

export function emptyDoc(): StoryEditorDoc {
  return {
    bg: { ...IDENTITY_TRANSFORM },
    layers: [],
    strokes: [],
    filter: { ...DEFAULT_FILTER },
  };
}

// ---- P3: brush (ve tay) ----

/** Web logical sizes 2–24px → canvas px (store canvas, display web units). */
export const BRUSH_SIZE_MIN = Math.round(2 * C);
export const BRUSH_SIZE_MAX = Math.round(24 * C);

export interface BrushGradient {
  enabled: boolean;
  from: string;
  to: string;
}

export interface BrushState {
  color: string;
  size: number;
  gradient: BrushGradient;
  eraser: boolean;
}

export const DEFAULT_BRUSH: BrushState = {
  color: '#FFFFFF',
  size: Math.round(6 * C),
  gradient: { enabled: false, from: '#FFFFFF', to: '#FF6BD6' },
  eraser: false,
};

export interface Stroke {
  id: string;
  points: number[];
  color: string;
  width: number;
  gradient: { from: string; to: string } | null;
}

export interface StrokePathResult {
  d: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Smoothed quadratic path (midpoint control) + bounding box — web GradientPencilBrush parity. */
export function strokePathAndBounds(pts: number[]): StrokePathResult {
  'worklet';
  if (!pts.length) return { d: '', minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  const n = pts.length / 2;
  let d = `M ${pts[0]} ${pts[1]}`;
  if (n === 1) return { d, minX, minY, maxX, maxY };
  for (let i = 1; i < n - 1; i++) {
    const cx = pts[i * 2];
    const cy = pts[i * 2 + 1];
    const mx = (cx + pts[(i + 1) * 2]) / 2;
    const my = (cy + pts[(i + 1) * 2 + 1]) / 2;
    d += ` Q ${cx} ${cy} ${mx} ${my}`;
  }
  d += ` L ${pts[(n - 1) * 2]} ${pts[(n - 1) * 2 + 1]}`;
  return { d, minX, minY, maxX, maxY };
}

function distToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

export function hitStroke(s: Stroke, x: number, y: number, tol: number): boolean {
  const p = s.points;
  if (p.length < 2) return false;
  const lim = s.width / 2 + tol;
  const limSq = lim * lim;
  if (p.length === 2) {
    const dx = x - p[0];
    const dy = y - p[1];
    return dx * dx + dy * dy <= limSq;
  }
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distToSegmentSq(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= limSq) return true;
  }
  return false;
}

// ---- P3: filter (css filter formulas từ web FilterPanel.cssFilter) ----

export type FilterPresetId = 'original' | 'bw' | 'warm' | 'cool' | 'vintage' | 'dramatic';

export const FILTER_PRESETS: FilterPresetId[] = [
  'original',
  'bw',
  'warm',
  'cool',
  'vintage',
  'dramatic',
];

export interface StoryFilterState {
  id: FilterPresetId;
  intensity: number;
}

export const DEFAULT_FILTER: StoryFilterState = { id: 'original', intensity: 1 };

type Mat = number[];

function matMul(a: Mat, b: Mat): Mat {
  const out = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

function matGrayscale(i: number): Mat {
  const g = [0.2126, 0.7152, 0.0722];
  return [
    1 - i + i * g[0], i * g[1], i * g[2], 0, 0,
    i * g[0], 1 - i + i * g[1], i * g[2], 0, 0,
    i * g[0], i * g[1], 1 - i + i * g[2], 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function matSepia(s: number): Mat {
  const mix = (target: number) => 1 + s * (target - 1);
  return [
    mix(0.393), s * 0.769, s * 0.189, 0, 0,
    s * 0.349, mix(0.686), s * 0.168, 0, 0,
    s * 0.272, s * 0.534, mix(0.131), 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function matSaturate(s: number): Mat {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function matBrightness(b: number): Mat {
  return [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

function matContrast(c: number): Mat {
  const o = 0.5 - 0.5 * c;
  return [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
}

function matHueRotate(deg: number): Mat {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + 0.787 * c - 0.213 * s, 0.715 - 0.715 * c - 0.715 * s, 0.072 - 0.072 * c + 0.928 * s, 0, 0,
    0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.14 * s, 0.072 - 0.072 * c - 0.283 * s, 0, 0,
    0.213 - 0.213 * c - 0.787 * s, 0.715 - 0.715 * c + 0.715 * s, 0.072 + 0.928 * c + 0.072 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Skia ColorMatrix (4x5 row-major, 20 số) — null = original (không filter). */
export function filterMatrix(id: FilterPresetId, intensity: number): number[] | null {
  const i = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  switch (id) {
    case 'bw':
      return matGrayscale(i);
    case 'warm':
      return matMul(
        matHueRotate(12 * i),
        matMul(matBrightness(1 + 0.06 * i), matMul(matSaturate(1 + 0.3 * i), matSepia(0.4 * i))),
      );
    case 'cool':
      return matMul(
        matBrightness(1 + 0.05 * i),
        matMul(matSaturate(1 - 0.1 * i), matHueRotate(12 * i)),
      );
    case 'vintage':
      return matMul(
        matBrightness(1 + 0.06 * i),
        matMul(matContrast(1 - 0.1 * i), matSepia(0.5 * i)),
      );
    case 'dramatic':
      return matMul(
        matSaturate(1 + 0.2 * i),
        matMul(matBrightness(1 - 0.05 * i), matContrast(1 + 0.35 * i)),
      );
    default:
      return null;
  }
}

export function buildFont(style: TextPanelStyle): SkFont {
  return matchFont({
    fontFamily: FONT_FAMILIES[style.fontFamily],
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
  });
}

export interface TextLineLayout {
  text: string;
  x: number;
  w: number;
  baseline: number;
}

export interface TextLayout {
  lines: TextLineLayout[];
  blockW: number;
  blockH: number;
  lineHeight: number;
}

export function layoutText(text: string, font: SkFont, style: TextPanelStyle): TextLayout {
  const lineHeight = Math.round(style.fontSize * 1.3);
  const raw = text.split('\n');
  const metrics = font.getMetrics();
  const ascent = Math.max(1, -(metrics.ascent ?? -style.fontSize * 0.8));
  const descent = Math.max(1, metrics.descent ?? style.fontSize * 0.2);
  const contentH = ascent + descent;
  const widths = raw.map((line) => (line.length ? font.measureText(line).width : 0));
  const blockW = Math.max(1, ...widths);
  const lines: TextLineLayout[] = raw.map((line, i) => {
    const w = widths[i];
    const x =
      style.textAlign === 'left'
        ? 0
        : style.textAlign === 'right'
          ? blockW - w
          : (blockW - w) / 2;
    const baseline = i * lineHeight + (lineHeight - contentH) / 2 + ascent;
    return { text: line, x, w, baseline };
  });
  return { lines, blockW, blockH: raw.length * lineHeight, lineHeight };
}

export function layerTf(x: number, y: number, scale: number, rotation: number): Transforms3d {
  'worklet';
  return [
    { translateX: x },
    { translateY: y },
    { rotate: rotation },
    { scaleX: scale },
    { scaleY: scale },
  ];
}

export interface LayerBox {
  id: string;
  cx: number;
  cy: number;
  s: number;
  r: number;
  hw: number;
  hh: number;
}

export function hitTestLayer(boxes: LayerBox[], px: number, py: number): string | null {
  'worklet';
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const dx = px - b.cx;
    const dy = py - b.cy;
    const cos = Math.cos(-b.r);
    const sin = Math.sin(-b.r);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    if (Math.abs(rx / b.s) <= b.hw && Math.abs(ry / b.s) <= b.hh) return b.id;
  }
  return null;
}
