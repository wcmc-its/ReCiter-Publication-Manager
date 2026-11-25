import { forwardRef } from 'react';
import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';

export type InputProps = Omit<OutlinedInputProps, 'size' | 'color'>;

// Shared field look for Input and Select.
export const fieldSx = {
  fontSize: 14, bgcolor: 'var(--pm-surface)', borderRadius: 'var(--radius-md)', color: 'var(--pm-foreground)',
  '& .MuiOutlinedInput-input': { py: 1, px: 1.5 },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--pm-muted-foreground)', opacity: 1 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--pm-border-strong)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--pm-muted-foreground)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--pm-ring)', borderWidth: 2 },
};

// Pair with a <label htmlFor={id}> or pass inputProps={{ 'aria-label': ... }}.
export const Input = forwardRef<HTMLDivElement, InputProps>(function Input({ sx, ...rest }, ref) {
  return <OutlinedInput ref={ref} size="small" sx={[fieldSx, ...(Array.isArray(sx) ? sx : [sx])]} {...rest} />;
});
