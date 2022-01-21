import React from "react";
import Publication from "../Publication/Publication";

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
  return (
    <>
      {props.publications.map((publication: any, index: number) => {
        return (
          <Publication 
            index={index}
            key={index}
            reciterArticle={publication}
            personIdentifier={props.personIdentifier}
            fullName={props.fullName}
          />
        )
      })}
    </>
  )
}

export default ReciterTabContent