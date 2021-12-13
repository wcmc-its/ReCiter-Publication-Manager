import React, { useState, MouseEvent } from "react";
import { Row, Col } from "react-bootstrap";
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled } from '@mui/material/styles';
import { ListItem } from "../../../../types/listItem";
import SplitDropdown from "../Dropdown/SplitDropdown";

const dropdownItems: Array<ListItem> = 
 [
    { title: 'Create Reports', to: '/create-reports'},
    { title: 'Perform Analysis', to: '/perform-analysis'},
 ]


const FilterReview = ({
  onToggle,
  count,
} : {
  onToggle: (value: boolean) => void;
  count: number,
}) => {
  const [filter, setFilter] = useState(false);

  const handleChange = ( event: MouseEvent<HTMLElement, globalThis.MouseEvent>, value: any) => {
    setFilter(value);
    onToggle(value);
  }

  const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    marginLeft: '20px',
    marginRight: '20px',
    maxHeight: '40px',
    '& .MuiToggleButtonGroup-grouped': {
      textTransform: 'none',
    },
    '& .MuiToggleButton-root.MuiButtonBase-root.Mui-selected': {
      color: '#fff',

      backgroundColor: '#337ab7',
      '&:hover': {
        backgroundColor: '#549ad8',
      }
    }
  }));

  return (
    <Row className="pb-2 pt-2">
      <Col><h2>{`${count}`} people found using filters</h2></Col>
      <Col>
        <SplitDropdown
          title="Curate Publications"
          to='/publications'
          id="publications"
          listItems={dropdownItems}
          />
      </Col>
      <Col className="d-flex flex-row">
      <div>Show only people with <br /> pending suggestions</div>
      <StyledToggleButtonGroup
        color="primary"
        value={filter}
        exclusive
        onChange={handleChange}
      >
        <ToggleButton value={false}>No</ToggleButton>
        <ToggleButton value={true}>Yes</ToggleButton>
      </StyledToggleButtonGroup>
      </Col>
    </Row>
  )
}

export default FilterReview;
