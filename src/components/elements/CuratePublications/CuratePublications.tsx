import React, { useEffect, useState } from "react";
import styles from './CuratePublications.module.css';
import appStyles from '../App/App.module.css';
import FilterSection from "../Filter/FilterSection";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import  PublicationsPane from "../Publication/PublicationsPane";
import { publicationsFetchGroupData, fetchGroupFeedbacklog } from '../../../redux/actions/actions';
import Loader from "../Common/Loader";
import { Button, Spinner } from "react-bootstrap";
import { reciterConfig } from "../../../../config/local";
import fullName  from "../../../utils/fullName";
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';


interface DropdownProps {
  title: string,
  children?: Array<string>,
}

const filtersList = [
  { title: 'People', value: 'nameOrUids'},
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
  const publicationsPreviousDataFetching = useSelector((state: RootStateOrAny) => state.publicationsPreviousDataFetching)
  const publicationsGroupDataIds = useSelector((state: RootStateOrAny) => state.publicationsGroupDataIds)
  const maxResults = reciterConfig.reciter.featureGeneratorByGroup.maxResultsOnGroupView;
  const incrementBy = reciterConfig.reciter.featureGeneratorByGroup.incrementResultsBy;
  const [loadCount, setLoadCount] = useState(incrementBy || 20);
  const [page, setPage] = useState<number>(1);
  const totalCount = useSelector((state: RootStateOrAny) => state.identityAllData.reduce((acc, identity) => {return (identity.countPendingArticles > 0) ? acc + 1 : acc;}, 0));

  useEffect(() => {
    if (filteredIds.length) {
      dispatch(publicationsFetchGroupData(filteredIds.slice(0, incrementBy), 'refresh'));
    }
  }, [])


  filtersList.forEach( filter => {
    if (Object.keys(filters).length > 0 && filters.hasOwnProperty(filter.value)) {
        let dropdownItem = { title: filter.title, children: filters[filter.value]}
        filterSectionList.push(dropdownItem)
    } else {
      filterSectionList.push({ title: filter.title})
    }
  })

  const handlePageUpdate = (updatedPage: number) => {
    setPage(updatedPage);
    dispatch(publicationsFetchGroupData(filteredIds.slice((updatedPage - 1) * incrementBy, updatedPage * incrementBy), 'refresh'));
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
        buttonTitle="Update Search..."
        buttonUrl="/search"
        ></FilterSection>
      { (publicationsGroupDataFetching) ? <Loader /> : 
        <>
          <div className="d-flex justify-content-between">
            {publicationsGroupData.reciter && <h2 className={styles.sectionHeader}>{`About ${totalCount} people with pending publications`}</h2>}
            <div className={styles.paginationContainer}>
              <Button className="primary m-2" disabled={page === 1} onClick={() => handlePageUpdate(page - 1)}><NavigateBeforeIcon /> Previous </Button>
              <Button className="primary m-2" disabled={page * incrementBy >= filteredIds.length } onClick={() => handlePageUpdate(page + 1)}>Next <NavigateNextIcon /></Button>
            </div>
          </div>
          <div className={styles.publicationsContainer}>
            {
              <PublicationsList />
            }
          </div>
        </>
      }
    </div>
  )
}

export default CuratePublications;
