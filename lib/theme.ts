import { Platform } from 'react-native';

export const colors = {
  ink: '#F7F8FA',
  muted: 'rgba(247,248,250,0.66)',
  line: 'rgba(255,255,255,0.14)',
  glass: 'rgba(16,22,30,0.58)',
  glassStrong: 'rgba(14,20,27,0.78)',
  white: '#FFFFFF',
  accent: '#DDE7FF',
  accentStrong: '#6F9FFF',
};

export const shadows = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  android: { elevation: 14 },
  default: {},
});
