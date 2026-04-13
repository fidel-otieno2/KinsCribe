// ── Kinscribe Brand Theme ─────────────────────────────────────
// Bold & energetic · Earth tones · Family heritage

// ── DARK THEME (default) ─────────────────────────────────────
export const darkTheme = {
  mode: 'dark',

  // Backgrounds
  bg: '#1C1A14',
  bgSecondary: '#2A2720',
  bgCard: '#3A3527',
  bgElevated: '#443E30',

  // Surfaces
  surface: 'rgba(42,39,32,0.95)',
  surfaceLight: 'rgba(58,53,39,0.8)',

  // Text
  text: '#F5F0E8',
  textSecondary: '#E8E0CC',
  muted: '#A89070',
  dim: '#6B5D4A',

  // Borders
  border: 'rgba(196,163,90,0.12)',
  border2: 'rgba(196,163,90,0.22)',
  borderFamily: 'rgba(139,94,60,0.4)',

  // Brand colors (same in both modes)
  primary: '#4A7C3F',
  primaryDark: '#2D5A27',
  primaryLight: '#7FB069',
  gold: '#C4A35A',
  brown: '#8B5E3C',
  bark: '#5C3D2E',

  // Semantic
  red: '#C0392B',
  green: '#7FB069',
  error: '#E74C3C',

  // Story rings
  storyActive: ['#2D5A27', '#7FB069', '#C4A35A'],
  storyFamily: ['#8B5E3C', '#C4A35A', '#5C3D2E'],
  storySeen: ['#4A4035', '#4A4035'],

  // Tab bar
  tabBar: 'rgba(28,26,20,0.97)',
  tabBarBorder: 'rgba(196,163,90,0.1)',
};

// ── LIGHT THEME ───────────────────────────────────────────────
export const lightTheme = {
  mode: 'light',

  // Backgrounds
  bg: '#F5F0E8',
  bgSecondary: '#EDE6D6',
  bgCard: '#E8E0CC',
  bgElevated: '#FFFFFF',

  // Surfaces
  surface: 'rgba(245,240,232,0.97)',
  surfaceLight: 'rgba(232,224,204,0.9)',

  // Text
  text: '#1C1A14',
  textSecondary: '#3A3527',
  muted: '#6B5D4A',
  dim: '#A89070',

  // Borders
  border: 'rgba(45,90,39,0.1)',
  border2: 'rgba(45,90,39,0.18)',
  borderFamily: 'rgba(139,94,60,0.3)',

  // Brand colors (same in both modes)
  primary: '#2D5A27',
  primaryDark: '#1A3A16',
  primaryLight: '#4A7C3F',
  gold: '#8B5E3C',
  brown: '#5C3D2E',
  bark: '#3D2A1E',

  // Semantic
  red: '#C0392B',
  green: '#2D5A27',
  error: '#E74C3C',

  // Story rings
  storyActive: ['#2D5A27', '#7FB069', '#C4A35A'],
  storyFamily: ['#8B5E3C', '#C4A35A', '#5C3D2E'],
  storySeen: ['#C4B99A', '#C4B99A'],

  // Tab bar
  tabBar: 'rgba(245,240,232,0.97)',
  tabBarBorder: 'rgba(45,90,39,0.1)',
};

export const gradients = {
  primary: ['#2D5A27', '#4A7C3F'],
  primaryBold: ['#2D5A27', '#7FB069'],
  gold: ['#C4A35A', '#8B5E3C'],
  family: ['#8B5E3C', '#5C3D2E'],
  warm: ['#C4A35A', '#2D5A27'],
  darkBg: ['#1C1A14', '#2A2720'],
  lightBg: ['#F5F0E8', '#EDE6D6'],
  card: ['rgba(58,53,39,0.9)', 'rgba(28,26,20,0.95)'],
  hero: ['rgba(28,26,20,0.1)', 'rgba(28,26,20,0.6)', '#1C1A14'],
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#C4A35A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
};

// Legacy export so existing imports don't break
export const colors = darkTheme;
export const gradientColors = ['#2D5A27', '#4A7C3F'];
export const gradientStart = { x: 0, y: 0 };
export const gradientEnd = { x: 1, y: 1 };
