/**
 * Theme Constants
 * Centralized color and style definitions for consistent UI
 */

/**
 * Brand colors
 */
export const COLORS = {
  // Aureen brand — champagne gold, light & airy
  primary: '#C9A86C',
  primaryHover: '#B8975B',
  primaryDark: '#A9863F',

  accent: '#A9863F',
  accentHover: '#977636',

  // Soft champagne tints + warm ivory surfaces
  goldSoft: '#F6EFE2',
  goldChip: '#F4ECDD',
  goldChipText: '#9A7B43',
  goldBorder: '#EBE3D3',
  goldBorderStrong: '#E0D6C2',
  onGold: '#2C2417',

  surface: '#FBFAF7',
  surfaceWhite: '#ffffff',
  border: '#EFE7D8',

  secondary: '#C9A86C',
  secondaryHover: '#B8975B',
  secondaryDark: '#A9863F',

  danger: '#EFDDDD',
  dangerHover: '#E5CDCD',
  dangerText: '#C96A6A',

  success: '#10b981',
  successHover: '#059669',

  highlightYellow: '#F3E7C9',
  highlightMint: '#d1fae5',
  highlightCoral: '#fed7d7',
  highlightPeach: '#fde68a',
  highlightLavender: '#e9d5ff',
  highlightSky: '#dbeafe',

  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  textPrimary: '#1F1F2E',
  textSecondary: '#9492A8',
  textMuted: '#9ca3af',
} as const;

/**
 * Highlight color mapping for Tailwind classes
 */
export const HIGHLIGHT_COLOR_CLASSES: Record<string, string> = {
  yellow: 'bg-highlight-yellow',
  mint: 'bg-highlight-mint',
  coral: 'bg-highlight-coral',
  peach: 'bg-highlight-peach',
  lavender: 'bg-highlight-lavender',
  sky: 'bg-highlight-sky'
};

/**
 * Common button styles
 */
export const BUTTON_STYLES = {
  base: 'px-4 py-2 rounded-lg font-medium transition-all duration-200',
  primary: `${COLORS.primary} hover:${COLORS.primaryHover}`,
  danger: `${COLORS.danger} hover:${COLORS.dangerHover}`,

  // Size variants
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
} as const;

/**
 * Get inline styles for primary button
 */
export function getPrimaryButtonStyles(isHovered = false): React.CSSProperties {
  return {
    backgroundColor: isHovered ? COLORS.primaryHover : COLORS.primary,
    color: COLORS.textPrimary,
  };
}

/**
 * Get inline styles for danger button
 */
export function getDangerButtonStyles(isHovered = false): React.CSSProperties {
  return {
    backgroundColor: isHovered ? COLORS.dangerHover : COLORS.danger,
    color: COLORS.dangerText,
  };
}

/**
 * Common spacing values
 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const;

/**
 * Common border radius values
 */
export const BORDER_RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  base: 1,
  dropdown: 10,
  sticky: 100,
  overlay: 1000,
  modal: 10000,
  tooltip: 100000,
  max: 2147483647, // Maximum z-index for Chrome extension elements
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;
