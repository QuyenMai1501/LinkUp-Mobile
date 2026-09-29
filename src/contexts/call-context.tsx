import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  RTCPeerConnection,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { getIceServers, type IceServer } from '@/api/calls';
import { getProfileByUserID } from '@/api/profile';
import { useAuth } from '@/contexts/auth-context';
import { useCallSocket } from '@/hooks/useCallSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { playRingtone, playRinging, stopRingtone } from '@/utils/ringtone';

import type {
  CallBusyPayload,
  CallIceCandidateInit,
  CallIncomingPayload,
  CallInitiatedPayload,
  CallMutePayload,
  CallPeer,
  CallSignalPayload,
  CallStatus,
  CallStatusPayload,
  CallType,
  CallVideoPayload,
} from '@/types/call';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';

export interface ActiveCall {
  callId: string;
  callType: CallType;
  peer: CallPeer;
  direction: 'outgoing' | 'incoming';
}

interface CallContextValue {
  phase: CallPhase;
  call: ActiveCall | null;
  lastStatus: CallStatus | null;
  duration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localMuted: boolean;
  localVideoOn: boolean;
  remoteMuted: boolean;
  remoteVideoOn: boolean;
  isInCall: boolean;
  startCall: (peer: CallPeer, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  dismiss: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

async function ensureCallPermissions(type: CallType): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS xin quyền tự động lúc getUserMedia
  const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (type === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, accessToken } = useAuth();
  const myUserId = user?.id ?? '';
  const socket = useCallSocket();
  const subscribe = socket.subscribe;

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [lastStatus, setLastStatus] = useState<CallStatus | null>(null);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localMuted, setLocalMuted] = useState(false);
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);

  const phaseRef = useRef<CallPhase>('idle');
  const callRef = useRef<ActiveCall | null>(null);
  const callIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingSignalsRef = useRef<{
    offer?: { type: string; sdp: string };
    ice: CallIceCandidateInit[];
  }>({ ice: [] });
  const iceServersRef = useRef<IceServer[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseBoth = (p: CallPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setActiveCall = (c: ActiveCall | null) => {
    callRef.current = c;
    setCall(c);
  };

  const showError = (message: string) => {
    Alert.alert(message);
  };

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  // CallProvider mount 1 lần ở root — kết nối lại khi token xuất hiện
  // (sau login) hoặc ngắt khi logout (useCallSocket mount lúc chưa có token).
  useEffect(() => {
    if (accessToken) socket.connect();
    else socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    getIceServers().then((servers) => {
      iceServersRef.current = servers;
    });
  }, []);

  const clearDuration = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const startDuration = () => {
    clearDuration();
    const started = Date.now();
    setDuration(0);
    durationTimerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - started) / 1000));
    }, 1000);
  };

  const closePeerConnection = () => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    pcRef.current = null;
  };

  const stopStreams = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const resetToIdle = () => {
    stopRingtone();
    closePeerConnection();
    stopStreams();
    pendingSignalsRef.current = { ice: [] };
    callIdRef.current = null;
    clearDuration();
    if (endedTimerRef.current) {
      clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    setActiveCall(null);
    setPhaseBoth('idle');
    setLastStatus(null);
    setDuration(0);
    setLocalMuted(false);
    setLocalVideoOn(false);
    setRemoteMuted(false);
    setRemoteVideoOn(false);
    setRemoteStream(null);
  };

  const showEnded = (status: CallStatus) => {
    stopRingtone();
    closePeerConnection();
    stopStreams();
    pendingSignalsRef.current = { ice: [] };
    callIdRef.current = null;
    clearDuration();
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    setPhaseBoth('ended');
    setLastStatus(status);
    setRemoteStream(null);
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    endedTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'ended') resetToIdle();
    }, 2000);
  };

  const createPeerConnection = async (callId: string) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pcRef.current = pc;

    pc.onicecandidate = (event: any) => {
      if (!event?.candidate) return;
      socket.send('call:signal', {
        call_id: callId,
        signal: { type: 'ice', candidate: event.candidate.toJSON() },
      });
    };

    pc.ontrack = (event: any) => {
      const stream = event?.streams?.[0];
      if (stream) {
        setRemoteStream(stream);
      }
    };

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }
    return pc;
  };

  const handleStatus = (payload: CallStatusPayload) => {
    // Fix race: call:status (event 'calling'/'missed') đến TRƯỚC call:initiated.
    // Seed call_id khi đang outgoing để không bỏ lọt trạng thái đầu tiên.
    if (
      callIdRef.current === null &&
      (payload.status === 'calling' || payload.status === 'missed') &&
      phaseRef.current === 'outgoing'
    ) {
      callIdRef.current = payload.call_id;
    }
    if (callIdRef.current !== payload.call_id) return;
    switch (payload.status) {
      case 'calling':
      case 'ringing':
        if (phaseRef.current === 'outgoing') playRinging();
        break;
      case 'connected':
        stopRingtone();
        setPhaseBoth('active');
        setRemoteVideoOn(callRef.current?.callType === 'video');
        setRemoteMuted(false);
        startDuration();
        break;
      case 'ended':
      case 'missed':
      case 'rejected':
      case 'cancelled':
      case 'busy':
        showEnded(payload.status);
        break;
    }
  };

  const handleIncoming = async (payload: CallIncomingPayload) => {
    if (phaseRef.current === 'ended') resetToIdle();
    if (phaseRef.current !== 'idle') return;
    callIdRef.current = payload.call_id;
    const peer: CallPeer = {
      user_id: payload.caller_id,
      display_name: t('call.unknown'),
      avatar_uri: '',
    };
    try {
      const profile = await getProfileByUserID(payload.caller_id);
      peer.display_name = profile.display_name || peer.display_name;
      peer.avatar_uri = profile.avatar_uri;
    } catch {
      /* giữ placeholder */
    }
    setActiveCall({
      callId: payload.call_id,
      callType: payload.call_type,
      peer,
      direction: 'incoming',
    });
    setPhaseBoth('incoming');
    setDuration(0);
    playRingtone();
  };

  const handleInitiated = async (payload: CallInitiatedPayload) => {
    if (phaseRef.current !== 'outgoing') return;
    callIdRef.current = payload.call_id;
    setActiveCall(
      callRef.current
        ? { ...callRef.current, callId: payload.call_id }
        : null,
    );
    try {
      const pc = await createPeerConnection(payload.call_id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send('call:signal', {
        call_id: payload.call_id,
        signal: { type: 'offer', sdp: offer.sdp },
      });
    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
      showError(t('call.failed'));
      showEnded('ended');
    }
  };

  const handleSignal = async (payload: CallSignalPayload) => {
    if (callIdRef.current !== payload.call_id) return;
    const pc = pcRef.current;
    const sig = payload.signal;
    if (!pc) {
      // Chưa tạo PC (callee chưa bấm Accept) → buffer offer/ice
      if (sig.type === 'offer') {
        pendingSignalsRef.current.offer = { type: sig.type, sdp: sig.sdp };
      } else if (sig.type === 'ice') {
        pendingSignalsRef.current.ice.push(sig.candidate);
      }
      return;
    }
    try {
      if (sig.type === 'offer' || sig.type === 'answer') {
        await pc.setRemoteDescription({ type: sig.type, sdp: sig.sdp });
      } else if (sig.type === 'ice') {
        await pc.addIceCandidate(sig.candidate);
      }
    } catch (err) {
      console.error('Failed to handle call signal:', err);
    }
  };

  const handleMute = (payload: CallMutePayload) => {
    if (callIdRef.current !== payload.call_id) return;
    if (payload.user_id === myUserIdRef.current) return;
    setRemoteMuted(payload.muted);
  };

  const handleVideo = (payload: CallVideoPayload) => {
    if (callIdRef.current !== payload.call_id) return;
    if (payload.user_id === myUserIdRef.current) return;
    setRemoteVideoOn(payload.video_enabled);
  };

  const handleBusy = (payload: CallBusyPayload) => {
    if (phaseRef.current !== 'outgoing') return;
    if (callRef.current && callRef.current.peer.user_id === payload.callee_id) {
      showEnded('busy');
    }
  };

  const handlersRef = useRef<Record<string, (payload: unknown) => void>>({});
  useEffect(() => {
    handlersRef.current = {
      'call:status': handleStatus as (payload: unknown) => void,
      'call:incoming': handleIncoming as (payload: unknown) => void,
      'call:initiated': handleInitiated as (payload: unknown) => void,
      'call:signal': handleSignal as (payload: unknown) => void,
      'call:mute': handleMute as (payload: unknown) => void,
      'call:video': handleVideo as (payload: unknown) => void,
      'call:busy': handleBusy as (payload: unknown) => void,
    };
  });

  useEffect(() => {
    const unsubscribers = [
      subscribe('call:status', (payload) =>
        handlersRef.current['call:status']?.(payload),
      ),
      subscribe('call:incoming', (payload) =>
        handlersRef.current['call:incoming']?.(payload),
      ),
      subscribe('call:initiated', (payload) =>
        handlersRef.current['call:initiated']?.(payload),
      ),
      subscribe('call:signal', (payload) =>
        handlersRef.current['call:signal']?.(payload),
      ),
      subscribe('call:mute', (payload) =>
        handlersRef.current['call:mute']?.(payload),
      ),
      subscribe('call:video', (payload) =>
        handlersRef.current['call:video']?.(payload),
      ),
      subscribe('call:busy', (payload) =>
        handlersRef.current['call:busy']?.(payload),
      ),
    ];
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [subscribe]);

  // Tự reset nếu 30s vẫn chưa nhận call:initiated khi đang gọi ra
  useEffect(() => {
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    if (phase === 'outgoing') {
      outgoingTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'outgoing') {
          resetToIdle();
          showError(t('call.noAnswer'));
        }
      }, 30000);
    }
    return () => {
      if (outgoingTimerRef.current) {
        clearTimeout(outgoingTimerRef.current);
        outgoingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, t]);

  useEffect(() => {
    return () => {
      resetToIdle();
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = async (peer: CallPeer, type: CallType) => {
    if (phaseRef.current === 'ended') resetToIdle();
    if (phaseRef.current !== 'idle') return;
    if (socket.status !== 'open') {
      showError(t('call.noConnection'));
      return;
    }
    const granted = await ensureCallPermissions(type);
    if (!granted) {
      showError(t('call.permissionDenied'));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
    } catch {
      showError(t('call.permissionDenied'));
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    setLocalMuted(false);
    setLocalVideoOn(type === 'video');
    setRemoteMuted(false);
    setRemoteVideoOn(false);
    setActiveCall({ callId: '', callType: type, peer, direction: 'outgoing' });
    setPhaseBoth('outgoing');
    setDuration(0);
    playRinging();
    socket.send('call:initiate', {
      callee_id: peer.user_id,
      call_type: type,
    });
  };

  const acceptCall = async () => {
    const active = callRef.current;
    if (!active || phaseRef.current !== 'incoming') return;
    const granted = await ensureCallPermissions(active.callType);
    if (!granted) {
      showError(t('call.permissionDenied'));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: true,
        video: active.callType === 'video',
      });
    } catch {
      showError(t('call.permissionDenied'));
      return;
    }
    stopRingtone();
    localStreamRef.current = stream;
    setLocalStream(stream);
    setLocalMuted(false);
    setLocalVideoOn(active.callType === 'video');
    socket.send('call:accept', { call_id: active.callId });
    try {
      const pc = await createPeerConnection(active.callId);
      const pending = pendingSignalsRef.current;
      if (pending.offer) {
        await pc.setRemoteDescription({
          type: pending.offer.type,
          sdp: pending.offer.sdp,
        });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send('call:signal', {
          call_id: active.callId,
          signal: { type: 'answer', sdp: answer.sdp },
        });
      }
      for (const candidate of pending.ice) {
        await pc.addIceCandidate(candidate);
      }
      pendingSignalsRef.current = { ice: [] };
    } catch (err) {
      console.error('Failed to accept call:', err);
      showError(t('call.failed'));
      showEnded('ended');
    }
  };

  const rejectCall = () => {
    const active = callRef.current;
    if (!active || phaseRef.current !== 'incoming') return;
    stopRingtone();
    socket.send('call:reject', { call_id: active.callId });
    showEnded('rejected');
  };

  const endCall = () => {
    const active = callRef.current;
    if (
      !active ||
      (phaseRef.current !== 'active' && phaseRef.current !== 'outgoing')
    ) {
      return;
    }
    socket.send('call:end', { call_id: active.callId });
    showEnded(phaseRef.current === 'outgoing' ? 'cancelled' : 'ended');
  };

  const toggleMute = () => {
    const active = callRef.current;
    if (!active || phaseRef.current !== 'active') return;
    const next = !localMuted;
    setLocalMuted(next);
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    socket.send('call:toggle_mute', { call_id: active.callId, muted: next });
  };

  const toggleVideo = () => {
    const active = callRef.current;
    if (
      !active ||
      active.callType !== 'video' ||
      phaseRef.current !== 'active'
    ) {
      return;
    }
    const next = !localVideoOn;
    setLocalVideoOn(next);
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
    socket.send('call:video_toggle', {
      call_id: active.callId,
      video_enabled: next,
    });
  };

  const dismiss = () => {
    if (phaseRef.current === 'ended') resetToIdle();
  };

  return (
    <CallContext.Provider
      value={{
        phase,
        call,
        lastStatus,
        duration,
        localStream,
        remoteStream,
        localMuted,
        localVideoOn,
        remoteMuted,
        remoteVideoOn,
        isInCall: phase !== 'idle',
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        dismiss,
      }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
