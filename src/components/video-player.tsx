import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '@/components/ui/icon';
import { FontFamilies } from '@/constants/typography';

const HIDE_DELAY = 2500;
const SEEK_STEP = 10;
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VideoPlayerProps {
  uri: string;
  style?: object;
  interactive?: boolean;
  /** Bật âm thanh (mặc định true — mirror web muted init; feed autoplay vẫn truyền muted theo prop). */
  muted?: boolean;
  /** Lặp lại video (mặc định true — giữ hành vi cũ). */
  loop?: boolean;
  /** Dùng điều khiển video gốc của expo-video (chat lightbox/ad preview). */
  nativeControls?: boolean;
  /**
   * Phát tự động (muted theo prop) khi true, pause khi false — feed dùng cho
   * autoplay 1 video/lúc. User tap pause thủ công sẽ không bị autoplay đè.
   */
  autoplay?: boolean;
  /**
   * Bắt tap toàn vùng video (trừ các nút controls phía trên).
   * Native VideoView nuốt touch (expo-video Android `onTouchEvent` luôn
   * return true, iOS AVPlayerViewController gesture) → cần catcher Pressable
   * đặt TRÊN VideoView để tap đi vào RN. Không truyền → tự togglePlay.
   */
  onTap?: () => void;
  /**
   * Long-press vùng video (catcher trên VideoView) → mở MessageActions.
   * Long-press xong không kích hoạt onTap/togglePlay.
   */
  onLongPress?: () => void;
  onEnd?: () => void;
  /**
   * Nông controls lên trên overlay phía dưới (vd: info bar trong media-viewer)
   * để không bị che. Đơn vị px, cộng vào paddingBottom của overlay.
   */
  controlsBottomInset?: number;
}

