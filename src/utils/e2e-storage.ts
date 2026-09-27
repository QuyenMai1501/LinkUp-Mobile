import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const IDENTITY_PREFIX = '@e2e:identity:';
const CHAT_KEY_PREFIX = '@e2e:chatKey:';
const CHAT_ALT_KEY_PREFIX = '@e2e:chatAltKeys:';
const PEER_KEY_PREFIX = '@e2e:peerKey:';

interface IdentityRecord {
  user_id: string;
  public_key: string;
  private_key_jwk: object;
}

// Public key (kèm version) của đối phương khi mình wrap khóa chat lần cuối.
// Dùng để phát hiện đối phương đổi identity/thiết bị → re-key row của mình.
interface PeerKeyRecord {
  chat_id: string;
  partner_user_id: string;
  partner_public_key: string;
  partner_key_version: number;
}

// --- Identity (private key in SecureStore, public key in AsyncStorage) ---

// SecureStore chỉ nhận key khớp /[A-Za-z0-9._-]/ (expo-secure-store validate
// trước khi gọi native) — prefix cũ '@e2e:identity:' chứa '@' và ':' → throw
// ở MỌI lần get/set, identity chưa từng lưu được trên thiết bị.
function secureIdentityKey(userId: string): string {
  return `e2e-identity-${userId}-priv`.replace(/[^\w.-]/g, '_');
}

export async function getIdentity(
  userId: string,
): Promise<{ public_key: string; private_key_jwk: object } | null> {
  const pub = await AsyncStorage.getItem(`${IDENTITY_PREFIX}${userId}:pub`);
  const priv = await SecureStore.getItemAsync(secureIdentityKey(userId));
  if (!pub || !priv) return null;
  return { public_key: pub, private_key_jwk: JSON.parse(priv) };
}

export async function setIdentity(record: IdentityRecord): Promise<void> {
  await AsyncStorage.setItem(
    `${IDENTITY_PREFIX}${record.user_id}:pub`,
    record.public_key,
  );
  await SecureStore.setItemAsync(
    secureIdentityKey(record.user_id),
    JSON.stringify(record.private_key_jwk),
  );
}

// --- Chat keys ---

export async function getChatKey(chatId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${CHAT_KEY_PREFIX}${chatId}`);
}

export async function setChatKey(chatId: string, key: string): Promise<void> {
  await AsyncStorage.setItem(`${CHAT_KEY_PREFIX}${chatId}`, key);
}

export async function deleteChatKeys(chatId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(`${CHAT_KEY_PREFIX}${chatId}`),
    AsyncStorage.removeItem(`${CHAT_ALT_KEY_PREFIX}${chatId}`),
  ]);
}

// --- Alt keys (fallback for old messages) ---

export async function getChatAltKeys(chatId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(`${CHAT_ALT_KEY_PREFIX}${chatId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function addChatAltKey(chatId: string, key: string): Promise<void> {
  const existing = await getChatAltKeys(chatId);
  if (!existing.includes(key)) {
    existing.push(key);
    await AsyncStorage.setItem(
      `${CHAT_ALT_KEY_PREFIX}${chatId}`,
      JSON.stringify(existing),
    );
  }
}

// --- Peer key version (phát hiện đối phương đổi identity) ---

export async function getPeerKey(chatId: string): Promise<PeerKeyRecord | undefined> {
  try {
    const raw = await AsyncStorage.getItem(`${PEER_KEY_PREFIX}${chatId}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as PeerKeyRecord;
  } catch {
    return undefined;
  }
}

export async function setPeerKey(record: PeerKeyRecord): Promise<void> {
  await AsyncStorage.setItem(
    `${PEER_KEY_PREFIX}${record.chat_id}`,
    JSON.stringify(record),
  );
}

// --- Snapshot khóa chat (dành cho backup khôi phục) ---

// getChatKeysSnapshot đọc toàn bộ khóa chat (canonical) + fallback thành một
// map dùng làm payload cho backup khôi phục khóa trên thiết bị mới.
export interface ChatKeysSnapshot {
  keys: Record<string, string>;
  altKeys: Record<string, string[]>;
}

export async function getChatKeysSnapshot(): Promise<ChatKeysSnapshot> {
  const all = await AsyncStorage.getAllKeys();
  const keyIds = all
    .filter((k) => k.startsWith(CHAT_KEY_PREFIX))
    .map((k) => k.slice(CHAT_KEY_PREFIX.length));
  const altIds = all
    .filter((k) => k.startsWith(CHAT_ALT_KEY_PREFIX))
    .map((k) => k.slice(CHAT_ALT_KEY_PREFIX.length));

  const keys: Record<string, string> = {};
  if (keyIds.length > 0) {
    const pairs = await AsyncStorage.multiGet(
      keyIds.map((id) => `${CHAT_KEY_PREFIX}${id}`),
    );
    for (const [fullKey, value] of pairs) {
      if (value) keys[fullKey.slice(CHAT_KEY_PREFIX.length)] = value;
    }
  }

  const altKeys: Record<string, string[]> = {};
  if (altIds.length > 0) {
    const pairs = await AsyncStorage.multiGet(
      altIds.map((id) => `${CHAT_ALT_KEY_PREFIX}${id}`),
    );
    for (const [fullKey, value] of pairs) {
      if (!value) continue;
      try {
        altKeys[fullKey.slice(CHAT_ALT_KEY_PREFIX.length)] = JSON.parse(value) as string[];
      } catch {
        /* bỏ qua khóa hỏng */
      }
    }
  }

  return { keys, altKeys };
}

// importChatKeysSnapshot ghi khóa chat đã giải mã từ backup vào AsyncStorage —
// dùng trên thiết bị mới sau khi unlock. Ghi canonical + các khóa fallback.
export async function importChatKeysSnapshot(snapshot: ChatKeysSnapshot): Promise<void> {
  const entries: [string, string][] = Object.entries(snapshot.keys).map(
    ([chatId, key]) => [`${CHAT_KEY_PREFIX}${chatId}`, key],
  );
  for (const [chatId, list] of Object.entries(snapshot.altKeys)) {
    if (list.length > 0) {
      entries.push([`${CHAT_ALT_KEY_PREFIX}${chatId}`, JSON.stringify(list)]);
    }
  }
  if (entries.length > 0) {
    await AsyncStorage.multiSet(entries);
  }
}
