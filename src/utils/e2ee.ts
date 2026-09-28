import {
  getIdentity,
  setIdentity,
  getChatKey as getStoredChatKeyLocal,
  setChatKey as setStoredChatKeyLocal,
  getChatAltKeys,
  addChatAltKey,
  getPeerKey,
  setPeerKey,
} from './e2e-storage';
import {
  getChatKey as getRemoteChatKey,
  getUserKey,
  registerUserKey,
  storeChatKeys,
  rekeyChat,
} from '@/api/e2e';
import type { ChatE2EKey } from '@/api/e2e';

export const E2E_INFO = 'linkup-e2e-v1';

// Sự kiện báo khóa chat vừa thay đổi (tạo/adopt/re-key) — hook useE2ERecovery
// lắng nghe để tự cập nhật backup khôi phục (throttled). Mobile không có
// window.dispatchEvent → dùng registry listener trong cùng runtime JS.
export const E2E_KEYS_UPDATED_EVENT = 'linkup:e2e-keys-updated';

type KeysUpdatedListener = () => void;
const keysUpdatedListeners = new Set<KeysUpdatedListener>();

export function subscribeE2EKeysUpdated(listener: KeysUpdatedListener): () => void {
  keysUpdatedListeners.add(listener);
  return () => {
    keysUpdatedListeners.delete(listener);
  };
}

function notifyKeysUpdated(): void {
  for (const listener of keysUpdatedListeners) listener();
}

// LOG CHẨN ĐOÁN TẠM THỜI (Phase 0) — gỡ sau khi xác định nguyên nhân native
// không giải mã được tin text từ web. Chỉ chạy trong __DEV__.
export function dbg(...args: unknown[]): void {
  if (__DEV__) console.log('[e2e]', ...args);
}

export function short(v: string | null | undefined): string {
  if (!v) return String(v);
  return v.length <= 10 ? v : `${v.slice(0, 10)}…(${v.length})`;
}

const te = new TextEncoder();
const td = new TextDecoder();

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function importAesKey(
  raw: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    usage,
  );
}

async function generateIdentity(userId: string) {
  // extractable=true: mobile PHẢI export private key ra JWK để lưu xuống
  // AsyncStorage (khác web — web lưu object CryptoKey trực tiếp vào IndexedDB).
  // extractable=false → exportKey('jwk') ném "key is not extractable".
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pubB64 = bytesToB64(new Uint8Array(pubRaw));
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { userId, publicKey: pubB64, privateKeyJwk: privJwk };
}

export interface Identity {
  userId: string;
  publicKey: string;
  privateKey: CryptoKey;
}

// Memoize theo userId. Hydrate chạy song song nhiều ensureChatKey (mapLimited 4
// ở messages.tsx) — nếu mỗi lời gọi tự đọc storage rồi generate khi storage rỗng
// thì sẽ sinh ra N identity khác nhau: AsyncStorage giữ bản CUỐI trong khi
// registeredUserKeys memoize bản ĐẦU → pub trên server ≠ private key đang giữ →
// derive sai shared secret → unwrap GCM fail. Một promise cho mỗi userId → chỉ
// 1 generate + 1 ghi storage, mọi caller chung cùng identity.
const identityCache = new Map<string, Promise<Identity>>();

export async function getOrCreateIdentity(userId: string): Promise<Identity> {
  const existing = identityCache.get(userId);
  if (existing) return existing;
  const p = (async (): Promise<Identity> => {
    const stored = await getIdentity(userId);
    if (stored?.private_key_jwk && stored.public_key) {
      const privateKey = (await crypto.subtle.importKey(
        'jwk',
        stored.private_key_jwk as JsonWebKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      )) as CryptoKey;
      return { userId, publicKey: stored.public_key, privateKey };
    }
    const generated = await generateIdentity(userId);
    const privateKey = (await crypto.subtle.importKey(
      'jwk',
      generated.privateKeyJwk as JsonWebKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )) as CryptoKey;
    await setIdentity({
      user_id: userId,
      public_key: generated.publicKey,
      private_key_jwk: generated.privateKeyJwk,
    });
    return { userId, publicKey: generated.publicKey, privateKey };
  })();
  identityCache.set(userId, p);
  p.catch(() => identityCache.delete(userId));
  return p;
}

const registeredUserKeys = new Map<
  string,
  { publicKey: string; p: Promise<unknown> }
>();

