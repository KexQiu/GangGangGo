export type ResolvedColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryForeground: string;
  primaryPressed: string;
  primarySoft: string;
  info: string;
  infoSoft: string;
  navigationActive: string;
  navigationInactive: string;
  privacy: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
};

export const themeColors: Record<ResolvedColorScheme, ThemeColors> = {
  light: {
    background: '#F7FAF8',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF6F1',
    border: '#DDE8E1',
    text: '#1F2A24',
    textMuted: '#59695F',
    textSubtle: '#647269',
    primary: '#147D50',
    primaryForeground: '#FFFFFF',
    primaryPressed: '#10663F',
    primarySoft: '#DDF5E9',
    info: '#2664CE',
    infoSoft: '#E4EEFF',
    navigationActive: '#0B6B47',
    navigationInactive: '#59695F',
    privacy: '#7350BB',
    warning: '#925B00',
    warningSoft: '#FFF3D6',
    danger: '#C42E36',
    dangerSoft: '#FFE5E7',
  },
  dark: {
    background: '#0F1713',
    surface: '#1B2A23',
    surfaceMuted: '#14211B',
    border: '#2C4036',
    text: '#F1F7F3',
    textMuted: '#B9C8BF',
    textSubtle: '#A0B3A7',
    primary: '#41D492',
    primaryForeground: '#0F1713',
    primaryPressed: '#2FB77D',
    primarySoft: '#173D2C',
    info: '#73A3FF',
    infoSoft: '#1B315C',
    navigationActive: '#56E1A0',
    navigationInactive: '#B9C8BF',
    privacy: '#B197FF',
    warning: '#FDBA3B',
    warningSoft: '#4A3513',
    danger: '#FF6B70',
    dangerSoft: '#4A1F24',
  },
};
