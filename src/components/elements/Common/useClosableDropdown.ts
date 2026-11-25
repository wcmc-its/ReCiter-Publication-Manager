import { useCallback, useEffect, useRef, useState } from "react";

// Controlled show state for a react-bootstrap Dropdown whose menu closes on Escape from anywhere.
// react-bootstrap only handles Escape when focus is inside the toggle or menu; the /report filter
// menus use clickable divs, so after a click focus sits on <body> and Escape did nothing.
// Escape closes through the same path as a click outside, so onClose (apply filters) fires once.
export const useClosableDropdown = (onClose?: () => void) => {
  const [show, setShow] = useState(false);
  const showRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const toggleRef = useRef<HTMLButtonElement>(null);

  const onToggle = useCallback((nextShow: boolean) => {
    if (showRef.current === nextShow) return;
    showRef.current = nextShow;
    setShow(nextShow);
    if (!nextShow && onCloseRef.current) onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onToggle(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [show, onToggle]);

  return { show, onToggle, toggleRef };
};
