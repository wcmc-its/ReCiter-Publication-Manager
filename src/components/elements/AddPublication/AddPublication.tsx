import React, { useState, FunctionComponent } from "react"
import styles from './AddPublication.module.css'
import publicationStyles from '../Publication/Publication.module.css'

interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    item: any
}

const AddPublication: FunctionComponent<FuncProps> = (props) => {
    const acceptPublication = () => {
        const { item } = props
        props.onAccept(item.pmid);
    }

    const rejectPublication = () => {
        const { item } = props
        props.onReject(item.pmid)
    }

    const { item } = props;

    return <tr>
        <td key="0" className={publicationStyles.publicationButtons}>
            <div>
                <button
                    className={`btn btn-success ${publicationStyles.publicationAccept}`}
                    onClick={acceptPublication}
                >Accept
                </button>
                <button
                    className={`btn btn-danger ${publicationStyles.publicationUndo}`}
                    onClick={rejectPublication}
                >Reject
                </button>
            </div>
        </td>
        <td key="1" className={publicationStyles.publicationContent}>
            <p className={publicationStyles.publicationField}>
                <strong>Authors: </strong>
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
                <strong>Title: </strong>
                <span>{item.title}</span>
            </p>
            <p className={publicationStyles.publicationField}>
                <strong>Journal: </strong>
                <span>{item.journal}</span>
            </p>
            <p className={publicationStyles.publicationField}>
                <strong>Date: </strong>
                <span>{item.displayDate}</span>
            </p>
        </td>
    </tr>;

}

export default AddPublication