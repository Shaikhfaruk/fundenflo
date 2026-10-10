import { DevicePlatform } from '@/lib/constants/auth.constants';

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

const match = (rules: Array<[RegExp, string]>, agent: string) => rules.find(([pattern]) => pattern.test(agent))?.[1];

export function currentDevice() {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const name = [match(BROWSERS, agent), match(SYSTEMS, agent)].filter(Boolean).join(' on ') || 'Web browser';
  return { platform: DevicePlatform.Web, name };
}
