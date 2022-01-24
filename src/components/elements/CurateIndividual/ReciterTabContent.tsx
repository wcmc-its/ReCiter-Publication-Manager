import React from "react";
import Publication from "../Publication/Publication";
import Divider from "../Common/Divider";
import FilterPubSection from "./FilterPubSection";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";

interface TabContentProps {
  tabType: string,
  publications: any,
  index: number,
  personIdentifier: string,
  fullName: string,
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  if (!props.publications.length) {
    return (
      <div className="text-center">
        <p>No articles found</p>
      </div>
    )
  }

  const searchTextUpdate = (searchText: string) => {
    // TODO: update the list
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText);
  }

  return (
    <>
      <FilterPubSection 
        searchTextUpdate={searchTextUpdate}
      />
      {props.publications.map((publication: any, index: number) => {
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