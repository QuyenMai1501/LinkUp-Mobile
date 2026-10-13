// Mirror Web types/groupCall.ts — contract group call qua WS
// /api/group-calls/ws (server: groupws/handler.go + dto/call.dto.go).

export type GroupCallPhase =
  | 'idle'
  /** Có cuộc gọi đến (invited) — chuông reo, chờ Tham gia/Từ chối. */
  | 'ringing'
  /** Đang getUserMedia + chờ created/joined_ack. */
  | 'connecting'
  /** Đang trong call (mesh). */
  | 'active'
  /** Call vừa kết thúc — hiện overlay ended vài giây rồi idle. */
  | 'ended';

export interface GroupCallParticipant {
  user_id: string;
  display_name: string;
  avatar_uri: string;
  muted: boolean;
  video_enabled: boolean;
  is_active: boolean;
}

export interface ActiveGroupCall {
  callId: string;
  chatId: string;
  callerId: string;
  isVideo: boolean;
  participants: Map<string, GroupCallParticipant>;
  pendingRequests: string[];
}

// WS payloads — server → client
export interface GroupCallIncomingPayload {
  call_id: string;
  chat_id: string;
  caller_id: string;
  participants: string[];
  is_video: boolean;
}

export interface GroupCallCreatedPayload {
  call_id: string;
  chat_id: string;
  caller_id: string;
  participants: string[];
  is_video: boolean;
}

export interface GroupCallJoinedPayload {
  call_id: string;
  chat_id: string;
  user_id: string;
}

export interface GroupCallJoinRequestPayload {
  call_id: string;
  chat_id: string;
  user_id: string;
}

export interface GroupCallJoinRequestSentPayload {
  call_id: string;
}

export interface GroupCallJoinRejectedPayload {
  call_id: string;
  user_id: string;
  reason?: string;
}

export interface GroupCallEndedPayload {
  call_id: string;
  by?: string;
  reason?: string;
}

export interface GroupCallLeftPayload {
  call_id: string;
  user_id: string;
}

export interface GroupCallSignalPayload {
  call_id: string;
  sender_id: string;
  signal: GroupCallSignalBody;
}

export interface GroupCallMicPayload {
  call_id: string;
  user_id: string;
  muted: boolean;
  changed_by: string;
}

export interface GroupCallVideoPayload {
  call_id: string;
  user_id: string;
  video_enabled: boolean;
}

export interface GroupCallParticipantsResponse {
  call_id: string;
  participants: string[];
  joined: string[];
  active_participants: string[];
}

// SDP/ICE relay — opaque, server không inspect.
export type GroupCallSignalBody =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: unknown };

// Lịch sử cuộc gọi nhóm — đến qua group:history (useGroupChatRoom).
export interface GroupCallHistoryItem {
  call_id: string;
  chat_id: string;
  caller_id: string;
  participants: string[];
  status: string;
  is_video?: boolean;
  created_at: string;
  ended_at?: string;
}
