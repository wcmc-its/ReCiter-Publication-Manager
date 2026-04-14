import React, { useState, useEffect, useRef } from "react";
import { Button, Form, Row, Col, Container , Dropdown, InputGroup } from "react-bootstrap";
import { orgUnitsFetchAllData, institutionsFetchAllData, personTypesFetchAllData } from '../../../redux/actions/actions';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import styles from './Search.module.css'
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';
import { Identity } from "../../../../types/identity";

const SearchBar = ({ 
  searchData,
  resetData,
  findPeopleLabels
} : { 
  searchData: (
    searchQuery: string, 
    orgUnitQuery: Array<string>, 
    insitutionQuery: Array<string>,
    personTypeQuery: Array<string>,
  ) => void;
  resetData: () => void, findPeopleLabels :any}) => {

  const filters = useSelector((state: RootStateOrAny) => state.filters)

  const [searchQuery, setSearchQuery] = useState(filters.nameOrUids ? filters.nameOrUids.join(" ") : '');
  const [orgUnitQuery, setOrgUnitQuery] = useState<Array<string>>(filters.orgUnits ? filters.orgUnits : []);
  const [insitutionQuery, setInstitutionQuery] = useState<Array<string>>(filters.institutions ? filters.institutions : []);
  const [personTypeQuery, setPersonTypeQuery] = useState<Array<string>>(filters.personTypes ? filters.personTypes : []);

  const [allLabelSettings, setAllLabelSettings] = useState<any>()

  const dispatch = useDispatch()

  const orgUnitsData = useSelector((state: RootStateOrAny) => state.orgUnitsData)
  const institutionsData = useSelector((state: RootStateOrAny) => state.institutionsData)
  const personTypesData = useSelector((state: RootStateOrAny) => state.personTypesData)

  useEffect(() => {
    clearFilters();
    if(institutionsData && institutionsData.length == 0)
      dispatch(institutionsFetchAllData())
    if(orgUnitsData && orgUnitsData.length == 0)
      dispatch(orgUnitsFetchAllData())
    if(personTypesData && personTypesData.length == 0)
      dispatch(personTypesFetchAllData())
},[])

useEffect(() => { 
  if(findPeopleLabels.length > 0){
  let cwidLabel = findPeopleLabels.find(data => data.labelUserKey === "personIdentifier")
  let orgLabel = findPeopleLabels.find(data => data.labelUserKey === "organization")
  let instituteLabel = findPeopleLabels.find(data => data.labelUserKey === "institution")
  let personTypeLabel = findPeopleLabels.find(data => data.labelUserKey === "personType")
  let labelsPrepared = {
    cwidLabel : cwidLabel?.labelUserView,
    orgLabel:  orgLabel?.labelUserView,
    instituteLabel: instituteLabel?.labelUserView,
    personTypeLabel : personTypeLabel?.labelUserView
  }
  setAllLabelSettings(labelsPrepared)
}
},[findPeopleLabels])

  const clearFilters = () => {
    setSearchQuery('');
    setOrgUnitQuery([]);
    setInstitutionQuery([]);
    setPersonTypeQuery([]);
    resetData();
  }


  const CssTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ced4da',
      padding: '.375rem .75rem',
      '& fieldset': {
        top: '0px',
        '& legend': {
          display: 'none'
        }
      },
      '&:hover fieldset': {
        borderColor: '#ced4da',
      },
    },
  });

  const onFormSubmit = (e)=>{
    e.preventDefault();
    searchData(searchQuery, orgUnitQuery, insitutionQuery, personTypeQuery)
  }


  return (
    <Container className={styles.searchFormContainer}>
      <Form onSubmit={onFormSubmit}>
        <Form.Group>
          {/* <Form.Label className={styles.searchFormLabel}>Name or {allLabelSettings?.cwidLabel}(s)</Form.Label> */}
          <Form.Label className={styles.searchFormLabel}> {allLabelSettings?.cwidLabel ? `Name or ${allLabelSettings?.cwidLabel}(s)` : `Name` }</Form.Label>
          <InputGroup>
            <Form.Control type="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}></Form.Control>
          </InputGroup>
          <Row className="mt-3 mb-3"> 
            <Col md={4}>
              <Form.Label className={styles.searchFormLabel}>{allLabelSettings?.orgLabel || "Organizational unit(s)" }</Form.Label>
              <Autocomplete
                freeSolo
                multiple
                id="organizational units"
                disableClearable
                value={orgUnitQuery}
                options={orgUnitsData.map((option: Identity) => option.primaryOrganizationalUnit)}
                onChange={(event, value) => setOrgUnitQuery(value as string[])}
                renderInput={(params) => (
                  <CssTextField
                    variant = "outlined"
                    {...params}
                    InputProps={{
                      ...params.InputProps,
                      type: 'search',
                    }}
                  />
                )}
              />
            </Col>
            <Col md={4}><Form.Label className={styles.searchFormLabel}>{allLabelSettings?.instituteLabel || "Institution(s)" }</Form.Label>
              <Autocomplete
                  freeSolo
                  multiple
                  id="institutions"
                  disableClearable
                  value={insitutionQuery}
                  options={institutionsData.map((option: Identity) => option.primaryInstitution)}
                  onChange={(event, value) => setInstitutionQuery(value as string[])}
                  renderInput={(params) => (
                    <CssTextField
                      variant = "outlined"
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        type: 'search',
                      }}
                    />
                  )}
                />
            </Col>
            <Col md={4}><Form.Label className={styles.searchFormLabel}>{allLabelSettings?.personTypeLabel || "Person Type(s)" } </Form.Label>
              <Autocomplete
                  freeSolo
                  multiple
                  id="person-types"
                  disableClearable
                  value={personTypeQuery}
                  options={personTypesData.map((option: any) => option.personType)}
                  onChange={(event, value) => setPersonTypeQuery(value as string[])}
                  renderInput={(params) => (
                    <CssTextField
                      variant = "outlined"
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        type: 'search',
                      }}
                    />
                  )}
                />
            </Col>
          </Row>
          <div className="d-flex flex-row align-items-center">
            <Col sm={2}>
              <Button className="primary w-100" type="submit">Search</Button>
            </Col>
            <div className={`m-3 ${styles.textButton}`} onClick={clearFilters}>Reset</div>
          </div>
        </Form.Group>
      </Form>
    </Container>
  )
}

export default SearchBar;
