import React, { useState } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form } from "react-bootstrap";

export const CheckList = ({ title, options, onUpdateFilter, filterName }) => {
  const [selected, setSelected] = useState<Array<string>>([]);

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
                onChange={(e) => onSelect(e)}
                />
            )
          })
        }
      </div>
    </DropdownWrapper>
  )
}