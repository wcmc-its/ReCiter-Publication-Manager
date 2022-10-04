import React from "react";
import { ListItem } from "../../../../types/listItem";
import { SplitButton, Dropdown } from "react-bootstrap";
import Link from 'next/link';
import styles from './Dropdown.module.css';

interface DropdownProps {
  title: string,
  to?: string,
  onClick?: () => void,
  id: string, 
  listItems: Array<ListItem>,
  secondary?: boolean,
  disabled?: boolean,
  onDropDownClick:any,
  isUserRole:any
}

const SplitDropdown: React.FC<DropdownProps> = ({ isUserRole,title, to, onClick, id, listItems, secondary,onDropDownClick,disabled}) => {

  return (
    <div className="mt-2">
      {/* <Link href={{
            pathname: to,
            // state: curateData, // the data
          }} passHref> */}
        <SplitButton
          className={secondary ? styles.secondaryDropdownButton : styles.dropdownButton}
          title={title}
          id={id}
          key={id}
          disabled={disabled}
          onClick={()=>onDropDownClick()}
        >
          {listItems.map((item: ListItem, index: number) => {
            if (item.onClick !== undefined) {
              return (
                <Dropdown.Item className={styles.dropdownItem} key={`${id}__${index}`} eventKey={index} onClick={item.onClick}>
                  {item.title}
                </Dropdown.Item>
              )
            } else {
              return (
                // <Link key={index} href={item.to} passHref><Dropdown.Item className={styles.dropdownItem} key={`${id}__${index}`}   eventKey={index}>{item.title}</Dropdown.Item></Link>
                <Dropdown.Item className={styles.dropdownItem} key={`${id}__${index}`} onClick={onClick}   eventKey={index}>{item.title}</Dropdown.Item>
              )
            }
          })}
        </SplitButton>
      {/* </Link> */}
  </div>
  )
}

export default SplitDropdown;