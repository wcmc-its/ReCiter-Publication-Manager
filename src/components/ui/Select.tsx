import MuiSelect, { SelectProps as MuiSelectProps } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import { fieldSx } from './Input';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<MuiSelectProps<string>, 'value' | 'onChange' | 'size' | 'color' | 'multiple' | 'input' | 'children' | 'variant'> & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

// Single-value select. Label it with labelId + a visible label, or inputProps={{ 'aria-label': ... }}.
export function Select({ value, onChange, options, sx, MenuProps, ...rest }: SelectProps) {
  return (
    <MuiSelect<string>
      value={value}
      onChange={e => onChange(e.target.value)}
      input={<OutlinedInput size="small" />}
      sx={[fieldSx, { '& .MuiSelect-select': { py: 1, pl: 1.5 } }, ...(Array.isArray(sx) ? sx : [sx])]}
      MenuProps={{ PaperProps: { sx: { mt: 0.5, borderRadius: 'var(--radius-md)', border: '1px solid var(--pm-border)', boxShadow: 'var(--shadow-md)' } }, ...MenuProps }}
      {...rest}
    >
      {options.map(o => (
        <MenuItem key={o.value} value={o.value} disabled={o.disabled} sx={{ fontSize: 14 }}>
          {o.label}
        </MenuItem>
      ))}
    </MuiSelect>
  );
}
