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
      </div>
      <Pagination total={filteredIds.length} page={page}
        count={count}
        onChange={handlePaginationUpdate}/>
    </div>
  )
}

export default CuratePublications;
