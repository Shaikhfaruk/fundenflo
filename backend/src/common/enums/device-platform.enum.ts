export const DevicePlatform = {
  ios: 'ios',
  android: 'android',
  web: 'web',
  other: 'other',
} as const;

export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];
