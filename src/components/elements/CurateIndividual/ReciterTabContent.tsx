import React, { useState, useEffect } from "react";
import Publication from "../Publication/Publication";
import Divider from "../Common/Divider";
import FilterPubSection from "./FilterPubSection";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import sortPublications from "../../../utils/sortPublications";
import Pagination from '../Pagination/Pagination';
import { useSession } from "next-auth/react";
import { curateSearchtextAction, reciterUpdatePublication } from "../../../redux/actions/actions";
import { RootStateOrAny, useDispatch, useSelector } from "react-redux";

interface TabContentProps {
  tabType: string,
  publications: any,
  index: number,
  isSearchText: any,
  personIdentifier: string,
  fullName: string,
  updatePublicationAssertion: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  updatePublicationAssertionBulk: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  showEvidenceDefault?:any,
  activeKey:any,
  totalCount:any,
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<string>("0")
  const [publications, setPublications] = useState<any>(props.publications);
  const [searchtextCarier, setSearchtextCarier] = useState<any>("");

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(50)
  const {data: session, status} = useSession();
  const loading = status === "loading"
  const [totalCount, setTotalCount] = useState<number>(publications.length || 0);
  const dispatch = useDispatch();

  if (!props.publications.length) {
    return (
      <div className="text-center">
        <p>No articles found</p>
      </div>
    )
  }

  const searchTextUpdate = (searchText: string) => {
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText.trim());
    setPublications(filteredPublications);
    setTotalCount(filteredPublications.length);
    setSearchtextCarier(searchText);
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
  const handlePaginationUpdate = (page) => {
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
    if (publications) {
      dataList = publications;
    }
    return dataList.slice(from, to);
  };

  let publicationsPaginatedData = publications.slice((page - 1) * count, page * count);

  var totalNullCount = 0;
  var totalAcceptedCount = 0;
  var totalRejectedCount = 0;

  if(publicationsPaginatedData.length){
    publicationsPaginatedData.map((publication)=>{
      if(publication.userAssertion === "NULL"){
        totalNullCount++
      }else if(publication.userAssertion === "ACCEPTED"){
        totalAcceptedCount++
      }else{
        totalRejectedCount++
      }
    })
  }



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

    let SearchInfo = {
      searchedText:searchtextCarier,
      userAssertion:userAssertion
    }
    dispatch(curateSearchtextAction(SearchInfo));

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
    const pmids = getPaginatedData().map((publication) => { return publication.pmid });
    const request = {
      publications: pmids,
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: props.personIdentifier,
    }
    let SearchInfo = {
      searchedText:searchtextCarier,
      userAssertion:userAssertion
    }
    dispatch(curateSearchtextAction(SearchInfo));
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
        isSearchText={props.isSearchText}
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
              index={ `page${page}${index+1}`}
              reciterArticle={publication}
              personIdentifier={props.personIdentifier}
              fullName={props.fullName}
              updatePublication={handleUpdatePublication}
              activekey={props.activeKey}
              totalCount={props.totalCount}
              showEvidenceDefault={props.showEvidenceDefault}
              page={page}
              paginatedPubsCount={publication.userAssertion === "NULL" ? totalNullCount : publication.userAssertion === "ACCEPTED" ? totalAcceptedCount : totalRejectedCount}
            />
            <Divider />
          </div>
        )
      })}
    </>
  )
}

export default ReciterTabContent