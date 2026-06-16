import React from "react";
import { ListItem } from "../../../../types/listItem";
import { SplitButton, Dropdown } from "react-bootstrap";
import styles from './Dropdown.module.css';

interface DropdownProps {
  title: string,
  to?: string,
  onClick?:(title:string) => void,
  id: string,
  listItems: Array<ListItem>,
  secondary?: boolean,
  disabled?: boolean,
  onDropDownClick:any
}

const ICONS: Record<string, JSX.Element> = {
  "Curate Publications": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5.5h6M5 10.5h4"/></svg>
  ),
  "Create Reports": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12V4l5-2 5 2v8"/><path d="M7 14V9h2v5"/></svg>
  ),
  "View Profile": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/></svg>
  ),
  "Manage User": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/><path d="M11 2l1 1-3 3"/></svg>
  ),
  "Manage Profile": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5.5h3M5 10.5h4"/></svg>
  ),
  "Manage Notifications": (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a6 6 0 110 12A6 6 0 018 2z"/><path d="M8 5v3l2 2"/></svg>
  ),
};

const SplitDropdown: React.FC<DropdownProps> = ({ title, to, onClick, id, listItems, secondary, onDropDownClick, disabled }) => {

  return (
    <div className="mt-2">
        <SplitButton
          className={secondary ? styles.secondaryDropdownButton : styles.dropdownButton}
          title={title}
          id={id}
          key={id}
          disabled={disabled}
          onClick={(t: any) => onDropDownClick(t)}
        >
          {secondary && (
            <div className={styles.actionsHeader}>Actions for this person</div>
          )}
          {secondary && (
            <Dropdown.Item
              className={styles.actionsItemPrimary}
              onClick={() => onDropDownClick(title)}
            >
              {ICONS[title] || null}
              {title}
            </Dropdown.Item>
          )}
          {listItems.map((item: ListItem, index: number) => {
            const isViewProfile = item.title === "View Profile";
            const itemClass = secondary ? styles.actionsItem : styles.dropdownItem;

            return (
              <React.Fragment key={`${id}__${index}`}>
                {secondary && isViewProfile && <div className={styles.actionsDivider} />}
                <Dropdown.Item
                  className={itemClass}
                  eventKey={index}
                  onClick={item.onClick !== undefined ? item.onClick : () => onClick(item.title)}
                >
                  {secondary && (ICONS[item.title] || null)}
                  {item.title}
                </Dropdown.Item>
              </React.Fragment>
            );
          })}
        </SplitButton>
    </div>
  )
}

export default SplitDropdown;
