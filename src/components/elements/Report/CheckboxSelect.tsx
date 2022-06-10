import React, { useState, useEffect } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form, InputGroup, FormControl, Button } from "react-bootstrap";
import { AiOutlineSearch } from "react-icons/ai";
import styles from "./ChecboxSelect.module.css";

export const CheckboxSelect: React.FC<any> = ({ title, value, options, formatOptionTitle, optionLabel, filterUpdateOptions, isDynamicFetch, optionValue, filterName, onUpdateFilter, selectedOptions }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [selectedList, setSelectedList] = useState<any>([]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newInput = e.target.value;
    setUserInput(newInput);
  }

  // fetch data on input change
  useEffect(() => {
    if (isDynamicFetch) {
      filterUpdateOptions[value](userInput);
    }
  }, [userInput])

  const filteredOptions = (options, isDynamicFetch) => {
    if (userInput != '' && !isDynamicFetch) {
      let optionsList = options.filter(option => getLabel(option).includes(userInput));
      return optionsList;
    }

    return options;
  }

  const getLabel = (option) => {
    let label = formatOptionTitle ? formatOptionTitle(option) : optionLabel ? option[optionLabel] : option.label;
    return label;
  }

  const onSelect = (event) => {
    let value = event.target.value;
    let checked = event.target.checked;
    let updatedSelected = [];

    if (checked) {
      updatedSelected = [...selectedOptions, value]

      // find the option
      let optionObj = options.find(option => option[optionValue] == value);
      // add to the selected list state to display at the bottom of the options
      if (optionObj) {
        let updatedList = [...selectedList, optionObj];
        setSelectedList(updatedList);
      }
    } else {
      updatedSelected = selectedOptions.filter(option => option != value)

      // remove from the selected list state
      let updatedList = selectedList.filter(item => item[optionValue] != value);
      setSelectedList(updatedList);
    }
    
    onUpdateFilter(filterName, updatedSelected);
  }

  const onRemoveSelected = (event) => {
    // remove from the selected list
    let updatedList = selectedList.filter(item => item[optionValue] !== event.target.value)
    setSelectedList(updatedList);
  }

  return (
    <DropdownWrapper title={title} variant={ selectedOptions.length > 0 ? "primary" : "white"}>
      <div className={styles.dropdownContainer}>
      <InputGroup className="mb-3">         
       <FormControl
            className="border-right-0 border-top-right-radius-0 border-bottom-right-radius-0"
            placeholder="Search"
            aria-label={title}
            aria-describedby={title}
            value={userInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onInputChange(e)}
          />
            <div className="d-flex border-grey p-1 rounded-right align-items-center">
              <AiOutlineSearch style={{ marginTop: "-2px" }} />
            </div>
       </InputGroup>
       <div className={styles.selectListContainer}>
        {
          filteredOptions(options, isDynamicFetch).map((option) => {
            return (
              <Form.Check
                type="checkbox"
                id={option.key}
                key={option.key}
                label={getLabel(option)}
                value={option[optionValue]}
                checked={selectedOptions && selectedOptions.includes(option[optionValue]) }
                onChange={(e) => onSelect(e)}
                />
            )
          })
          }
       </div>
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
                      key={`${item.key}_${index}`}
                      label={getLabel(item)}
                      value={item[optionValue]}
                      checked={selectedOptions && selectedOptions.includes(item[optionValue]) }
                      onChange={(e) => onRemoveSelected(e)}
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
