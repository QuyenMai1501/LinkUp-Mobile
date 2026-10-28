/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/preserve-manual-memoization -- gesture/worklet callbacks đọc ref + ghi SharedValue chủ đích, không chạy trong render */
import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Blur,
  Canvas,
  ColorMatrix,
  DashPathEffect,
  FilterMode,
  Group,
  Image,
  ImageFormat,
  LinearGradient,
  MipmapMode,
  Path,
  Rect,
  Skia,
  Text,
  useImage,
  type CanvasRef,
  type SkImage,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import StoryEditorBrushPanel from './story-editor-brush-panel';
import StoryEditorFilterPanel from './story-editor-filter-panel';
import StoryEditorStickerPanel from './story-editor-sticker-panel';
import StoryEditorTextPanel from './story-editor-text-panel';
import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_BRUSH,
  DEFAULT_TEXT_STYLE,
  IDENTITY_TRANSFORM,
  STICKER_ASSETS,
  STICKER_BASE,
  buildFont,
  filterMatrix,
  hitStroke,
  hitTestLayer,
  layerTf,
  layoutText,
  strokePathAndBounds,
  type BrushState,
  type FilterPresetId,
  type LayerBox,
  type StickerDef,
  type StickerLayer,
  type StoryEditorDoc,
  type StoryFilterState,
  type StoryLayer,
  type Stroke,
  type TextLayer,
} from './story-editor-constants';

const BG_BLUR = 90;
const SELECTION_COLOR = '#12A5A1';
const COMMIT_DELAY_MS = 80;
const BG_SCALE_MIN = 0.5;
const BG_SCALE_MAX = 6;
const LAYER_SCALE_MIN = 0.2;
const LAYER_SCALE_MAX = 6;
const TEXT_MAX = 300;
const ERASE_TOL = 12;
const LIVE_PATH_EMPTY = 'M -100000 -100000';
const DRAW_MIN_D2 = 4;

export interface StoryEditorHandle {
  flush: () => Promise<string | null>;
}

