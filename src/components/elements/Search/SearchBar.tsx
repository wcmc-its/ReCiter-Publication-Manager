import React, { useState, useEffect } from "react";
import { Button, Form, Container, InputGroup } from "react-bootstrap";
import { orgUnitsFetchAllData, institutionsFetchAllData, personTypesFetchAllData } from '../../../redux/actions/actions';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import styles from './Search.module.css'
import { CheckboxSelect } from "../Report/CheckboxSelect";
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
  const [filterClearCount, setFilterClearCount] = useState(0);

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
    setFilterClearCount(c => c + 1);
    resetData();
  }

  const handleFilterUpdate = (filterName: string, values: string[]) => {
    if (filterName === 'orgUnits') setOrgUnitQuery(values);
    else if (filterName === 'institutions') setInstitutionQuery(values);
    else if (filterName === 'personTypes') setPersonTypeQuery(values);
  }

  const onFormSubmit = (e)=>{
    e.preventDefault();
    searchData(searchQuery, orgUnitQuery, insitutionQuery, personTypeQuery)
  }


  return (
    <Container className={styles.searchFormContainer}>
      <Form onSubmit={onFormSubmit}>
        <Form.Group style={{ marginBottom: 0 }}>
          <Form.Label className={styles.searchFormLabel}> {allLabelSettings?.cwidLabel ? `Name or ${allLabelSettings?.cwidLabel}(s)` : `Name` }</Form.Label>
          <InputGroup>
            <Form.Control type="input" placeholder="Search by name or CWID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}></Form.Control>
          </InputGroup>
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div className={styles.filterRowLabel}>Filters</div>
            <div className={styles.filterRow}>
              <CheckboxSelect
                reportFiltersLabes={findPeopleLabels}
                title="organization"
                options={orgUnitsData}
                optionLabel="primaryOrganizationalUnit"
                optionValue="primaryOrganizationalUnit"
                filterName="orgUnits"
                onUpdateFilter={handleFilterUpdate}
                selectedOptions={orgUnitQuery}
                isFilterClear={filterClearCount}
                isDynamicFetch={false}
                onLoadMore={() => {}}
                value=""
              />
              <CheckboxSelect
                reportFiltersLabes={findPeopleLabels}
                title="institution"
                options={institutionsData}
                optionLabel="primaryInstitution"
                optionValue="primaryInstitution"
                filterName="institutions"
                onUpdateFilter={handleFilterUpdate}
                selectedOptions={insitutionQuery}
                isFilterClear={filterClearCount}
                isDynamicFetch={false}
                onLoadMore={() => {}}
                value=""
              />
              <CheckboxSelect
                reportFiltersLabes={findPeopleLabels}
                title="personType"
                options={personTypesData}
                optionLabel="personType"
                optionValue="personType"
                filterName="personTypes"
                onUpdateFilter={handleFilterUpdate}
                selectedOptions={personTypeQuery}
                isFilterClear={filterClearCount}
                isDynamicFetch={false}
                onLoadMore={() => {}}
                value=""
              />
            </div>
          </div>
          <div className="d-flex flex-row align-items-center" style={{ gap: '10px' }}>
            <Button className="primary" type="submit" style={{ padding: '8px 24px', background: '#c0392b', borderColor: '#c0392b', borderRadius: '5px', fontSize: '13px', fontWeight: 600, fontFamily: '"DM Sans", sans-serif' }}>Search</Button>
            <button type="button" className={styles.textButton} onClick={clearFilters} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>Reset</button>
          </div>
        </Form.Group>
      </Form>
    </Container>
  )
}

export default SearchBar;
