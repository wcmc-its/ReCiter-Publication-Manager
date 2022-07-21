import React, { useState, MouseEvent } from "react";
import { Row, Col, Button } from "react-bootstrap";
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled } from '@mui/material/styles';
import { ListItem } from "../../../../types/listItem";
import SplitDropdown from "../Dropdown/SplitDropdown";
import { useRouter } from 'next/router';
import { useDispatch } from "react-redux";
import { updatePubFiltersFromSearch } from "../../../redux/actions/actions";

const dropdownItems: Array<ListItem> = 
 [
    { title: 'Create Reports', to: '/create-reports'},
    { title: 'Perform Analysis', to: '/perform-analysis'},
 ]


const FilterReview = ({
  onToggle,
  count,
  filterByPending,
  onCurate,
} : {
  onToggle: (value: boolean) => void;
  count: number,
  filterByPending: boolean,
  onCurate: any,
}) => {
  const [filter, setFilter] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();

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

  const onDropDownClick = ()=>{
    onCurate();
  }

  const onClickCurateReports = () => {
    // update redux state
    dispatch(updatePubFiltersFromSearch());
    // navigate to create reports page
    router.push('/report');
  }

  // console.log("curateData is", curateData)

  return (
    <Row className="pb-2 pt-2">
      <Col className="d-flex my-auto"><h4><strong>{`${count}`} people found using filters</strong></h4></Col>
      <Col className="d-flex flex-row">
        <SplitDropdown
          title="Curate Publications"
          to='/curate'
          id="publications"
          listItems={dropdownItems}
          disabled={count === 0}
          onDropDownClick={onDropDownClick}
          />
          <div className="mt-2 mx-2">
            <Button className="primary" onClick={onClickCurateReports}>Create Reports</Button>
          </div>
      </Col>
      <Col className="d-flex flex-row">
      <div>Show only people with <br /> pending suggestions</div>
      <StyledToggleButtonGroup
        color="primary"
        value={filterByPending}
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
