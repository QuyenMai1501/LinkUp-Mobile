import { setAudioModeAsync } from 'expo-audio';

export type CallAudioKind = 'voice' | 'video';

/**
 * Audio mode cho chuông cuộc gọi tới: phát qua loa ngoài, chưa mở micro.
 * Gọi trước khi phát ringtone để không dùng chung mode với WebRTC.
 */
export async function prepareRingtoneAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'doNotMix',
  });
}

/**
 * Audio mode cho WebRTC: mở micro; thoại route earpiece, video route loa ngoài
 * để giảm feedback khi cả hai bên cùng dùng loa.
 */
export async function prepareCallAudio(kind: CallAudioKind): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
    shouldRouteThroughEarpiece: kind === 'voice',
    interruptionMode: 'doNotMix',
  });
}

/** Khôi phục audio mode cho media thường sau khi kết thúc cuộc gọi. */
export async function restoreCallAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'mixWithOthers',
  });
}

/**
 * Bật xử lý âm thanh WebRTC (AEC/NS/AGC). Các key `goog*` là constraint gốc
 * của libwebrtc; key chuẩn giữ lại cho tương thích.
 */
export const CALL_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googAutoGainControl: true,
  googHighpassFilter: true,
} as const;
