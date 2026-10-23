import type { ImageSourcePropType } from 'react-native';

/**
 * Preset ảnh tĩnh của chat background — value server = filename (giống Web,
 * Web render url(/presets/chat-bg/<filename>)), mobile render asset local.
 * Unknown value (file không có) → caller fallback không render.
 */
export const PRESET_IMAGES: Record<string, ImageSourcePropType> = {
  'preset-01.jpg': require('../assets/chat-bg/preset-01.jpg'),
  'preset-02.jpg': require('../assets/chat-bg/preset-02.jpg'),
  'preset-03.jpg': require('../assets/chat-bg/preset-03.jpg'),
  'preset-04.jpg': require('../assets/chat-bg/preset-04.jpg'),
  'preset-05.jpg': require('../assets/chat-bg/preset-05.jpg'),
  'preset-06.jpg': require('../assets/chat-bg/preset-06.jpg'),
  'preset-07.jpg': require('../assets/chat-bg/preset-07.jpg'),
  'preset-08.jpg': require('../assets/chat-bg/preset-08.jpg'),
  'preset-09.jpg': require('../assets/chat-bg/preset-09.jpg'),
  'preset-10.jpg': require('../assets/chat-bg/preset-10.jpg'),
  'preset-11.jpg': require('../assets/chat-bg/preset-11.jpg'),
  'preset-12.jpg': require('../assets/chat-bg/preset-12.jpg'),
};

export const PRESET_FILENAMES = Object.keys(PRESET_IMAGES);
