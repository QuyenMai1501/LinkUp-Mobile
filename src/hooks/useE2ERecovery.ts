import { useCallback, useEffect, useRef, useState } from 'react';
import {
  E2E_KEYS_UPDATED_EVENT,
  PBKDF2_ITERATIONS,
  RECOVERY_PBKDF2_ITERATIONS,
  derivePinKey,
  deriveRecoveryKey,
  generateRecoveryKey,
  generateRecoverySalt,
  hashCheck,
  encryptRecoveryBlob,
  decryptRecoveryBlob,
  subscribeE2EKeysUpdated,
  type RecoveryBlobPayload,
} from '@/utils/e2ee';
import { getChatKeysSnapshot, importChatKeysSnapshot } from '@/utils/e2e-storage';
import {
  putRecovery,
  getRecoveryMeta,
  unlockRecovery,
  deleteRecovery,
  type RecoveryMeta,
} from '@/api/e2e';

// Cứ bao lâu (ms) backup được phép tự cập nhật lại tối đa một lần.
const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

function isValidPin(pin: string): boolean {
  return /^\d{6,}$/.test(pin);
}

export interface UseE2ERecoveryResult {
  meta: RecoveryMeta | null;
  busy: boolean;
  refreshBackupIfStale: () => Promise<void>;
  forceRefreshBackup: () => Promise<boolean>;
  enableRecovery: (pin: string) => Promise<{ recoveryKey: string }>;
  tryUnlock: (secret: string, kind: 'pin' | 'recovery') => Promise<boolean>;
  disableRecovery: () => Promise<void>;
}

