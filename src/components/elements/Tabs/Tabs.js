import React from 'react';
import { useSelector } from "react-redux";
import styles from './Tabs.module.css';

const Tabs = (props) => {

    const reciterData = useSelector((state) => state.reciterData)
    var suggested = 0
    var accepted = 0
    var rejected = 0

    reciterData.reciter.forEach(function(publication){
        switch(publication.userAssertion) {
            case "NULL":
                suggested++
                break
            case "ACCEPTED":
                accepted++
                break
            case "REJECTED":
                rejected++
                break
            default:
                break
        }
    })

    return (

        <div className={`nav nav-tabs tabs-headers`} role="tablist">
            <div className={(props.tabActive === "Accepted")?"active":""}>
                <button
                    type="button"
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" tabIndex={props.tabActive === "Accepted" ? 0 : -1} aria-selected={props.tabActive === "Accepted"} data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Accepted"); } }
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >Accepted <span className={(props.tabActive === "Accepted")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{accepted}</span></button>
            </div>
            <div className={(props.tabActive === "Suggested")?"active":""}>
                <button
                    type="button"
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" tabIndex={props.tabActive === "Suggested" ? 0 : -1} aria-selected={props.tabActive === "Suggested"} data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Suggested"); } }
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >Suggested <span className={(props.tabActive === "Suggested")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{suggested}</span></button>
            </div>
            <div className={(props.tabActive === "Rejected")?"active":""}>
                <button
                    type="button"
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" tabIndex={props.tabActive === "Rejected" ? 0 : -1} aria-selected={props.tabActive === "Rejected"} data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Rejected"); } }
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >Rejected <span className={(props.tabActive === "Rejected")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{rejected}</span></button>
            </div>
            <div className={(props.tabActive === "Add Publication")?"active":""}>
                <button
                    type="button"
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" tabIndex={props.tabActive === "Add Publication" ? 0 : -1} aria-selected={props.tabActive === "Add Publication"} data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Add Publication"); } }
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >Add Publication</button>
            </div>
        </div>
    );
}

export default Tabs