function ensureRegisteredUserKey(
  userId: string,
  publicKey: string,
): Promise<void> {
  const existing = registeredUserKeys.get(userId);
  if (existing) {
    // Đèn báo (chẩn đoán): trong cùng phiên mà pub cần đăng ký khác pub đã memo
    // → có lời gọi register với 2 identity khác nhau. Không được xảy ra sau khi
    // memoize getOrCreateIdentity. Log public key — không nhạy cảm.
    if (existing.publicKey !== publicKey) {
      dbg(
        'OWN-PUB-MISMATCH (in-session)', userId,
        'registered=', existing.publicKey, 'identity=', publicKey,
      );
    }
    return existing.p.then(() => undefined);
  }
  const p = registerUserKey(publicKey).catch((err: unknown) => {
    registeredUserKeys.delete(userId);
    throw err;
  });
  registeredUserKeys.set(userId, { publicKey, p });
  return p.then(() => undefined);
}

// LOG CHẨN ĐOÁN (__DEV__, 1 lần/phiên): đọc pub của CHÍNH mình trên server rồi
// so với identity đang giữ. Khác nhau = pub server ≠ private key → derive sai
// shared secret (nguyên nhân gốc UNWRAP fail). Chỉ GET, không ghi.
let ownPubCheck: Promise<void> | null = null;

function dbgOwnPub(userId: string, identityPub: string): Promise<void> {
  if (!ownPubCheck) {
    ownPubCheck = (async () => {
      try {
        const mine = await getUserKey(userId);
        dbg(
          'OWN-PUB', mine.public_key === identityPub ? 'MATCH' : 'MISMATCH',
          'server=', mine.public_key, 'identity=', identityPub,
        );
      } catch {
        dbg('OWN-PUB', 'MISMATCH (server=NONE)', 'identity=', identityPub);
      }
    })();
  }
  return ownPubCheck;
}

const inFlightChatKeys = new Map<string, Promise<string | null>>();
const chatKeyCache = new Map<string, string | null>();

// Các chat mà trong phiên này phát hiện đối phương đổi identity nhưng mình không
// còn giữ khóa chuẩn (không tự re-key được) → UI hiện cảnh báo thay vì âm thầm
// fallback về legacy.
const partnerChangedChats = new Set<string>();

export function wasPartnerChanged(chatId: string): boolean {
  return partnerChangedChats.has(chatId);
}

