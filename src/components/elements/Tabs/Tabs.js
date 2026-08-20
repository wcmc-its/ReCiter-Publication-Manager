import React from 'react';
import { useSelector } from "react-redux";
import styles from './Tabs.module.css';

// Option C (docs/README-other-publications-tab.md, Decisions 1-3): Scopus/OpenAlex
// join this same tab-bar row after a divider, not a separate stacked bar or umbrella
// tab. "PubMed" is an inline label scoped to just Accepted/Suggested/Rejected — the
// source cluster after the divider stays unlabeled on purpose (Decision 2/3).

// A row counts toward its source tab unless it's a real duplicate of an accepted
// PubMed record (suppressed by the supersede rule). A disputed-but-unresolved row
// (suppressed by dispute, supersededByPmid still null) still counts — it renders in
// its own tab, in the disputed visual state (Faculty tab wiring, README).
const countBySource = (rows, sourceType) => rows.filter((row) =>
    row.sourceType === sourceType && !(row.suppressed && row.supersededByPmid != null)
).length

const Tabs = (props) => {

    const reciterData = useSelector((state) => state.reciterData)
    const otherPublicationsData = useSelector((state) => state.otherPublicationsData)
    var suggested = 0
    var accepted = 0
    var rejected = 0

    // ReCiter-Publication-Manager#873: reciterData.reciter is undefined until the
    // fetch resolves; unguarded .forEach crashed on first render.
    ;(reciterData?.reciter?.reCiterArticleFeatures || []).forEach(function(publication){
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

    // Scopus and OpenAlex only (Manual Add stays deferred — see the README).
    const scopusCount = countBySource(otherPublicationsData, "SCOPUS")
    const openAlexCount = countBySource(otherPublicationsData, "OPENALEX")

    return (

        <ul className={`nav nav-tabs tabs-headers`} role="tablist">
            <span className={styles.tabGroupLabel}>PubMed</span>
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
            {(scopusCount > 0 || openAlexCount > 0) && (
                <li className={styles.tabDivider} aria-hidden="true"></li>
            )}
            {scopusCount > 0 && (
                <li className={(props.tabActive === "Scopus")?"active":""}>
                    <a
                        className={styles.publicationsTabLink}
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="scopus"
                        onClick={() => { props.tabClickHandler("Scopus"); } }
                    >Scopus <span className={styles.publicationsTabLinkActive}>{scopusCount}</span></a>
                </li>
            )}
            {openAlexCount > 0 && (
                <li className={(props.tabActive === "OpenAlex")?"active":""}>
                    <a
                        className={styles.publicationsTabLink}
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="openalex"
                        onClick={() => { props.tabClickHandler("OpenAlex"); } }
                    >OpenAlex <span className={styles.publicationsTabLinkActive}>{openAlexCount}</span></a>
                </li>
            )}
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
