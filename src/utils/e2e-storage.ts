import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const IDENTITY_PREFIX = '@e2e:identity:';
const CHAT_KEY_PREFIX = '@e2e:chatKey:';
const CHAT_ALT_KEY_PREFIX = '@e2e:chatAltKeys:';

interface IdentityRecord {
  user_id: string;
  public_key: string;
  private_key_jwk: object;
}

// --- Identity (private key in SecureStore, public key in AsyncStorage) ---

export async function getIdentity(
  userId: string,
): Promise<{ public_key: string; private_key_jwk: object } | null> {
  const pub = await AsyncStorage.getItem(`${IDENTITY_PREFIX}${userId}:pub`);
  const priv = await SecureStore.getItemAsync(`${IDENTITY_PREFIX}${userId}:priv`);
  if (!pub || !priv) return null;
  return { public_key: pub, private_key_jwk: JSON.parse(priv) };
}

export async function setIdentity(record: IdentityRecord): Promise<void> {
  await AsyncStorage.setItem(
    `${IDENTITY_PREFIX}${record.user_id}:pub`,
    record.public_key,
  );
  await SecureStore.setItemAsync(
    `${IDENTITY_PREFIX}${record.user_id}:priv`,
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
