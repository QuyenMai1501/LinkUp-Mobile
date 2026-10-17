import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { StoryAvatarRing, STORY_RING_COLORS } from '@/components/story/story-avatar-ring';
import { Radius, Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/useTranslation';
import type { StoryFeedItem, StoryItem } from '@/types/story';

const TILE_W = 76;
const CARD_W = 68;
const CARD_H = 96;

interface StoryBarProps {
  stories: StoryFeedItem[];
  loading?: boolean;
  currentUserId?: string;
  /** Avatar hiện tại của user — dùng cho tile "Tin của bạn". */
  avatarUri?: string;
  onSelectStory: (userId: string, stories: StoryItem[]) => void;
  onCreateStory: () => void;
  onMuteUser: (userId: string) => void;
}

function StoryPreview({ story }: { story: StoryItem }) {
  if (!story.media_uri) {
    return <View style={[styles.previewMedia, styles.previewFallback]} />;
  }
  return (
    <Image
      source={{ uri: story.media_uri }}
      style={styles.previewMedia}
      contentFit="cover"
      transition={200}
    />
  );
}

function SkeletonCard() {
  return <View style={[styles.card, styles.skeletonCard]} />;
}

export default function StoryBar({
  stories,
  loading = false,
  currentUserId,
  avatarUri,
  onSelectStory,
  onCreateStory,
  onMuteUser,
}: StoryBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const ownGroup = currentUserId
    ? stories.find((s) => s.user.id === currentUserId)
    : undefined;
  const ownViewed = ownGroup
    ? ownGroup.stories.every((s) => s.has_viewed)
    : false;
  // Web bị hiển thị trùng (tile "Tin của bạn" + group mình trong danh sách) —
  // mobile lọc group mình khỏi bar.
  const otherGroups = stories.filter((s) => s.user.id !== currentUserId);

  const confirmMute = (userId: string, displayName: string) => {
    Alert.alert(displayName, undefined, [
      {
        text: t('story.muteUser'),
        style: 'destructive',
        onPress: () => onMuteUser(userId),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  if (loading && stories.length === 0) {
    return (
      <View style={styles.wrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <SkeletonCard key={k} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!currentUserId && stories.length === 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {/* Tile "Tin của bạn" */}
        {currentUserId && (
          <Pressable style={styles.tile} onPress={onCreateStory}>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {avatarUri?.trim() ? (
                <Image source={{ uri: avatarUri }} style={styles.previewMedia} contentFit="cover" />
              ) : (
                <View style={[styles.previewMedia, styles.previewFallback, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.ownInitial}>
                    {t('story.yourStory').charAt(0)}
                  </ThemedText>
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.65)']}
                style={styles.cardGradient}
                pointerEvents="none"
              />
              <View style={styles.plusBadge}>
                <ThemedText style={styles.plusBadgeText}>+</ThemedText>
              </View>
              <View style={styles.cardOverlay}>
                <StoryAvatarRing
                  src={avatarUri}
                  name={t('story.yourStory')}
                  hasStory={!!ownGroup}
                  hasViewed={ownViewed}
                  size={40}
                />
                <ThemedText style={styles.cardName} numberOfLines={1}>
                  {t('story.yourStory')}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        )}

        {otherGroups.map((item) => {
          const hasViewed = item.stories.every((s) => s.has_viewed);
          const preview = item.stories[0];
          return (
            <Pressable
              key={item.user.id}
              style={styles.tile}
              onPress={() => onSelectStory(item.user.id, item.stories)}
              onLongPress={() => {
                if (item.user.id !== currentUserId) {
                  confirmMute(item.user.id, item.user.display_name);
                }
              }}>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {preview ? (
                  <StoryPreview story={preview} />
                ) : (
                  <View style={[styles.previewMedia, styles.previewFallback]} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  style={styles.cardGradient}
                  pointerEvents="none"
                />
                {item.user.id !== currentUserId && (
                  <Pressable
                    hitSlop={6}
                    style={styles.moreBtn}
                    onPress={() => confirmMute(item.user.id, item.user.display_name)}>
                    <ThemedText style={styles.moreBtnText}>⋯</ThemedText>
                  </Pressable>
                )}
                <View style={styles.cardOverlay}>
                  <StoryAvatarRing
                    src={item.user.avatar_uri}
                    name={item.user.display_name}
                    hasStory
                    hasViewed={hasViewed}
                    size={40}
                  />
                  <ThemedText style={styles.cardName} numberOfLines={1}>
                    {item.user.display_name}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  row: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  tile: {
    width: TILE_W,
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  previewMedia: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  previewFallback: {
    backgroundColor: '#3A3A3C',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cardOverlay: {
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
    zIndex: 1,
  },
  cardName: {
    ...Typography.caption,
    fontSize: 11,
    color: '#FFFFFF',
    maxWidth: CARD_W - 8,
    textAlign: 'center',
  },
  plusBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: STORY_RING_COLORS[1],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  plusBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  moreBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  moreBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ownInitial: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  skeletonCard: {
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
});
