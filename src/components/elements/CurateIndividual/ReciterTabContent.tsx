import React, { useState } from "react";
import Publication from "../Publication/Publication";
import Divider from "../Common/Divider";
import FilterPubSection from "./FilterPubSection";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import sortPublications from "../../../utils/sortPublications";
import Pagination  from '../Pagination/Pagination';

interface TabContentProps {
  tabType: string,
  publications: any,
  index: number,
  personIdentifier: string,
  fullName: string,
  feedbacklog: any,
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<string>("0")
  const [publications, setPublications] = useState<any>(props.publications);
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(20)

  if (!props.publications.length) {
    return (
      <div className="text-center">
        <p>No articles found</p>
      </div>
    )
  }

  const searchTextUpdate = (searchText: string) => {
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText);
    setPublications(filteredPublications);
  }

  const sortUpdate = (sort: string) => {
    setSort(sort);
    let sortedPublications = sortPublications(props.publications, sort);
    setPublications(sortedPublications);
  }

  const handlePaginationUpdate = ( page ) => {
    setPage(page)
  }

  const handleCountUpdate = (count) => {
    if (count) {
      setPage(1);
      setCount(parseInt(count));
    }
  }

  const getPaginatedData = () => {
    let dataList = publications.slice(page * count, (page + 1) * count)
    return dataList;
  };

  return (
    <>
      <FilterPubSection 
        searchTextUpdate={searchTextUpdate}
        sortUpdate={sortUpdate}
        publications={publications}
      />
      <Pagination total={publications.length} page={page}
        count={count}
        onChange={handlePaginationUpdate}
        onCountChange={handleCountUpdate}
        />
      {getPaginatedData().map((publication: any, index: number) => {
        return (
          <div key={publication.pmid}>
            <Publication 
              index={index}
              reciterArticle={publication}
              personIdentifier={props.personIdentifier}
              fullName={props.fullName}
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