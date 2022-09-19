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
import { useSession } from "next-auth/client";
import { allowedPermissions, dropdownItemsReport } from "../../../utils/constants";
import styles from './Search.module.css'



const FilterReview = ({
  onToggle,
  count,
  filterByPending,
  onCurate,
  isUserRole,
} : {
  onToggle: (value: boolean) => void;
  count: number,
  filterByPending: boolean,
  onCurate: any,
  isUserRole : any
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
    dispatch(updatePubFiltersFromSearch());
    onCurate();
  }

  const onClickCurateReports = () => {
    // update redux state
    dispatch(updatePubFiltersFromSearch());
    // navigate to create reports page
    router.push('/report');
  }

  const dropdownItems: Array<ListItem> = 
 [
    { title: 'Create Reports', onClick: onClickCurateReports},
    // { title: 'Perform Analysis', to: '/perform-analysis'},
 ]

  return (
    <Row className="pb-2 pt-2">
      <Col className="d-flex my-auto"><h4><strong>{`${count}`} people found using filters</strong></h4></Col>
      <Col>
      {
      isUserRole === allowedPermissions.Superuser ? 
        <SplitDropdown
          title= { isUserRole && isUserRole === allowedPermissions.Reporter_All ? "Create Report" : "Curate Publications" }
          to='/curate'
          id="publications"
          listItems={isUserRole && isUserRole === allowedPermissions.Superuser? dropdownItems : dropdownItemsReport}
          disabled={count === 0}
          isUserRole={isUserRole}
          onDropDownClick={ isUserRole && isUserRole === allowedPermissions.Reporter_All ? onClickCurateReports : onDropDownClick}
          />
          : 
          <Button className="secondary" variant="primary" onClick={isUserRole && isUserRole === allowedPermissions.Reporter_All ? onClickCurateReports : onDropDownClick }>{isUserRole === allowedPermissions.Reporter_All ? "Create Report" : "Curate Publications"}</Button>
      }
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