export function useE2ERecovery(): UseE2ERecoveryResult {
  const [meta, setMeta] = useState<RecoveryMeta | null>(null);
  const [busy, setBusy] = useState(false);

  // Khóa dẫn được giữ trong bộ nhớ của phiên (không persist) để tự refresh
  // backup khi khóa chat thay đổi mà không phải hỏi lại PIN mỗi lần.
  const pinKeyRef = useRef<CryptoKey | null>(null);
  const recoveryKeyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<string | null>(null);
  // Hash check lưu tại lúc bật — không tái dẫn từ secret (secret không persist).
  const pinCheckRef = useRef<string | null>(null);
  const recoveryCheckRef = useRef<string | null>(null);
  const lastRefreshRef = useRef(0);

  const check = useCallback(async () => {
    try {
      const remote = await getRecoveryMeta();
      setMeta(remote);
    } catch {
      // Không phá luồng: lỗi mạng → giữ meta cũ, caller tự quyết định.
    }
  }, []);

  // Mount: lấy meta backup lần đầu. setMeta nằm trong callback .then() (async)
  // — tránh react-hooks/set-state-in-effect (không gọi setState đồng bộ trong effect).
  useEffect(() => {
    let cancelled = false;
    void getRecoveryMeta()
      .then((remote) => {
        if (cancelled) return;
        setMeta(remote);
      })
      .catch(() => {
        // Không phá luồng: lỗi mạng → giữ meta cũ, caller tự quyết định.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // forceRefreshBackup self-referencing: định nghĩa qua ref để tránh vòng phụ thuộc.
  const forceRefreshBackup = useCallback(async (): Promise<boolean> => {
    const pinKey = pinKeyRef.current;
    const recoveryKey = recoveryKeyRef.current;
    const salt = saltRef.current;
    const pinCheck = pinCheckRef.current;
    const recoveryCheck = recoveryCheckRef.current;
    if (!pinKey || !recoveryKey || !salt || !pinCheck || !recoveryCheck) return false;
    try {
      const snapshot = await getChatKeysSnapshot();
      const payload: RecoveryBlobPayload = {
        version: 1,
        keys: snapshot.keys,
        altKeys: snapshot.altKeys,
      };
      const blob = await encryptRecoveryBlob(payload, pinKey, recoveryKey);
      await putRecovery({ salt, blob, pin_check: pinCheck, recovery_check: recoveryCheck });
      await check();
      return true;
    } catch {
      return false;
    }
  }, [check]);

  // Giữ tham chiếu ổn định cho refreshBackupIfStale.
  const forceRefreshBackupRef = useRef(forceRefreshBackup);
  useEffect(() => {
    forceRefreshBackupRef.current = forceRefreshBackup;
  }, [forceRefreshBackup]);

  // Tự cập nhật backup khi khóa chat thay đổi trong phiên này (throttled).
  const refreshBackupIfStale = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    // Chỉ refresh khi đã bật (giữ được khóa trong bộ nhớ) để không PUT rác.
    if (!pinKeyRef.current || !recoveryKeyRef.current || !saltRef.current) return;
    if (await forceRefreshBackupRef.current()) {
      lastRefreshRef.current = now;
    }
  }, []);

  // Giữ tham chiếu ổn định cho listener.
  const refreshRef = useRef(refreshBackupIfStale);
  useEffect(() => {
    refreshRef.current = refreshBackupIfStale;
  }, [refreshBackupIfStale]);

  // Mobile không có window event → dùng registry listener trong e2ee.ts.
  useEffect(() => {
    const listener = () => void refreshRef.current();
    return subscribeE2EKeysUpdated(listener);
  }, []);

  // Bật khôi phục trên máy chính: sinh recovery key + salt, mã hóa snapshot
  // khóa chat hiện tại, upload blob + salt + hash check lên server. Trả về
  // recovery key để UI hiện đúng MỘT lần (không lưu lên server).
  const enableRecovery = useCallback(
    async (pin: string): Promise<{ recoveryKey: string }> => {
      if (!isValidPin(pin)) throw new Error('recovery.pinInvalid');
      setBusy(true);
      try {
        const recoveryKey = generateRecoveryKey();
        const salt = generateRecoverySalt();
        const pinKey = await derivePinKey(pin, salt);
        const derivedRecoveryKey = await deriveRecoveryKey(recoveryKey, salt);

        const snapshot = await getChatKeysSnapshot();
        const payload: RecoveryBlobPayload = {
          version: 1,
          keys: snapshot.keys,
          altKeys: snapshot.altKeys,
        };
        const blob = await encryptRecoveryBlob(payload, pinKey, derivedRecoveryKey);
        // Check là hash của secret (PIN / recovery key) + salt — server chỉ đối
        // chiếu, không thể dùng để giải mã.
        const pinCheck = await hashCheck(pin, salt, PBKDF2_ITERATIONS);
        const recoveryCheck = await hashCheck(recoveryKey, salt, RECOVERY_PBKDF2_ITERATIONS);

        await putRecovery({ salt, blob, pin_check: pinCheck, recovery_check: recoveryCheck });

        // Giữ khóa + hash check trong phiên để tự refresh sau này (khóa dẫn
        // chỉ tồn tại trong RAM, mất khi reload/tắt app).
        pinKeyRef.current = pinKey;
        recoveryKeyRef.current = derivedRecoveryKey;
        saltRef.current = salt;
        pinCheckRef.current = pinCheck;
        recoveryCheckRef.current = recoveryCheck;
        lastRefreshRef.current = Date.now();
        await check();
        return { recoveryKey };
      } finally {
        setBusy(false);
      }
    },
    [check],
  );

  // Mở khóa trên thiết bị mới: gửi hash check, nhận blob, giải mã bằng key dẫn
  // từ secret (PIN hoặc recovery key) rồi nhập toàn bộ khóa chat vào AsyncStorage.
  const tryUnlock = useCallback(
    async (secret: string, kind: 'pin' | 'recovery'): Promise<boolean> => {
      if (!meta?.salt) throw new Error('recovery.noBackup');
      setBusy(true);
      try {
        const iterations = kind === 'pin' ? PBKDF2_ITERATIONS : RECOVERY_PBKDF2_ITERATIONS;
        const derivedKey =
          kind === 'pin'
            ? await derivePinKey(secret, meta.salt)
            : await deriveRecoveryKey(secret, meta.salt);
        const check = await hashCheck(secret, meta.salt, iterations);

        const res = await unlockRecovery(check);
        if (!res?.blob) throw new Error('recovery.unlockFailed');

        const payload = await decryptRecoveryBlob(res.blob, derivedKey);
        if (!payload) throw new Error('recovery.wrongSecret');

        await importChatKeysSnapshot({
          keys: payload.keys,
          altKeys: payload.altKeys,
        });
        return true;
      } finally {
        setBusy(false);
      }
    },
    [meta],
  );

  // Tắt khôi phục: xóa backup trên server + quên khóa/hash trong phiên.
  const disableRecovery = useCallback(async (): Promise<void> => {
    await deleteRecovery();
    pinKeyRef.current = null;
    recoveryKeyRef.current = null;
    saltRef.current = null;
    pinCheckRef.current = null;
    recoveryCheckRef.current = null;
    lastRefreshRef.current = 0;
    setMeta({ has_blob: false });
  }, []);

  return {
    meta,
    busy,
    refreshBackupIfStale,
    forceRefreshBackup,
    enableRecovery,
    tryUnlock,
    disableRecovery,
  };
}

// isValidPin dùng chung cho UI (Settings + modal thiết bị mới).
export { isValidPin };
export { E2E_KEYS_UPDATED_EVENT };
