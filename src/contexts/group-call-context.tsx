import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  RTCPeerConnection,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { showAlert } from '@/utils/alert';
import { getIceServers, type IceServer } from '@/api/calls';
import { getProfileByUserID } from '@/api/profile';
import { useAuth } from '@/contexts/auth-context';
import { useGroupCallSocket } from '@/hooks/useGroupCallSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { playRingtone, stopRingtone } from '@/utils/ringtone';

import type {
  ActiveGroupCall,
  GroupCallCreatedPayload,
  GroupCallEndedPayload,
  GroupCallIncomingPayload,
  GroupCallJoinRequestPayload,
  GroupCallJoinRejectedPayload,
  GroupCallJoinedPayload,
  GroupCallLeftPayload,
  GroupCallMicPayload,
  GroupCallParticipant,
  GroupCallParticipantsResponse,
  GroupCallPhase,
  GroupCallSignalBody,
  GroupCallSignalPayload,
  GroupCallVideoPayload,
} from '@/types/group-call';

interface GroupCallContextValue {
  phase: GroupCallPhase;
  call: ActiveGroupCall | null;
  duration: number;
  localStream: MediaStream | null;
  localMuted: boolean;
  localVideoOn: boolean;
  isCreator: boolean;
  isInGroupCall: boolean;
  remoteStreams: Map<string, MediaStream>;
  startGroupCall: (chatId: string, participantIds?: string[]) => Promise<void>;
  joinGroupCall: (callId: string) => Promise<void>;
  declineGroupCall: () => void;
  acceptJoinRequest: (userId: string) => void;
  rejectJoinRequest: (userId: string) => void;
  endGroupCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  dismiss: () => void;
  /** Đang thu nhỏ overlay về mini bar (mirror Web minimized phase). */
  minimized: boolean;
  minimize: () => void;
  expand: () => void;
}

const GroupCallContext = createContext<GroupCallContextValue | undefined>(
  undefined,
);

// Server chỉ nhận call_type=video (client.go) → luôn xin cả mic + camera.
async function ensureGroupCallPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perms = [
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    PermissionsAndroid.PERMISSIONS.CAMERA,
  ];
  const result = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * Cuộc gọi nhóm — full mesh WebRTC, mirror Web GroupCallContext.
 * WS riêng /api/group-calls/ws (useGroupCallSocket); server relay
 * group:call:signal tới tất cả joined. Overlay active có thể thu nhỏ
 * về mini bar nổi (minimized/minimize/expand — mirror Web).
 */
