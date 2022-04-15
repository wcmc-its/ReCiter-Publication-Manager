import React, { useState } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form, InputGroup, FormControl, Button } from "react-bootstrap";
import { AiOutlineSearch } from "react-icons/ai";
import styles from "./ChecboxSelect.module.css";

export const CheckboxSelect: React.FC<any> = ({ title, value, options, formatOptionTitle, optionLabel, filterUpdateOptions, isDynamicFetch, optionValue, filterName, onUpdateFilter, selectedOptions }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [selected, setSelected] = useState<Array<string>>([]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newInput = e.target.value;
    setUserInput(newInput);
  }

  const filteredOptions = (options, isDynamicFetch) => {
    if (isDynamicFetch) {
      filterUpdateOptions[value](userInput);
    } else if (userInput != '') {
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
      updatedSelected = [...selected, value]
    } else {
      updatedSelected = selected.filter(option => option != value)
    }
    
    onUpdateFilter(filterName, updatedSelected);
    setSelected(updatedSelected);
  }

  return (
    <DropdownWrapper title={title}>
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
    </DropdownWrapper>
  )
}
