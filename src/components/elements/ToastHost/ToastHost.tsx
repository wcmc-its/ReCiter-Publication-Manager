import { useEffect } from "react";
import type { ReactNode } from "react";
import { Slide, ToastContainer, toast } from "react-toastify";
import type { Id } from "react-toastify";
import { clearUndo, handleUndoKey, registerUndo, runUndo } from "../../../lib/undoShortcut";

// The app's only toast container, mounted once in _app.tsx so every page (Login included) shares
// it. Call sites just call toast.success/error/info(message); the look (dark pill, bottom-center,
// 5s, no progress bar) lives here and in styles/globals.css (.pm-toasts).
export default function ToastHost() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { handleUndoKey(e, document); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastContainer
      className="pm-toasts"
      position="bottom-center"
      autoClose={5000}
      hideProgressBar
      closeButton={false}
      icon={false}
      theme="dark"
      transition={Slide}
      role="status"
    />
  );
}

// A toast with an "Undo · U" button. While it is up, pressing U (outside a field or dialog, no
// Ctrl/Cmd/Alt) does the same as the button; showing another Undo toast replaces it. In-session
// only: nothing about the Undo survives a reload.
export function showUndoToast(
  message: ReactNode,
  onUndo: () => void,
  opts: { autoClose?: number; canUndo?: () => boolean; onClose?: () => void } = {},
): Id {
  let toastId: Id = "";
  const id = registerUndo(onUndo, { canUndo: opts.canUndo, dismiss: () => toast.dismiss(toastId) });
  toastId = toast(
    <span className="pm-undo-toast">
      <span>{message}</span>
      <button type="button" aria-keyshortcuts="U" onClick={() => runUndo(id)}>Undo · U</button>
    </span>,
    {
      autoClose: opts.autoClose,
      onClose: () => { clearUndo(id); opts.onClose?.(); },
    },
  );
  return toastId;
}
