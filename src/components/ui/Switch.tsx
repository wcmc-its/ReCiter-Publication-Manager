import { ReactNode } from 'react';
import MuiSwitch, { SwitchProps as MuiSwitchProps } from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { focusRing } from './tokens';

export type SwitchProps = Omit<MuiSwitchProps, 'size' | 'color'> & { label?: ReactNode };

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--pm-slate)' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'var(--pm-slate)', opacity: 1 },
  '& .MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb': focusRing,
};

// role="switch" so screen readers announce on/off rather than checked/unchecked.
export function Switch({ label, sx, inputProps, ...rest }: SwitchProps) {
  const control = (
    <MuiSwitch size="small" sx={[switchSx, ...(Array.isArray(sx) ? sx : [sx])]} inputProps={{ role: 'switch', ...inputProps }} {...rest} />
  );
  if (!label) return control;
  return (
    <FormControlLabel
      control={control}
      label={label}
      sx={{ m: 0, gap: 0.75, '& .MuiFormControlLabel-label': { fontSize: 14, color: 'var(--pm-foreground)' } }}
    />
  );
}