export async function ensureChatKey(args: {
  chatId: string;
  myUserId: string;
  partnerUserId: string;
}): Promise<string | null> {
  const { chatId, myUserId, partnerUserId } = args;
  if (!chatId || !myUserId || !partnerUserId) return null;

  const inflight = inFlightChatKeys.get(chatId);
  if (inflight) return inflight;

  const promise = (async (): Promise<string | null> => {
    const identity = await getOrCreateIdentity(myUserId);
    await ensureRegisteredUserKey(myUserId, identity.publicKey);
    if (__DEV__) await dbgOwnPub(myUserId, identity.publicKey);

    let localKey: string | null = null;
    try {
      localKey = await getStoredChatKeyLocal(chatId);
    } catch {
      localKey = null;
    }

    let partner: { public_key: string; key_version: number } | null = null;
    try {
      partner = await getUserKey(partnerUserId);
    } catch {
      partner = null;
    }
    // Đối phương chưa đăng ký public key → không thể tự đặt lại khóa. Chat đã
    // có local thì vẫn đọc tin cũ (fallback); không thì legacy.
    if (!partner?.public_key) {
      dbg('ensureChatKey', chatId, 'partner has NO public key; local=', short(localKey));
      chatKeyCache.set(chatId, localKey);
      return localKey;
    }
    const partnerPub = partner.public_key;
    dbg(
      'ensureChatKey', chatId, 'identity pub=', identity.publicKey,
      'partner pub=', partnerPub, 'partner key_version=', partner.key_version,
    );

    // Đối phương đổi identity/thiết bị (key_version tăng hoặc public key đổi so
    // với lần wrap trước)? Nếu mình vẫn giữ khóa chuẩn local → re-key row của
    // MÌNH sang shared secret mới để người ở thiết bị mới vẫn unwrap được khóa
    // cũ (không cần tạo khóa chat mới). Không giữ local → đối phương chưa thể
    // khôi phục lịch sử: đánh dấu để UI cảnh báo thay vì âm thầm legacy.
    const storedPeer = await getPeerKey(chatId).catch(() => undefined);
    const partnerChanged = Boolean(
      storedPeer &&
        (storedPeer.partner_key_version !== partner.key_version ||
          storedPeer.partner_public_key !== partnerPub),
    );

    const shared = await deriveChatKey(identity.privateKey, partnerPub);

    if (partnerChanged && localKey) {
      const mine = await wrapChatKey(shared, localKey);
      await rekeyChat(chatId, mine.wrapped, mine.nonce);
      await setStoredChatKeyLocal(chatId, localKey);
      notifyKeysUpdated();
      await setPeerKey({
        chat_id: chatId,
        partner_user_id: partnerUserId,
        partner_public_key: partnerPub,
        partner_key_version: partner.key_version,
      });
      dbg('ensureChatKey', chatId, 'PARTNER CHANGED → rekeyed own row, key=', short(localKey));
      chatKeyCache.set(chatId, localKey);
      return localKey;
    }
    if (partnerChanged && !localKey) {
      partnerChangedChats.add(chatId);
      dbg('ensureChatKey', chatId, 'PARTNER CHANGED and no local key → partner_changed');
    }

    // Server là nguồn chuẩn: đã có khóa wrap cho mình thì unwrap vào local.
    // Khóa local cũ (nếu khác) được lưu làm fallback để tin cũ của mình vẫn
    // đọc được sau khi adopt khóa server.
    let remote: ChatE2EKey | null = null;
    try {
      remote = await getRemoteChatKey(chatId);
    } catch {
      remote = null;
    }
    if (remote?.wrapped_key) {
      // Chẩn đoán: log TRƯỚC khi unwrap để có dữ liệu cả khi throw.
      dbg(
        'ensureChatKey', chatId, 'remote row wrapped.len=', remote.wrapped_key.length,
        'nonce.len=', remote.nonce.length,
      );
      try {
        const key = await unwrapChatKey(shared, remote.wrapped_key, remote.nonce);
        dbg(
          'ensureChatKey', chatId, 'adopted server key=', short(key),
          'sameAsLocal=', key === localKey, 'localWas=', short(localKey),
        );
        await setStoredChatKeyLocal(chatId, key);
        if (localKey && localKey !== key) await addChatAltKey(chatId, localKey);
        notifyKeysUpdated();
        await setPeerKey({
          chat_id: chatId,
          partner_user_id: partnerUserId,
          partner_public_key: partnerPub,
          partner_key_version: partner.key_version,
        });
        chatKeyCache.set(chatId, key);
        return key;
      } catch (err) {
        // Không unwrap được (đối phương đổi identity): giữ local nếu có để
        // tin cũ của mình khỏi bị mất.
        dbg(
          'ensureChatKey', chatId, 'UNWRAP remote row FAILED (stale local kept)=', short(localKey),
          'err=', err instanceof Error ? err.message : String(err),
        );
        chatKeyCache.set(chatId, localKey);
        return localKey;
      }
    }

    // Chưa có khóa trên server: tạo khóa mới, hoặc đăng ký khóa local có sẵn
    // lên server. First-wins phía server đảm bảo không ghi đè khóa của bên kia.
    const chatKey = localKey ?? generateChatKeyBase64();
    const mine = await wrapChatKey(shared, chatKey);
    const theirs = await wrapChatKey(shared, chatKey);
    await storeChatKeys([
      { chat_id: chatId, user_id: myUserId, wrapped_key: mine.wrapped, nonce: mine.nonce },
      { chat_id: chatId, user_id: partnerUserId, wrapped_key: theirs.wrapped, nonce: theirs.nonce },
    ]);

    // Reconciliation: nếu đối phương cũng vừa tạo khóa (hoặc server giữ khóa
    // tạo trước), ưu tiên khóa trên server để hai bên khớp.
    let afterPost: ChatE2EKey | null = null;
    try {
      afterPost = await getRemoteChatKey(chatId);
    } catch {
      afterPost = null;
    }
    let finalKey = chatKey;
    if (afterPost?.wrapped_key) {
      try {
        finalKey = await unwrapChatKey(shared, afterPost.wrapped_key, afterPost.nonce);
      } catch {
        finalKey = chatKey;
      }
    }
    await setStoredChatKeyLocal(chatId, finalKey);
    if (localKey && localKey !== finalKey) await addChatAltKey(chatId, localKey);
    dbg('ensureChatKey', chatId, 'created/reconciled key=', short(finalKey), 'postedAs=', short(chatKey));
    notifyKeysUpdated();
    await setPeerKey({
      chat_id: chatId,
      partner_user_id: partnerUserId,
      partner_public_key: partnerPub,
      partner_key_version: partner.key_version,
    });
    chatKeyCache.set(chatId, finalKey);
    return finalKey;
  })();

  inFlightChatKeys.set(chatId, promise);
  try {
    return await promise;
  } finally {
    inFlightChatKeys.delete(chatId);
  }
}

