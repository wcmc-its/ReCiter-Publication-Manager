import React, { useState } from "react";
import type { Author } from '../../../../types/Author';
import styles from "./AuthorsComponent.module.css";

const Author = ({author, index, count, onClick} : {
  author: Author,
  index: number,
  count: number,
  onClick?: (personIdentifier: string) => void
}) => {
  let authorFullName: string = '';
  if (author.firstName) {
    authorFullName += author.firstName + " ";
  }
  if (author.lastName) {
    authorFullName += author.lastName;
  }

  if (parseInt(author.highlightAuthor)) {
    return (
      <li key={"author" + index}><span onClick={() => onClick(author.personIdentifier)} className={styles.highlightedAuthor}>{authorFullName}</span>{(index < count - 1)?", ":""}</li>
    )
  }

  return <li key={"author" + index}><span className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}</span>{(index < count - 1)?", ":""}</li>
}

const AuthorsList = ({ authors, onClick } : {
  authors: Author[],
  onClick?: (personIdentifier: string) => void
}) => {
  return (
    <ul className={styles.listInline}>
      {
        authors && authors.map((author, i) => <Author author={author} key={i} index={i} count={authors.length} onClick={onClick}></Author>  )
      }
    </ul>
  )
}

export const AuthorsComponent = ({ authors, onClick} : { authors: Author[], onClick?: (personIdentifier: string) => void}) => {
  const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false);

  if (!authors) {
    return null
  }

  let authCount = authors.length;
  if ( authCount > 0) {
    if ( authCount <= 7 || expandedAuthors) {
      return (<AuthorsList authors={authors} onClick={onClick}></AuthorsList>)
  } else {
    let authorsDefaultDisplay = authors.slice(0, 6);
    let lastAuthor = authors[authCount - 1];

    return (
      <>
        <AuthorsList authors={authorsDefaultDisplay} onClick={onClick}></AuthorsList>
        <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
        <ul className={styles.listInline}>
          <Author author={lastAuthor} index={authCount - 1} count={authCount} onClick={onClick}></Author>
        </ul>
      </>
    )
  }
} else return (
    <span>No authors listed</span>
  )
}