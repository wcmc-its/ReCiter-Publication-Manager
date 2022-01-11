import React, { useEffect, useState } from "react";
import styles from './CuratePublications.module.css';
import appStyles from '../App/App.module.css';
import FilterSection from "../Filter/FilterSection";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import  Publication from "../Publication/Publication";
import Pagination  from '../Pagination/Pagination';
import { publicationsFetchGroupData } from '../../../redux/actions/actions';
import Loader from "../Common/Loader";

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
  const dispatch = useDispatch()
  const filters = useSelector((state: RootStateOrAny) => state.filters)
  const filteredIds = useSelector((state: RootStateOrAny) => state.filteredIds)
  let filterSectionList: Array<DropdownProps> = [];
  const publicationsGroupDataFetching = useSelector((state: RootStateOrAny) => state.publicationsGroupDataFetching)
  const publicationsGroupData = useSelector((state: RootStateOrAny) => state.publicationsGroupData)

  useEffect(() => {
    dispatch(publicationsFetchGroupData(filteredIds))
  }, [])


  filtersList.forEach( filter => {
    if (Object.keys(filters).length > 0 && filters.hasOwnProperty(filter.value)) {
      let dropdownItem = { title: filter.title, children: filters[filter.value]}
      filterSectionList.push(dropdownItem)
    } else {
      filterSectionList.push({ title: filter.title})
    }
  })

  const handlePaginationUpdate = (eventKey, page, updateCount) => {
    let updatedCount = count
    setPage(page)

    if (updateCount) {
      setCount(eventKey)
      updatedCount = eventKey
    }
  }
 
  const PublicationsList = () => {
    let from = (page - 1) * count;
    let to = from + count;
    let dataList = [];
    if (publicationsGroupData.reciter && publicationsGroupData.reciter.length > 0) {
      dataList = publicationsGroupData.reciter.slice(from, to);
    }
    return(
      <>
      {dataList.map((reciterItem: any) => {
        return (
          <Publication 
            item={reciterItem}
            />
        )
      })}
    </>
    )
  }

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.header}>Curate Publications</h1>
      <FilterSection 
        list={filterSectionList}
        buttonTitle="Update Search"
        buttonUrl="/search"
        ></FilterSection>
      { publicationsGroupDataFetching ? <Loader /> : 
        <>
          {publicationsGroupData.reciter  && <h2 className={styles.sectionHeader}>{`${publicationsGroupData.reciter.length} people with pending publications`}</h2>}
          <Pagination total={publicationsGroupData.reciter ? publicationsGroupData.reciter.length : 0} page={page}
            count={count}
            onChange={handlePaginationUpdate}/>
          <div className={styles.publicationsContainer}>
            {
              <PublicationsList />
            }
          </div>
          <Pagination total={publicationsGroupData.reciter ? publicationsGroupData.reciter.length : 0} page={page}
            count={count}
            onChange={handlePaginationUpdate}/>
        </>
      }
    </div>
  )
}

export default CuratePublications;
