import { forwardRef } from 'react';
import MuiButton, { ButtonProps as MuiButtonProps } from '@mui/material/Button';
import { focusRing } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<MuiButtonProps, 'variant' | 'size' | 'color'> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
};

// Colors per variant; disabled keeps the variant's look at half opacity.
const VARIANT = {
  primary: { mui: 'contained', color: '#fff', bg: 'primary.main', border: 'primary.main', hoverBg: 'primary.dark', hoverBorder: 'primary.dark' },
  secondary: { mui: 'outlined', color: 'var(--pm-foreground)', bg: 'var(--pm-surface)', border: 'var(--pm-border-strong)', hoverBg: 'var(--pm-surface-2)', hoverBorder: 'var(--pm-border-strong)' },
  ghost: { mui: 'text', color: 'var(--pm-foreground)', bg: 'transparent', border: 'transparent', hoverBg: 'var(--pm-surface-2)', hoverBorder: 'transparent' },
  danger: { mui: 'outlined', color: 'var(--pm-red)', bg: 'var(--pm-surface)', border: 'var(--pm-red-tint-border)', hoverBg: 'var(--pm-red-tint)', hoverBorder: 'var(--pm-red)' },
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', sx, ...rest }, ref,
) {
  const v = VARIANT[variant];
  return (
    <MuiButton
      ref={ref}
      variant={v.mui}
      disableElevation
      disableRipple
      sx={[
        {
          textTransform: 'none', fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap', minWidth: 0,
          borderRadius: 'var(--radius-md)', gap: 0.75,
          fontSize: size === 'sm' ? 13 : 14,
          height: size === 'sm' ? 32 : 36,
          px: size === 'sm' ? 1.5 : 2,
          '& .MuiButton-startIcon, & .MuiButton-endIcon': { m: 0 },
          border: '1px solid', color: v.color, bgcolor: v.bg, borderColor: v.border,
          '&:hover': { bgcolor: v.hoverBg, borderColor: v.hoverBorder },
          '&.Mui-focusVisible': focusRing,
          '&.Mui-disabled': { opacity: 0.5, color: v.color, bgcolor: v.bg, borderColor: v.border },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
});
