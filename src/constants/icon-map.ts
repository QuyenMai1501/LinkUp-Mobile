import { Ionicons } from '@expo/vector-icons';

export type IoniconsName = keyof typeof Ionicons.glyphMap;

export const icons = {
  // Navigation
  menu: 'menu-outline' as const,
  home: 'home-outline' as const,
  homeFilled: 'home' as const,
  people: 'people-outline' as const,
  peopleFilled: 'people' as const,
  bell: 'notifications-outline' as const,
  bellFilled: 'notifications' as const,
  globe: 'globe-outline' as const,
  globeFilled: 'globe' as const,
  bookmark: 'bookmark-outline' as const,
  bookmarkFilled: 'bookmark' as const,
  person: 'person-outline' as const,
  personFilled: 'person' as const,
  settings: 'settings-outline' as const,

  // Actions
  add: 'add-outline' as const,
  search: 'search-outline' as const,
  chat: 'chatbubble-outline' as const,
  chatFilled: 'chatbubble' as const,
  heart: 'heart-outline' as const,
  heartFilled: 'heart' as const,
  share: 'arrow-redo-outline' as const,
  reply: 'arrow-undo-outline' as const,
  copy: 'copy-outline' as const,
  pin: 'pin' as const,
  trash: 'trash-outline' as const,
  attach: 'attach-outline' as const,
  smile: 'happy-outline' as const,
  gif: 'film-outline' as const,
  send: 'paper-plane-outline' as const,
  sendFilled: 'paper-plane' as const,

  // Close / Cancel
  close: 'close-outline' as const,

  // Status
  checkCircle: 'checkmark-circle-outline' as const,
  xCircle: 'close-circle-outline' as const,
  warning: 'warning-outline' as const,
  hourglass: 'hourglass-outline' as const,
  check: 'checkmark' as const,

  // Privacy
  lock: 'lock-closed-outline' as const,
  shield: 'shield-checkmark-outline' as const,

  // Password visibility
  eye: 'eye-outline' as const,
  eyeOff: 'eye-off-outline' as const,

  // Auth / Misc
  mail: 'mail-outline' as const,
  mailOpen: 'mail-open-outline' as const,
  logout: 'log-out-outline' as const,
  camera: 'camera-outline' as const,
  video: 'videocam-outline' as const,
  newspaper: 'newspaper-outline' as const,
  images: 'images-outline' as const,
  info: 'information-circle-outline' as const,
  document: 'document-text-outline' as const,
  call: 'call-outline' as const,
  save: 'bookmark-outline' as const,
  palette: 'color-palette-outline' as const,
  laptop: 'laptop-outline' as const,
  play: 'play-outline' as const,
  compass: 'compass-outline' as const,
  compassFilled: 'compass' as const,
} as const;

export type IconName = keyof typeof icons;
