import React from "react";
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import { Dropdown } from "react-bootstrap";

interface SliderFilterProps {
  name: string
  value?: number | Array<number>
  min?: number
  max?: number
  handleChange?: () => void
  getAriaValueText?: (text: number) => string
}
export const SliderFilter: React.FC<SliderFilterProps> = ({ name, max, min, value = [0, 10], getAriaValueText, handleChange }) => {
  return (
    <Dropdown className="d-inline-block">
      <Dropdown.Toggle variant="primary" id="dropdown-basic">
        {name}
      </Dropdown.Toggle>

      <Dropdown.Menu className="px-4">
        <Box sx={{ width: 250 }}>
          <Slider
            value={value}
            min={min}
            step={1}
            max={max}
            onChange={handleChange}
            aria-labelledby="non-linear-slider"
            disableSwap
          />
          <div id="input-slider" className="slider-label d-flex justify-content-between">
            <span>{value[0]}</span>
            <span>{value[1]}</span>
          </div>
        </Box>
      </Dropdown.Menu>
    </Dropdown>
  )
}