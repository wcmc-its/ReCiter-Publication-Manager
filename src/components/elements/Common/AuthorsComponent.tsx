import React, { useState } from "react";
import type { Author } from '../../../../types/Author';
import styles from "./AuthorsComponent.module.css";

// `suffix` follows the last name in the list (", editors" on an edited book); `author.roleNote`
// follows that person's name ("(translator)").
const AuthorComponent = ({author, index, count, onClick, suffix = ""} : {
  author: Author,
  index: number,
  count: number,
  onClick?: (personIdentifier: string) => void,
  suffix?: string,
}) => {
  let authorFullName: string = '';
  if (author.firstName) {
    authorFullName += author.firstName + " ";
  }
  if (author.lastName) {
    authorFullName += author.lastName;
  }

  const sep = index < count - 1 ? ", " : suffix;
  const note = author.roleNote ? <span className={styles.roleNote} data-testid="author-role"> ({author.roleNote})</span> : null;

  if (parseInt(author.highlightAuthor)) {
    return (
      <li key={"author" + index}><span className={`${styles.wcmAuthor} ${styles.highlightedAuthor}`} title={`View ${authorFullName.trim()}'s profile`} onClick={() => onClick(author.personIdentifier)}>{authorFullName}</span>{note}{sep}</li>
    )
  } else if (author.personIdentifier && author.personIdentifier !== "") {
    return (
      <li key={"author" + index}><span className={styles.wcmAuthor} title={`View ${authorFullName.trim()}'s profile`} onClick={() => onClick(author.personIdentifier)}>{authorFullName}</span>{note}{sep}</li>
    )
  }

  return <li key={"author" + index}><span className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}</span>{note}{sep}</li>
}

const AuthorsList = ({ authors, onClick, suffix } : {
  authors: Author[],
  onClick?: (personIdentifier: string) => void,
  suffix?: string,
}) => {
  return (
    <ul className={styles.listInline}>
      {
        authors && authors.map((author, i) => <AuthorComponent author={author} key={i} index={i} count={authors.length} onClick={onClick} suffix={suffix}></AuthorComponent>  )
      }
    </ul>
  )
}

export const AuthorsComponent = ({ authors, onClick, suffix } : { authors: Author[], onClick?: (personIdentifier: string) => void, suffix?: string }) => {
  const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false);

  if (!authors) {
    return null
  }

  let authCount = authors.length;
  if ( authCount > 0) {
    if ( authCount <= 7 || expandedAuthors) {
      return (<AuthorsList authors={authors} onClick={onClick} suffix={suffix}></AuthorsList>)
  } else {
    let authorsDefaultDisplay = authors.slice(0, 6);
    let lastAuthor = authors[authCount - 1];

    return (
      <>
        <AuthorsList authors={authorsDefaultDisplay} onClick={onClick}></AuthorsList>
        <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
        <ul className={styles.listInline}>
          <AuthorComponent author={lastAuthor} index={authCount - 1} count={authCount} onClick={onClick} suffix={suffix}></AuthorComponent>
        </ul>
      </>
    )
  }
} else return (
    <span>No authors listed</span>
  )
}