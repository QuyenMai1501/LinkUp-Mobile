import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoPlayerProps {
  uri: string;
  style?: object;
}

export default function VideoPlayer({ uri, style }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);

  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
  });

  const togglePlay = useCallback(() => {
    if (playing) {
      player.pause();
      setPlaying(false);
      setShowPlayButton(true);
    } else {
      player.play();
      setPlaying(true);
      setShowPlayButton(false);
      setTimeout(() => setShowPlayButton(false), 2000);
    }
  }, [playing, player]);

  return (
    <Pressable style={[styles.container, style]} onPress={togglePlay}>
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
