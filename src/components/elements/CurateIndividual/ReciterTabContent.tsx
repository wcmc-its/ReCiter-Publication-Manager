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
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<number>(0)
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

  const sortUpdate = (sort: number) => {
    setSort(sort);
    let sortedPublications = sortPublications(props.publications, sort);
    setPublications(sortedPublications);
  }

  const handlePaginationUpdate = (eventKey, page, updateCount) => {
    let updatedCount = count
    setPage(page)

    if (updateCount) {
      setCount(eventKey)
      updatedCount = eventKey
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

  return (
    <>
      <FilterPubSection 
        searchTextUpdate={searchTextUpdate}
        sortUpdate={sortUpdate}
      />
      <Pagination total={publications.length} page={page}
        count={count}
        onChange={handlePaginationUpdate}
        />
      {getPaginatedData().map((publication: any, index: number) => {
        return (
          <>
            <Publication 
              index={index}
              key={index}
              reciterArticle={publication}
              personIdentifier={props.personIdentifier}
              fullName={props.fullName}
            />
            <Divider />
          </>
        )
      })}
    </>
  )
}

export default ReciterTabContent