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

        <ul className={`nav nav-tabs tabs-headers`} role="tablist">
            <li className={(props.tabActive === "Accepted")?"active":""}>
                <a
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Accepted"); } }
                >Accepted <span className={(props.tabActive === "Accepted")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{accepted}</span></a>
            </li>
            <li className={(props.tabActive === "Suggested")?"active":""}>
                <a
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Suggested"); } }
                >Suggested <span className={(props.tabActive === "Suggested")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{suggested}</span></a>
            </li>
            <li className={(props.tabActive === "Rejected")?"active":""}>
                <a
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Rejected"); } }
                >Rejected <span className={(props.tabActive === "Rejected")?styles.publicationsTabLinkActive:styles.publicationsTabLinkActive}>{rejected}</span></a>
            </li>
            <li className={(props.tabActive === "Add Publication")?"active":""}>
                <a
                    className={styles.publicationsTabLink}
                    aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                    onClick={() => { props.tabClickHandler("Add Publication"); } }
                >Add Publication</a>
            </li>
        </ul>
    );
}

export default Tabs