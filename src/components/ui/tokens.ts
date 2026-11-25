// Hex values the MUI theme needs (MUI computes hover/alpha shades, so it can't take CSS vars).
// Mirrors the --pm-* / --wcm-* tokens in styles/globals.css; change both together.
export const pm = {
  red: '#b31b1b',
  redDark: '#8c1515',
  redLight: '#f5e6e6',
  slate: '#34506e',
  page: '#faf8f6',
  surface: '#ffffff',
  border: '#e9e3df',
  foreground: '#1c1c1c',
  mutedForeground: '#6a6a6a',
};

// Visible keyboard focus ring shared by the primitives.
export const focusRing = { outline: '2px solid var(--pm-ring)', outlineOffset: '2px' };
