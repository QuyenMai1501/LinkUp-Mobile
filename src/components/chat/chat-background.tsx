import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { parseGradientColors } from '@/components/chat/chat-background-picker';
import { PRESET_IMAGES } from '@/constants/chat-bg-presets';
import type { ChatBackground } from '@/types/chat';
import { overlayRgba } from '@/utils/chat-readability';

interface Props {
  background: ChatBackground | null | undefined;
}

/**
 * Layer nền trò chuyện (absoluteFill) — solid / gradient / preset / custom
 * + lớp scrim adaptive (luminance × overlay_strength, parity Web ChatWindow).
 * Đặt làm child ĐẦU TIÊN của container tin nhắn: siblings phía sau tự vẽ
 * đè lên; layer không chặn touch (pointerEvents="none").
 */
export function ChatBackgroundLayer({ background }: Props) {
  if (!background?.value) return null;
  // Preset lạ (file không bundle) → fallback nền mặc định thay vì ảnh vỡ.
  if (background.type === 'preset' && !PRESET_IMAGES[background.value]) {
    return null;
  }
  const scrim = overlayRgba(background, background.overlay_strength);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BackgroundFill background={background} />
      {scrim ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]} />
      ) : null}
    </View>
  );
}

function BackgroundFill({ background }: { background: ChatBackground }) {
  const value = background.value;
  switch (background.type) {
    case 'solid':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: value }]} />
      );
    case 'gradient':
      return (
        <LinearGradient
          colors={parseGradientColors(value)}
          style={StyleSheet.absoluteFill}
        />
      );
    case 'preset': {
      const src = PRESET_IMAGES[value];
      if (!src) return null;
      return (
        <Image
          source={src}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      );
    }
    default:
      // custom (URL) + giá trị cũ còn lưu trực tiếp dạng URL.
      return (
        <Image
          source={{ uri: value }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      );
  }
}

/**
 * Nền RIÊNG của header khi có nền trò chuyện — mirror Web `chatHeaderStyle`:
 * solid/gradient hiển thị NGUYÊN BẢN (không scrim adaptive), preset/custom =
 * ảnh + lớp đen 0.55 CỐ ĐỊNH (không theo slider strength). absoluteFill,
 * không chặn touch. Đặt làm child đầu tiên của header.
 */
export function ChatHeaderBackground({ background }: Props) {
  if (!background?.value) return null;
  // Preset lạ (file không bundle) → không vẽ gì (header giữ nền mặc định).
  if (background.type === 'preset' && !PRESET_IMAGES[background.value]) {
    return null;
  }
  const isImage =
    background.type === 'preset' || background.type === 'custom';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BackgroundFill background={background} />
      {isImage ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.55)' },
          ]}
        />
      ) : null}
    </View>
  );
}
