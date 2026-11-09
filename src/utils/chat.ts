type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Bubble optimistic (đang gửi: text/media/voice) — id tạm `temp-N` do client
 * sinh. Tin này dùng giờ THIẾT BỊ nên không được so giờ với tin server.
 */
export function isPendingMessage(m: { id: string }): boolean {
  return m.id.startsWith('temp-');
}

/** So sánh tin theo created_at; bubble optimistic (`temp-`) LUÔN xếp cuối. */
export function sortMessagesByCreatedAt<T extends { id: string; created_at: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const pa = isPendingMessage(a) ? 1 : 0;
    const pb = isPendingMessage(b) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function diffMinutes(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

function diffHours(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 3600000));
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function vnDate(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function vnDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatChatTime(iso: string, t: TranslationFn): string {
  const mins = diffMinutes(iso);
  if (mins < 1) return t('chat.justNow');
  if (mins < 60) return t('chat.minutesAgo', { minutes: String(mins) });
  const hours = diffHours(iso);
  if (hours < 24) return t('chat.hoursAgo', { hours: String(hours) });
  return vnDate(iso);
}

export function formatChatDate(iso: string, t: TranslationFn): string {
  if (isToday(iso)) return t('chat.today');
  if (isYesterday(iso)) return t('chat.yesterday');
  return vnDateTime(iso);
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}
