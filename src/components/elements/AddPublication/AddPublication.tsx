import React, { useState, FunctionComponent } from "react"
import styles from './AddPublication.module.css'
import publicationStyles from '../Publication/Publication.module.css'

interface FuncProps {
    onAccept(id: number, userAssertion : string): void,
    onReject(id: number, userAssertion : string): void,
    item: any
}

const AddPublication: FunctionComponent<FuncProps> = (props) => {
    const acceptPublication = () => {
        const { item } = props
        props.onAccept(item.pmid, 'ACCEPTED');
    }

    const rejectPublication = () => {
        const { item } = props
        props.onReject(item.pmid, 'REJECTED')
    }

    const { item } = props;

    return <tr className={`${styles.tableRows}`}>
        <td key="0" className={publicationStyles.publicationButtons}>
            <div>
                <button
                    className={`btn btn-success ${publicationStyles.publicationAccept}`}
                    onClick={acceptPublication}
                    
                > <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check" viewBox="0 0 16 16">
                <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
              </svg>Accept
                </button>
                <button
                    className={`btn btn-danger ${publicationStyles.publicationUndo}`}
                    onClick={rejectPublication}
                ><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>Reject
                </button>
            </div>
        </td>
        <td key="1" className={publicationStyles.publicationContent}>
            <p className={publicationStyles.publicationField}>
                <strong>{item.title}</strong>
                {/* <span>{item.title}</span> */}
            </p>
            <p className={publicationStyles.publicationField}>
                
                {/* <strong>Authors: </strong> */}
                <span>
                    {
                        (item !== undefined && item.authors !== undefined)?
                        item.authors.map(function(author: any, authorIndex: number) {
                            var authorHTML = <span></span>;

                            authorHTML = <span
                                key={authorIndex}>{author.authorName}{(authorIndex < item.authors.length - 1) ? ", " : ""}</span>;
                            return authorHTML;
                        })
                        :<span>No authors listed</span>
                    }

                </span>
            </p>
            <p className={publicationStyles.publicationField}>
                {/* <strong>Journal: </strong> */}
                <span>{item.journal}</span>
            {/* </p>
            <p className={publicationStyles.publicationField}>
                <strong>Date: </strong> */}
                <span>&nbsp;&nbsp;{item.displayDate}</span>
            </p>
            <p className={publicationStyles.publicationField}>
                PMID: 
                <span><u>{item.pmid}</u></span>
            </p>
        </td>
    </tr>;

}

export default AddPublication