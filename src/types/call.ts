export type CallType = 'voice' | 'video';

export interface CallPeer {
  user_id: string;
  display_name: string;
  avatar_uri: string;
}

export type CallStatus =
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'busy'
  | 'cancelled';

export interface CallIceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

/** Ngôn ngữ signal trao đổi qua call:signal — server chuyển tiếp nguyên văn. */
export type CallSignalBody =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: CallIceCandidateInit };

export interface CallIncomingPayload {
  call_id: string;
  caller_id: string;
  call_type: CallType;
  timestamp: number;
}

export interface CallInitiatedPayload {
  call_id: string;
}

export interface CallStatusPayload {
  call_id: string;
  status: CallStatus;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  video_enabled_caller: boolean;
  video_enabled_callee: boolean;
  started_at?: number;
  ended_at?: number;
  duration?: number;
}

export interface CallSignalPayload {
  call_id: string;
  sender_id: string;
  signal: CallSignalBody;
}

export interface CallMutePayload {
  call_id: string;
  user_id: string;
  muted: boolean;
}

export interface CallVideoPayload {
  call_id: string;
  user_id: string;
  video_enabled: boolean;
}

export interface CallBusyPayload {
  callee_id: string;
}

/** Payload của call:missed lẫn call:cancelled. */
export interface CallMissedPayload {
  call_id: string;
  caller_id: string;
  timestamp: number;
}

// ─── Call history (GET /api/calls/history) ──────────────────────

export interface CallHistoryUserBrief {
  id: string;
  display_name: string;
  /** Server json tag là `avatar_url` (KHÔNG phải `avatar_uri` như type của Web). */
  avatar_url: string;
}

export interface CallHistoryItem {
  id: string;
  other_user: CallHistoryUserBrief;
  call_type: CallType;
  direction: 'outgoing' | 'incoming';
  status: CallStatus;
  is_missed: boolean;
  /** Giây. */
  duration: number;
  started_at?: number;
  ended_at?: number;
  /** Epoch milliseconds. */
  created_at: number;
}

export interface CallHistoryListResponse {
  data: CallHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