interface StoryEditorProps {
  ref?: Ref<StoryEditorHandle>;
  uri: string;
  doc: StoryEditorDoc;
  onChange: (doc: StoryEditorDoc) => void;
  index: number;
  total: number;
  width: number;
  height: number;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function boxFor(l: StoryLayer): LayerBox {
  if (l.type === 'sticker') {
    const h = (STICKER_BASE / 2) * 1.1;
    return { id: l.id, cx: l.x, cy: l.y, s: l.scale, r: l.rotation, hw: h, hh: h };
  }
  const font = buildFont(l.style);
  const layout = layoutText(l.text, font, l.style);
  const hw = Math.max(layout.blockW / 2 + l.style.strokeWidth + 12, l.style.fontSize * 0.5);
  const hh = Math.max(layout.blockH / 2 + l.style.strokeWidth + 12, l.style.fontSize * 0.45);
  return { id: l.id, cx: l.x, cy: l.y, s: l.scale, r: l.rotation, hw, hh };
}

interface LayerNodeProps {
  layer: StoryLayer;
  tf: Transforms3d | SharedValue<Transforms3d>;
  selected: boolean;
}

function StickerNode({ layer, tf, selected }: LayerNodeProps) {
  const img = useImage(STICKER_ASSETS[(layer as StickerLayer).stickerId]);
  const half = STICKER_BASE / 2;
  if (!img) return null;
  return (
    <Group transform={tf}>
      <Image image={img} x={-half} y={-half} width={STICKER_BASE} height={STICKER_BASE} antiAlias />
      {selected && (
        <Rect
          x={-half - 8}
          y={-half - 8}
          width={STICKER_BASE + 16}
          height={STICKER_BASE + 16}
          color={SELECTION_COLOR}
          strokeWidth={4}
          style="stroke"
          antiAlias>
          <DashPathEffect intervals={[16, 10]} />
        </Rect>
      )}
    </Group>
  );
}

function TextNode({ layer, tf, selected }: LayerNodeProps) {
  const l = layer as TextLayer;
  const s = l.style;
  const font = useMemo(() => buildFont(s), [s]);
  const layout = useMemo(() => layoutText(l.text, font, s), [l.text, font, s]);
  const left = -layout.blockW / 2;
  const top = -layout.blockH / 2;
  const gradStart = { x: left, y: top };
  const gradEnd = { x: left + layout.blockW, y: top + layout.blockH };
  const underlineH = Math.max(2, Math.round(s.fontSize * 0.06));
  const highlight = s.highlight;
  const gradient = s.gradient;

  return (
    <Group transform={tf}>
      {highlight &&
        layout.lines.map((line, i) => (
          <Rect
            key={`h${i}`}
            x={left + line.x - s.fontSize * 0.25}
            y={top + i * layout.lineHeight - s.fontSize * 0.1}
            width={line.w + s.fontSize * 0.5}
            height={layout.lineHeight + s.fontSize * 0.2}
            color={highlight}
          />
        ))}
      {s.underline &&
        layout.lines.map((line, i) => (
          <Rect
            key={`u${i}`}
            x={left + line.x}
            y={top + line.baseline + s.fontSize * 0.08}
            width={Math.max(1, line.w)}
            height={underlineH}
            color={gradient ? undefined : s.fill}>
            {gradient && (
              <LinearGradient
                start={gradStart}
                end={gradEnd}
                colors={[gradient.from, gradient.to]}
              />
            )}
          </Rect>
        ))}
      {layout.lines.map((line, i) =>
        s.strokeWidth > 0 && s.stroke ? (
          <Text
            key={`s${i}`}
            font={font}
            text={line.text}
            x={left + line.x}
            y={top + line.baseline}
            color={s.stroke}
            style="stroke"
            strokeWidth={s.strokeWidth}
            antiAlias
          />
        ) : null,
      )}
      {layout.lines.map((line, i) =>
        s.gradient ? (
          <Text
            key={`f${i}`}
            font={font}
            text={line.text}
            x={left + line.x}
            y={top + line.baseline}
            antiAlias>
            <LinearGradient
              start={gradStart}
              end={gradEnd}
              colors={[s.gradient.from, s.gradient.to]}
            />
          </Text>
        ) : (
          <Text
            key={`f${i}`}
            font={font}
            text={line.text}
            x={left + line.x}
            y={top + line.baseline}
            color={s.fill}
            antiAlias
          />
        ),
      )}
      {selected && (
        <Rect
          x={left - 12 - s.strokeWidth}
          y={top - 12 - s.strokeWidth}
          width={layout.blockW + 24 + s.strokeWidth * 2}
          height={layout.blockH + 24 + s.strokeWidth * 2}
          color={SELECTION_COLOR}
          strokeWidth={4}
          style="stroke"
          antiAlias>
          <DashPathEffect intervals={[16, 10]} />
        </Rect>
      )}
    </Group>
  );
}

export default function StoryEditor({
  ref,
  uri,
  doc,
  onChange,
  index,
  total,
  width,
  height,
}: StoryEditorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const canvasRef = useRef<CanvasRef>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const bgImage = useImage(uri, () => setLoadFailed(true));

  const [bg, setBg] = useState(doc.bg);
  const [layers, setLayers] = useState<StoryLayer[]>(doc.layers);
  const [strokes, setStrokes] = useState<Stroke[]>(doc.strokes);
  const [filter, setFilter] = useState<StoryFilterState>(doc.filter);
  const [brush, setBrush] = useState<BrushState>(DEFAULT_BRUSH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tool, setTool] = useState<'stickers' | 'draw' | 'filter' | null>(null);
  const [past, setPast] = useState<StoryEditorDoc[]>([]);
  const [future, setFuture] = useState<StoryEditorDoc[]>([]);
  const [flushing, setFlushing] = useState(false);

  const S = width / CANVAS_W;
  const K = 1 / S;

  const bgSV = useSharedValue<Transforms3d>(layerTf(doc.bg.tx, doc.bg.ty, doc.bg.scale, 0));
  const liveSV = useSharedValue<Transforms3d>([]);
  const curSV = useSharedValue({ tx: 0, ty: 0, s: 1, r: 0 });
  const seedSV = useSharedValue({ tx: 0, ty: 0, s: 1, r: 0 });
  const panStartSV = useSharedValue({ x: 0, y: 0 });
  const pinchSeedSV = useSharedValue(1);
  const targetSV = useSharedValue('');
  const panBegunSV = useSharedValue(false);
  const livePtsSV = useSharedValue<number[]>([]);
  const livePathSV = useSharedValue(LIVE_PATH_EMPTY);
  const gradStartSV = useSharedValue({ x: 0, y: 0 });
  const gradEndSV = useSharedValue({ x: 0, y: 0 });

  const selectedLayer = selectedId ? (layers.find((l) => l.id === selectedId) ?? null) : null;
  const boxes = useMemo(() => layers.map(boxFor), [layers]);
  const docNow = useMemo<StoryEditorDoc>(
    () => ({ bg, layers, strokes, filter }),
    [bg, filter, layers, strokes],
  );

  const checkpoint = useCallback(() => {
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
  }, [docNow]);

  const applyDoc = useCallback(
    (d: StoryEditorDoc) => {
      setBg(d.bg);
      setLayers(d.layers);
      setStrokes(d.strokes);
      setFilter(d.filter);
      bgSV.value = layerTf(d.bg.tx, d.bg.ty, d.bg.scale, 0);
      if (selectedId && !d.layers.some((l) => l.id === selectedId)) {
        setSelectedId(null);
        setEditingId(null);
      } else if (selectedId) {
        const l = d.layers.find((x) => x.id === selectedId);
        if (l) liveSV.value = layerTf(l.x, l.y, l.scale, l.rotation);
      }
      onChange(d);
    },
    [bgSV, liveSV, onChange, selectedId],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([...future, docNow]);
    applyDoc(prev);
  }, [applyDoc, docNow, future, past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setPast([...past, docNow]);
    applyDoc(next);
  }, [applyDoc, docNow, future, past]);

