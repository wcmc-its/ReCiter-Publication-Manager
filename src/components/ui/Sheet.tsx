import { ReactNode, useId } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import { OverlayFooter, OverlayHeader } from './Dialog';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Panel width in px on sm and up (default 440); full width on phones. */
  width?: number;
};

// Side panel: a dialog anchored right. Escape, backdrop click, focus trap and return focus
// come from MUI's Modal (temporary Drawer); role/aria-modal/labelledby are set on the panel.
export function Sheet({ open, onClose, title, description, children, footer, width = 440 }: SheetProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => onClose()}
      PaperProps={{
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
        'aria-describedby': description ? descId : undefined,
        sx: {
          width: { xs: '100%', sm: width }, display: 'flex', flexDirection: 'column',
          bgcolor: 'var(--pm-surface)', borderLeft: '1px solid var(--pm-border)', boxShadow: 'var(--shadow-xl)',
        },
      }}
    >
      <OverlayHeader titleId={titleId} descId={descId} title={title} description={description} onClose={onClose} divider />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2, fontSize: 14, color: 'var(--pm-foreground)' }}>
        {children}
      </Box>
      {footer && <OverlayFooter>{footer}</OverlayFooter>}
    </Drawer>
  );
}
