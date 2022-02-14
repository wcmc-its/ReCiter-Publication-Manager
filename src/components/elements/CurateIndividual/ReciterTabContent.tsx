import React, { useState, useEffect } from "react";
import Publication from "../Publication/Publication";
import Divider from "../Common/Divider";
import FilterPubSection from "./FilterPubSection";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import sortPublications from "../../../utils/sortPublications";
import Pagination  from '../Pagination/Pagination';
import { useSession } from "next-auth/client";
import { fetchFeedbacklog, reciterUpdatePublication } from "../../../redux/actions/actions";
import { useDispatch } from "react-redux"; 

interface TabContentProps {
  tabType: string,
  publications: any,
  index: number,
  personIdentifier: string,
  fullName: string,
  updatePublicationAssertion: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  updatePublicationAssertionBulk: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  feedbacklog: any,
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<string>("0")
  const [publications, setPublications] = useState<any>(props.publications);
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(20)
  const [session, loading] = useSession();
  const [totalCount, setTotalCount] = useState<number>(publications.length || 0);
  const dispatch = useDispatch();

  if (!props.publications.length) {
    return (
      <div className="text-center">
        <p>No articles found</p>
      </div>
    )
  }

  // TODO: update history
  // useEffect(() => {
  //   let sortedPublications = sortPublications(props.publications, sort);
  //   setPublications(sortedPublications);
  //   dispatch(fetchFeedbacklog(props.personIdentifier));
  // }, [publications.length])

  const searchTextUpdate = (searchText: string) => {
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText);
    setPublications(filteredPublications);
    setTotalCount(filteredPublications.length);
     if (page !== 1) {
       setPage(1);
     }
  }

  const sortUpdate = (sort: string) => {
    setSort(sort);
    let sortedPublications = sortPublications(props.publications, sort);
    setPublications(sortedPublications);
  }

  // Update the page
  const handlePaginationUpdate = ( page ) => {
    setPage(page)
  }

  // Update the count per page
  const handleCountUpdate = (count) => {
    if (count) {
      setPage(1);
      setCount(parseInt(count));
    }
  }

  const getPaginatedData = () => {
    let from = (page - 1) * count;
    let to = from + count;
    let dataList = [];
    if (props.publications) {
      dataList = props.publications;
    }
    return dataList.slice(from, to);
  };

  let publicationsPaginatedData = publications.slice((page - 1) * count, page * count);

  const handleUpdatePublication = (uid: string, pmid: number, userAssertion: string) => {
    const userId = session?.data?.databaseUser?.userID;
    const request = {
      publications: [pmid],
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: uid,
    }
    // TODO: send request
    dispatch(reciterUpdatePublication(uid, request));
    
    // update user assertion of the publication
    let updatedPublication = {};
    let index = publications.findIndex(publication => publication.pmid === pmid);
    if (index > -1) { 
      updatedPublication = { 
        ...publications[index],
        userAssertion: userAssertion
      };
    }

    // move updated data to the right Tab
    props.updatePublicationAssertion(updatedPublication, userAssertion, props.tabType);
  }

  const handleUpdatePublicationAll = (userAssertion: string) => {
    const userId = session?.data?.databaseUser?.userID;
    const pmids = getPaginatedData().map((publication) => {return publication.pmid});
    const request = {
      publications: pmids,
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: props.personIdentifier,
    }

    dispatch(reciterUpdatePublication(props.personIdentifier, request));
    //TODO Update publications list in the tab
    let paginatedPublications = getPaginatedData();
    let updatedPublications = []; 
    pmids.forEach((pmid) => {
      let updatedPublication = {};
      let index = paginatedPublications.findIndex(publication => publication.pmid === pmid);
      if (index > -1) { 
        updatedPublication = { 
          ...publications[index],
          userAssertion: userAssertion
        };
        updatedPublications.push(updatedPublication);
      }
    })

    props.updatePublicationAssertionBulk(updatedPublications, userAssertion, props.tabType);
  }

  return (
    <>
      <FilterPubSection 
        searchTextUpdate={searchTextUpdate}
        sortUpdate={sortUpdate}
        publications={publications}
        updateAll={handleUpdatePublicationAll}
        tabType={props.tabType}
      />
      <Pagination total={totalCount} page={page}
        count={count}
        onChange={handlePaginationUpdate}
        onCountChange={handleCountUpdate}
        />
      {publicationsPaginatedData.map((publication: any, index: number) => {
        return (
          <div key={publication.pmid}>
            <Publication 
              index={index}
              reciterArticle={publication}
              personIdentifier={props.personIdentifier}
              fullName={props.fullName}
              updatePublication={handleUpdatePublication}
              feedbacklog={props.feedbacklog}
            />
            <Divider />
          </div>
        )
      })}
    </>
  )
}

export default ReciterTabContent