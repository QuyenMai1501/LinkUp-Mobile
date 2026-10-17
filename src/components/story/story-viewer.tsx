import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import StoryStatsModal from '@/components/story/story-stats-modal';
import { createDirectChat, createChatInvite } from '@/api/chat';
import {
  deleteStory,
  getStoryAnalytics,
  reactStory,
  shareStory,
  viewStory,
} from '@/api/story';
import { useServerEmojis } from '@/hooks/use-server-emojis';
import { useTranslation } from '@/hooks/useTranslation';
import { getEmotionEmojis, type EmojiItem as LocalEmoji } from '@/utils/emojis';
import { stashStoryReplyDraft } from '@/utils/story-reply-draft';
import type { StoryAnalytics, StoryItem } from '@/types/story';
import type { EmojiItem } from '@/types/post';

const REACTION_CODES = [':like:', ':love:', ':haha:', ':wow:', ':sad:', ':angry:'];
const DURATION_MS = 5000;
const TICK_MS = 50;
const TAP_THRESHOLD_MS = 250;

const TEXT_GRADIENTS: [string, string][] = [
  ['#F9CE34', '#EE2A7B'],
  ['#6228D7', '#EE2A7B'],
  ['#12A5A1', '#0A1F44'],
  ['#FF6B6B', '#FEC89A'],
  ['#43E97B', '#38F9D7'],
];

function pickTextGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TEXT_GRADIENTS[h % TEXT_GRADIENTS.length];
}

