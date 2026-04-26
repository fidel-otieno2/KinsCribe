// ── KinsCribe Premium Theme ───────────────────────────────────
// Deep navy · Purple-blue accents · Glassmorphism · AI-powered feel

// ── DARK THEME ────────────────────────────────────────────────
export const darkTheme = {
  mode: 'dark',

  // Backgrounds
  bg:            '#0F172A',
  bgSecondary:   '#0B0F1A',
  bgCard:        '#1E293B',
  bgElevated:    '#111827',

  // Surfaces
  surface:       'rgba(30,41,59,0.95)',
  surfaceLight:  'rgba(255,255,255,0.05)',

  // Text
  text:          '#FFFFFF',
  textSecondary: '#E2E8F0',
  muted:         '#94A3B8',
  dim:           '#64748B',

  // Borders
  border:        'rgba(255,255,255,0.08)',
  border2:       'rgba(255,255,255,0.12)',
  borderFamily:  'rgba(124,58,237,0.3)',

  // Brand — Purple primary
  primary:       '#7C3AED',
  primaryDark:   '#5B21B6',
  primaryLight:  '#8B5CF6',

  // Secondary — Blue
  secondary:     '#3B82F6',
  secondaryLight:'#60A5FA',
  cyan:          '#06B6D4',

  // Legacy aliases so existing screens don't break
  gold:          '#F59E0B',
  brown:         '#7C3AED',
  bark:          '#5B21B6',

  // Semantic
  red:           '#EF4444',
  green:         '#10B981',
  error:         '#EF4444',
  warning:       '#F59E0B',
  info:          '#38BDF8',

  // Story rings
  storyActive:   ['#7C3AED', '#3B82F6', '#06B6D4'],
  storyFamily:   ['#9333EA', '#3B82F6'],
  storySeen:     ['#1E293B', '#1E293B'],

  // Tab bar
  tabBar:        'rgba(11,15,26,0.97)',
  tabBarBorder:  'rgba(124,58,237,0.15)',
};

// ── LIGHT THEME ───────────────────────────────────────────────
export const lightTheme = {
  mode: 'light',

  // Backgrounds
  bg:            '#F8FAFC',
  bgSecondary:   '#F1F5F9',
  bgCard:        '#FFFFFF',
  bgElevated:    '#FFFFFF',

  // Surfaces
  surface:       'rgba(248,250,252,0.97)',
  surfaceLight:  'rgba(124,58,237,0.05)',

  // Text
  text:          '#0F172A',
  textSecondary: '#1E293B',
  muted:         '#64748B',
  dim:           '#94A3B8',

  // Borders
  border:        'rgba(15,23,42,0.08)',
  border2:       'rgba(15,23,42,0.12)',
  borderFamily:  'rgba(124,58,237,0.2)',

  // Brand
  primary:       '#7C3AED',
  primaryDark:   '#5B21B6',
  primaryLight:  '#8B5CF6',

  // Secondary
  secondary:     '#3B82F6',
  secondaryLight:'#60A5FA',
  cyan:          '#06B6D4',

  // Legacy aliases
  gold:          '#F59E0B',
  brown:         '#7C3AED',
  bark:          '#5B21B6',

  // Semantic
  red:           '#EF4444',
  green:         '#10B981',
  error:         '#EF4444',
  warning:       '#F59E0B',
  info:          '#38BDF8',

  // Story rings
  storyActive:   ['#7C3AED', '#3B82F6', '#06B6D4'],
  storyFamily:   ['#9333EA', '#3B82F6'],
  storySeen:     ['#CBD5E1', '#CBD5E1'],

  // Tab bar
  tabBar:        'rgba(248,250,252,0.97)',
  tabBarBorder:  'rgba(124,58,237,0.1)',
};

export const gradients = {
  primary:     ['#7C3AED', '#3B82F6'],
  primaryBold: ['#9333EA', '#06B6D4'],
  purple:      ['#7C3AED', '#5B21B6'],
  blue:        ['#3B82F6', '#06B6D4'],
  darkBg:      ['#0F172A', '#1E1040', '#0F172A'],
  card:        ['rgba(30,41,59,0.9)', 'rgba(15,23,42,0.95)'],
  hero:        ['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.6)', '#0F172A'],
  glow:        ['rgba(124,58,237,0.4)', 'rgba(59,130,246,0.2)', 'transparent'],
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  xxl:  32,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
};

// Legacy export so existing imports don't break
export const colors = darkTheme;
export const gradientColors = ['#7C3AED', '#3B82F6'];
export const gradientStart = { x: 0, y: 0 };
export const gradientEnd = { x: 1, y: 1 };
