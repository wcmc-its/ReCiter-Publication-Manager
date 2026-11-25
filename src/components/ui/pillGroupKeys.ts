// Roving-focus math for PillGroup: which option an arrow/Home/End key moves focus to.
// Skips disabled options and wraps. Returns null for keys it doesn't handle (or nowhere to go).
export function nextPillIndex(key: string, current: number, disabled: boolean[]): number | null {
  const n = disabled.length;
  const enabled = (i: number) => !disabled[i];
  if (!disabled.some(d => !d)) return null;
  if (key === 'Home') return disabled.findIndex(d => !d);
  if (key === 'End') {
    for (let i = n - 1; i >= 0; i--) if (enabled(i)) return i;
  }
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!step) return null;
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n;
    if (enabled(i)) return i;
  }
  return null;
}
