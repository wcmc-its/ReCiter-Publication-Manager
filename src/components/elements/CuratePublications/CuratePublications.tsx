import React, { useState } from "react";
import styles from './CuratePublications.module.css';
import appStyles from '../App/App.module.css';
import FilterSection from "../Filter/FilterSection";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import  Publication from "../Publication/Publication";
import Pagination  from '../Pagination/Pagination';

interface DropdownProps {
  title: string,
  children?: Array<string>,
}

const filtersList = [
  { title: 'People', value: 'searchText'},
  { title: 'Organization', value: 'orgUnits'},
  { title: 'Institution', value: 'institutions'},
  { title: 'Person Type', value: 'personTypes'}
]

///TEMP
const faculty = {
  firstName: 'Rainu',
  lastName: 'Kaishal',
  title: 'Chairman of Healthcare Policy and Research',
}

const item = {
  evidence: [
    {label: 'evidence label', institutionalData: 'instittutional data', articleData: 'article data'}
  ],
  standardScore: 10,
  authors: [
    {authorName: 'Evan T Shole 1'},
    {authorName: 'Evan T Shole 2'},
    {authorName: 'Evan T Shole 3'},
    {authorName: 'Evan T Shole 4'},
    {authorName: 'Evan T Shole 5'},
    {authorName: 'Evan T Shole 6'},
    {authorName: 'Evan T Shole 7'},
    {authorName: 'Evan T Shole 8'},
  ],
  title: 'A Method to Improve Availability and Quality of Patient Race',
  journal: 'Applied Clinical Informatics',
  displayDate: '2020 Nov 25',
  pmid: 2342342,
  userAssertion: "NULL",
}

const CuratePublications = () => {
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(20)
  const filters = useSelector((state: RootStateOrAny) => state.filters)
  const filteredIds = useSelector((state: RootStateOrAny) => state.filteredIds)
  let filterSectionList: Array<DropdownProps> = [];


  filtersList.forEach( filter => {
    if (Object.keys(filters).length > 0 && filters.hasOwnProperty(filter.value)) {
      let dropdownItem = { title: filter.title, children: filters[filter.value]}
      filterSectionList.push(dropdownItem)
    } else {
      filterSectionList.push({ title: filter.title})
    }
  })

  const handlePaginationUpdate = () => {
    console.log('update');
  }

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.header}>Curate Publications</h1>
      <FilterSection 
        list={filterSectionList}
        buttonTitle="Update Search"
        buttonUrl="/search"
        ></FilterSection>
      <h2>{`${filteredIds.length} people with pending publications`}</h2>
      <Pagination total={filteredIds.length} page={page}
        count={count}
        onChange={handlePaginationUpdate}/>
      <div className={styles.publicationsContainer}>
        <Publication
          faculty={faculty}
          item={item}
          ></Publication>
      </div>
      <Pagination total={filteredIds.length} page={page}
        count={count}
        onChange={handlePaginationUpdate}/>
    </div>
  )
}

export default CuratePublications;
