import { KeyboardEvent, useRef } from 'react';
import Box from '@mui/material/Box';
import { focusRing } from './tokens';
import { nextPillIndex } from './pillGroupKeys';

export type PillOption = { value: string; label: string; disabled?: boolean };

type Common = {
  /** Accessible name for the group. */
  label: string;
  options: PillOption[];
};
export type PillGroupProps = Common & (
  | { multiple?: false; value: string | null; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

// Pill-style single choice (role=radiogroup) or multi choice (group of role=checkbox).
// One tab stop: arrow keys / Home / End move focus (and select, for radio groups); Space or Enter picks.
export function PillGroup(props: PillGroupProps) {
  const { label, options, multiple } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const isOn = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);
  const firstOn = options.findIndex(o => isOn(o.value) && !o.disabled);
  const tabStop = firstOn >= 0 ? firstOn : options.findIndex(o => !o.disabled);

  const pick = (v: string) => {
    // tsconfig has strict off, so the union doesn't narrow on `multiple`; cast per branch.
    if (props.multiple) props.onChange(isOn(v) ? props.value.filter(x => x !== v) : [...props.value, v]);
    else (props.onChange as (value: string) => void)(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = nextPillIndex(e.key, i, options.map(o => !!o.disabled));
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    // Radio groups select as focus moves (WAI-ARIA radio pattern); checkbox groups only move focus.
    if (!multiple) pick(options[next].value);
  };

  return (
    <Box role={multiple ? 'group' : 'radiogroup'} aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {options.map((o, i) => {
        const on = isOn(o.value);
        return (
          <Box
            key={o.value}
            component="button"
            type="button"
            ref={(el: HTMLButtonElement | null) => { refs.current[i] = el; }}
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={o.disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => pick(o.value)}
            onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => onKeyDown(e, i)}
            sx={{
              height: 30, px: 1.5, borderRadius: 'var(--radius-pill)', border: '1px solid',
              fontFamily: 'inherit', fontSize: 13, lineHeight: 1, cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: on ? 600 : 500,
              color: on ? 'var(--pm-slate)' : 'var(--pm-foreground)',
              bgcolor: on ? 'var(--pm-slate-tint)' : 'var(--pm-surface)',
              borderColor: on ? 'var(--pm-slate)' : 'var(--pm-border-strong)',
              '&:hover:not(:disabled)': { borderColor: on ? 'var(--pm-slate)' : 'var(--pm-muted-foreground)' },
              '&:focus-visible': focusRing,
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}
