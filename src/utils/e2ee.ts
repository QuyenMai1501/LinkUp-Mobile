import {
  getIdentity,
  setIdentity,
  getChatKey as getStoredChatKeyLocal,
  setChatKey as setStoredChatKeyLocal,
  getChatAltKeys,
  addChatAltKey,
} from './e2e-storage';
import {
  getChatKey as getRemoteChatKey,
  getUserKey,
  registerUserKey,
  storeChatKeys,
} from '@/api/e2e';
import type { ChatE2EKey } from '@/api/e2e';

export const E2E_INFO = 'linkup-e2e-v1';

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
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const pubRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pubB64 = bytesToB64(new Uint8Array(pubRaw));
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { userId, publicKey: pubB64, privateKeyJwk: privJwk };
}

export async function getOrCreateIdentity(userId: string) {
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
}

const registeredUserKeys = new Map<string, Promise<unknown>>();

function ensureRegisteredUserKey(
  userId: string,
  publicKey: string,
): Promise<void> {
  const existing = registeredUserKeys.get(userId);
  const p =
    existing ??
    registerUserKey(publicKey).catch((err: unknown) => {
      registeredUserKeys.delete(userId);
      throw err;
    });
  if (!existing) registeredUserKeys.set(userId, p);
  return p.then(() => undefined);
}

const inFlightChatKeys = new Map<string, Promise<string | null>>();
const chatKeyCache = new Map<string, string | null>();

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

    let localKey: string | null = null;
    try {
      localKey = await getStoredChatKeyLocal(chatId);
    } catch {
      localKey = null;
    }

    let partnerPub: string | null = null;
    try {
      partnerPub = (await getUserKey(partnerUserId)).public_key;
    } catch {
      partnerPub = null;
    }
    if (!partnerPub) {
      chatKeyCache.set(chatId, localKey);
      return localKey;
    }

    const shared = await deriveChatKey(identity.privateKey, partnerPub);

    let remote: ChatE2EKey | null = null;
    try {
      remote = await getRemoteChatKey(chatId);
    } catch {
      remote = null;
    }
    if (remote?.wrapped_key) {
      try {
        const key = await unwrapChatKey(shared, remote.wrapped_key, remote.nonce);
        await setStoredChatKeyLocal(chatId, key);
        if (localKey && localKey !== key) await addChatAltKey(chatId, localKey);
        chatKeyCache.set(chatId, key);
        return key;
      } catch {
        chatKeyCache.set(chatId, localKey);
        return localKey;
      }
    }

    const chatKey = localKey ?? generateChatKeyBase64();
    const mine = await wrapChatKey(shared, chatKey);
    const theirs = await wrapChatKey(shared, chatKey);
    await storeChatKeys([
      { chat_id: chatId, user_id: myUserId, wrapped_key: mine.wrapped, nonce: mine.nonce },
      { chat_id: chatId, user_id: partnerUserId, wrapped_key: theirs.wrapped, nonce: theirs.nonce },
    ]);

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
  let canonical: string | null | undefined = chatKeyCache.get(chatId);
  if (canonical === undefined) {
    try {
      canonical = await getStoredChatKeyLocal(chatId);
    } catch {
      canonical = null;
    }
    chatKeyCache.set(chatId, canonical);
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
  if (lastErr) throw lastErr;
  throw new Error('e2e not ready');
}
