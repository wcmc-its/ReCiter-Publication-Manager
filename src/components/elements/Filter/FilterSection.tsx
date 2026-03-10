import React from "react";
import styles from './Filter.module.css';
import { Dropdown } from 'react-bootstrap';
import Link from 'next/link'

interface DropdownProps {
  title: string,
  children?: Array<string>,
}

interface SectionProps {
  list: Array<DropdownProps>
  buttonTitle?: string,
  buttonUrl: string,
}

const FilteSection: React.FC<SectionProps> = (props) => {
  return (
    <div className={styles.filterSection}>
      {
        props.list && props.list.map((item: DropdownProps, index: number) => {
          return (
            <Dropdown key={item.title}>
              <Dropdown.Toggle className={item.children ? `${styles.filterDropdown} ${styles.filled}` : styles.filterDropdown } id={item.title}>
              {item.title}
              </Dropdown.Toggle>
                {
                  item.children &&
                    <Dropdown.Menu>
                    {item.children.map((dropdownItem: string) => {
                    return (
                      <Dropdown.Item key={dropdownItem}>{dropdownItem}</Dropdown.Item>
                    )
                    })}
                  </Dropdown.Menu>
                }
            </Dropdown>
          )
        })
      }
      <Link href={props.buttonUrl} className={styles.updateBtn}>
        {props.buttonTitle}
      </Link>
    </div>
  )
}

export default FilteSection;
