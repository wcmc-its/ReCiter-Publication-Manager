import React, { useEffect, useState, useRef } from "react";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs, Badge } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import TabAddPublication from "../TabAddPublication/TabAddPublication";
import TabAddExternalPublication from "./TabAddExternalPublication";
import TabScopusAuthorships from "./TabScopusAuthorships";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
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
  const [pubSearchFilters, setPubSearchFilters] = useState<any>();
  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)
  // Single "+ Add publication" dropdown (PubMed / OpenAlex / …) — keeps the tab-bar
  // compact as more external sources (Scopus, WoS) are added.
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);

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
    { name: 'External', value: 'External', allowedRoleNames: ["Superuser","Curator_Self","Curator_All"] },
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

  // Steer an in-PubMed external result to the scored PubMed path: pre-fill the PubMed
  // tab's search with the PMID and switch to it, so the curator accepts it as evidence.
  const handleAddViaPubMed = (pmid: number) => {
    setPubSearchFilters({ pubMendSearchText: String(pmid) });
    onTabChange('AddPub');
  }

  // Current status of a PMID in this person's record, to annotate external search
  // results: ACCEPTED / REJECTED / PENDING (suggested), or null if not in the record.
  const getPmidStatus = (pmid: number): 'ACCEPTED' | 'REJECTED' | 'PENDING' | null => {
    if (!pmid) return null;
    for (const tab of (filteredData as any[])) {
      if (tab.value !== 'NULL' && tab.value !== 'ACCEPTED' && tab.value !== 'REJECTED') continue;
      if ((tab.data || []).some((a: any) => Number(a.pmid) === Number(pmid))) {
        return tab.value === 'NULL' ? 'PENDING' : tab.value;
      }
    }
    return null;
  }

  // Re-run ReCiter for this person. Accept/reject already persist per-click via the
  // goldstandard write, so this just triggers a fresh feature-generator analysis
  // (analysisRefreshFlag=true). While it runs, reciterFetching flips true and
  // CurateIndividual shows its "Loading publications…" skeleton; the tabs remount
  // with the new suggestions (and reset change tracking) on completion.
  const handleRefresh = () => {
    if (reciterFetching) return;
    const uid = reciterData?.reciter?.personIdentifier;
    if (uid) dispatch(reciterFetchData(uid, true));
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
          {netChangedCount > 0 && (
            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              title="Re-run ReCiter to generate new suggestions"
            >
              <svg
                className={styles.refreshIcon}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="11" height="11"
              >
                <path d="M13.5 8a5.5 5.5 0 11-1.1-3.3M13.5 2v3h-3" />
              </svg>
              <span>Refresh Suggestions</span>
              <span className={styles.unsavedBadge} title={`${netChangedCount} change(s) saved — refresh to regenerate suggestions`}>
                {netChangedCount}
              </span>
            </button>
          )}
          {(key === 'AddPub' || key === 'External' || key === 'ScopusAuth') ? (
            <div
              className={styles.addRecordIndicator}
              onClick={(e) => setAddMenuAnchor(e.currentTarget)}
              style={{ cursor: 'pointer' }}
              title="Switch add source"
            >
              <span className={styles.addRecordPulse} />
              {key === 'AddPub' ? 'Adding record from PubMed' : key === 'External' ? 'Adding record from OpenAlex' : 'Scopus'}
              <span style={{ marginLeft: 4 }}>&#9662;</span>
            </div>
          ) : (
            <button
              className={styles.addRecordBtn}
              onClick={(e) => setAddMenuAnchor(e.currentTarget)}
            >
              + Add publication &#9662;
            </button>
          )}
          <Menu
            anchorEl={addMenuAnchor}
            open={Boolean(addMenuAnchor)}
            onClose={() => setAddMenuAnchor(null)}
            MenuListProps={{ dense: true }}
          >
            <MenuItem
              selected={key === 'AddPub'}
              onClick={() => { setAddMenuAnchor(null); onTabChange('AddPub'); }}
              sx={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              PubMed
            </MenuItem>
            <MenuItem
              selected={key === 'External'}
              onClick={() => { setAddMenuAnchor(null); onTabChange('External'); }}
              sx={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              OpenAlex
            </MenuItem>
            <MenuItem
              selected={key === 'ScopusAuth'}
              onClick={() => { setAddMenuAnchor(null); onTabChange('ScopusAuth'); }}
              sx={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              Scopus
            </MenuItem>
          </Menu>
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
      ) : key === 'External' ? (
        <TabAddExternalPublication
          personIdentifier={reciterData.reciter?.personIdentifier}
          onAddViaPubMed={handleAddViaPubMed}
          getPmidStatus={getPmidStatus}
        />
      ) : key === 'ScopusAuth' ? (
        <TabScopusAuthorships
          personIdentifier={reciterData.reciter?.personIdentifier}
          fullName={fullName}
          onAddViaPubMed={handleAddViaPubMed}
          getPmidStatus={getPmidStatus}
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