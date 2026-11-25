import { ReactNode } from 'react';
import MuiCheckbox, { CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { focusRing } from './tokens';

export type CheckboxProps = Omit<MuiCheckboxProps, 'size' | 'color'> & { label?: ReactNode };

// A real <input type="checkbox"> (MUI keeps it in the DOM), with a visible keyboard focus ring.
export function Checkbox({ label, sx, ...rest }: CheckboxProps) {
  const control = (
    <MuiCheckbox
      size="small"
      disableRipple
      sx={[
        {
          p: 0.5, borderRadius: 'var(--radius-sm)', color: 'var(--pm-muted-foreground)',
          '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: 'var(--pm-slate)' },
          '&.Mui-focusVisible': { ...focusRing, outlineOffset: '-2px' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
  if (!label) return control;
  return (
    <FormControlLabel
      control={control}
      label={label}
      sx={{ m: 0, gap: 0.5, '& .MuiFormControlLabel-label': { fontSize: 14, color: 'var(--pm-foreground)' } }}
    />
  );
}
