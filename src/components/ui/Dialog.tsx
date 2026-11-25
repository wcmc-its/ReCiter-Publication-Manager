import { ReactNode, useId } from 'react';
import MuiDialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { focusRing } from './tokens';

// Shared header used by Dialog and Sheet: title, optional description, close button.
export function OverlayHeader({ titleId, descId, title, description, onClose, divider }: {
  titleId: string;
  descId: string;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  divider?: boolean;
}) {
  return (
    <Box sx={{
      position: 'relative', px: 2.5, pt: 2.5, pb: divider ? 2 : 0, pr: 6,
      borderBottom: divider ? '1px solid var(--pm-border)' : 'none',
    }}>
      <Box component="h2" id={titleId} sx={{ m: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: 'var(--pm-foreground)' }}>
        {title}
      </Box>
      {description && (
        <Box component="p" id={descId} sx={{ m: 0, mt: 0.75, fontSize: 14, lineHeight: 1.5, color: 'var(--pm-muted-foreground)' }}>
          {description}
        </Box>
      )}
      <IconButton
        aria-label="Close"
        onClick={onClose}
        size="small"
        disableRipple
        sx={{
          position: 'absolute', top: 14, right: 14, color: 'var(--pm-muted-foreground)', borderRadius: 'var(--radius-sm)',
          '&:hover': { color: 'var(--pm-foreground)', bgcolor: 'var(--pm-surface-2)' },
          '&.Mui-focusVisible': focusRing,
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap',
      px: 2.5, py: 2, borderTop: '1px solid var(--pm-border)',
    }}>
      {children}
    </Box>
  );
}

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, right-aligned under a divider. */
  footer?: ReactNode;
  /** Max width in px (default 512). */
  width?: number;
};

// Modal dialog. Escape, backdrop click, focus trap and return focus come from MUI's Modal.
export function Dialog({ open, onClose, title, description, children, footer, width = 512 }: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  return (
    <MuiDialog
      open={open}
      onClose={() => onClose()}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      PaperProps={{
        sx: {
          width: '100%', maxWidth: width, m: 2,
          borderRadius: 'var(--radius)', border: '1px solid var(--pm-border)',
          boxShadow: 'var(--shadow-lg)', bgcolor: 'var(--pm-surface)',
        },
      }}
    >
      <OverlayHeader titleId={titleId} descId={descId} title={title} description={description} onClose={onClose} />
      {children && <Box sx={{ px: 2.5, py: 2, fontSize: 14, color: 'var(--pm-foreground)' }}>{children}</Box>}
      {footer && <OverlayFooter>{footer}</OverlayFooter>}
    </MuiDialog>
  );
}
