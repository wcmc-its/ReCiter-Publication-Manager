import React, { useEffect, useState } from "react";
import styles from './CuratePublications.module.css';
import appStyles from '../App/App.module.css';
import FilterSection from "../Filter/FilterSection";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import  PublicationsPane from "../Publication/PublicationsPane";
import { publicationsFetchGroupData, fetchGroupFeedbacklog } from '../../../redux/actions/actions';
import Loader from "../Common/Loader";
import { Button, Spinner } from "react-bootstrap";
import fullName  from "../../../utils/fullName";

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
  const dispatch = useDispatch()
  const filters = useSelector((state: RootStateOrAny) => state.filters)
  const filteredIds = useSelector((state: RootStateOrAny) => state.identityAllData.map((identity) => identity.personIdentifier))

  const filteredIdentities = useSelector((state: RootStateOrAny) => state.identityAllData.reduce((acc, identity) => {return {...acc, [identity.personIdentifier] : { title: identity.title, fullName: fullName(identity)} }}, {}))

  let filterSectionList: Array<DropdownProps> = [];
  const publicationsGroupDataFetching = useSelector((state: RootStateOrAny) => state.publicationsGroupDataFetching)
  const publicationsMoreDataFetching = useSelector((state: RootStateOrAny) => state.publicationsMoreDataFetching)
  const publicationsGroupData = useSelector((state: RootStateOrAny) => state.publicationsGroupData)
  const feedbacklogGroup = useSelector((state: RootStateOrAny) => state.feedbacklogGroup)
  const feedbacklogGroupFetching = useSelector((state: RootStateOrAny) => state.feedbacklogGroupFetching)
  const [loadCount, setLoadCount] = useState(20);
  const defaultCount = 20;

  useEffect(() => {
    dispatch(publicationsFetchGroupData(filteredIds.slice(0, defaultCount), true));
    dispatch(fetchGroupFeedbacklog(filteredIds.slice(0, defaultCount)));
  }, [])


  filtersList.forEach( filter => {
    if (Object.keys(filters).length > 0 && filters.hasOwnProperty(filter.value)) {
      if (filter.value === 'searchText') {
        let searchWords = filters[filter.value].split(' ');
        let dropdownItem = { title: filter.title, children: searchWords}
        filterSectionList.push(dropdownItem)
      } else {
        let dropdownItem = { title: filter.title, children: filters[filter.value]}
        filterSectionList.push(dropdownItem)
      }
    } else {
      filterSectionList.push({ title: filter.title})
    }
  })

  const fetchPublications = () => {
    let updatedCount = loadCount + defaultCount;
    dispatch(publicationsFetchGroupData(filteredIds.slice(loadCount, updatedCount), false));
    setLoadCount(updatedCount);
  }
 
  const PublicationsList = () => {
    return(
      <>
      {publicationsGroupData && publicationsGroupData.reciter?.map((reciterItem: any, index: number) => {
        return (
          <PublicationsPane 
            key={index}
            index={index}
            item={reciterItem}
            feedbacklogGroup={feedbacklogGroup}
            filteredIdentities={filteredIdentities}
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
      { (publicationsGroupDataFetching ||  feedbacklogGroupFetching) ? <Loader /> : 
        <>
          {publicationsGroupData.reciter  && <h2 className={styles.sectionHeader}>{`${publicationsGroupData.reciter.length} people with pending publications`}</h2>}
          <div className={styles.publicationsContainer}>
            {
              <PublicationsList />
            }
          </div>
          { filteredIds.length > loadCount &&
            <div className="d-flex align-items-center p-3 justify-content-center">
              <Button className="primary" onClick={fetchPublications} disabled={publicationsMoreDataFetching}>
                {
                  publicationsMoreDataFetching ? 
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />
                    {' '} Loading...
                  </>
                  : <>View More</>
                }
              </Button>
            </div>
          }
        </>
      }
    </div>
  )
}

export default CuratePublications;
