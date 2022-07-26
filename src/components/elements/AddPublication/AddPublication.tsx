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
                    
                > <svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-ptiqhd-MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24" aria-hidden="true" data-testid="CheckIcon"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>Accept
                </button>
                <button
                    className={`btn btn-danger ${publicationStyles.publicationUndo}`}
                    onClick={rejectPublication}
                ><svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-ptiqhd-MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24" aria-hidden="true" data-testid="ClearIcon"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>Reject
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