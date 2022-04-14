import React, { useState } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form, InputGroup, FormControl, Button } from "react-bootstrap";
import { AiOutlineSearch } from "react-icons/ai";
import styles from "./ChecboxSelect.module.css";

export const CheckboxSelect: React.FC<any> = ({ title, value, options, formatOptionTitle, optionLabel, filterUpdateOptions, isDynamicFetch }) => {
  const [userInput, setUserInput] = useState<string>('');

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
                />
            )
          })
        }
      </div>
    </DropdownWrapper>
  )
}
