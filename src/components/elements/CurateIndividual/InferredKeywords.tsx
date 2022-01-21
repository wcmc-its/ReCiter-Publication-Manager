import React from "react";
import styles from "./CurateIndividual.module.css";

interface Keyword {
  keyword: string,
  type: string,
  cout: number
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
      <p>
        <b> Inferred keywords: </b>
      {
        reciter.articleKeywordsAcceptedArticles.map((articleKeyword: Keyword, key: number) => {
          return (
            <>
              <span className={styles.highlighted}>{articleKeyword.keyword}</span><span>{' '}</span>
            </>
          )
        })
     }
    </p>
    }
    </>
  )
}

export default InferredKeywords;