import React, { useState } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form } from "react-bootstrap";

export const CheckList = ({ title, options, onUpdateFilter, filterName, selectedOptions }) => {

  const onSelect = (event) => {
    let value = event.target.value;
    let checked = event.target.checked;
    let updatedSelected = [];

    if (checked) {
      updatedSelected = [...selectedOptions, value]
    } else {
      updatedSelected = selectedOptions.filter(option => option != value)
    }

    onUpdateFilter(filterName, updatedSelected);
  }

  return (
    <DropdownWrapper title={title} variant={ selectedOptions.length > 0 ? "primary" : "white"}>
      <div>
        {
          options.map((option) => {
            return (
              <Form.Check
                type="checkbox"
                id={option.key}
                key={option.key}
                label={option.label}
                value={option.label}
                checked={selectedOptions.includes(option.label)}
                onChange={(e) => onSelect(e)}
                />
            )
          })
        }
      </div>
    </DropdownWrapper>
  )
}