import React, { useState } from "react";
import type { Author } from '../../../../types/Author';
import styles from "./AuthorsComponent.module.css";

const Author = ({author, index, count} : {
  author: Author,
  index: number,
  count: number,
}) => {
  let authorFullName: string = '';
  if (author.firstName) {
    authorFullName += author.firstName + " ";
  }
  if (author.lastName) {
    authorFullName += author.lastName;
  }

  return <li key={"author" + index}><span className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}</span>{(index < count - 1)?", ":""}</li>
}

const AuthorsList = ({ authors } : {
  authors: Author[]
}) => {
  return (
    <ul className={styles.listInline}>
      {
        authors && authors.map((author, i) => <Author author={author} key={i} index={i} count={authors.length}></Author>  )
      }
    </ul>
  )
}

export const AuthorsComponent = ({ authors } : { authors: Author[]}) => {
  const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false);

  if (!authors) {
    return null
  }

  let authCount = authors.length;
  if ( authCount > 0) {
    if ( authCount <= 7 || expandedAuthors) {
      return (<AuthorsList authors={authors}></AuthorsList>)
  } else {
    let authorsDefaultDisplay = authors.slice(0, 6);
    let lastAuthor = authors[authCount - 1];

    return (
      <>
        <AuthorsList authors={authorsDefaultDisplay}></AuthorsList>
        <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
        <ul className={styles.listInline}>
          <Author author={lastAuthor} index={authCount - 1} count={authCount}></Author>
        </ul>
      </>
    )
  }
} else return (
    <span>No authors listed</span>
  )
}