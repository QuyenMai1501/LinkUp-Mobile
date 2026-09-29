const URL_RE = /https?:\/\/[^\s<>'")\]]+/gi;

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?[^]*)?$/i;

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const VIMEO_RE = /vimeo\.com\/(\d+)/;

function isVideoFileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return VIDEO_EXT_RE.test(u.pathname);
  } catch {
    return false;
  }
}

function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url);
}

function isVimeoUrl(url: string): boolean {
  return VIMEO_RE.test(url);
}

export function isVideoUrl(url: string): boolean {
  return isYouTubeUrl(url) || isVimeoUrl(url) || isVideoFileUrl(url);
}

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_RE);
  return match ? match[1] : null;
}

export function getVideoThumbnail(url: string): string | null {
  const ytId = getYouTubeVideoId(url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  }
  if (isVimeoUrl(url)) {
    const match = url.match(VIMEO_RE);
    if (match) {
      return `https://vumbnail.com/${match[1]}.jpg`;
    }
  }
  return null;
}

export function extractVideoUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return matches.filter((m) => isVideoUrl(m));
}
