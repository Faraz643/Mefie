import { Platform } from 'react-native';

export const colors = {
  ink: '#F8FAFC',
  muted: 'rgba(248,250,252,0.68)',
  faint: 'rgba(248,250,252,0.46)',
  line: 'rgba(255,255,255,0.20)',
  lineStrong: 'rgba(255,255,255,0.34)',
  glass: 'rgba(28,34,42,0.54)',
  glassStrong: 'rgba(19,25,33,0.74)',
  glassLight: 'rgba(255,255,255,0.14)',
  white: '#FFFFFF',
  black: '#0B1016',
  accent: '#E8F0FF',
  accentStrong: '#78A5FF',
  danger: '#FFB8B8',
};

export const radii = {
  card: 26,
  button: 21,
  pill: 999,
};

export const shadows = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  android: { elevation: 16 },
  default: {},
});
