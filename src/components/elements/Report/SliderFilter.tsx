import React, { useState } from "react";
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import { Dropdown } from "react-bootstrap";

interface SliderFilterProps {
  name: string
  value?: number | Array<number>
  min?: number
  max?: number
  handleChange?: (filterLowerBoundName: string, filterUpperBoundName: string, valueLower: number, valueUpper: number) => void
  getAriaValueText?: (text: number) => string
  filterLowerName: string
  filterUpperName: string
  values: Array<number>
}
export const SliderFilter: React.FC<SliderFilterProps> = ({ name, max, min, getAriaValueText, handleChange, filterLowerName, filterUpperName, values }) => {

  const onSliderUpdate = (event, newValue) => {
    handleChange(filterLowerName, filterUpperName, newValue[0], newValue[1]);
  }

  return (
    <Dropdown className="d-inline-block">
      <Dropdown.Toggle variant={values.some(value => value === undefined) ? "white" : "primary"} id="dropdown-basic">
        {name}
      </Dropdown.Toggle>

      <Dropdown.Menu className="px-4">
        <Box sx={{ width: 250 }}>
          <Slider
            value={values.some(value => value === undefined) ? [min, max] : values}
            min={min}
            step={1}
            max={max}
            onChange={onSliderUpdate}
            aria-labelledby="non-linear-slider"
            disableSwap
          />
          <div id="input-slider" className="slider-label d-flex justify-content-between">
            <span>{values[0] ? values[0] : min}</span>
            <span>{values[1] ? values[1] : max}</span>
          </div>
        </Box>
      </Dropdown.Menu>
    </Dropdown>
  )
}