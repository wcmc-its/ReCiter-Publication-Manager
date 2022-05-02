import React, { ComponentType } from "react";
import { Dropdown } from "react-bootstrap";

interface DropdownWrapperProps {
  title: string,
  children: JSX.Element,
  variant?: string,
}

export const DropdownWrapper: React.FC<DropdownWrapperProps> = ({ title, children, variant = "primary"}) => {
    return (
      <Dropdown className="d-inline-block">
        <Dropdown.Toggle variant={variant} id="dropdown-basic">
          {title}
        </Dropdown.Toggle>
  
        <Dropdown.Menu className="px-4">
          {children}
        </Dropdown.Menu>
      </Dropdown>
    )
}