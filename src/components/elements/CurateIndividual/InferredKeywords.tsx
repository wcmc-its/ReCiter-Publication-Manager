import React from "react";
import styles from "./CurateIndividual.module.css";
import { Popover, OverlayTrigger } from "react-bootstrap";

interface Keyword {
  keyword: string,
  type: string,
  count: number
}

const InferredKeywords = ({
  reciter
} : {
  reciter: any
}) => {
  let keyWordsList: Array<Keyword> = [];

  return (
    <> 
    {
      reciter.articleKeywordsAcceptedArticles && reciter.articleKeywordsAcceptedArticles.length > 0 &&
      <div className="mb-1">
        <b> Inferred keywords: </b>
      {
        reciter.articleKeywordsAcceptedArticles.map((articleKeyword: Keyword, key: number) => {
          return (
            <div className="d-inline" key={`inferred-keyword__${key.toString()}`}>
              <OverlayTrigger 
                trigger={["focus", "hover"]} 
                overlay={(      
                  <Popover id="keyword-information">
                    <Popover.Body>
                      {`${articleKeyword.count} accepted publications are indexed with this keyword.`}
                    </Popover.Body>
                  </Popover>)} placement="top"><span className={styles.highlighted}>{articleKeyword.keyword}</span>
              </OverlayTrigger>
              <span>{' '}</span>
            </div>
          )
        })
     }
    </div>
    }
    </>
  )
}

export default InferredKeywords;