export function GroupCallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, accessToken } = useAuth();
  const myUserId = user?.id ?? '';
  const socket = useGroupCallSocket();

  const [phase, setPhase] = useState<GroupCallPhase>('idle');
  const [call, setCall] = useState<ActiveGroupCall | null>(null);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localMuted, setLocalMuted] = useState(false);
  const [localVideoOn, setLocalVideoOn] = useState(true);
  const [remoteStreams, setRemoteStreams] = useState<
    Map<string, MediaStream>
  >(new Map());
  const [minimized, setMinimized] = useState(false);
  // Reset thu nhỏ khi callId đổi (adjust-state-during-render — react-compiler
  // lint bắt setState đồng bộ trong effect)
  const [prevMinCallId, setPrevMinCallId] = useState<string | null>(null);
  const currentCallId = call?.callId ?? null;
  if (currentCallId !== prevMinCallId) {
    setPrevMinCallId(currentCallId);
    setMinimized(false);
  }

  const phaseRef = useRef<GroupCallPhase>('idle');
  const callRef = useRef<ActiveGroupCall | null>(null);
  const callIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef('');
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceServersRef = useRef<IceServer[]>([]);
  const pendingSignalsRef = useRef<
    Map<string, { offer?: { type: string; sdp: string }; ice: unknown[] }>
  >(new Map());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantsRef = useRef<Map<string, GroupCallParticipant>>(new Map());

  const setPhaseBoth = (p: GroupCallPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const setCallState = useCallback((c: ActiveGroupCall | null) => {
    callRef.current = c;
    callIdRef.current = c?.callId ?? null;
    setCall(c);
  }, []);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  // Mount 1 lần ở root — reconnect khi token xuất hiện (sau login).
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

  // Fetch display_name/avatar cho participant (server chỉ trả user_id).
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profile = await getProfileByUserID(userId);
      const p = participantsRef.current.get(userId);
      if (p && profile) {
        p.display_name = profile.display_name || userId;
        p.avatar_uri = profile.avatar_uri || '';
        participantsRef.current.set(userId, { ...p });
        setCallState(
          callRef.current
            ? { ...callRef.current, participants: new Map(participantsRef.current) }
            : null,
        );
      }
    } catch {
      /* placeholder user_id */
    }
  }, [setCallState]);

  const clearDuration = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const startDuration = useCallback(() => {
    clearDuration();
    const started = Date.now();
    setDuration(0);
    durationTimerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - started) / 1000));
    }, 1000);
  }, []);

  const closeAllPeerConnections = () => {
    pcsRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    pcsRef.current.clear();
  };

  const stopStreams = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const resetToIdle = useCallback(() => {
    stopRingtone();
    closeAllPeerConnections();
    stopStreams();
    pendingSignalsRef.current.clear();
    participantsRef.current.clear();
    callIdRef.current = null;
    clearDuration();
    if (endedTimerRef.current) {
      clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
    setCallState(null);
    setPhaseBoth('idle');
    setDuration(0);
    setLocalMuted(false);
    setLocalVideoOn(true);
    setRemoteStreams(new Map());
  }, [setCallState]);

  const showEnded = useCallback(
    (extraMs = 3000) => {
      stopRingtone();
      closeAllPeerConnections();
      stopStreams();
      pendingSignalsRef.current.clear();
      callIdRef.current = null;
      clearDuration();
      setPhaseBoth('ended');
      setRemoteStreams(new Map());
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
      endedTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'ended') resetToIdle();
      }, extraMs);
    },
    [resetToIdle],
  );

  const getOrCreatePc = useCallback(
    (remoteUserId: string, callId: string) => {
      const existing = pcsRef.current.get(remoteUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcsRef.current.set(remoteUserId, pc);

      pc.onicecandidate = (event: any) => {
        if (!event.candidate) return;
        const candidate =
          typeof event.candidate.toJSON === 'function'
            ? event.candidate.toJSON()
            : event.candidate;
        socket.send('group:call:signal', {
          call_id: callId,
          signal: { type: 'ice', candidate },
        });
      };

      pc.ontrack = (event: any) => {
        const stream = event.streams[0];
        if (stream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(remoteUserId, stream);
            return next;
          });
          const p = participantsRef.current.get(remoteUserId);
          if (p) {
            p.is_active = true;
            participantsRef.current.set(remoteUserId, { ...p });
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected'
        ) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      return pc;
    },
    [socket],
  );

  const createOfferForPeer = useCallback(
    async (remoteUserId: string, callId: string) => {
      const pc = getOrCreatePc(remoteUserId, callId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.send('group:call:signal', {
          call_id: callId,
          signal: { type: 'offer', sdp: offer.sdp },
        });
      } catch {
        /* peer không bắt signal — cleanup ở onconnectionstatechange */
      }
    },
    [getOrCreatePc, socket],
  );

  // Áp buffered ICE cho sender sau khi có remote description.
  const flushBufferedIce = useCallback(
    async (senderId: string, pc: RTCPeerConnection) => {
      const buf = pendingSignalsRef.current.get(senderId);
      if (!buf || buf.ice.length === 0) return;
      pendingSignalsRef.current.delete(senderId);
      for (const c of buf.ice) {
        await pc.addIceCandidate(c);
      }
    },
    [],
  );

  const handleSignal = useCallback(
    async (payload: GroupCallSignalPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      if (payload.sender_id === myUserIdRef.current) return;

      const sig = payload.signal as GroupCallSignalBody & {
        type: string;
        sdp?: string;
        candidate?: unknown;
      };
      const senderId = payload.sender_id;
      const pc = pcsRef.current.get(senderId);

      if (!pc) {
        // Chưa có PC (signal tới trước joined) — buffer offer/ICE.
        if (!pendingSignalsRef.current.has(senderId)) {
          pendingSignalsRef.current.set(senderId, { ice: [] });
        }
        const buf = pendingSignalsRef.current.get(senderId)!;
        if (sig.type === 'offer' && sig.sdp) {
          buf.offer = { type: sig.type, sdp: sig.sdp };
        } else if (sig.type === 'ice' && sig.candidate) {
          buf.ice.push(sig.candidate);
        }
        return;
      }

      try {
        if (sig.type === 'offer' && sig.sdp) {
          await pc.setRemoteDescription({ type: 'offer', sdp: sig.sdp });
          await flushBufferedIce(senderId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.send('group:call:signal', {
            call_id: payload.call_id,
            signal: { type: 'answer', sdp: answer.sdp },
          });
        } else if (sig.type === 'answer' && sig.sdp) {
          await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
          await flushBufferedIce(senderId, pc);
        } else if (sig.type === 'ice' && sig.candidate) {
          if (!pc.remoteDescription) {
            // Chưa có remote description — buffer ICE, áp sau setRemoteDescription.
            if (!pendingSignalsRef.current.has(senderId)) {
              pendingSignalsRef.current.set(senderId, { ice: [] });
            }
            pendingSignalsRef.current.get(senderId)!.ice.push(sig.candidate);
            return;
          }
          await pc.addIceCandidate(sig.candidate);
        }
      } catch {
        /* SDP tranh chấp — bỏ qua */
      }
    },
    [socket, flushBufferedIce],
  );

  // Áp buffered signals khi PC vừa được tạo cho sender.
  const flushPendingSignals = useCallback(
    async (senderId: string) => {
      const buf = pendingSignalsRef.current.get(senderId);
      if (!buf) return;
      let pc = pcsRef.current.get(senderId);
      if (!pc && buf.offer && callIdRef.current) {
        // Chưa có PC nhưng buffer có offer — tạo passive PC rồi áp.
        pc = getOrCreatePc(senderId, callIdRef.current);
      }
      if (!pc) return;
      pendingSignalsRef.current.delete(senderId);
      try {
        if (buf.offer) {
          await pc.setRemoteDescription(buf.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (callIdRef.current) {
            socket.send('group:call:signal', {
              call_id: callIdRef.current,
              signal: { type: 'answer', sdp: answer.sdp },
            });
          }
        }
        for (const c of buf.ice) {
          await pc.addIceCandidate(c);
        }
      } catch {
        /* bỏ qua */
      }
    },
    [socket, getOrCreatePc],
  );

  const handleIncoming = useCallback(
    (payload: GroupCallIncomingPayload) => {
      if (phaseRef.current === 'ended') resetToIdle();
      if (phaseRef.current !== 'idle') return;

      callIdRef.current = payload.call_id;

      const participants = new Map<string, GroupCallParticipant>();
      const ensure = (uid: string) => {
        if (participants.has(uid)) return;
        participants.set(uid, {
          user_id: uid,
          display_name: uid === myUserIdRef.current ? t('groupCall.you') : uid,
          avatar_uri: '',
          muted: false,
          video_enabled: true,
          is_active: false,
        });
      };
      payload.participants.forEach(ensure);
      ensure(payload.caller_id);

      setCallState({
        callId: payload.call_id,
        chatId: payload.chat_id,
        callerId: payload.caller_id,
        isVideo: payload.is_video,
        participants,
        pendingRequests: [],
      });
      setPhaseBoth('ringing');
      setDuration(0);
      participantsRef.current = participants;
      playRingtone();
      // Lazy profile — không block ringtone.
      const ids = new Set([...payload.participants, payload.caller_id]);
      ids.forEach((uid) => {
        if (uid !== myUserIdRef.current) void loadProfile(uid);
      });
    },
    [resetToIdle, setCallState, loadProfile, t],
  );

  const handleCreated = useCallback(
    async (payload: GroupCallCreatedPayload) => {
      if (phaseRef.current !== 'connecting') return;

      callIdRef.current = payload.call_id;

      const participants = new Map<string, GroupCallParticipant>();
      for (const uid of payload.participants) {
        participants.set(uid, {
          user_id: uid,
          display_name: uid === myUserIdRef.current ? t('groupCall.you') : uid,
          avatar_uri: '',
          muted: false,
          video_enabled: true,
          is_active: false,
        });
      }

      setCallState({
        callId: payload.call_id,
        chatId: payload.chat_id,
        callerId: payload.caller_id,
        isVideo: payload.is_video,
        participants,
        pendingRequests: [],
      });
      participantsRef.current = participants;

      setPhaseBoth('active');
      startDuration();

      payload.participants.forEach((uid) => {
        if (uid !== myUserIdRef.current) void loadProfile(uid);
      });

      // Creator offer cho tất cả participant đã invite.
      for (const uid of payload.participants) {
        if (uid !== myUserIdRef.current) {
          await createOfferForPeer(uid, payload.call_id);
        }
      }
    },
    [createOfferForPeer, setCallState, loadProfile, startDuration, t],
  );

  const handleJoined = useCallback(
    async (payload: GroupCallJoinedPayload) => {
      if (callIdRef.current !== payload.call_id) return;

      if (payload.user_id === myUserIdRef.current) {
        if (phaseRef.current === 'connecting') {
          setPhaseBoth('active');
          startDuration();
        }
        // Join từ history bubble — chưa có call state, tạo tối thiểu từ joined payload.
        if (!callRef.current) {
          const self = new Map<string, GroupCallParticipant>();
          self.set(myUserIdRef.current, {
            user_id: myUserIdRef.current,
            display_name: t('groupCall.you'),
            avatar_uri: '',
            muted: false,
            video_enabled: true,
            is_active: true,
          });
          setCallState({
            callId: payload.call_id,
            chatId: payload.chat_id,
            callerId: '',
            isVideo: true,
            participants: self,
            pendingRequests: [],
          });
          participantsRef.current = self;
        }
        // Joiner: xin danh sách joined để tạo PC passive cho existing members.
        // Existing member sẽ offer cho mình — mình chỉ answer (tránh glare).
        socket.send('group:call:list-participants', { call_id: payload.call_id });
        // Flush offer/ICE có thể đã tới trước joined.
        const pendingIds = Array.from(pendingSignalsRef.current.keys());
        for (const uid of pendingIds) {
          await flushPendingSignals(uid);
        }
        return;
      }

      // Người mới join — thêm participant + offer cho họ (existing offer).
      participantsRef.current.set(payload.user_id, {
        user_id: payload.user_id,
        display_name: payload.user_id,
        avatar_uri: '',
        muted: false,
        video_enabled: true,
        is_active: false,
      });
      setCallState(
        callRef.current
          ? { ...callRef.current, participants: new Map(participantsRef.current) }
          : null,
      );
      void loadProfile(payload.user_id);

      if (callIdRef.current) {
        await createOfferForPeer(payload.user_id, callIdRef.current);
      }
      // Signal buffer có thể tới trước joined — áp ngay.
      await flushPendingSignals(payload.user_id);
    },
    [createOfferForPeer, setCallState, loadProfile, flushPendingSignals, startDuration, socket, t],
  );

  const handleJoinRequest = useCallback(
    (payload: GroupCallJoinRequestPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      const active = callRef.current;
      if (!active) return;
      if (active.pendingRequests.includes(payload.user_id)) return;
      setCallState({
        ...active,
        pendingRequests: [...active.pendingRequests, payload.user_id],
      });
      void loadProfile(payload.user_id);
    },
    [setCallState, loadProfile],
  );

  const handleJoinRejected = useCallback(
    (payload: GroupCallJoinRejectedPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      if (payload.user_id !== myUserIdRef.current) return;
      showAlert(t('groupCall.joinRejected'));
      showEnded();
    },
    [showEnded, t],
  );

  const handleEnded = useCallback(
    (payload: GroupCallEndedPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      showEnded();
    },
    [showEnded],
  );

  const handleLeft = useCallback(
    (payload: GroupCallLeftPayload) => {
      if (callIdRef.current !== payload.call_id) return;

      const pc = pcsRef.current.get(payload.user_id);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pcsRef.current.delete(payload.user_id);
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(payload.user_id);
        return next;
      });
      participantsRef.current.delete(payload.user_id);

      setCallState(
        callRef.current
          ? { ...callRef.current, participants: new Map(participantsRef.current) }
          : null,
      );
    },
    [setCallState],
  );

  const handleMic = useCallback(
    (payload: GroupCallMicPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      const p = participantsRef.current.get(payload.user_id);
      if (p) {
        p.muted = payload.muted;
        participantsRef.current.set(payload.user_id, { ...p });
        setCallState(
          callRef.current
            ? { ...callRef.current, participants: new Map(participantsRef.current) }
            : null,
        );
      }
    },
    [setCallState],
  );

  const handleVideo = useCallback(
    (payload: GroupCallVideoPayload) => {
      if (callIdRef.current !== payload.call_id) return;
      const p = participantsRef.current.get(payload.user_id);
      if (p) {
        p.video_enabled = payload.video_enabled;
        participantsRef.current.set(payload.user_id, { ...p });
        setCallState(
          callRef.current
            ? { ...callRef.current, participants: new Map(participantsRef.current) }
            : null,
        );
      }
    },
    [setCallState],
  );

  const handleParticipants = useCallback(
    async (payload: GroupCallParticipantsResponse) => {
      if (callIdRef.current !== payload.call_id) return;
      for (const uid of payload.participants) {
        if (!participantsRef.current.has(uid)) {
          participantsRef.current.set(uid, {
            user_id: uid,
            display_name: uid,
            avatar_uri: '',
            muted: false,
            video_enabled: true,
            is_active: payload.active_participants.includes(uid),
          });
          void loadProfile(uid);
        }
      }
      setCallState(
        callRef.current
          ? { ...callRef.current, participants: new Map(participantsRef.current) }
          : null,
      );

      // Joiner: tạo PC passive cho mỗi joined member (trừ self) rồi
      // flush buffered offer/ICE — existing member là offerer, mình answer.
      for (const uid of payload.joined) {
        if (uid === myUserIdRef.current) continue;
        getOrCreatePc(uid, payload.call_id);
        await flushPendingSignals(uid);
      }
    },
    [setCallState, loadProfile, getOrCreatePc, flushPendingSignals],
  );

  // Server gửi joined_ack cho joiner khi request-join thành công
  // (chỉ path invited, không có path approve-join). Dùng làm safety net:
  // ensure callIdRef + fetch participants nếu joined event bị miss.
  const handleJoinedAck = useCallback(
    (payload: { call_id: string; chat_id: string }) => {
      if (phaseRef.current !== 'connecting') return;
      callIdRef.current = payload.call_id;
      socket.send('group:call:list-participants', { call_id: payload.call_id });
    },
    [socket],
  );

  // Đăng ký WS handlers — ghi ref sau mỗi render (react-hooks/refs cấm ghi
  // trong render); subscribe effect chỉ theo [socket] đọc ref.
  const handlersRef = useRef<Record<string, (payload: unknown) => void>>({});
  useEffect(() => {
    handlersRef.current = {
      'group:call:incoming': handleIncoming as (p: unknown) => void,
      'group:call:created': handleCreated as (p: unknown) => void,
      'group:call:joined': handleJoined as (p: unknown) => void,
      'group:call:joined_ack': handleJoinedAck as (p: unknown) => void,
      'group:call:join-request': handleJoinRequest as (p: unknown) => void,
      'group:call:join-rejected': handleJoinRejected as (p: unknown) => void,
      'group:call:signal': handleSignal as (p: unknown) => void,
      'group:call:ended': handleEnded as (p: unknown) => void,
      'group:call:left': handleLeft as (p: unknown) => void,
      'group:call:mic': handleMic as (p: unknown) => void,
      'group:call:video': handleVideo as (p: unknown) => void,
      'group:call:participants': handleParticipants as (p: unknown) => void,
    };
  });

  useEffect(() => {
    const unsubscribers = Object.entries(handlersRef.current).map(
      ([type, handler]) =>
        socket.subscribe(type, (payload) => handler(payload)),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [socket]);

  useEffect(() => {
    return () => {
      resetToIdle();
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGroupCall = useCallback(
    async (chatId: string, participantIds?: string[]) => {
      if (phaseRef.current !== 'idle') return;
      if (socket.status !== 'open') {
        showAlert(t('groupCall.noConnection'));
        return;
      }
      const okPerms = await ensureGroupCallPermissions();
      if (!okPerms) {
        showAlert(t('groupCall.permissionDenied'));
        return;
      }

      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        showAlert(t('groupCall.permissionDenied'));
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setLocalMuted(false);
      setLocalVideoOn(true);

      const participants = new Map<string, GroupCallParticipant>();
      participants.set(myUserIdRef.current, {
        user_id: myUserIdRef.current,
        display_name: t('groupCall.you'),
        avatar_uri: '',
        muted: false,
        video_enabled: true,
        is_active: true,
      });

      setCallState({
        callId: '',
        chatId,
        callerId: myUserIdRef.current,
        isVideo: true,
        participants,
        pendingRequests: [],
      });
      participantsRef.current = participants;
      setPhaseBoth('connecting');
      setDuration(0);

      const ok = socket.send('group:call:create', {
        chat_id: chatId,
        participant_ids: participantIds,
        call_type: 'video',
      });
      if (!ok) {
        showAlert(t('groupCall.noConnection'));
        resetToIdle();
      }
    },
    [socket, setCallState, resetToIdle, t],
  );

  const joinGroupCall = useCallback(
    async (callId: string) => {
      if (phaseRef.current !== 'idle' && phaseRef.current !== 'ringing') return;
      if (socket.status !== 'open') {
        showAlert(t('groupCall.noConnection'));
        return;
      }
      const okPerms = await ensureGroupCallPermissions();
      if (!okPerms) {
        showAlert(t('groupCall.permissionDenied'));
        return;
      }

      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        showAlert(t('groupCall.permissionDenied'));
        return;
      }

      stopRingtone();
      callIdRef.current = callId;
      localStreamRef.current = stream;
      setLocalStream(stream);
      setLocalMuted(false);
      setLocalVideoOn(true);
      setPhaseBoth('connecting');

      socket.send('group:call:request-join', { call_id: callId });
    },
    [socket, t],
  );

  const declineGroupCall = useCallback(() => {
    if (phaseRef.current !== 'ringing') return;
    stopRingtone();
    resetToIdle();
  }, [resetToIdle]);

  const acceptJoinRequest = useCallback(
    (userId: string) => {
      const active = callRef.current;
      if (!active || !active.callId) return;
      socket.send('group:call:approve-join', {
        call_id: active.callId,
        user_id: userId,
      });
      setCallState({
        ...active,
        pendingRequests: active.pendingRequests.filter((id) => id !== userId),
      });
    },
    [socket, setCallState],
  );

  const rejectJoinRequest = useCallback(
    (userId: string) => {
      const active = callRef.current;
      if (!active || !active.callId) return;
      socket.send('group:call:reject-join', {
        call_id: active.callId,
        user_id: userId,
      });
      setCallState({
        ...active,
        pendingRequests: active.pendingRequests.filter((id) => id !== userId),
      });
    },
    [socket, setCallState],
  );

  const endGroupCall = useCallback(() => {
    const active = callRef.current;
    if (!active || !active.callId) {
      resetToIdle();
      return;
    }
    socket.send('group:call:end', { call_id: active.callId });
    showEnded();
  }, [socket, showEnded, resetToIdle]);

  const toggleMute = useCallback(() => {
    const active = callRef.current;
    if (!active || !active.callId || phaseRef.current !== 'active') return;
    const next = !localMuted;
    setLocalMuted(next);
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    socket.send('group:call:toggle-mic', {
      call_id: active.callId,
      muted: next,
    });
  }, [localMuted, socket]);

  const toggleVideo = useCallback(() => {
    const active = callRef.current;
    if (!active || !active.callId || phaseRef.current !== 'active') return;
    const next = !localVideoOn;
    setLocalVideoOn(next);
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
    socket.send('group:call:toggle-video', {
      call_id: active.callId,
      video_enabled: next,
    });
  }, [localVideoOn, socket]);

  const dismiss = useCallback(() => {
    if (phaseRef.current === 'ended') resetToIdle();
  }, [resetToIdle]);

  const minimize = useCallback(() => {
    if (phaseRef.current === 'active') setMinimized(true);
  }, []);

  const expand = useCallback(() => {
    setMinimized(false);
  }, []);

  return (
    <GroupCallContext.Provider
      value={{
        phase,
        call,
        duration,
        localStream,
        localMuted,
        localVideoOn,
        isCreator: call?.callerId === myUserId,
        isInGroupCall:
          phase === 'active' || phase === 'connecting' || phase === 'ringing',
        remoteStreams,
        startGroupCall,
        joinGroupCall,
        declineGroupCall,
        acceptJoinRequest,
        rejectJoinRequest,
        endGroupCall,
        toggleMute,
        toggleVideo,
        dismiss,
        minimized,
        minimize,
        expand,
      }}
    >
      {children}
    </GroupCallContext.Provider>
  );
}

export function useGroupCall(): GroupCallContextValue {
  const context = useContext(GroupCallContext);
  if (context === undefined) {
    throw new Error('useGroupCall must be used within a GroupCallProvider');
  }
  return context;
}
