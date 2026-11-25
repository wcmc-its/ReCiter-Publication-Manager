import React from "react";
import { Dropdown } from "react-bootstrap";
import { useClosableDropdown } from "./useClosableDropdown";

interface DropdownWrapperProps {
  title: any,
  children: JSX.Element,
  variant?: string,
  // Fires when the menu closes (click outside, Escape, toggle). /report applies filters then.
  onClose?: () => void,
}

export const DropdownWrapper: React.FC<DropdownWrapperProps> = ({ title, children, variant = "primary", onClose }) => {
    const { show, onToggle, toggleRef } = useClosableDropdown(onClose);
    return (
      <Dropdown className="d-inline-block" show={show} onToggle={onToggle}>
        <Dropdown.Toggle ref={toggleRef} variant={variant} id="dropdown-basic">
          {title}
        </Dropdown.Toggle>
  
        <Dropdown.Menu style={{ padding: 0, minWidth: 260 }}>
          {children}
        </Dropdown.Menu>
      </Dropdown>
    )
}
