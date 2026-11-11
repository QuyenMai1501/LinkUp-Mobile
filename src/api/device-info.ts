import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const DEVICE_NAME_HEADER = 'X-Device-Name';

export function getDeviceName(): string | null {
  if (Platform.OS === 'web') return null;

  try {
    const model = Device.modelName?.trim();
    const os = Device.osName?.trim();
    const version = Device.osVersion?.trim();
    const osLabel = os ? (version ? `${os} ${version}` : os) : null;
    const name = [model, osLabel].filter(Boolean).join(' · ');
    if (name) return name;
  } catch {
    /* fall through */
  }

  return Platform.OS === 'ios' ? 'iOS' : 'Android';
}

export function deviceNameHeaders(): Record<string, string> {
  const name = getDeviceName();
  return name ? { [DEVICE_NAME_HEADER]: name } : {};
}
