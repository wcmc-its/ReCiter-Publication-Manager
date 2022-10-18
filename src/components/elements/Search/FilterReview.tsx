import React, { useState, MouseEvent,useEffect } from "react";
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
} : {
  onToggle: (value: boolean) => void;
  count: number,
  filterByPending: boolean,
  onCurate: any,
}) => {
  const [filter, setFilter] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const [session, loading] = useSession();

  const[dropdownTitle, setDropdownTitle] = useState("");
  const[dropdownMenuItems, setDropdownMenuItems] = useState([]);
  const[isCuratorSelf ,setIsCuratorSelf] = useState(false);
  const[isCuratorAll ,setIsCuratorAll] = useState(false);
  const[isReporterAll ,setIsReporterAll] = useState(false);
  const[isSuperUser ,setIsSuperUser] = useState(false);
  const[loggedInPersonIdentifier, setLoggedInPersonIdentifier] = useState("paa2013");

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

  useEffect(() => {
    let userPermissions = JSON.parse(session.data.userRoles);
    console.log("userPermission***********************************",userPermissions);
    if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All)) {
      //setIsuserRole(allowedPermissions.Reporter_All)
        setDropdownTitle("Create Report");
        setDropdownMenuItems([]);
        setIsReporterAll(true);
       // setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All)) {
      //setIsuserRole(allowedPermissions.Curator_All);
        setDropdownTitle("Curate Publications");
        let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
        setDropdownMenuItems(dropDownMenuItems);
        setIsCuratorAll(true);
        //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser)) {
     // setIsuserRole(allowedPermissions.Superuser);
        setDropdownTitle("Curate Publications");
        let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
        setDropdownMenuItems(dropDownMenuItems);
        setIsSuperUser(true)
        //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
      //setIsuserRole(allowedPermissions.Curator_Self);
      setDropdownTitle("Curate Publications");
      setDropdownMenuItems([]);
      setIsCuratorSelf(true)
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser )) {
      //setIsuserRole(allowedPermissions.Curator_Self);
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true);
      setIsSuperUser(true);
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } 
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )) {
      //setIsuserRole(allowedPermissions.Curator_Self);
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true)
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } 
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser  )) {
      //setIsuserRole(allowedPermissions.Curator_Self);
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsReporterAll(true)  
      setIsCuratorAll(true);
      setIsSuperUser(true);
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }  
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )) {
      //setIsuserRole(allowedPermissions.Curator_Self);
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsReporterAll(true)  
      setIsCuratorAll(true);
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } 
     
    else { // when CWID has more than 1 role or multiple roles
      //setIsuserRole(allowedPermissions.Superuser);
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsSuperUser(true);
      //setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }

  
  },[]);
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

  const dropdownItems: Array<ListItem> = 
 [
    { title: 'Create Reports', onClick: onClickCreateReports},
    // { title: 'Perform Analysis', to: '/perform-analysis'},
 ]

 const RoleSplitDropdown = () => {

   if((isCuratorSelf && !isReporterAll && !isCuratorAll && !isSuperUser) || (isReporterAll && !isCuratorAll && !isSuperUser) || (isCuratorSelf && isReporterAll &&(!isSuperUser && !isCuratorAll) )) 
    {
      console.log("1");
        return <Button className="secondary" variant="secondary" onClick={() => onClickCreateReports()}>{"Create Report"}</Button>
    }
    else if(isCuratorAll && !isReporterAll && !isSuperUser) 
    {
      console.log("2")

        return <Button className="secondary" variant="secondary" onClick={() => onDropDownClick()}>{"Curate Publications"}</Button>
    }
    else if((isCuratorAll && isReporterAll) || isSuperUser)
    {
      console.log("3")

      return  <SplitDropdown
        title={"Curate Publications"}
        //{isUserRole && isUserRole === allowedPermissions.Reporter_All ? "Create Reports" : "Curate Publications"}
        // to={`/curate/${identity.personIdentifier}`}
        //onDropDownClick={isUserRole && isUserRole === allowedPermissions.Reporter_All ? () => redirectToCurate("report",identity.personIdentifier) : () => redirectToCurate("individual", identity.personIdentifier)}
        onDropDownClick={()=>onClickCreateReports()}
        id="publications"
        listItems={dropdownMenuItems} 
        secondary={true}
        onClick={() => onClickCreateReports()}/>
    }
    return null;
   
}

  return (
    <Row className="pb-2 pt-2">
      <Col className="d-flex my-auto"><h4><strong>{`${count}`} people found using filters</strong></h4></Col>
      <Col>
      {
        <RoleSplitDropdown></RoleSplitDropdown>

     /* isUserRole === allowedPermissions.Superuser ? 
        <SplitDropdown
          title= { isUserRole && isUserRole === allowedPermissions.Reporter_All ? "Create Report" : "Curate Publications" }
          to='/curate'
          id="publications"
          listItems={isUserRole && isUserRole === allowedPermissions.Superuser? dropdownItems : dropdownItemsReport}
          disabled={count === 0}
          isUserRole={isUserRole}
          onDropDownClick={ isUserRole && isUserRole === allowedPermissions.Reporter_All ? onClickCreateReports : onDropDownClick}
          />
          : 
          <Button className="secondary" variant="primary" onClick={isUserRole && isUserRole === allowedPermissions.Reporter_All ? onClickCreateReports : onDropDownClick }>{isUserRole === allowedPermissions.Reporter_All ? "Create Report" : "Curate Publications"}</Button>*/
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
