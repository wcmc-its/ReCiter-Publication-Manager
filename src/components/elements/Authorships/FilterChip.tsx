import { CSSProperties, ReactNode, useRef } from "react";
import Popover from "@mui/material/Popover";

// One chip in the /authorships filter row: a pill that shows the filter's current value and
// opens its own list (radio for a single choice, checkbox for several), as in the prototype.
// The parent owns which chip is open, so one Escape or outside click closes whichever it is
// and the page's keyboard shortcuts can see that a list is up.

export type ChipOption = {
  value: string;
  label: string;
  sub?: string;
  count?: ReactNode;    // right-aligned, muted; omit for none
  dim?: boolean;        // greyed (a zero count nobody has ticked)
  title?: string;
};

type Props = {
  label: string;           // "Identity affiliation" — also names the Clear link
  text: string;            // what the pill reads: "Identity affiliation: Weill Cornell Medicine"
  active: boolean;         // slate tint
  open: boolean;
  onOpen: (el: HTMLElement) => void;
  onClose: () => void;
  single?: boolean;        // radio list; a pick closes the list
  options: ChipOption[];
  isChecked: (value: string) => boolean;
  onPick: (value: string) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  empty?: ReactNode;       // shown in place of the options when there are none
  onClear?: () => void;    // "Clear <label>", shown only while the chip is active
};

const chipStyle = (active: boolean, open: boolean): CSSProperties => ({
  font: "inherit",
  height: 32, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 11px",
  borderRadius: 999, border: `1px solid ${active ? "var(--pm-slate-tint-border)" : "var(--pm-border-strong)"}`,
  background: active ? "var(--pm-slate-tint)" : open ? "var(--pm-surface-2)" : "#fff",
  color: active ? "var(--pm-slate)" : "var(--pm-foreground)",
  fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", maxWidth: "100%",
});

export const popoverPaper: CSSProperties = {
  marginTop: 6, background: "#fff", border: "1px solid var(--pm-border-strong)", borderRadius: 10,
  boxShadow: "0 8px 24px rgba(34,30,28,0.12)", maxWidth: "calc(100vw - 32px)",
};

export const Chevron = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Marker = ({ on, round }: { on: boolean; round: boolean }) => (
  <span aria-hidden="true" style={{
    marginTop: 2, width: 16, height: 16, flexShrink: 0, boxSizing: "border-box",
    borderRadius: round ? "50%" : 4, display: "grid", placeItems: "center", color: "#fff",
    border: `1.5px solid ${on ? "var(--pm-slate)" : "var(--pm-muted-foreground)"}`,
    background: on ? "var(--pm-slate)" : "#fff",
  }}>
    {on && (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    )}
  </span>
);

export const optionRowClass = "pm-auth-opt";

export default function FilterChip({
  label, text, active, open, onOpen, onClose, single, options, isChecked, onPick, search, empty, onClear,
}: Props) {
  const anchor = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button ref={anchor} type="button" aria-haspopup="true" aria-expanded={open}
        onClick={() => (open ? onClose() : anchor.current && onOpen(anchor.current))}
        style={chipStyle(active, open)}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
        <Chevron />
      </button>
      <Popover open={open} anchorEl={anchor.current} onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        TransitionProps={{ onEntered: () => searchRef.current?.focus() }}
        PaperProps={{ style: { ...popoverPaper, width: 300, padding: 6, display: "flex", flexDirection: "column", gap: 4 } }}>
        {search && (
          <input ref={searchRef} type="search" value={search.value} onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder} aria-label={search.placeholder}
            style={{ font: "inherit", height: 32, boxSizing: "border-box", padding: "0 10px", border: "1px solid var(--pm-border-strong)", borderRadius: 6, fontSize: 13, outline: "none" }} />
        )}
        <div role={single ? "radiogroup" : "group"} aria-label={label}
          style={{ maxHeight: 340, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {options.length === 0 && empty}
          {options.map((o) => {
            const on = isChecked(o.value);
            return (
              <button key={o.value} type="button" role={single ? "radio" : "checkbox"} aria-checked={on}
                title={o.title} className={optionRowClass}
                onClick={() => { onPick(o.value); if (single) onClose(); }}
                style={{
                  font: "inherit", display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", border: 0,
                  background: "none", borderRadius: 6, textAlign: "left", fontSize: 13, cursor: "pointer",
                  color: "var(--pm-foreground)", opacity: o.dim && !on ? 0.55 : 1,
                }}>
                <Marker on={on} round={!!single} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span>{o.label}</span>
                  {o.sub && <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", lineHeight: 1.4 }}>{o.sub}</span>}
                </span>
                {o.count != null && o.count !== "" && (
                  <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{o.count}</span>
                )}
              </button>
            );
          })}
        </div>
        {active && onClear && (
          <button type="button" onClick={() => { onClear(); onClose(); }}
            style={{ font: "inherit", border: 0, borderTop: "1px solid var(--pm-border)", background: "none", padding: "8px 10px 4px", textAlign: "left", fontSize: 12.5, color: "var(--pm-slate)", cursor: "pointer" }}>
            Clear {label.toLowerCase()}
          </button>
        )}
      </Popover>
    </>
  );
}