  const cleanupEmptyText = useCallback(() => {
    const kept = layers.filter((l) => !(l.type === 'text' && !l.text.trim()));
    if (kept.length !== layers.length) {
      setLayers(kept);
      onChange({ ...docNow, layers: kept });
    }
  }, [docNow, layers, onChange]);

  const handleTap = useCallback(
    (px: number, py: number) => {
      const hitId = hitTestLayer(boxes, px, py);
      if (!hitId) {
        cleanupEmptyText();
        setSelectedId(null);
        setEditingId(null);
        return;
      }
      const l = layers.find((x) => x.id === hitId);
      if (!l) return;
      if (hitId === selectedId) {
        if (l.type === 'text') setEditingId(hitId);
        return;
      }
      setSelectedId(hitId);
      setEditingId(null);
      setTool(null);
      liveSV.value = layerTf(l.x, l.y, l.scale, l.rotation);
    },
    [boxes, cleanupEmptyText, layers, liveSV, selectedId],
  );

  const selectForDrag = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      const l = layers.find((x) => x.id === id);
      if (!l) return;
      setSelectedId(id);
      setEditingId(null);
      setTool(null);
      liveSV.value = layerTf(l.x, l.y, l.scale, l.rotation);
    },
    [layers, liveSV, selectedId],
  );

  const doCommit = useCallback(() => {
    const target = targetSV.value;
    const c = { tx: curSV.value.tx, ty: curSV.value.ty, s: curSV.value.s };
    panBegunSV.value = false;
    targetSV.value = '';
    if (target === 'bg') {
      if (c.tx === bg.tx && c.ty === bg.ty && c.s === bg.scale) return;
      const nextBg = { scale: c.s, tx: c.tx, ty: c.ty };
      setPast((p) => [...p.slice(-19), docNow]);
      setFuture([]);
      setBg(nextBg);
      onChange({ ...docNow, bg: nextBg });
      return;
    }
    if (!target) return;
    const l = layers.find((x) => x.id === target);
    if (!l) return;
    if (c.tx === l.x && c.ty === l.y && c.s === l.scale) return;
    const nextLayers = layers.map((x) =>
      x.id === target ? { ...x, x: c.tx, y: c.ty, scale: c.s } : x,
    );
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    setLayers(nextLayers);
    onChange({ ...docNow, layers: nextLayers });
  }, [bg, curSV, docNow, layers, onChange, panBegunSV, targetSV]);

  const scheduleCommit = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      doCommit();
    }, COMMIT_DELAY_MS);
  }, [doCommit]);

  const cancelCommit = useCallback(() => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  }, []);

  const writeTF = () => {
    'worklet';
    const c = curSV.value;
    const tf = layerTf(c.tx, c.ty, c.s, targetSV.value === 'bg' ? 0 : c.r);
    if (targetSV.value === 'bg') bgSV.value = tf;
    else liveSV.value = tf;
  };

  const seedFromState = () => {
    'worklet';
    if (targetSV.value === 'bg') {
      curSV.value = { tx: bg.tx, ty: bg.ty, s: bg.scale, r: 0 };
    } else {
      const l = layers.find((x) => x.id === targetSV.value);
      if (l) curSV.value = { tx: l.x, ty: l.y, s: l.scale, r: l.rotation };
    }
    seedSV.value = { ...curSV.value };
  };

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])
    .onBegin((e) => {
      runOnJS(cancelCommit)();
      panBegunSV.value = true;
      const hit = hitTestLayer(boxes, e.x * K, e.y * K);
      targetSV.value = hit ?? 'bg';
      if (hit && hit !== selectedId) runOnJS(selectForDrag)(hit);
      seedFromState();
      panStartSV.value = { x: e.x, y: e.y };
      writeTF();
    })
    .onUpdate((e) => {
      const dx = (e.x - panStartSV.value.x) * K;
      const dy = (e.y - panStartSV.value.y) * K;
      curSV.value = { ...curSV.value, tx: seedSV.value.tx + dx, ty: seedSV.value.ty + dy };
      writeTF();
    })
    .onFinalize(() => {
      runOnJS(scheduleCommit)();
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      runOnJS(cancelCommit)();
      if (!panBegunSV.value) {
        targetSV.value = selectedId ?? 'bg';
        seedFromState();
        panStartSV.value = { x: 0, y: 0 };
        writeTF();
      }
      pinchSeedSV.value = curSV.value.s;
    })
    .onUpdate((e) => {
      const min = targetSV.value === 'bg' ? BG_SCALE_MIN : LAYER_SCALE_MIN;
      const max = targetSV.value === 'bg' ? BG_SCALE_MAX : LAYER_SCALE_MAX;
      const next = Math.min(max, Math.max(min, pinchSeedSV.value * e.scale));
      curSV.value = { ...curSV.value, s: next };
      writeTF();
    })
    .onFinalize(() => {
      runOnJS(scheduleCommit)();
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(400)
    .maxDistance(10)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x * K, e.y * K);
    });

  const drawPan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => {
      const px = e.x * K;
      const py = e.y * K;
      livePtsSV.value = [px, py];
      const r = strokePathAndBounds([px, py]);
      livePathSV.value = r.d;
      gradStartSV.value = { x: r.minX, y: r.minY };
      gradEndSV.value = { x: r.maxX, y: r.maxY };
    })
    .onUpdate((e) => {
      const pts = livePtsSV.value;
      if (!pts.length) return;
      const nx = e.x * K;
      const ny = e.y * K;
      const dx = nx - pts[pts.length - 2];
      const dy = ny - pts[pts.length - 1];
      if (dx * dx + dy * dy < DRAW_MIN_D2) return;
      const next = [...pts, nx, ny];
      livePtsSV.value = next;
      const r = strokePathAndBounds(next);
      livePathSV.value = r.d;
      gradStartSV.value = { x: r.minX, y: r.minY };
      gradEndSV.value = { x: r.maxX, y: r.maxY };
    })
    .onFinalize(() => {
      runOnJS(endStroke)();
    });

  const eraseTap = Gesture.Tap()
    .maxDuration(400)
    .maxDistance(10)
    .onEnd((e) => {
      runOnJS(eraseAt)(e.x * K, e.y * K);
    });

  const drawing = tool === 'draw';
  const composed =
    drawing && brush.eraser
      ? eraseTap
      : drawing
        ? drawPan
        : Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const showTextPanel = tool === null && selectedLayer?.type === 'text';
  const showStickerPanel = tool === 'stickers';
  const showBrushPanel = tool === 'draw';
  const showFilterPanel = tool === 'filter';
  const filterMx =
    filter.id === 'original' ? null : filterMatrix(filter.id, filter.intensity);
  const strokeNodes = useMemo(
    () =>
      strokes.map((s) => ({
        key: s.id,
        ...strokePathAndBounds(s.points),
        width: s.width,
        color: s.color,
        gradient: s.gradient,
      })),
    [strokes],
  );

  const addText = useCallback(() => {
    cleanupEmptyText();
    const layer: TextLayer = {
      id: newId(),
      type: 'text',
      text: '',
      style: { ...DEFAULT_TEXT_STYLE },
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      scale: 1,
      rotation: 0,
    };
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    const next = [...layers, layer];
    setLayers(next);
    onChange({ ...docNow, layers: next });
    setSelectedId(layer.id);
    setEditingId(layer.id);
    setTool(null);
    liveSV.value = layerTf(layer.x, layer.y, 1, 0);
  }, [cleanupEmptyText, docNow, layers, liveSV, onChange]);

  const addSticker = useCallback(
    (def: StickerDef) => {
      const n = layers.length;
      const layer: StickerLayer = {
        id: newId(),
        type: 'sticker',
        stickerId: def.id,
        x: CANVAS_W / 2 + ((n % 4) - 1.5) * 70,
        y: CANVAS_H / 2 + ((Math.floor(n / 4) % 4) - 1.5) * 70,
        scale: 1,
        rotation: 0,
      };
      setPast((p) => [...p.slice(-19), docNow]);
      setFuture([]);
      const next = [...layers, layer];
      setLayers(next);
      onChange({ ...docNow, layers: next });
      setSelectedId(layer.id);
      setEditingId(null);
      setTool(null);
      liveSV.value = layerTf(layer.x, layer.y, 1, 0);
    },
    [docNow, layers, liveSV, onChange],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    const next = layers.filter((l) => l.id !== selectedId);
    setLayers(next);
    onChange({ ...docNow, layers: next });
    setSelectedId(null);
    setEditingId(null);
  }, [docNow, layers, onChange, selectedId]);

  const applyStyle = useCallback(
    (patch: Partial<TextLayer['style']>) => {
      if (!selectedId) return;
      const next = layers.map((l) =>
        l.id === selectedId && l.type === 'text' ? { ...l, style: { ...l.style, ...patch } } : l,
      );
      setLayers(next);
      onChange({ ...docNow, layers: next });
    },
    [docNow, layers, onChange, selectedId],
  );

  const editLayer = editingId ? (layers.find((l) => l.id === editingId) as TextLayer) : null;

  const onEditText = useCallback(
    (v: string) => {
      if (!editingId) return;
      const text = v.slice(0, TEXT_MAX);
      const next = layers.map((l) =>
        l.id === editingId && l.type === 'text' ? { ...l, text } : l,
      );
      setLayers(next);
      onChange({ ...docNow, layers: next });
    },
    [docNow, editingId, layers, onChange],
  );

  const resetBg = useCallback(() => {
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    const next = { ...IDENTITY_TRANSFORM };
    setBg(next);
    bgSV.value = layerTf(next.tx, next.ty, next.scale, 0);
    onChange({ ...docNow, bg: next });
  }, [bgSV, docNow, onChange]);

  const endStroke = useCallback(() => {
    const pts = livePtsSV.value.slice();
    livePtsSV.value = [];
    livePathSV.value = LIVE_PATH_EMPTY;
    gradStartSV.value = { x: 0, y: 0 };
    gradEndSV.value = { x: 0, y: 0 };
    if (pts.length < 4) return;
    const stroke: Stroke = {
      id: newId(),
      points: pts,
      color: brush.color,
      width: brush.size,
      gradient: brush.gradient.enabled
        ? { from: brush.gradient.from, to: brush.gradient.to }
        : null,
    };
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    const next = [...strokes, stroke];
    setStrokes(next);
    onChange({ ...docNow, strokes: next });
  }, [brush, docNow, livePathSV, livePtsSV, gradStartSV, gradEndSV, onChange, strokes]);

  const eraseAt = useCallback(
    (px: number, py: number) => {
      let hitIdx = -1;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (hitStroke(strokes[i], px, py, ERASE_TOL)) {
          hitIdx = i;
          break;
        }
      }
      if (hitIdx < 0) return;
      setPast((p) => [...p.slice(-19), docNow]);
      setFuture([]);
      const next = strokes.filter((_, i) => i !== hitIdx);
      setStrokes(next);
      onChange({ ...docNow, strokes: next });
    },
    [docNow, onChange, strokes],
  );

  const clearStrokes = useCallback(() => {
    if (!strokes.length) return;
    setPast((p) => [...p.slice(-19), docNow]);
    setFuture([]);
    setStrokes([]);
    onChange({ ...docNow, strokes: [] });
  }, [docNow, onChange, strokes]);

  const patchBrush = useCallback((patch: Partial<BrushState>) => {
    setBrush((prev) => ({ ...prev, ...patch }));
  }, []);

  const selectFilter = useCallback(
    (id: FilterPresetId) => {
      const next: StoryFilterState = { id, intensity: filter.intensity };
      setFilter(next);
      onChange({ ...docNow, filter: next });
    },
    [docNow, filter.intensity, onChange],
  );

  const changeIntensity = useCallback(
    (v: number) => {
      const next: StoryFilterState = { id: filter.id, intensity: v };
      setFilter(next);
      onChange({ ...docNow, filter: next });
    },
    [docNow, filter.id, onChange],
  );

  const toggleTool = useCallback((next: 'stickers' | 'draw' | 'filter') => {
    setTool((prev) => (prev === next ? null : next));
    setSelectedId(null);
    setEditingId(null);
  }, []);

  const flush = useCallback(async (): Promise<string | null> => {
    cancelCommit();
    cleanupEmptyText();
    setSelectedId(null);
    setEditingId(null);
    setTool(null);
    setFlushing(true);
    await new Promise((r) => setTimeout(r, 90));
    try {
      const snap = await canvasRef.current?.makeImageSnapshotAsync();
      if (!snap) return null;
      let out: SkImage = snap;
      const snapW = snap.width();
      const snapH = snap.height();
      if (snapW !== CANVAS_W || snapH !== CANVAS_H) {
        const surface = Skia.Surface.MakeOffscreen(CANVAS_W, CANVAS_H);
        if (surface) {
          surface
            .getCanvas()
            .drawImageRectOptions(
              snap,
              { x: 0, y: 0, width: snapW, height: snapH },
              { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H },
              FilterMode.Linear,
              MipmapMode.None,
            );
          out = surface.makeImageSnapshot();
        }
      }
      const b64 = out.encodeToBase64(ImageFormat.JPEG, 92);
      const file = new File(Paths.cache, `linkup-story-${Date.now()}-${index}.jpg`);
      file.write(b64, { encoding: 'base64' });
      return file.uri;
    } catch {
      return null;
    } finally {
      setFlushing(false);
    }
  }, [cancelCommit, cleanupEmptyText, index]);

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  const editBox = editLayer
    ? (() => {
        const font = buildFont(editLayer.style);
        const layout = layoutText(editLayer.text, font, editLayer.style);
        const w = editLayer.text.length
          ? layout.blockW + layout.blockW * 0.02 + 6
          : editLayer.style.fontSize * 4;
        const h = Math.max(layout.blockH, editLayer.style.fontSize * 1.4);
        return { w, h, layout };
      })()
    : null;

  const panelVisible =
    showTextPanel || showStickerPanel || showBrushPanel || showFilterPanel;

  return (
    <View style={styles.root}>
      <View style={[styles.frameWrap, { width, height, borderRadius: 16 }]}>
        <View
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: [{ scale: S }],
            transformOrigin: 'top left',
          }}>
          <Canvas
            ref={canvasRef}
            style={{ width: CANVAS_W, height: CANVAS_H }}
            opaque
            android={{ surfaceType: 'TextureView' }}>
            {bgImage && !loadFailed && (
              <>
                <Group>
                  <Blur blur={BG_BLUR} />
                  <Image
                    image={bgImage}
                    x={0}
                    y={0}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    fit="cover"
                  />
                </Group>
                <Image
                  image={bgImage}
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  fit="contain"
                  transform={bgSV}
                  origin={{ x: CANVAS_W / 2, y: CANVAS_H / 2 }}
                  antiAlias>
                  {filterMx && <ColorMatrix matrix={filterMx} />}
                </Image>
              </>
            )}
            {layers.map((l) => {
              const isSelected = selectedId === l.id && !flushing;
              const tf = isSelected
                ? liveSV
                : layerTf(l.x, l.y, l.scale, l.rotation);
              return l.type === 'sticker' ? (
                <StickerNode key={l.id} layer={l} tf={tf} selected={isSelected} />
              ) : (
                <TextNode key={l.id} layer={l} tf={tf} selected={isSelected} />
              );
            })}
            {strokeNodes.map((s) => (
              <Path
                key={s.key}
                path={s.d}
                strokeWidth={s.width}
                color={s.gradient ? undefined : s.color}
                style="stroke"
                strokeCap="round"
                strokeJoin="round"
                antiAlias>
                {s.gradient && (
                  <LinearGradient
                    start={{ x: s.minX, y: s.minY }}
                    end={{ x: s.maxX, y: s.maxY }}
                    colors={[s.gradient.from, s.gradient.to]}
                  />
                )}
              </Path>
            ))}
            {drawing && !brush.eraser && (
              <Path
                path={livePathSV}
                strokeWidth={brush.size}
                color={brush.gradient.enabled ? undefined : brush.color}
                style="stroke"
                strokeCap="round"
                strokeJoin="round"
                antiAlias>
                {brush.gradient.enabled && (
                  <LinearGradient
                    start={gradStartSV}
                    end={gradEndSV}
                    colors={[brush.gradient.from, brush.gradient.to]}
                  />
                )}
              </Path>
            )}
          </Canvas>
        </View>

        {loadFailed && (
          <View style={styles.loadError} pointerEvents="none">
            <ThemedText themeColor="textSecondary" style={styles.loadErrorText}>
              {t('story.editor.mediaLoadFailed')}
            </ThemedText>
          </View>
        )}

        <GestureDetector gesture={composed}>
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents={editingId ? 'none' : 'auto'}
          />
        </GestureDetector>

        {editLayer && editBox && (
          <TextInput
            style={[
              styles.input,
              {
                left: editLayer.x * S - (editBox.w * S) / 2,
                top: editLayer.y * S - (editBox.h * S) / 2,
                width: editBox.w * S,
                height: editBox.h * S,
                fontSize: editLayer.style.fontSize * S,
                lineHeight: Math.round(editLayer.style.fontSize * 1.3 * S),
                color: 'transparent',
                textAlign: editLayer.style.textAlign,
                fontWeight: editLayer.style.fontWeight,
                fontStyle: editLayer.style.fontStyle,
                textDecorationLine: editLayer.style.underline ? 'underline' : 'none',
              },
            ]}
            value={editLayer.text}
            onChangeText={onEditText}
            onBlur={() => setEditingId(null)}
            autoFocus
            caretHidden
            underlineColorAndroid="transparent"
            multiline
            maxLength={TEXT_MAX}
            textAlignVertical="center"
            scrollEnabled={false}
          />
        )}

        <View style={styles.counter} pointerEvents="none">
          <ThemedText style={styles.counterText}>
            {index + 1}/{total}
          </ThemedText>
        </View>

        <Pressable
          style={styles.resetBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.resetPosition')}
          onPress={resetBg}>
          <Icon name="check" size={16} color={theme.textOnPrimary} />
        </Pressable>
      </View>

      <View style={[styles.toolbar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <Pressable
          style={styles.toolBtn}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.text')}
          onPress={addText}>
          <Icon name="textTool" size={22} />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          accessibilityRole="button"
          accessibilityState={{ selected: showStickerPanel }}
          accessibilityLabel={t('story.editor.stickers')}
          onPress={() => toggleTool('stickers')}>
          <Icon
            name="sticker"
            size={22}
            color={showStickerPanel ? theme.primary : undefined}
          />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          accessibilityRole="button"
          accessibilityState={{ selected: showBrushPanel }}
          accessibilityLabel={t('story.editor.draw')}
          onPress={() => toggleTool('draw')}>
          <Icon
            name="draw"
            size={22}
            color={showBrushPanel ? theme.primary : undefined}
          />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          accessibilityRole="button"
          accessibilityState={{ selected: showFilterPanel }}
          accessibilityLabel={t('story.editor.filters')}
          onPress={() => toggleTool('filter')}>
          <Icon
            name="filter"
            size={22}
            color={showFilterPanel ? theme.primary : undefined}
          />
        </Pressable>
        <View style={styles.toolSpacer} />
        <Pressable
          style={styles.toolBtn}
          disabled={!past.length}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.undo')}
          onPress={undo}>
          <Icon name="undo" size={22} color={past.length ? undefined : theme.border} />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          disabled={!future.length}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.redo')}
          onPress={redo}>
          <Icon name="redo" size={22} color={future.length ? undefined : theme.border} />
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          disabled={!selectedId}
          accessibilityRole="button"
          accessibilityLabel={t('story.editor.delete')}
          onPress={removeSelected}>
          <Icon name="trash" size={22} color={selectedId ? theme.danger : theme.border} />
        </Pressable>
      </View>

      {panelVisible && (
        <View style={[styles.panelAnchor, { bottom: 56 }]}>
          {showStickerPanel ? (
            <StoryEditorStickerPanel onPick={addSticker} />
          ) : showBrushPanel ? (
            <StoryEditorBrushPanel
              brush={brush}
              onChange={patchBrush}
              hasStrokes={strokes.length > 0}
              onClear={clearStrokes}
            />
          ) : showFilterPanel ? (
            <StoryEditorFilterPanel
              uri={uri}
              filter={filter}
              onSelect={selectFilter}
              onIntensity={changeIntensity}
              onCheckpoint={checkpoint}
            />
          ) : showTextPanel && selectedLayer?.type === 'text' ? (
            <StoryEditorTextPanel
              style={selectedLayer.style}
              hasSelection
              onStyleChange={applyStyle}
              onCheckpoint={checkpoint}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    width: '100%',
  },
  frameWrap: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  loadError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  loadErrorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  input: {
    position: 'absolute',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  counter: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resetBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    gap: 2,
  },
  toolSpacer: {
    flex: 1,
  },
  panelAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