export async function deriveChatKey(
  privateKey: CryptoKey,
  peerPublicKeyB64: string,
): Promise<CryptoKey> {
  const peerPub = (await crypto.subtle.importKey(
    'spki',
    b64ToBytes(peerPublicKeyB64).buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )) as CryptoKey;
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPub },
    privateKey,
    256,
  );
  const hkdfRaw = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: te.encode(E2E_INFO),
    },
    hkdfRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function generateChatKeyBase64(): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(32)));
}

export async function wrapChatKey(
  sharedKey: CryptoKey,
  chatKeyB64: string,
): Promise<{ wrapped: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    b64ToBytes(chatKeyB64).buffer as ArrayBuffer,
  );
  return {
    wrapped: bytesToB64(concat(iv, new Uint8Array(ct))),
    nonce: bytesToB64(iv),
  };
}

export async function unwrapChatKey(
  sharedKey: CryptoKey,
  wrapped: string,
  nonce?: string,
): Promise<string> {
  const blob = b64ToBytes(wrapped);
  const iv = nonce ? b64ToBytes(nonce) : blob.slice(0, 12);
  const ct = blob.slice(iv.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    sharedKey,
    ct as BufferSource,
  );
  return bytesToB64(new Uint8Array(plain));
}

export async function encryptMessage(
  chatKeyB64: string,
  plain: string,
): Promise<string> {
  const key = await importAesKey(b64ToBytes(chatKeyB64), ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(plain),
  );
  return bytesToB64(concat(iv, new Uint8Array(ct)));
}

export async function decryptMessage(
  chatKeyB64: string,
  cipher: string,
): Promise<string> {
  const blob = b64ToBytes(cipher);
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const key = await importAesKey(b64ToBytes(chatKeyB64), ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return td.decode(plain);
}

export async function decryptChat(
  chatId: string,
  cipher: string,
): Promise<string> {
  // Cache chỉ tin khóa THẬT. Giá trị null (chưa có khóa / race với lần ghi
  // trước của ensureChatKey) → coi như cache-miss, đọc lại storage — tránh
  // trường hợp cache bị ghi null SAU khi ensureChatKey đã ghi key → decrypt
  // vĩnh viễn keyCount=0 dù storage đã có khóa.
  let canonical: string | null = chatKeyCache.get(chatId) ?? null;
  if (!canonical) {
    try {
      canonical = await getStoredChatKeyLocal(chatId);
    } catch {
      canonical = null;
    }
    if (canonical) chatKeyCache.set(chatId, canonical);
  }

  const keys = new Set<string>();
  if (canonical) keys.add(canonical);
  try {
    const altKeys = await getChatAltKeys(chatId);
    for (const k of altKeys) keys.add(k);
  } catch {
    /* skip */
  }

  let lastErr: unknown = null;
  for (const key of keys) {
    try {
      return await decryptMessage(key, cipher);
    } catch (err) {
      lastErr = err;
    }
  }
  dbg(
    'decryptChat FAILED', chatId, 'cipher=', short(cipher), 'canonical=', short(canonical),
    'keyCount=', keys.size, 'err=', lastErr instanceof Error ? lastErr.message : String(lastErr),
  );
  if (lastErr) throw lastErr;
  throw new Error('e2e not ready');
}

// ── Khôi phục khóa chat trên thiết bị mới (PIN + recovery key) ──────────────
//
// PIN dùng PBKDF2-SHA-256 với số iteration cao (chậm) vì entropy thấp; recovery
// key sinh ngẫu nhiên (32 ký tự base32, ~160 bit) nên dùng iteration vừa phải.
export const PBKDF2_ITERATIONS = 600_000;
export const RECOVERY_PBKDF2_ITERATIONS = 200_000;

// Bảng chữ cái cho recovery key — bỏ các ký tự dễ nhầm (0/O, 1/I, L).
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return out;
}

export function generateRecoverySalt(): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriveBytesFromSecret(
  secret: string,
  saltB64: string,
  iterations: number,
): Promise<Uint8Array> {
  const salt = b64ToBytes(saltB64);
  const raw = await crypto.subtle.importKey(
    'raw',
    te.encode(secret).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    raw,
    256,
  );
  return new Uint8Array(bits);
}

// derivePinKey ra khóa AES-256-GCM từ PIN + salt (PBKDF2 600k iteration).
export async function derivePinKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const bytes = await deriveBytesFromSecret(pin, saltB64, PBKDF2_ITERATIONS);
  return importAesKey(bytes, ['encrypt', 'decrypt']);
}