export default function VideoPlayer({
  uri,
  style,
  interactive = true,
  muted = true,
  loop = true,
  nativeControls = false,
  autoplay = false,
  onTap,
  onLongPress,
  onEnd,
  controlsBottomInset = 0,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(muted);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekWidth, setSeekWidth] = useState(0);
  // User tap pause thủ công → autoplay effect không đè (mirror web userPausedRef).
  const userPausedRef = useRef(false);
  const videoViewRef = useRef<VideoView>(null);
  // Auto-hide controls bằng state (không ref) để seek chain/PanResponder
  // không capture ref → react-compiler không flag refs trong render.
  const [hideState, setHideState] = useState({ tick: 0, enabled: true });

  const player = useVideoPlayer(uri, (p) => {
    p.muted = muted;
    p.loop = loop;
    p.timeUpdateEventInterval = 0.5;
  });

  const clearHideTimer = useCallback(() => {
    setHideState((s) => (s.enabled ? { ...s, enabled: false } : s));
  }, []);

  const startHideTimer = useCallback(() => {
    setHideState((s) => ({ tick: s.tick + 1, enabled: true }));
  }, []);

  // Sync overlay theo trạng thái thật của player (autoplay + tap + nativeControls).
  useEffect(() => {
    const subs = [
      player.addListener('playingChange', (e: { isPlaying: boolean }) => {
        setPlaying(e.isPlaying);
        if (e.isPlaying) {
          startHideTimer();
        } else {
          setShowControls(true);
          clearHideTimer();
        }
      }),
      player.addListener('timeUpdate', (e: { currentTime: number }) => {
        setCurrentTime(e.currentTime);
        const d = player.duration;
        if (d > 0) setDuration(d);
      }),
      player.addListener('sourceLoad', (e: { duration: number }) => {
        if (e.duration > 0) setDuration(e.duration);
      }),
      player.addListener('mutedChange', (e: { muted: boolean }) => setIsMuted(e.muted)),
      player.addListener('playbackRateChange', (e: { playbackRate: number }) =>
        setSpeed(e.playbackRate),
      ),
      player.addListener('playToEnd', () => onEnd?.()),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, startHideTimer, clearHideTimer, onEnd]);

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

  // Auto-hide controls 2.5s sau mỗi lần start (mirror web HIDE_DELAY).
  // enabled=false (pause/clear) → không reschedule.
  useEffect(() => {
    if (!hideState.enabled) return;
    const id = setTimeout(() => {
      setShowControls(false);
      setSpeedMenuOpen(false);
    }, HIDE_DELAY);
    return () => clearTimeout(id);
  }, [hideState]);

  const togglePlay = useCallback(() => {
    if (playing) {
      userPausedRef.current = true;
      player.pause();
      setPlaying(false);
      setShowControls(true);
      clearHideTimer();
    } else {
      userPausedRef.current = false;
      player.play();
      setPlaying(true);
      startHideTimer();
    }
  }, [playing, player, clearHideTimer, startHideTimer]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    // eslint-disable-next-line react-hooks/immutability -- expo-video player là object mutable, API chính thức
    player.muted = next;
    setIsMuted(next);
    if (playing) startHideTimer();
  }, [isMuted, player, playing, startHideTimer]);

  const seekBy = useCallback(
    (delta: number) => {
      const current = player.currentTime;
      const max = duration || player.duration || 0;
      let target = current + delta;
      if (target < 0) target = 0;
      if (max > 0 && target > max) target = max;
      player.seekBy(target - current);
      setCurrentTime(target);
      if (playing) startHideTimer();
    },
    [duration, player, playing, startHideTimer],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const clamped = Math.min(1, Math.max(0, ratio));
      const target = clamped * duration;
      player.seekBy(target - player.currentTime);
      setCurrentTime(target);
      if (playing) startHideTimer();
    },
    [duration, player, playing, startHideTimer],
  );

  const seekFromX = useCallback(
    (x: number) => {
      if (seekWidth <= 0) return;
      seekToRatio(x / seekWidth);
    },
    [seekWidth, seekToRatio],
  );

  const seekPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => seekFromX(evt.nativeEvent.locationX),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [seekFromX],
  );

  const handleSpeedSelect = useCallback(
    (next: number) => {
      // eslint-disable-next-line react-hooks/immutability -- expo-video player là object mutable, API chính thức
      player.playbackRate = next;
      setSpeed(next);
      setSpeedMenuOpen(false);
      if (playing) startHideTimer();
    },
    [player, playing, startHideTimer],
  );

  const handleFullscreen = useCallback(() => {
    const view = videoViewRef.current;
    if (view) view.enterFullscreen().catch(() => {});
    if (playing) startHideTimer();
  }, [playing, startHideTimer]);

  // Catcher đặt SAU VideoView (chặn native nuốt touch) và TRƯỚC controls overlay
  // (children overlay sau catcher → hit-test bắt trước) để nút controls ăn trước.
  const handleCatcherPress = useCallback(() => {
    if (speedMenuOpen) {
      setSpeedMenuOpen(false);
      return;
    }
    if (onTap) {
      onTap();
      return;
    }
    if (interactive) {
      togglePlay();
      // Tap = reveal controls (mirror web mousemove): pause giữ hiện, play tự ẩn.
      setShowControls(true);
    }
  }, [speedMenuOpen, onTap, interactive, togglePlay]);

  if (nativeControls) {
    return (
      <View style={[styles.container, style]}>
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
        />
      </View>
    );
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const volumeIcon = isMuted ? 'volumeMute' : 'volumeHigh';

  const content = (
    <>
      <VideoView
        ref={videoViewRef}
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleCatcherPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel="video"
      />
      {showControls && (
        <View
          style={[styles.overlay, { paddingBottom: 6 + controlsBottomInset }]}
          pointerEvents="box-none">
          {!playing && (
            <View style={styles.bigPlay} pointerEvents="none">
              <Icon name="play" size={56} color="#fff" />
            </View>
          )}
          <View style={styles.seekRow} pointerEvents="box-none">
            <Text style={styles.time}>{formatTime(currentTime)}</Text>
            <View
              style={styles.seekTrackWrap}
              onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
              {...seekPan.panHandlers}
            >
              <View style={styles.seekRail} pointerEvents="none">
                <View style={[styles.seekFill, { width: `${progress}%` }]} />
                <View style={[styles.seekThumb, { left: `${progress}%` }]} />
              </View>
            </View>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.controlRow} pointerEvents="box-none">
            <Pressable
              style={styles.btn}
              onPress={togglePlay}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
            >
              <Icon name={playing ? 'pause' : 'play'} size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => seekBy(-SEEK_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Rewind"
            >
              <Icon name="rewind" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => seekBy(SEEK_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Forward"
            >
              <Icon name="forward" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={toggleMute}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
            >
              <Icon name={volumeIcon} size={20} color="#fff" />
            </Pressable>
            <View style={styles.spacer} />
            <View style={styles.speedWrap} pointerEvents="box-none">
              <Pressable
                style={styles.speedBtn}
                onPress={() => setSpeedMenuOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Speed"
              >
                <Text style={styles.speedText}>{speed}x</Text>
              </Pressable>
              {speedMenuOpen && (
                <View style={styles.speedMenu} pointerEvents="box-none">
                  {SPEEDS.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.speedItem, s === speed && styles.speedItemActive]}
                      onPress={() => handleSpeedSelect(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s}x`}
                    >
                      <Text
                        style={[styles.speedText, s === speed && styles.speedTextActive]}
                      >
                        {s}x
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Pressable
              style={styles.btn}
              onPress={handleFullscreen}
              accessibilityRole="button"
              accessibilityLabel="Fullscreen"
            >
              <Icon name="expand" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </>
  );

  return <View style={[styles.container, style]}>{content}</View>;
}

/**
 * Thumbnail frame đầu của video (paused, không controls) — dùng cho preview
 * trong composer/ad-form (mirror web `<video muted preload="metadata">`).
 */
export function VideoThumb({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return (
    <View style={[styles.container, style]}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
    </View>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  bigPlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seekTrackWrap: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  seekRail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'visible',
  },
  seekFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  seekThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
  },
  time: {
    color: '#fff',
    fontSize: 12,
    minWidth: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontFamily: FontFamilies.regular,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  speedWrap: {
    alignItems: 'center',
  },
  speedBtn: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  speedMenu: {
    position: 'absolute',
    bottom: 36,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 64,
  },
  speedItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  speedItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  speedText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamilies.semibold,
  },
  speedTextActive: {
    color: '#7dd3fc',
  },
});
