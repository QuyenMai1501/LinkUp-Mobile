import { useEffect, useRef, useState } from 'react';
import { tokenStorage } from '@/api/token-storage';
import { API_BASE } from '@/api/client';
import type { ChatMessage } from '@/types/chat';

const mediaBlobCache = new Map<string, { url: string; isVideo: boolean }>();

interface MessageMediaState {
  src: string | null;
  isVideo: boolean;
  failed: boolean;
  loading: boolean;
}

export function useMessageMedia(message: ChatMessage): MessageMediaState {
  const cached = mediaBlobCache.get(message.id);
  const [src, setSrc] = useState<string | null>(message.media_uri ?? cached?.url ?? null);
  const [isVideo, setIsVideo] = useState(
    message.media_type?.startsWith('video/') ?? cached?.isVideo ?? false,
  );
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(() => !(message.media_uri ?? cached?.url));
  const objectUrlRef = useRef<string | null>(null);

  const needsDownload = !message.media_uri && !src;

  useEffect(() => {
    if (!needsDownload) return;
    if (mediaBlobCache.has(message.id)) return;
    let cancelled = false;

    const download = async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        const res = await fetch(`${API_BASE}/chats/messages/${message.id}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const isVideoBlob = blob.type.startsWith('video/');
        mediaBlobCache.set(message.id, { url, isVideo: isVideoBlob });
        objectUrlRef.current = url;
        setSrc(url);
        setIsVideo(isVideoBlob);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    };

    download();

    return () => {
      cancelled = true;
      if (objectUrlRef.current && mediaBlobCache.get(message.id)?.url !== objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    };
  }, [message.id, message.media_uri, needsDownload]);

  return { src, isVideo, failed, loading };
}
