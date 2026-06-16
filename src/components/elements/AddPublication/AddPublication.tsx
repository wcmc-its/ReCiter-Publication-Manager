import React, { FunctionComponent } from "react"
import styles from './AddPublication.module.css'
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';

interface FuncProps {
    onAccept(id: number, userAssertion: string): void,
    onReject(id: number, userAssertion: string): void,
    item: any,
    curationStatus?: 'ACCEPTED' | 'REJECTED' | null,
}

const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
const doiUrl = 'https://doi.org/';

const AddPublication: FunctionComponent<FuncProps> = (props) => {
    const { item, curationStatus } = props;
    const isCurated = curationStatus === 'ACCEPTED' || curationStatus === 'REJECTED';

    const acceptPublication = () => {
        props.onAccept(item.pmid, 'ACCEPTED');
    }

    const rejectPublication = () => {
        props.onReject(item.pmid, 'REJECTED');
    }

    const stripClass = curationStatus === 'ACCEPTED'
        ? styles.statusStripAccepted
        : curationStatus === 'REJECTED'
            ? styles.statusStripRejected
            : styles.statusStripNeutral;

    return (
        <div className={`${styles.pubCard} ${isCurated ? styles.pubCardCurated : ''}`}>
            <div className={stripClass} />
            <div className={styles.pubCardMain}>
                <div className={styles.pubCardContent}>
                    <div className={styles.pubTitle}>{item.title}</div>
                    <div className={styles.pubAuthors}>
                        {item.authors?.length > 0
                            ? item.authors.map((author: any, i: number) => (
                                <span key={i}>
                                    {author.authorName}{i < item.authors.length - 1 ? ', ' : ''}
                                </span>
                            ))
                            : <span>No authors listed</span>
                        }
                    </div>
                    <div className={styles.pubMeta}>
                        {item.journal && <span className={styles.pubJournal}>{item.journal}</span>}
                        {item.displayDate && <span>{item.displayDate}</span>}
                        {item.publicationTypeCanonical && (
                            <span className={styles.pubTypeBadge}>{item.publicationTypeCanonical}</span>
                        )}
                        {isCurated && (
                            <span className={curationStatus === 'ACCEPTED' ? styles.badgeAccepted : styles.badgeRejected}>
                                {curationStatus === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
                            </span>
                        )}
                    </div>
                    <div className={styles.pubLinks}>
                        <span>PMID: <a href={`${pubMedUrl}${item.pmid}`} target="_blank" rel="noreferrer">{item.pmid}</a></span>
                        {item.doi && <span><a href={`${doiUrl}${item.doi}`} target="_blank" rel="noreferrer">DOI &#8599;</a></span>}
                    </div>
                </div>
                {!isCurated && (
                    <div className={styles.cardActions}>
                        <button className={styles.btnAccept} onClick={acceptPublication}>
                            <CheckIcon style={{fontSize: 14}} /> Accept
                        </button>
                        <button className={styles.btnReject} onClick={rejectPublication}>
                            <ClearIcon style={{fontSize: 14}} /> Reject
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AddPublication
