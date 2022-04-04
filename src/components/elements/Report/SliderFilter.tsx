import React from "react";
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';

interface SliderFilterProps {
  value: number | Array<number>
  min?: number
  max?: number
  handleChange: () => void
  getAriaValueText?: (text: number) => string
}
export const SliderFilter: React.FC<SliderFilterProps> = ({ value, getAriaValueText, handleChange }) => {
  return (
    <Box sx={{ width: 250 }}>
      <Slider
        value={value}
        min={5}
        step={1}
        max={30}
        onChange={handleChange}
        aria-labelledby="non-linear-slider"
        disableSwap
      />
      <div id="input-slider" className="slider-label d-flex justify-content-between">
        <span>{value[0]}</span>
        <span>{value[1]}</span>
      </div>
    </Box>
  )
}