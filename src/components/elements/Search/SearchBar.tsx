import React, { useState, useEffect } from "react";
import { Button, Input } from "../../ui";
import { orgUnitsFetchAllData, institutionsFetchAllData, personTypesFetchAllData } from '../../../redux/actions/actions';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import styles from './Search.module.css'
import { CheckboxSelect } from "../Report/CheckboxSelect";
import { Identity } from "../../../../types/identity";

const SearchBar = ({
  searchData,
  resetData,
  findPeopleLabels,
  toggles,
} : {
  searchData: (
    searchQuery: string,
    orgUnitQuery: Array<string>,
    insitutionQuery: Array<string>,
    personTypeQuery: Array<string>,
  ) => void;
  resetData: () => void;
  findPeopleLabels: any;
  // Switches that act at once (Pending only, the scope checkbox), placed inside the card.
  toggles?: React.ReactNode;
}) => {

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


  // The identifier label is admin-configurable (findPeople "personIdentifier", "CWID" by default).
  const idLabel = allLabelSettings?.cwidLabel || 'CWID';

  return (
    <form className={styles.filterCard} onSubmit={onFormSubmit} role="search" aria-label="Find people">
      <div className={styles.queryField}>
        <Input
          id="people-search-query"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Name or ${idLabel} (comma-separate several ${idLabel}s)`}
          inputProps={{ 'aria-label': `Name or ${idLabel}` }}
        />
      </div>
      <div className={styles.filterPills}>
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
      {toggles}
      <div className={styles.filterActions}>
        <Button variant="primary" type="submit">Search</Button>
        <Button variant="ghost" onClick={clearFilters}>Reset</Button>
      </div>
    </form>
  )
}

export default SearchBar;
