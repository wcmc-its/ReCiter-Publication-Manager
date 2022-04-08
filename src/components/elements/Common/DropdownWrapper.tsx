import React, { ComponentType } from "react";
import { Dropdown } from "react-bootstrap";

interface DropdownWrapperProps {
  title: string,
  children: JSX.Element,
}

export const DropdownWrapper: React.FC<DropdownWrapperProps> = ({ title, children}) => {
    return (
      <Dropdown className="d-inline-block">
        <Dropdown.Toggle variant="primary" id="dropdown-basic">
          {title}
        </Dropdown.Toggle>
  
        <Dropdown.Menu className="px-4">
          {children}
        </Dropdown.Menu>
      </Dropdown>
    )
}

export const withDropdown = (Component: ComponentType<any>, name: string) => {
  return () => {
    return (
      <Dropdown className="d-inline-block">
        <Dropdown.Toggle variant="primary" id="dropdown-basic">
          {name}
        </Dropdown.Toggle>
  
        <Dropdown.Menu className="px-4">
          <Component />
        </Dropdown.Menu>
      </Dropdown>
    )
  };
};