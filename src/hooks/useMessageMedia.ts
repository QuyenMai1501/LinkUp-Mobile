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

function getDownloadUrl(messageId: string): string {
  return `${API_BASE}/chats/messages/${messageId}/download`;
}

export function useMessageMedia(message: ChatMessage): MessageMediaState {
  const cached = mediaBlobCache.get(message.id);
  const [src, setSrc] = useState<string | null>(message.media_uri ?? cached?.url ?? null);
  const [isVideo, setIsVideo] = useState(
    message.media_type?.startsWith('video/') ?? cached?.isVideo ?? false,
  );
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(() => !(message.media_uri ?? cached?.url));

  const needsDownload = !message.media_uri && !src;

  useEffect(() => {
    if (!needsDownload) return;
    if (mediaBlobCache.has(message.id)) return;
    let cancelled = false;

    const resolveMedia = async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        const url = getDownloadUrl(message.id);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        const isVideoType = contentType.startsWith('video/') || message.media_type?.startsWith('video/');
        if (!cancelled) {
          // Use the download URL directly — expo-image fetches HTTP URLs natively.
          // Avoid URL.createObjectURL (unavailable in React Native).
          mediaBlobCache.set(message.id, { url, isVideo: !!isVideoType });
          setSrc(url);
          setIsVideo(!!isVideoType);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    };

    resolveMedia();

    return () => {
      cancelled = true;
    };
  }, [message.id, message.media_uri, needsDownload]);

  return { src, isVideo, failed, loading };
}
