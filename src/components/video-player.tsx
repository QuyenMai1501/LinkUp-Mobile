import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoPlayerProps {
  uri: string;
  style?: object;
  interactive?: boolean;
  /** Bật âm thanh (mặc định false — giữ hành vi cũ của post/media-viewer). */
  muted?: boolean;
  /** Lặp lại video (mặc định true — giữ hành vi cũ). */
  loop?: boolean;
  /** Dùng điều khiển video gốc của expo-video (bỏ overlay play custom). */
  nativeControls?: boolean;
  /**
   * Phát tự động (muted theo prop) khi true, pause khi false — feed dùng cho
   * autoplay 1 video/lúc. User tap pause thủ công sẽ không bị autoplay đè.
   */
  autoplay?: boolean;
}

export default function VideoPlayer({
  uri,
  style,
  interactive = true,
  muted = true,
  loop = true,
  nativeControls = false,
  autoplay = false,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);
  // User tap pause thủ công → autoplay effect không đè (mirror web userPausedRef).
  const userPausedRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.muted = muted;
    p.loop = loop;
  });

  // Sync overlay theo trạng thái thật của player (autoplay + tap + nativeControls).
  useEffect(() => {
    const sub = player.addListener('playingChange', (e: { isPlaying: boolean }) => {
      setPlaying(e.isPlaying);
      setShowPlayButton(!e.isPlaying);
    });
    return () => sub.remove();
  }, [player]);

  // Feed autoplay: phát khi autoplay=true (trừ khi user đã tap pause), pause khi false.
  // pause() trên player đang paused là no-op — an toàn cho mọi call site không autoplay.
  useEffect(() => {
    if (autoplay && !userPausedRef.current) {
      player.play();
    } else if (!autoplay) {
      userPausedRef.current = false;
      player.pause();
    }
  }, [autoplay, player]);

  const togglePlay = useCallback(() => {
    if (playing) {
      userPausedRef.current = true;
      player.pause();
    } else {
      userPausedRef.current = false;
      player.play();
    }
  }, [playing, player]);

  if (nativeControls) {
    return (
      <View style={[styles.container, style]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
        />
      </View>
    );
  }

  const content = (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      {showPlayButton && (
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <View style={styles.playIcon} />
          </View>
        </View>
      )}
    </>
  );

  if (!interactive) {
    return <View style={[styles.container, style]}>{content}</View>;
  }

  return (
    <Pressable style={[styles.container, style]} onPress={togglePlay}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderLeftWidth: 18,
    borderLeftColor: '#fff',
    borderTopWidth: 11,
    borderTopColor: 'transparent',
    borderBottomWidth: 11,
    borderBottomColor: 'transparent',
  },
});
