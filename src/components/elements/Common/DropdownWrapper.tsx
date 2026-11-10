import React from "react";
import { Dropdown } from "react-bootstrap";

interface DropdownWrapperProps {
  title: any,
  children: JSX.Element,
  variant?: string,
  // Fires when the menu closes (click outside, Escape, toggle). /report applies filters then.
  onClose?: () => void,
}

export const DropdownWrapper: React.FC<DropdownWrapperProps> = ({ title, children, variant = "primary", onClose }) => {
    return (
      <Dropdown className="d-inline-block" onToggle={(nextShow) => { if (!nextShow && onClose) onClose(); }}>
        <Dropdown.Toggle variant={variant} id="dropdown-basic">
          {title}
        </Dropdown.Toggle>
  
        <Dropdown.Menu style={{ padding: 0, minWidth: 260 }}>
          {children}
        </Dropdown.Menu>
      </Dropdown>
    )
}
