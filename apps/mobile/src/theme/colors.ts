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
    textMuted: '#65746B',
    textSubtle: '#94A39A',
    primary: '#2FB77D',
    primaryPressed: '#1E8F62',
    primarySoft: '#DDF5E9',
    info: '#3C7DF0',
    infoSoft: '#E4EEFF',
    navigationActive: '#197A54',
    navigationInactive: '#65746B',
    privacy: '#8D6BE8',
    warning: '#F59E0B',
    warningSoft: '#FFF3D6',
    danger: '#E5484D',
    dangerSoft: '#FFE5E7',
  },
  dark: {
    background: '#0F1713',
    surface: '#1B2A23',
    surfaceMuted: '#14211B',
    border: '#2C4036',
    text: '#F1F7F3',
    textMuted: '#B9C8BF',
    textSubtle: '#819188',
    primary: '#41D492',
    primaryPressed: '#2FB77D',
    primarySoft: '#173D2C',
    info: '#73A3FF',
    infoSoft: '#1B315C',
    navigationActive: '#41D492',
    navigationInactive: '#B9C8BF',
    privacy: '#B197FF',
    warning: '#FDBA3B',
    warningSoft: '#4A3513',
    danger: '#FF6B70',
    dangerSoft: '#4A1F24',
  },
};
