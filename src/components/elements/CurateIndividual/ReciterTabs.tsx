import React, { useEffect, useState, useRef } from "react";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs, Badge } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import TabAddPublication from "../TabAddPublication/TabAddPublication";
import { allowedPermissions } from "../../../utils/constants";
import { useSession } from "next-auth/react";
import { clearPubMedData, showEvidenceByDefault, reciterFetchData } from "../../../redux/actions/actions";


const ReciterTabs = ({ reciterData, fullName, fetchOriginalData }: { reciterData: any, fullName: string, fetchOriginalData: any }) => {
  //default tab
  const [key, setKey] = useState('NULL');
  const dispatch = useDispatch();
  const [filteredData, setFilteredData] = useState([])
  const [pubKey, setPubKey] = useState(false);
  const { data: session, status } = useSession(); const loading = status === "loading";
  const isSearchText = useSelector((state: RootStateOrAny) => state.curateSearchtext)
  const showEvidenceDefault = useSelector((state: RootStateOrAny) => state.showEvidenceDefault)
  const [pubSearchFilters, setPubSearchFilters] = useState();
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done'>('idle');

  // Smart change tracking: compare current assertions to originals
  const originalAssertions = useRef<Map<number, string>>(new Map());
  const [changedAssertions, setChangedAssertions] = useState<Map<number, string>>(new Map());


  const addnewtabName = <p id="addnewtabName" className="noSpace" >Add New record:</p>
  const pubMedTabName = <p id="pubMedTabName" className="text-primary noSpace" ><span >PubMed</span></p>

  const tabsData = [
    { name: 'Suggested', value: 'NULL',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: 'Accepted', value: 'ACCEPTED',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: 'Rejected', value: 'REJECTED',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: addnewtabName, value: 'addNewRecord',allowedRoleNames: ["Superuser","Curator_Self","Curator_All"] },
    { name: pubMedTabName, value: 'AddPub', allowedRoleNames: ["Superuser","Curator_Self","Curator_All"] },
  ]

  useEffect(() => {
    let publicationsPerTabs = [];
    tabsData.forEach((tab) => {
      let filteredReciterData = filterPublications(reciterData, tab.value, "");
      publicationsPerTabs.push({ value: tab.value, name: tab.name, data: filteredReciterData, count: filteredReciterData.length, allowedRoleNames: tab.allowedRoleNames})
    })
    setFilteredData(publicationsPerTabs);

    // Build map of original assertions for smart change tracking
    const origMap = new Map<number, string>();
    publicationsPerTabs.forEach((tab: any) => {
      if (tab.value === 'NULL' || tab.value === 'ACCEPTED' || tab.value === 'REJECTED') {
        tab.data.forEach((article: any) => {
          origMap.set(article.pmid, article.userAssertion);
        });
      }
    });
    originalAssertions.current = origMap;
  }, [])

  const updatePublicationAssertion = (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => {
    let updatedFilteredData = [...filteredData];

    updatedFilteredData.forEach((tabData) => {
      // If Tab matches the updated user assertion, add the article in the tab
      if (tabData.value == userAssertion) {
        tabData.data.push(reciterArticle);
        tabData.count = tabData.count + 1;
      } else if (tabData.value == prevUserAssertion) {
        // If Tab matches the previous user assertion, remove from that tab
        let index = tabData.data.findIndex(i => i.pmid === reciterArticle.pmid);
        if (index > -1) { tabData.data.splice(index, 1) }
        if (tabData.count > 0) { tabData.count = tabData.count - 1; }
      }
    })

    setFilteredData(updatedFilteredData);
    // setKey(prevUserAssertion)
  }

  const updatePublicationAssertionBulk = (reciterArticles: any, userAssertion: string, prevUserAssertion: string) => {
    let updatedFilteredData = [...filteredData];
    updatedFilteredData.forEach((tabData) => {
      // If Tab matches the updated user assertion, add the article in the tab
      if (tabData.value == userAssertion) {
        tabData.data.push(...reciterArticles);
        tabData.count = tabData.count + reciterArticles.length;
      } else if (tabData.value == prevUserAssertion) {
        // If Tab matches the previous user assertion, remove from that tab
        let count = tabData.count;
        reciterArticles.forEach((reciterArticle) => {
          let index = tabData.data.findIndex(i => i.pmid === reciterArticle.pmid);
          if (index > -1) { tabData.data.splice(index, 1) }
          if (count > 0) { count--; }
        })
        tabData.count = count;
      }
    })
    setFilteredData(updatedFilteredData);
    // setKey(userAssertion)
  }
  const handleUpdateSearchFilters = (pubFilters : any)=>{
    setPubSearchFilters(pubFilters);
  }

  // Track assertion changes: each article counted at most once, net-zero = 0
  const handleAssertionChange = (pmid: number, newAssertion: string) => {
    setChangedAssertions(prev => {
      const next = new Map(prev);
      const original = originalAssertions.current.get(pmid);
      if (original === newAssertion) {
        // Back to original state — no net change
        next.delete(pmid);
      } else {
        // Changed from original — counts as 1 change (regardless of intermediate states)
        next.set(pmid, newAssertion);
      }
      return next;
    });
  };

  const netChangedCount = changedAssertions.size;

  const onTabChange = (k)=>{
    setKey(k)
    dispatch(showEvidenceByDefault(false));
  }

  const handleRefresh = () => {
    if (refreshState !== 'idle') return;
    setRefreshState('loading');
    // In production: dispatch(reciterFetchData(reciterData.reciter?.personIdentifier, true));
    // For now, simulate the network call with animation states
    setTimeout(() => {
      setRefreshState('done');
      setChangedAssertions(new Map()); // Changes submitted — reset tracking
      setTimeout(() => setRefreshState('idle'), 2000);
    }, 2500);
  };

  const countBadgeClass = (value: string) => {
    const count = getCount(value);
    if (count === 0) return styles.tabCountZero;
    if (value === 'NULL') return styles.tabCountSuggested;
    if (value === 'ACCEPTED') return styles.tabCountAccepted;
    if (value === 'REJECTED') return styles.tabCountRejected;
    return '';
  };

  const getCount = (value: string) => {
    const tab = filteredData.find((t: any) => t.value === value);
    return tab ? tab.count : 0;
  };

  const activeTabData = filteredData.find((t: any) => t.value === key);

  return (
    <>
      {/* Custom tab bar */}
      <div className={styles.tabsBar}>
        {['NULL', 'ACCEPTED', 'REJECTED'].map((value) => {
          const label = value === 'NULL' ? 'Suggested' : value === 'ACCEPTED' ? 'Accepted' : 'Rejected';
          return (
            <button
              key={value}
              className={key === value ? styles.tabActive : styles.tab}
              onClick={() => onTabChange(value)}
            >
              {label}
              <span className={countBadgeClass(value)}>{getCount(value)}</span>
            </button>
          );
        })}
        <div className={styles.tabSpacer} />
        <div className={styles.tabBarActions}>
          {(netChangedCount > 0 || refreshState !== 'idle') && (
            <button
              className={`${styles.refreshBtn} ${refreshState === 'loading' ? styles.refreshBtnLoading : ''} ${refreshState === 'done' ? styles.refreshBtnDone : ''}`}
              onClick={handleRefresh}
              title="Re-run ReCiter to generate new suggestions"
            >
              <svg
                className={`${styles.refreshIcon} ${refreshState === 'loading' ? styles.refreshIconSpin : ''}`}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="11" height="11"
              >
                {refreshState === 'done'
                  ? <path d="M2 8l4 4 8-8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M13.5 8a5.5 5.5 0 11-1.1-3.3M13.5 2v3h-3" />
                }
              </svg>
              <span className={refreshState === 'loading' ? styles.refreshLabelPulse : ''}>
                {refreshState === 'loading' ? 'Refreshing\u2026' : refreshState === 'done' ? 'Done' : 'Refresh Suggestions'}
              </span>
              {refreshState === 'idle' && netChangedCount > 0 && (
                <span className={styles.unsavedBadge} title={`${netChangedCount} unsaved change(s) will be submitted`}>
                  {netChangedCount}
                </span>
              )}
            </button>
          )}
          {key === 'AddPub' ? (
            <div className={styles.addRecordIndicator}>
              <span className={styles.addRecordPulse} />
              Adding record from PubMed
            </div>
          ) : (
            <button
              className={styles.addRecordBtn}
              onClick={() => onTabChange('AddPub')}
            >
              + Add record via PubMed
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {key === 'AddPub' ? (
        <TabAddPublication
          updatePublicationAssertion={updatePublicationAssertion}
          tabType="AddPub"
          personIdentifier={reciterData.reciter?.personIdentifier}
          pubSearchFilters={pubSearchFilters}
          handleUpdateSearchFilters={handleUpdateSearchFilters}
        />
      ) : activeTabData ? (
        <ReciterTabContent
          key={activeTabData.value}
          tabType={activeTabData.value}
          publications={activeTabData.data}
          index={filteredData.indexOf(activeTabData)}
          personIdentifier={reciterData.reciter?.personIdentifier}
          fullName={fullName}
          updatePublicationAssertion={updatePublicationAssertion}
          updatePublicationAssertionBulk={updatePublicationAssertionBulk}
          isSearchText={isSearchText}
          showEvidenceDefault={showEvidenceDefault}
          activeKey={key}
          totalCount={activeTabData.count}
          onAssertionChange={handleAssertionChange}
          onTabChange={onTabChange}
        />
      ) : null}
    </>
  )
}

export default ReciterTabs;