// deriveRecoveryKey ra khóa AES-256-GCM từ recovery key + salt. Recovery key có
// entropy rất cao nên KDF nhẹ hơn (200k) vẫn an toàn.
export async function deriveRecoveryKey(
  recoveryKey: string,
  saltB64: string,
): Promise<CryptoKey> {
  const bytes = await deriveBytesFromSecret(
    recoveryKey,
    saltB64,
    RECOVERY_PBKDF2_ITERATIONS,
  );
  return importAesKey(bytes, ['encrypt', 'decrypt']);
}

// hashCheck tính giá trị băm để server đối chiếu khi unlock (không phải khóa
// giải mã — client tự dẫn khóa từ PIN/recovery key). Là SHA-256 của key bytes
// đã dẫn từ secret, deterministic để server so sánh được; entropy đủ cao (PBKDF2
// 600k + PIN ≥6 số / recovery key 160-bit) nên kháng offline brute-force.
export async function hashCheck(
  secret: string,
  saltB64: string,
  iterations: number,
): Promise<string> {
  const bytes = await deriveBytesFromSecret(secret, saltB64, iterations);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return bytesToB64(new Uint8Array(digest));
}

// RecoveryBlobPayload là nội dung backup: mọi khóa chat canonical + fallback.
// Mã hóa AES-256-GCM; server chỉ giữ blob vô nghĩa, không bao giờ đọc được.
export interface RecoveryBlobPayload {
  version: 1;
  keys: Record<string, string>;
  altKeys: Record<string, string[]>;
}

// Dạng blob trên server: { v, d, p, r }.
//  - d: payload mã hóa bằng backupKey (khóa ngẫu nhiên sinh một lần khi backup).
//  - p: backupKey bọc bằng key dẫn từ PIN.
//  - r: backupKey bọc bằng key dẫn từ recovery key.
// Nhờ vậy chỉ cần MỘT bản backup mà mở được bằng PIN lẫn recovery key.
export interface RecoveryBlobEnvelope {
  v: 1;
  d: string;
  p: string;
  r: string;
}

async function aesEncryptB64(bytes: Uint8Array, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    bytes as BufferSource,
  );
  return bytesToB64(concat(iv, new Uint8Array(ct)));
}

async function aesDecryptB64(b64: string, key: CryptoKey): Promise<Uint8Array | null> {
  try {
    const blob = b64ToBytes(b64);
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

// encryptRecoveryBlob mã hóa payload bằng backupKey ngẫu nhiên, rồi bọc
// backupKey dưới cả key PIN lẫn key recovery → blob mở được bằng cả hai.
export async function encryptRecoveryBlob(
  payload: RecoveryBlobPayload,
  pinKey: CryptoKey,
  recoveryKey: CryptoKey,
): Promise<string> {
  const backupKey = crypto.getRandomValues(new Uint8Array(32));
  const backupCryptoKey = await importAesKey(backupKey, ['encrypt', 'decrypt']);

  const data = await aesEncryptB64(te.encode(JSON.stringify(payload)), backupCryptoKey);
  const p = await aesEncryptB64(backupKey, pinKey);
  const r = await aesEncryptB64(backupKey, recoveryKey);

  const envelope: RecoveryBlobEnvelope = { v: 1, d: data, p, r };
  return JSON.stringify(envelope);
}

// decryptRecoveryBlob giải mã blob bằng key dẫn từ PIN hoặc recovery key (thử
// cả hai slot p/r). Trả null khi key không khớp (nhập sai) hoặc blob lỗi.
export async function decryptRecoveryBlob(
  blobJson: string,
  key: CryptoKey,
): Promise<RecoveryBlobPayload | null> {
  let envelope: RecoveryBlobEnvelope;
  try {
    envelope = JSON.parse(blobJson) as RecoveryBlobEnvelope;
    if (envelope.v !== 1 || !envelope.d) return null;
  } catch {
    return null;
  }
  const backupKeyBytes =
    (await aesDecryptB64(envelope.p, key)) ?? (await aesDecryptB64(envelope.r, key));
  if (!backupKeyBytes) return null;
  const backupCryptoKey = await importAesKey(backupKeyBytes, ['decrypt']);
  const plain = await aesDecryptB64(envelope.d, backupCryptoKey);
  if (!plain) return null;
  try {
    return JSON.parse(td.decode(plain)) as RecoveryBlobPayload;
  } catch {
    return null;
  }
}
