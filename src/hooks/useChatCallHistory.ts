import { useEffect, useRef, useState } from 'react';

import { getCallHistory } from '@/api/calls';
import type { CallPhase } from '@/contexts/call-context';
import type { CallHistoryItem } from '@/types/call';

const EMPTY_CALL_HISTORY: CallHistoryItem[] = [];

export interface UseChatCallHistoryOptions {
  partnerUserId: string | null;
  callPhase: CallPhase;
  activeCall: { peer: { user_id: string } } | null;
}

export function useChatCallHistory({
  partnerUserId,
  callPhase,
  activeCall,
}: UseChatCallHistoryOptions) {
  const [historyByPartner, setHistoryByPartner] = useState<
    Map<string, CallHistoryItem[]>
  >(() => new Map());

  useEffect(() => {
    if (!partnerUserId) return;
    if (historyByPartner.has(partnerUserId)) return;
    let cancelled = false;
    getCallHistory({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        const items = res.data.filter(
          (item) => item.other_user.id === partnerUserId,
        );
        setHistoryByPartner((prev) => {
          const next = new Map(prev);
          next.set(partnerUserId, items);
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [partnerUserId, historyByPartner]);

  // Cuộc gọi vừa xong (phase ended → idle sau 2s): refetch để có row mới ngay.
  const prevPhaseRef = useRef<CallPhase>(callPhase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = callPhase;
    if (prev === 'ended' || callPhase !== 'ended') return;
    if (!activeCall || activeCall.peer.user_id !== partnerUserId) return;
    let cancelled = false;
    getCallHistory({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        const items = res.data.filter(
          (item) => item.other_user.id === partnerUserId,
        );
        if (items.length === 0) return;
        setHistoryByPartner((prevMap) => {
          const existing = prevMap.get(partnerUserId) ?? [];
          const byId = new Map(existing.map((item) => [item.id, item]));
          for (const item of items) byId.set(item.id, item);
          const next = new Map(prevMap);
          next.set(
            partnerUserId,
            [...byId.values()].sort((a, b) => b.created_at - a.created_at),
          );
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [callPhase, activeCall, partnerUserId]);

  return partnerUserId
    ? (historyByPartner.get(partnerUserId) ?? EMPTY_CALL_HISTORY)
    : EMPTY_CALL_HISTORY;
}
