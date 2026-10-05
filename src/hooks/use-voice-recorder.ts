import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

/** Server chặn audio > 300s (ValidateAudioDuration). */
export const MAX_VOICE_SECONDS = 300;

export interface VoiceRecording {
  uri: string;
  durationSec: number;
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);

  // Dừng ghi khi unmount — tránh rò mic sau khi rời màn chat.
  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false;
        void recorder.stop().catch(() => {});
      }
    },
    [recorder],
  );

  // allowsRecording chỉ có ý nghĩa trên iOS; playsInSilentMode để ghi được
  // khi máy đang ở chế độ rung/im lặng.
  const applyAudioMode = useCallback(async (allowsRecording: boolean) => {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recordingRef.current) return false;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await applyAudioMode(true);
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      await applyAudioMode(false);
      return false;
    }
    recordingRef.current = true;
    setRecording(true);
    return true;
  }, [recorder, applyAudioMode]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    if (!recordingRef.current) return null;
    // durationMillis phải đọc TRƯỚC stop() — status reset về 0 khi dừng.
    const durationMs = recorder.getStatus().durationMillis;
    recordingRef.current = false;
    let stopped = true;
    try {
      await recorder.stop();
    } catch {
      stopped = false;
    }
    setRecording(false);
    await applyAudioMode(false);
    if (!stopped) return null;
    const uri = recorder.uri;
    if (!uri) return null;
    const durationSec = Math.min(
      MAX_VOICE_SECONDS,
      Math.max(1, Math.round(durationMs / 1000)),
    );
    return { uri, durationSec };
  }, [recorder, applyAudioMode]);

  const cancel = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    try {
      await recorder.stop();
    } catch {
      /* recorder có thể đã dừng giữa chừng */
    }
    setRecording(false);
    await applyAudioMode(false);
  }, [recorder, applyAudioMode]);

  const elapsedSec = Math.round(recorderState.durationMillis / 1000);

  return {
    recording,
    elapsedSec,
    maxReached: elapsedSec >= MAX_VOICE_SECONDS,
    start,
    stop,
    cancel,
  };
}
