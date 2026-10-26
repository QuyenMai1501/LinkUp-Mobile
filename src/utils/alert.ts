/**
 * Module store cho dialog thay Alert.alert native.
 * - API drop-in cùng chữ ký với Alert.alert(title, message?, buttons?)
 * - Module-level nên gọi được từ cả non-React code (contexts/hooks) mà
 *   không cần provider nesting; host đọc qua useSyncExternalStore.
 */
export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertPayload = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

let current: AlertPayload | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  current = { title, message, buttons };
  emit();
}

/** Đóng dialog đang hiện mà không chạy button nào (dùng cho Android back). */
export function hideAlert(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function subscribeAlert(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAlertSnapshot(): AlertPayload | null {
  return current;
}
