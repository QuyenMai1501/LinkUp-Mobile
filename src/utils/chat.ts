type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

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
  if (mins < 1) return t('post.justNow');
  if (mins < 60) return t('post.minutesAgo', { minutes: String(mins) });
  const hours = diffHours(iso);
  if (hours < 24) return t('post.hoursAgo', { hours: String(hours) });
  return vnDate(iso);
}

export function formatChatDate(iso: string, t: TranslationFn): string {
  if (isToday(iso)) return t('chat.today');
  if (isYesterday(iso)) return t('chat.yesterday');
  return vnDateTime(iso);
}
