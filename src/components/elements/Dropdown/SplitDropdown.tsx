import React from "react";
import { ListItem } from "../../../../types/listItem";
import { SplitButton, Dropdown } from "react-bootstrap";
import Link from 'next/link';
import styles from './Dropdown.module.css';

interface DropdownProps {
  title: string,
  to: string,
  id: string, 
  listItems: Array<ListItem>,
  secondary?: boolean,
  disabled?: boolean,
}

const SplitDropdown: React.FC<DropdownProps> = ({ title, to, id, listItems, secondary, disabled}) => {
  return (
    <div className="mt-2">
      <Link href={to} passHref>
        <SplitButton
          className={secondary ? styles.secondaryDropdownButton : styles.dropdownButton}
          title={title}
          id={id}
          key={id}
          disabled={disabled}
        >
          {listItems.map((item: ListItem, index: number) => {
            return (
              <Link key={index} href={item.to} passHref><Dropdown.Item className={styles.dropdownItem} key={`${id}__${index}`} eventKey={index}>{item.title}</Dropdown.Item></Link>
            )
          })}
        </SplitButton>
      </Link>
  </div>
  )
}

export default SplitDropdown;