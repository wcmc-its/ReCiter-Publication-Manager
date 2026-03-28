import React from "react";
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import { Dropdown } from "react-bootstrap";
import { styled } from '@mui/material/styles';
import { setReportFilterLabels } from "../../../utils/constants";

const DarkSlider = styled(Slider)({
  color: '#1a2133',
  height: 4,
  '& .MuiSlider-thumb': {
    width: 16,
    height: 16,
    backgroundColor: '#1a2133',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    '&:hover, &.Mui-active': {
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    },
  },
  '& .MuiSlider-track': {
    backgroundColor: '#1a2133',
    border: 'none',
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#ddd7ce',
  },
});

interface SliderFilterProps {
  reportFiltersLabes?: any
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

export const SliderFilter: React.FC<SliderFilterProps> = ({ reportFiltersLabes, name, max, min, handleChange, filterLowerName, filterUpperName, values }) => {

  const onSliderUpdate = (event: any, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      handleChange(filterLowerName, filterUpperName, newValue[0], newValue[1]);
    }
  }

  const currentValues = values.some(value => value === undefined) ? [min, max] : values;

  return (
    <Dropdown className="d-inline-block">
      <Dropdown.Toggle variant={values.some(value => value === undefined) ? "white" : "primary"} id="dropdown-basic">
        {setReportFilterLabels(reportFiltersLabes, name)}
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ padding: '18px 16px 14px', minWidth: 280 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#8a94a6', marginBottom: 14 }}>
          {setReportFilterLabels(reportFiltersLabes, name)}
        </div>
        <Box sx={{ width: '100%', px: 1 }}>
          <DarkSlider
            value={currentValues}
            min={min}
            step={1}
            max={max}
            onChange={onSliderUpdate}
            aria-labelledby="range-slider"
            disableSwap
          />
        </Box>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#8a94a6', marginBottom: 4 }}>Min</div>
            <input
              type="text"
              readOnly
              value={currentValues[0] ?? min}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid #ddd7ce', borderRadius: 5,
                fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: '#eeeae4', color: '#1a2133',
                outline: 'none', textAlign: 'center'
              }}
            />
          </div>
          <span style={{ color: '#8a94a6', fontSize: 12, marginTop: 16 }}>–</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#8a94a6', marginBottom: 4 }}>Max</div>
            <input
              type="text"
              readOnly
              value={currentValues[1] ?? max}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid #ddd7ce', borderRadius: 5,
                fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: '#eeeae4', color: '#1a2133',
                outline: 'none', textAlign: 'center'
              }}
            />
          </div>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  )
}
