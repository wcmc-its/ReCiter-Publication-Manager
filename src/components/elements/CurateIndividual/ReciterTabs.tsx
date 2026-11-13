import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { fmtCount } from "../../../utils/curateGroups";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs, Badge } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";
import { useDispatch, useSelector } from "react-redux";
import { buildCoauthorIndex } from "../../../utils/identityEvidence";
import { RootStateOrAny } from "../../../types/redux";
import TabAddPublication from "../TabAddPublication/TabAddPublication";
import TabScopusAuthorships from "./TabScopusAuthorships";
import AllSourcesTab from "./AllSourcesTab";
import AddPublicationDialog from "./AddPublicationDialog";
import { useExternalArticles } from "./useExternalArticles";
import { countWorks, groupExternalWorks } from "../../../utils/allSources";
import { allowedPermissions } from "../../../utils/constants";
import { useSession } from "next-auth/react";
import { clearPubMedData, showEvidenceByDefault, reciterFetchData, pubmedFetchData, reciterUpdatePublication } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import { toReciterArticle } from "../../../utils/toReciterArticle";
import { AddDeepLink } from "../../../utils/externalAddSearch";
import { Button } from "../../ui";


const ReciterTabs = ({ reciterData, fullName, fetchOriginalData, addDeepLink: incomingDeepLink = null, onAddDeepLinkConsumed }: { reciterData: any, fullName: string, fetchOriginalData: any, addDeepLink?: AddDeepLink | null, onAddDeepLinkConsumed?: () => void }) => {
  //default tab; a deep link (parsed by CurateIndividual) opens the PubMed add view (pmid) or
  //All sources with the Add publication dialog searching the DOI (add=external)
  const [key, setKey] = useState(incomingDeepLink?.pmid ? 'AddPub' : incomingDeepLink ? 'AllSources' : 'NULL');
  const dispatch = useDispatch();
  const [filteredData, setFilteredData] = useState([])
  const [pubKey, setPubKey] = useState(false);
  const { data: session, status } = useSession(); const loading = status === "loading";
  const identityData = useSelector((state: RootStateOrAny) => state.identityData)
  // Same source TabAddPublication.tsx uses for the accept request's userID.
  const userId = session?.data?.databaseUser?.userID;
  const isSearchText = useSelector((state: RootStateOrAny) => state.curateSearchtext)
  const showEvidenceDefault = useSelector((state: RootStateOrAny) => state.showEvidenceDefault)
  const coauthorIndex = React.useMemo(() => buildCoauthorIndex(reciterData?.reciter?.reCiterArticleFeatures), [reciterData])
  const [pubSearchFilters, setPubSearchFilters] = useState<any>();
  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)
  // Phase 3a: one Add publication dialog (PubMed / Scopus / OpenAlex / Crossref) in place of
  // the Add publication dropdown. Opened on mount by an add=external deep link.
  const [addOpen, setAddOpen] = useState<boolean>(!!incomingDeepLink && !incomingDeepLink.pmid);
  // Toolbar row above the tab strip: the active tab's filter/sort/view portal into this slot.
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  // Deep link /curate/<uid>?add=external&doi=<doi>[&source=openalex|crossref]: opens the Add
  // publication dialog with the DOI filled in and searched. Copied in on mount; cleared when
  // the dialog closes.
  const [addDeepLink, setAddDeepLink] = useState<AddDeepLink | null>(incomingDeepLink);
  // The person's external (Scopus / OpenAlex / Crossref) works, for the All sources tab and its
  // count and "N to review" pill in the tab strip.
  const ext = useExternalArticles(reciterData?.reciter?.personIdentifier);
  const extCounts = React.useMemo(() => countWorks(groupExternalWorks(ext.rows)), [ext.rows]);

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

  useEffect(() => {
    // Taken: clear the parent's copy so a later remount (e.g. after Refresh Suggestions)
    // does not re-open the Add dialog and search again.
    if (incomingDeepLink) onAddDeepLinkConsumed?.();
    // add=pubmed&pmid=<pmid>: run the PubMed tab's search for it, as the External tab's
    // "Add via PubMed" does; the curator then accepts or rejects it there.
    if (incomingDeepLink?.pmid) handleAddViaPubMed(incomingDeepLink.pmid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const closeAdd = () => {
    setAddOpen(false);
    setAddDeepLink(null);
    // The dialog may have added external works; refresh All sources and its count.
    ext.refetch();
  }

  // Steer an in-PubMed external result to the scored PubMed path: pre-fill the PubMed
  // tab's search with the PMID, switch to it, AND run the search — mirrors
  // TabAddPublication.tsx searchFunction (~358-397) exactly so the Add tab's existing
  // useEffect([pubmedData]) -> filter() renders the result instead of landing on an
  // empty form the curator has to re-search by hand.
  const handleAddViaPubMed = (pmid: number) => runPubMedSearch(String(pmid), '', '')

  // The Add publication dialog's PubMed route (a PMID, or a PubMed author/title search with an
  // optional year range): the same query and date bounds TabAddPublication's searchFunction
  // builds, run in the PubMed add view.
  const runPubMedSearch = (query: string, from: string, to: string) => {
    // All four keys, as searchFunction's own pubFilters: TabAddPublication copies the year
    // keys into state, and undefined years fail its `latestYear >= earliestYear` gate, so
    // every later search on the tab silently did nothing until a page reload.
    setPubSearchFilters({ pubMendSearchText: query, pubMedLatestYear: to, pubMedEarliestYear: from, pubMedshowFiltersCount: true });
    setAddOpen(false);
    setAddDeepLink(null);
    onTabChange('AddPub');
    dispatch(pubmedFetchData({
      "strategy-query": query,
      "start": from ? from + '/01/01' : to ? '1600/01/01' : '',
      "end": to ? to + '/12/31' : from ? '2500/12/31' : '',
      "personIdentifier": reciterData?.reciter?.personIdentifier,
    }));
  }

  // Direct-add (Scopus tab "Add" button): performs EXACTLY the same accept as
  // TabAddPublication.tsx's acceptPublication (build the same goldstandard/feedbacklog
  // request, push the same reCiterArticleFeatures item, update the Accepted tab's
  // filteredData) — but WITHOUT handleAddViaPubMed's tab switch/search, and without
  // touching pubmedData/UpdatePubMadeData (there is no PubMed-tab search list here to
  // prune the accepted item from). userID/identityData below come from the same sources
  // TabAddPublication.tsx reads them from: session.data.databaseUser.userID (this
  // component's own useSession()) and state.identityData (this component's own
  // useSelector, added above alongside userId).
  //
  // Returns a promise that resolves once the PubMed article lookup succeeds and the
  // accept is dispatched, and rejects (with a message) on a non-200/missing-article
  // response from GET /api/reciter/pubmed-article/{pmid}. IMPORTANT: it does NOT reject
  // on a goldstandard write failure — reciterUpdatePublication (redux/actions/actions.js
  // reciterUpdatePublication, ~line 499) fires its own POST to
  // /api/reciter/update/goldstandard and handles success/failure entirely internally
  // (toast + dispatch(addError(...))); the thunk itself returns undefined rather than
  // the fetch promise, so a caller has no way to await or catch that failure. This is
  // pre-existing behaviour identical to acceptPublication in TabAddPublication.tsx,
  // which also never awaits reciterUpdatePublication — a goldstandard failure surfaces
  // only via that thunk's own toast, in both the existing Add-tab flow and here.
  const handleAcceptPmid = (pmid: number, item: any): Promise<void> => {
    return fetch(`/api/reciter/pubmed-article/${pmid}`, {
      credentials: "same-origin",
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: reciterConfig.backendApiKey,
      },
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body.article) {
          throw new Error((body && body.message) || `HTTP ${r.status}`);
        }
        return body.article;
      })
      .then((article) => {
        const newObject = toReciterArticle(article, "ACCEPTED");
        const reCiterArticleFeatures = reciterData?.reciter?.reCiterArticleFeatures;
        const newReciterData = reCiterArticleFeatures && reCiterArticleFeatures.length > 0 ? reCiterArticleFeatures : [];
        newReciterData.push(newObject);

        const request = {
          faculty: identityData,
          publications: [newObject.pmid],
          userAssertion: 'ACCEPTED',
          manuallyAddedFlag: true,
          userID: userId,
          personIdentifier: reciterData?.reciter?.personIdentifier,
        };
        dispatch(reciterUpdatePublication(identityData.uid, request));

        updatePublicationAssertion(newObject, "ACCEPTED", prevTabFor(newObject.pmid));
      });
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

  // Which tab updatePublicationAssertion must take this PMID OUT of, or undefined if it is in
  // none. Needed because the "Same as PMID N" candidates come from ReCiter's own candidate set
  // for this person, so the article is normally ALREADY listed in one of the tabs — and
  // updatePublicationAssertion only removes from the tab matching prevUserAssertion. Passing
  // undefined (correct for the primary Add button, which is gated on the PMID being in no tab)
  // would leave the article listed twice with an inflated count. Tab values are
  // 'NULL' | 'ACCEPTED' | 'REJECTED'; getPmidStatus reports the first of those as 'PENDING'.
  const prevTabFor = (pmid: number): any => {
    const status = getPmidStatus(pmid);
    return status === 'PENDING' ? 'NULL' : status === 'REJECTED' ? 'REJECTED' : undefined;
  }

  // `https://doi.org/`, `http://doi.org/`, and `doi:` are all the same identifier prefixed
  // differently by source — Scopus returns the bare DOI, PubMed/ReCiter sometimes carries one
  // of the URL forms — and case differs between sources too (10.1023/A:... vs 10.1023/a:...).
  const normalizeDoi = (x: any): string =>
    String(x ?? '').trim().toLowerCase().replace(/^(https:\/\/doi\.org\/|http:\/\/doi\.org\/|doi:)/, '');

  // A fetched external doc (Scopus search result) with no PMID of its own, matched against
  // this person's record by DOI or by Scopus document ID instead — scans the same tab lists
  // getPmidStatus does. Lets a PMID-less Scopus doc that is the same paper as an existing
  // record article (rharrington AU-ID 55415053000: 50 of 96 no-pubmed-id docs) be classified
  // exactly like a PMID-bearing in-record doc, rather than always surfacing as "needs review".
  const findRecordPmid = (doc: { doi?: string; articleId?: string }): number | null => {
    const docDoi = doc.doi ? normalizeDoi(doc.doi) : '';
    const docScopusId = doc.articleId ? String(doc.articleId).replace(/^SCOPUS:/, '') : '';
    if (!docDoi && !docScopusId) return null;
    for (const tab of (filteredData as any[])) {
      if (tab.value !== 'NULL' && tab.value !== 'ACCEPTED' && tab.value !== 'REJECTED') continue;
      for (const a of (tab.data || [])) {
        if (a.pmid == null) continue;
        if (docDoi && a.doi && normalizeDoi(a.doi) === docDoi) return Number(a.pmid);
        if (docScopusId && a.scopusDocID != null && String(a.scopusDocID) === docScopusId) return Number(a.pmid);
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

  // Prototype pills: pending suggestions amber, the open tab's count dark, every other count neutral.
  const countBadgeClass = (value: string, count: number) => {
    if (value === 'NULL' && count > 0) return styles.tabCountSuggested;
    return key === value ? styles.tabCountActive : styles.tabCountZero;
  };

  const getCount = (value: string) => {
    const tab = filteredData.find((t: any) => t.value === value);
    return tab ? tab.count : 0;
  };

  const activeTabData = filteredData.find((t: any) => t.value === key);

  // 2g: when the full-size strip doesn't fit on one line, compact it (short counts, tighter
  // tabs, short action labels) before falling back to wrapping. The full width is measured
  // while not compact; the spacer is left out because it only absorbs free space.
  const barRef = useRef<HTMLDivElement>(null);
  const fullW = useRef(0);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const fit = () => {
      if (!compact) {
        const cs = getComputedStyle(bar);
        fullW.current = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
          Array.from(bar.children).reduce((w, c) => w + (c.className === styles.tabSpacer ? 0 : (c as HTMLElement).offsetWidth), 0);
      }
      const next = fullW.current > bar.clientWidth;
      if (next !== compact) setCompact(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(bar);
    return () => ro.disconnect();
  });

  return (
    <>
      {/* One panel, as in the prototype: shaded top (toolbar + folder-tab strip), white body. */}
      <div className={styles.curatePanel}>
      <div className={styles.curateToolbar}>
        <div ref={setToolbarSlot} className={styles.curateToolbarSlot} />
        {(key === 'AddPub' || key === 'ScopusAuth') && (
          <button
            type="button"
            className={styles.addRecordIndicator}
            onClick={() => setAddOpen(true)}
            style={{ cursor: 'pointer' }}
            title="Search another source"
          >
            <span className={styles.addRecordPulse} />
            {key === 'AddPub' ? 'Adding record from PubMed' : 'Searching Scopus by Author ID'}
          </button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add publication
        </Button>
      </div>

      {/* Custom tab bar */}
      <div className={styles.tabsBar} ref={barRef} data-compact={compact || undefined}>
        <span className={styles.tabGroupLabel}>PubMed</span>
        {['NULL', 'ACCEPTED', 'REJECTED'].map((value) => {
          const label = value === 'NULL' ? 'Suggested' : value === 'ACCEPTED' ? 'Accepted' : 'Rejected';
          return (
            <button
              key={value}
              className={key === value ? styles.tabActive : styles.tab}
              onClick={() => onTabChange(value)}
            >
              {label}
              <span className={countBadgeClass(value, getCount(value))} title={compact ? `${getCount(value).toLocaleString()} ${label.toLowerCase()}` : undefined}>{fmtCount(getCount(value), compact)}</span>
            </button>
          );
        })}
        <div className={styles.tabDivider} />
        <span className={styles.tabGroupLabel}>External</span>
        <button
          className={key === 'AllSources' ? styles.tabActive : styles.tab}
          onClick={() => onTabChange('AllSources')}
        >
          All sources
          <span
            className={countBadgeClass('AllSources', extCounts.ACCEPTED)}
            title={`${extCounts.ACCEPTED.toLocaleString()} accepted external works from Scopus, OpenAlex and Crossref`}
          >
            {fmtCount(extCounts.ACCEPTED, compact)}
          </span>
          {extCounts.PENDING > 0 && (
            <span className={styles.tabPend} title={`${extCounts.PENDING} imported work${extCounts.PENDING === 1 ? '' : 's'} waiting for review`}>
              {extCounts.PENDING} {compact ? 'new' : 'to review'}
            </span>
          )}
        </button>
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
              <span>{compact ? 'Refresh' : 'Refresh Suggestions'}</span>
              <span className={styles.unsavedBadge} title={`${netChangedCount} change(s) saved — refresh to regenerate suggestions`}>
                {netChangedCount}
              </span>
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
      ) : key === 'ScopusAuth' ? (
        <TabScopusAuthorships
          personIdentifier={reciterData.reciter?.personIdentifier}
          fullName={fullName}
          onAddViaPubMed={handleAddViaPubMed}
          onAcceptPmid={handleAcceptPmid}
          getPmidStatus={getPmidStatus}
          findRecordPmid={findRecordPmid}
        />
      ) : key === 'AllSources' ? (
        <AllSourcesTab
          ext={ext}
          fullName={fullName}
          onOpenScopusAuthorships={() => onTabChange('ScopusAuth')}
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
          coauthorIndex={coauthorIndex}
          activeKey={key}
          totalCount={activeTabData.count}
          onAssertionChange={handleAssertionChange}
          onTabChange={onTabChange}
          toolbarSlot={toolbarSlot}
          acceptedCount={getCount('ACCEPTED')}
          rejectedCount={getCount('REJECTED')}
          onRefresh={handleRefresh}
        />
      ) : null}
      </div>

      {addOpen && (
        <AddPublicationDialog
          open
          onClose={closeAdd}
          fullName={fullName}
          personIdentifier={reciterData.reciter?.personIdentifier}
          initial={addDeepLink && !addDeepLink.pmid
            ? { query: addDeepLink.doi, source: addDeepLink.source, autoSearch: !!addDeepLink.doi, invalidDoi: addDeepLink.invalidDoi }
            : null}
          onPubMedSearch={runPubMedSearch}
          onAddViaPubMed={(pmid) => { closeAdd(); handleAddViaPubMed(pmid); }}
          onAcceptPmid={handleAcceptPmid}
          getPmidStatus={getPmidStatus}
          findRecordPmid={findRecordPmid}
          onOpenScopusAuthorships={() => { closeAdd(); onTabChange('ScopusAuth'); }}
        />
      )}
    </>
  )
}

export default ReciterTabs;