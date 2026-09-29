import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

// Chuông gọi tới: reo 0.7s – nghỉ 0.3s, loop (file wav cùng nhịp với rung).
const ringtoneSource = require('../../assets/sounds/ringtone.wav');
// Tiếng reo gọi ra: một tiếng 0.35s.
const ringingSource = require('../../assets/sounds/ringing.wav');

let ringtonePlayer: AudioPlayer | null = null;
let ringingPlayer: AudioPlayer | null = null;
let audioModeReady = false;
let ringtoneActive = false;

function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(
    () => {
      audioModeReady = false;
    },
  );
}

function getRingtonePlayer(): AudioPlayer {
  if (!ringtonePlayer) {
    ringtonePlayer = createAudioPlayer(ringtoneSource);
    ringtonePlayer.loop = true;
  }
  return ringtonePlayer;
}

function getRingingPlayer(): AudioPlayer {
  if (!ringingPlayer) {
    ringingPlayer = createAudioPlayer(ringingSource);
  }
  return ringingPlayer;
}

function safePlay(player: AudioPlayer) {
  try {
    void player.seekTo(0);
    player.play();
  } catch {
    /* audio session chưa sẵn sàng — bỏ qua */
  }
}

function safeStop(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.pause();
    void player.seekTo(0);
  } catch {
    /* ignore */
  }
}

/** Chuông + rung cho cuộc gọi tới (lặp). */
export function playRingtone() {
  if (ringtoneActive) return;
  ringtoneActive = true;
  ensureAudioMode();
  safePlay(getRingtonePlayer());
  Vibration.vibrate([0, 700, 300], true);
}

/** Tiếng reo + rung nhẹ khi gọi ra. */
export function playRinging() {
  ensureAudioMode();
  safePlay(getRingingPlayer());
  Vibration.vibrate(300);
}

export function stopRingtone() {
  ringtoneActive = false;
  safeStop(ringtonePlayer);
  safeStop(ringingPlayer);
  Vibration.cancel();
}
