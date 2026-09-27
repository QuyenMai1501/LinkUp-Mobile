// Selftest DEV — đối chiếu WebCrypto polyfill với golden vector của Web.
// Nguồn vector: sources/LinkUp_Web/__tests__/e2ee.golden.test.ts
// (sinh offline bằng Node WebCrypto, hardcode — không phụ thuộc runtime).
//
// Chạy 1 lần khi app khởi động ở __DEV__ (gọi từ src/app/_layout.tsx),
// kết quả log qua dbg() → log Metro. PASS nghĩa là chuỗi
// ECDH P-256 → HKDF-SHA256 (info "linkup-e2e-v1") → AES-256-GCM trên mobile
// khớp 100% với web → giải mã tin web gửi (và ngược lại) là chắc chắn.

import { dbg, decryptMessage, deriveChatKey, derivePinKey, unwrapChatKey } from './e2ee';

// Fixture ECDH P-256 (bất biến, sinh 1 lần cùng bộ với web)
const ALICE_PKCS8 =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgEVCCsSAgULfnK9Pt6bYxDiNwriLA4g+LSiVhVJ2PMZqhRANCAASG2t+nJhAM8s1ce4OK9enAN2Q1JcJME1gYooGHD9RGcOFTAfL6AMOeofuHrwIHjrSKGH6uUWDk83Errq5U3Fmq';
const BOB_SPKI =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiIcQvCctYRsjCa6e1qUfEyWPvcKtuprNHhhwr5qylNEjUlgwx/E0ZST01Pv1lVQ67Y8x9k6yPrg9CqhBa0OVLw==';
const CHAT_KEY_B64 = 'AxQlNkdYaXqLnK2+z+DxAhMkNUZXaHmKm6y9zt/wARI=';
const GOLDEN_WRAPPED =
  'AQIDBAUGBwgJCgsM06pqZnZEHFO2/AE4HsGR/CiIgOGa2R3E9vxAdc+nQpEOPcbp33nT90C6VS0qIH4d';
const GOLDEN_ENCRYPTED =
  'AQIDBAUGBwgJCgsMiMk4JyI8GtEJyWymkoNR/6EqpxyQc5dUGE6FXkfM2ieO05+NuFc0wpiN';
const PLAIN_MSG = '🔒 golden vector message';

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

async function check(name: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    dbg('selftest', 'PASS', name);
    return true;
  } catch (err) {
    dbg(
      'selftest',
      'FAIL',
      name,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function runE2EESelfTest(): Promise<boolean> {
  const results = await Promise.all([
    // 1. AES-GCM: giải đúng ciphertext sinh bằng web (format IV(12) || ct||tag)
    check('AES-GCM decrypt golden', async () => {
      const got = await decryptMessage(CHAT_KEY_B64, GOLDEN_ENCRYPTED);
      if (got !== PLAIN_MSG) throw new Error(`got="${got}"`);
    }),

    // 2. ECDH + HKDF: derive đúng shared key như web rồi unwrap golden wrapped
    //    (import pkcs8 như identity flow thật)
    check('ECDH+HKDF derive + unwrap golden', async () => {
      const priv = await crypto.subtle.importKey(
        'pkcs8',
        b64ToBytes(ALICE_PKCS8) as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      );
      const shared = await deriveChatKey(priv, BOB_SPKI);
      const key = await unwrapChatKey(shared, GOLDEN_WRAPPED);
      if (key !== CHAT_KEY_B64) throw new Error(`key="${key}"`);
    }),

    // 3. Round-trip 2 identity: exportKey('spki') + deriveChatKey hai chiều
    //    phải cho cùng 1 khóa (đường code mobile↔mobile)
    check('ECDH 2-identity roundtrip', async () => {
      const a = (await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      )) as CryptoKeyPair;
      const b = (await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      )) as CryptoKeyPair;
      const pubA = bytesToB64(
        new Uint8Array(await crypto.subtle.exportKey('spki', a.publicKey)),
      );
      const pubB = bytesToB64(
        new Uint8Array(await crypto.subtle.exportKey('spki', b.publicKey)),
      );
      const keyAB = await deriveChatKey(a.privateKey, pubB);
      const keyBA = await deriveChatKey(b.privateKey, pubA);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        keyAB,
        new TextEncoder().encode('x'),
      );
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyBA,
        ct as BufferSource,
      );
      if (new TextDecoder().decode(pt) !== 'x') throw new Error('keys differ');
    }),

    // 4. PBKDF2 (đường recovery PIN, 600k iteration)
    check('PBKDF2 pin key roundtrip', async () => {
      const salt = bytesToB64(new Uint8Array(16));
      const key = await derivePinKey('123456', salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode('pin'),
      );
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ct as BufferSource,
      );
      if (new TextDecoder().decode(pt) !== 'pin') throw new Error('pin mismatch');
    }),
    // 5. Đường identity thật: generate extractable=true → export private JWK
    //    → import lại (false) → derive. Chặn regression "key is not extractable"
    //    (e2ee.ts generateIdentity lưu JWK xuống AsyncStorage).
    check('identity JWK export/import roundtrip', async () => {
      const kp = (await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      )) as CryptoKeyPair;
      const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      const spki = bytesToB64(
        new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey)),
      );
      const priv = await crypto.subtle.importKey(
        'jwk',
        jwk as JsonWebKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      );
      const shared = await deriveChatKey(priv, spki);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        shared,
        new TextEncoder().encode('jwk'),
      );
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        shared,
        ct as BufferSource,
      );
      if (new TextDecoder().decode(pt) !== 'jwk') throw new Error('jwk mismatch');
    }),
  ]);

  const failed = results.filter((ok) => !ok).length;
  dbg('selftest', failed === 0 ? 'ALL PASS' : `FAILED ${failed}/${results.length}`);
  return failed === 0;
}
