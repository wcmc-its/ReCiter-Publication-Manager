import React, { useState, MouseEvent } from "react";
import { Row, Col, Button } from "react-bootstrap";
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled } from '@mui/material/styles';
import SplitDropdown from "../Dropdown/SplitDropdown";
import { useRouter } from 'next/router';
import { useDispatch } from "react-redux";
import { updatePubFiltersFromSearch } from "../../../redux/actions/actions";
import { useSession } from "next-auth/client";
import { getPermissionsFromRaw, hasPermission } from '../../../utils/permissionUtils';
import styles from './Search.module.css'



const FilterReview = ({
  showPendingToggle,
  onToggle,
  count,
  filterByPending,
  onCurate,
} : {
  showPendingToggle : boolean
  onToggle: (value: boolean) => void;
  count: number,
  filterByPending: boolean,
  onCurate: any,
}) => {
  const [filter, setFilter] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const [session, loading] = useSession();

  const permissions = getPermissionsFromRaw((session as any)?.data?.permissions)
  const canCurate = hasPermission(permissions, 'canCurate')
  const canReport = hasPermission(permissions, 'canReport')

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

  const onClickCreateReports = () => {
    // update redux state
    dispatch(updatePubFiltersFromSearch());
    // navigate to create reports page
    router.push('/report');
  }

 const RoleSplitDropdown = () => {
    if (canCurate && canReport) {
      return (
        <SplitDropdown
          title={"Curate Publications"}
          onDropDownClick={() => onDropDownClick()}
          id="publications"
          listItems={[{ title: 'Create Reports', onClick: onClickCreateReports }]}
          secondary={true}
          onClick={() => onClickCreateReports()}
        />
      )
    }
    if (canCurate) {
      return <Button className="secondary" variant="secondary" onClick={() => onDropDownClick()}>{"Curate Publications"}</Button>
    }
    if (canReport) {
      return <Button className="secondary" variant="secondary" onClick={() => onClickCreateReports()}>{"Create Report"}</Button>
    }
    return null
  }

  return (
    <Row className="pb-2 pt-2">
      <Col className="d-flex my-auto"><h4><strong>{`${count}`} people found using filters</strong></h4></Col>
      <Col>
      {
        <RoleSplitDropdown></RoleSplitDropdown>

      }
      </Col>
      {showPendingToggle ?
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
      </Col> : ""}
    </Row>
  )
}




export default FilterReview;
