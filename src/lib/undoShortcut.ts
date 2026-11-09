// The one in-session Undo behind the global toast host (ToastHost.tsx). Only the newest Undo
// toast owns the "U" shortcut: showing another replaces it, and it is cleared when its toast
// closes. Kept free of React and react-toastify so scripts/check-undo-shortcut.mjs can run it.

export interface UndoKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

interface UndoEntry {
  id: number;
  run: () => void;
  // keyboard-only gate (the Undo button always works, as the old Snackbar button did)
  canUndo?: () => boolean;
  dismiss?: () => void;
}

let current: UndoEntry | null = null;
let seq = 0;

export function registerUndo(run: () => void, opts: { canUndo?: () => boolean; dismiss?: () => void } = {}): number {
  current?.dismiss?.();
  current = { id: ++seq, run, ...opts };
  return current.id;
}

// Called when the toast closes (timeout, dismiss, unmount). A stale id is a no-op, so an older
// toast finishing its exit animation can't clear a newer Undo.
export function clearUndo(id: number): void {
  if (current?.id === id) current = null;
}

// Runs the Undo at most once, and only while it is still the current one.
export function runUndo(id: number): boolean {
  const entry = current;
  if (!entry || entry.id !== id) return false;
  current = null;
  entry.dismiss?.();
  entry.run();
  return true;
}

// "U" with no Ctrl/Cmd/Alt, not typed into a field, and not while a dialog, menu or listbox is up.
export function isUndoKey(e: UndoKeyEvent, doc?: { querySelector(s: string): unknown }): boolean {
  if (e.key !== "u" && e.key !== "U") return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = t?.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return false;
  if (doc?.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')) return false;
  return true;
}

// The host's keydown handler: true when it consumed the key.
export function handleUndoKey(e: UndoKeyEvent & { preventDefault(): void }, doc?: { querySelector(s: string): unknown }): boolean {
  const entry = current;
  if (!entry || !isUndoKey(e, doc)) return false;
  if (entry.canUndo && !entry.canUndo()) return false;
  e.preventDefault();
  return runUndo(entry.id);
}
