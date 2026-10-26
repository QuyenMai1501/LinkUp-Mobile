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
