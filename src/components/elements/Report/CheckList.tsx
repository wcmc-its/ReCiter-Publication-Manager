import React, { useState } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form } from "react-bootstrap";
import styles from "./ChecboxSelect.module.css";

export const CheckList = ({ title, options, onUpdateFilter, filterName, selectedOptions }) => {
  const [selectedList, setSelectedList] = useState<any>([]);

  const onSelect = (event) => {
    let value = event.target.value;
    let checked = event.target.checked;
    let updatedSelected = [];

    if (checked) {
      updatedSelected = [...selectedOptions, value]

      // find the option
      let optionObj = options.find(option => option.key == value);
      // add to the selected list state to display at the bottom of the options
      if (optionObj) {
        let updatedList = [...selectedList, optionObj];
        setSelectedList(updatedList);
      }
    } else {
      updatedSelected = selectedOptions.filter(option => option != value)

      // remove from the selected list state
      let updatedList = selectedList.filter(item => item.key != value);
      setSelectedList(updatedList);
    }
    onUpdateFilter(filterName, updatedSelected);
  }

  return (
    <DropdownWrapper title={title} variant={ selectedOptions.length > 0 ? "primary" : "white"}>
      <div>
        {
          options.map((option) => {
            if (selectedOptions.includes(option.key)) {
              return null;
            } else {
              return (
                <Form.Check
                  type="checkbox"
                  id={option.key}
                  key={option.key}
                  label={option.label}
                  value={option.key}
                  checked={selectedOptions.includes(option.label)}
                  onChange={(e) => onSelect(e)}
                  />
              )
            }
          })
        }
        {
          selectedList.length > 0 && 
          <div className={styles.selectFiltersContainer}>
            <div className={styles.divider}></div>
              {
                selectedList.map((item, index) => {
                  return (
                    <Form.Check
                    type="checkbox"
                    id={item.key}
                    key={item.key}
                    label={item.label}
                    value={item.key}
                    checked={selectedOptions.includes(item.key)}
                    onChange={(e) => onSelect(e)}
                    />
                  )
                })
              }
          </div>
        }
      </div>
    </DropdownWrapper>
  )
}