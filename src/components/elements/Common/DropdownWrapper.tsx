import React, { ComponentType } from "react";
import { Dropdown } from "react-bootstrap";

interface DropdownWrapperProps {
  title: any,
  children: JSX.Element,
  variant?: string,
}

export const DropdownWrapper: React.FC<DropdownWrapperProps> = ({ title, children, variant = "primary"}) => {
    return (
      <Dropdown className="d-inline-block">
        <Dropdown.Toggle variant={variant} id="dropdown-basic">
          {title}
        </Dropdown.Toggle>
  
        <Dropdown.Menu style={{ padding: 0, minWidth: 260, borderRadius: 12, border: '1px solid #d6d0c4', overflow: 'hidden' }}>
          {children}
        </Dropdown.Menu>
      </Dropdown>
    )
}