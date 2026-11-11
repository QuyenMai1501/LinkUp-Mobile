import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const DEVICE_NAME_HEADER = 'X-Device-Name';

const MAX_DEVICE_NAME_LENGTH = 100;

function toHeaderValue(raw: string): string {
  return raw
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DEVICE_NAME_LENGTH);
}

export function getDeviceName(): string | null {
  if (Platform.OS === 'web') return null;

  const fallback = Platform.OS === 'ios' ? 'iOS' : 'Android';

  try {
    const model = Device.modelName?.trim();
    const os = Device.osName?.trim();
    const version = Device.osVersion?.trim();
    const osLabel = os ? (version ? `${os} ${version}` : os) : null;
    const name = toHeaderValue(
      [model, osLabel].filter(Boolean).join(' - '),
    );
    return name || fallback;
  } catch {
    return fallback;
  }
}

export function deviceNameHeaders(): Record<string, string> {
  const name = getDeviceName();
  return name ? { [DEVICE_NAME_HEADER]: name } : {};
}