function formatTimeAgo(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('post.justNow');
  if (mins < 60) return t('post.minutesAgo', { minutes: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('post.hoursAgo', { hours: hrs });
  return t('post.daysAgo', { days: Math.floor(hrs / 24) });
}

/** Phát video story (tiêu thụ — mobile không tạo mới). Auto-play, không controls. */
function StoryVideo({
  uri,
  paused,
  muted,
  onEnded,
  style,
}: {
  uri: string;
  paused: boolean;
  muted: boolean;
  onEnded: () => void;
  style: object;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = muted;
    p.loop = false;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- expo-video player là object mutable, API chính thức
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const id = setInterval(() => {
      if (player.duration > 0 && player.currentTime >= player.duration - 0.05) {
        onEnded();
      }
    }, 200);
    return () => clearInterval(id);
  }, [player, onEnded]);

  return <VideoView player={player} style={style} contentFit="contain" nativeControls={false} />;
}

interface StoryViewerProps {
  stories: StoryItem[];
  initialIndex?: number;
  currentUserId?: string;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
  onStoryDeleted?: () => void;
}

export default function StoryViewer({
  stories,
  initialIndex = 0,
  currentUserId,
  onClose,
  onStoryViewed,
  onStoryDeleted,
}: StoryViewerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { byCode } = useServerEmojis();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [analytics, setAnalytics] = useState<StoryAnalytics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [tapHeartVisible, setTapHeartVisible] = useState(false);
  const [burst, setBurst] = useState<{ emoji: LocalEmoji | EmojiItem; seq: number } | null>(null);

  const lastTapRef = useRef(0);
  const burstOpacity = useMemo(() => new Animated.Value(0), []);
  const heartOpacity = useMemo(() => new Animated.Value(0), []);

  const story = stories[currentIndex];
  const isVideo = story?.media_type === 'video';
  const isText = !!story && !story.media_uri;
  const isOwner = !!currentUserId && story?.user_id === currentUserId;
  const modalOpen = showStats;

  // Reaction emoji: ưu tiên emoji server thật, fallback emoji nội bộ (Web cùng fallback).
  const reactionEmojis: (LocalEmoji | EmojiItem)[] = useMemo(() => {
    if (byCode) {
      const list = REACTION_CODES.map((code) => byCode.get(code)).filter(
        (e): e is EmojiItem => !!e && !e.id.startsWith('emotion-'),
      );
      if (list.length) return list;
    }
    return REACTION_CODES.map((code) => getEmotionEmojis().find((e) => e.code === code)).filter(
      (e): e is LocalEmoji => !!e,
    );
  }, [byCode]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Đánh dấu đã xem khi mở story (server ghi nhận view).
  useEffect(() => {
    if (!story) return;
    if (!story.has_viewed) {
      viewStory(story.id).catch(() => {});
      onStoryViewed?.(story.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Auto-advance ảnh/tin chữ: progress 0→100 trong 5s.
  useEffect(() => {
    if (!story || isPaused || modalOpen || isVideo) return;
    const step = (TICK_MS / DURATION_MS) * 100;
    const timer = setInterval(() => {
      setProgress((prev) => prev + step);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [story, isPaused, modalOpen, isVideo]);

  useEffect(() => {
    if (!story || isVideo || isPaused || modalOpen) return;
    if (progress < 100) return;
    // defer — tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect)
    const id = setTimeout(goNext, 0);
    return () => clearTimeout(id);
  }, [progress, story, isVideo, isPaused, modalOpen, goNext]);

  const ensureReact = useCallback(async (emojiId: string | undefined) => {
    if (!story || !emojiId) return;
    try {
      await reactStory(story.id, emojiId);
    } catch {
      /* ignore */
    }
  }, [story]);

  const animateBurst = useCallback(() => {
    burstOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(burstOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(burstOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [burstOpacity]);

  const handleReact = useCallback(
    (emoji: LocalEmoji | EmojiItem) => {
      setBurst((prev) => ({ emoji, seq: (prev ? prev.seq : 0) + 1 }));
      animateBurst();
      void ensureReact(emoji.id);
    },
    [animateBurst, ensureReact],
  );

  const handleDoubleTap = useCallback(() => {
    setTapHeartVisible(true);
    heartOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(heartOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(heartOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setTapHeartVisible(false));
    const love = reactionEmojis.find((e) => e.code === ':love:') ?? reactionEmojis[0];
    void ensureReact(love?.id);
  }, [heartOpacity, ensureReact, reactionEmojis]);

  const handleCenterRelease = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_THRESHOLD_MS * 2) {
      lastTapRef.current = 0;
      handleDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }, [handleDoubleTap]);

  const handleReplySubmit = useCallback(async () => {
    const text = replyText.trim();
    if (!text || !story || replySending) return;
    setReplySending(true);
    try {
      const res = await createDirectChat(story.user_id);
      stashStoryReplyDraft({ chatId: res.chat_id, text });
      setReplyText('');
      onClose();
      (router as any).push(`/(drawer)/chat/${res.chat_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('chat.NOT_PARTICIPANT')) {
        try {
          await createChatInvite(story.user_id);
          setReplyText('');
          onClose();
          (router as any).push('/(drawer)/messages');
        } catch {
          /* ignore */
        }
      }
    } finally {
      setReplySending(false);
    }
  }, [onClose, replySending, replyText, router, story]);

  const handleShare = useCallback(async () => {
    if (!story) return;
    shareStory(story.id).catch(() => {});
    try {
      await Share.share({ message: t('story.shareMessage', { name: story.display_name }) });
    } catch {
      /* share sheet dismiss */
    }
  }, [story, t]);

  const openAnalytics = useCallback(async () => {
    if (!story) return;
    setShowStats(true);
    setAnalytics(null);
    setStatsError(false);
    setStatsLoading(true);
    try {
      const data = await getStoryAnalytics(story.id);
      setAnalytics(data);
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, [story]);

  const confirmDelete = useCallback(() => {
    if (!story) return;
    Alert.alert(t('story.delete'), t('story.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('story.delete'),
        style: 'destructive',
        onPress: () => {
          deleteStory(story.id)
            .then(() => {
              onStoryDeleted?.();
              onClose();
            })
            .catch((err) => {
              Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.error'));
            });
        },
      },
    ]);
  }, [onClose, onStoryDeleted, story, t]);

  if (!story) return null;

  const isImage = story.media_type === 'image' && !!story.media_uri;
  const gradient = pickTextGradient(story.id);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Nội dung media + vùng bấm */}
          <View style={styles.mediaArea}>
            {isImage && (
              <Image
                source={{ uri: story.media_uri }}
                style={styles.media}
                contentFit="cover"
                transition={200}
              />
            )}
            {isVideo && (
              <StoryVideo
                uri={story.media_uri}
                paused={isPaused || modalOpen}
                muted={videoMuted}
                onEnded={goNext}
                style={styles.media}
              />
            )}
            {isText && (
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.media}>
                {!!story.caption && (
                  <ThemedText style={styles.textLabel} numberOfLines={6}>
                    {story.caption}
                  </ThemedText>
                )}
              </LinearGradient>
            )}

            {/* Vùng trái: tin trước */}
            {currentIndex > 0 && (
              <Pressable style={styles.navZoneLeft} onPress={goPrev} />
            )}
            {/* Vùng phải: tin sau */}
            <Pressable style={styles.navZoneRight} onPress={goNext} />
            {/* Vùng giữa: giữ = tạm dừng, tap nhanh đôi = tim */}
            <Pressable
              style={styles.navZoneCenter}
              onPressIn={() => setIsPaused(true)}
              onPressOut={() => {
                setIsPaused(false);
                handleCenterRelease();
              }}
            />

            {/* Double-tap heart */}
            {tapHeartVisible && (
              <Animated.View style={[styles.tapHeart, { opacity: heartOpacity }]} pointerEvents="none">
                <Icon name="heartFilled" size={96} color="#FF3B5C" />
              </Animated.View>
            )}
          </View>

          {/* Progress segments */}
          <View style={styles.progressRow} pointerEvents="none">
            {stories.map((s, i) => (
              <View key={s.id} style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: i < currentIndex ? '100%' : i === currentIndex ? `${Math.min(progress, 100)}%` : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Image source={{ uri: story.avatar_uri }} style={styles.headerAvatar} contentFit="cover" />
            <ThemedText style={styles.headerName} numberOfLines={1}>
              {story.display_name}
            </ThemedText>
            <ThemedText style={styles.headerTime}>{formatTimeAgo(story.created_at, t)}</ThemedText>
            {isVideo && (
              <Pressable hitSlop={8} onPress={() => setVideoMuted((m) => !m)}>
                <Icon name={videoMuted ? 'eyeOff' : 'eye'} size={20} color="#FFFFFF" />
              </Pressable>
            )}
            <View style={styles.flex} />
            {isOwner && (
              <>
                <Pressable hitSlop={8} onPress={openAnalytics} style={styles.headerBtn}>
                  <Icon name="stats" size={22} color="#FFFFFF" />
                </Pressable>
                <Pressable hitSlop={8} onPress={confirmDelete} style={styles.headerBtn}>
                  <Icon name="trash" size={20} color="#FFFFFF" />
                </Pressable>
              </>
            )}
            <Pressable hitSlop={8} onPress={onClose} style={styles.headerBtn}>
              <Icon name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Caption */}
          {!!story.caption && !isText && (
            <View style={styles.captionWrap} pointerEvents="none">
              <ThemedText style={styles.caption} numberOfLines={3}>
                {story.caption}
              </ThemedText>
            </View>
          )}

          {/* Action row: reaction + share */}
          <View style={styles.actionRow}>
            <View style={styles.reactionBar}>
              {reactionEmojis.map((e) => (
                <Pressable key={e.id} style={styles.reactBtn} onPress={() => handleReact(e)}>
                  <Image source={{ uri: e.image_uri }} style={styles.reactImg} contentFit="contain" />
                </Pressable>
              ))}
            </View>
            <Pressable hitSlop={8} onPress={handleShare} style={styles.shareBtn}>
              <Icon name="share" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Reaction burst */}
          {burst && (
            <Animated.View style={[styles.burst, { opacity: burstOpacity }]} pointerEvents="none">
              <Image source={{ uri: burst.emoji.image_uri }} style={styles.burstImg} contentFit="contain" />
            </Animated.View>
          )}

          {/* Reply bar */}
          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              placeholder={t('story.replyPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={replyText}
              onChangeText={setReplyText}
              returnKeyType="send"
              onSubmitEditing={handleReplySubmit}
            />
            <Pressable
              hitSlop={8}
              disabled={replySending || !replyText.trim()}
              onPress={handleReplySubmit}
              style={[styles.sendBtn, (!replyText.trim() || replySending) && styles.sendBtnDisabled]}>
              <Icon name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      <StoryStatsModal
        visible={showStats}
        analytics={analytics}
        loading={statsLoading}
        error={statsError}
        onClose={() => {
          setShowStats(false);
          setAnalytics(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  mediaArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  textLabel: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  navZoneLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '25%',
  },
  navZoneRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '25%',
  },
  navZoneCenter: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    top: 0,
    bottom: 0,
  },
  tapHeart: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 68 : 48,
    left: 12,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A3A3C',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTime: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  headerBtn: {
    marginLeft: 4,
  },
  captionWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reactBtn: {
    padding: 2,
  },
  reactImg: {
    width: 28,
    height: 28,
  },
  shareBtn: {
    padding: 6,
  },
  burst: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    alignItems: 'center',
  },
  burstImg: {
    width: 64,
    height: 64,
  },
  replyBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: Platform.OS === 'ios' ? 36 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
