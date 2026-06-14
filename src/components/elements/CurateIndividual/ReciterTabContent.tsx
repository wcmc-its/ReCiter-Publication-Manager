import React, { useState, useEffect, useRef, useCallback } from "react";
import Publication from "../Publication/Publication";
import FilterPubSection from "./FilterPubSection";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import sortPublications from "../../../utils/sortPublications";
import Pagination from '../Pagination/Pagination';
import { useSession } from "next-auth/client";
import { curateSearchtextAction, reciterUpdatePublication, reciterFetchData } from "../../../redux/actions/actions";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { RootStateOrAny } from "../../../types/redux";
import styles from "./CurateIndividual.module.css";
import CheckIcon from '@mui/icons-material/Check';


interface TabContentProps {
  tabType: string,
  publications: any,
  index: number,
  isSearchText: any,
  personIdentifier: string,
  fullName: string,
  updatePublicationAssertion: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  updatePublicationAssertionBulk: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
  showEvidenceDefault?:any,
  activeKey:any,
  totalCount:any,
  onAssertionChange?: (pmid: number, newAssertion: string) => void,
  onTabChange?: (key: string) => void,
}

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<string>("0")
  const [publications, setPublications] = useState<any>(props.publications);
  const [searchtextCarier, setSearchtextCarier] = useState<any>("");
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(20)
  const [session, loading] = useSession();
  const [totalCount, setTotalCount] = useState<number>(publications.length || 0);
  const dispatch = useDispatch();

  const searchTextUpdate = (searchText: string) => {
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText.trim());
    setPublications(filteredPublications);
    setTotalCount(filteredPublications.length);
    setSearchtextCarier(searchText);
    if (page !== 1) {
      setPage(1);
    }
  }

  const sortUpdate = (sort: string) => {
    setSort(sort);
    let sortedPublications = sortPublications(props.publications, sort);
    setPublications(sortedPublications);
  }

  // Re-sync local publications whenever the parent's filtered list changes (e.g. after an
  // assertion propagates up through ReciterTabs.updatePublicationAssertion).  The parent now
  // produces a new array reference on every update (immutable), so this effect reliably fires.
  // We re-apply any active text filter so the displayed subset stays consistent.
  useEffect(() => {
    const filtered = searchtextCarier
      ? filterPublicationsBySearchText(props.publications, searchtextCarier)
      : props.publications;
    setPublications(filtered);
    setTotalCount(filtered.length);
  }, [props.publications]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update the page
  const handlePaginationUpdate = (page) => {
    setPage(page)
  }

  // Update the count per page
  const handleCountUpdate = (count) => {
    if (count) {
      setPage(1);
      setCount(parseInt(count));
    }
  }

  const getPaginatedData = () => {
    let from = (page - 1) * count;
    let to = from + count;
    let dataList = [];
    if (publications) {
      dataList = publications;
    }
    return dataList.slice(from, to);
  };

  let publicationsPaginatedData = publications.slice((page - 1) * count, page * count);

  var totalNullCount = 0;
  var totalAcceptedCount = 0;
  var totalRejectedCount = 0;

  if(publicationsPaginatedData.length){
    publicationsPaginatedData.map((publication)=>{
      if(publication.userAssertion === "NULL"){
        totalNullCount++
      }else if(publication.userAssertion === "ACCEPTED"){
        totalAcceptedCount++
      }else{
        totalRejectedCount++
      }
    })
  }



  const handleUpdatePublication = (uid: string, pmid: number, userAssertion: string, articleOverride?: any) => {
    const userId = session?.data?.databaseUser?.userID;
    const request = {
      publications: [pmid],
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: uid,
    }

    let SearchInfo = {
      searchedText:searchtextCarier,
      userAssertion:userAssertion
    }
    dispatch(curateSearchtextAction(SearchInfo));

    // Always call the API
    dispatch(reciterUpdatePublication(uid, request));

    // update user assertion of the publication. Prefer an explicitly-passed article
    // (e.g. undo, where the card was already removed from the local list) so the parent
    // always gets a full record to file into the destination queue — never an empty {}.
    let updatedPublication: any = {};
    if (articleOverride) {
      updatedPublication = { ...articleOverride, userAssertion };
    } else {
      let index = publications.findIndex(publication => publication.pmid === pmid);
      if (index > -1) {
        updatedPublication = {
          ...publications[index],
          userAssertion: userAssertion
        };
      }
    }

    // Suggested tab: immediately remove actioned card and track for undo
    if (isSuggested && userAssertion !== 'NULL') {
      const article = publications.find((p: any) => p.pmid === pmid);
      setPublications(prev => prev.filter((p: any) => p.pmid !== pmid));
      lastActioned.current = { pmid, prevState: 'NULL', article };
      fireUndoToast(pmid, userAssertion, article);
    }

    // Update parent filteredData so clearing a filter reflects the change
    props.updatePublicationAssertion(updatedPublication, userAssertion, props.tabType);
    props.onAssertionChange?.(pmid, userAssertion);
  }

  // Toast with an Undo affordance — the rolling queue removes the card on decision,
  // so this is the catchable "you just did X — undo?" line. Reverts via the same path.
  const fireUndoToast = (pmid: number, userAssertion: string, article: any) => {
    const accepted = userAssertion === 'ACCEPTED';
    const title = article?.articleTitle || article?.title || `PMID ${pmid}`;
    const shortTitle = title.length > 60 ? title.slice(0, 60).trim() + '…' : title;
    const toastId = `undo-${pmid}`;
    const doUndo = () => {
      if (isSuggested && article) {
        setPublications((prev: any) =>
          prev.some((p: any) => p.pmid === pmid) ? prev : [...prev, { ...article, userAssertion: 'NULL' }]
        );
      }
      handleUpdatePublication(props.personIdentifier, pmid, 'NULL', article);
      if (lastActioned.current?.pmid === pmid) lastActioned.current = null;
      toast.dismiss(toastId);
    };
    toast(
      <div className={styles.undoToast}>
        <span className={accepted ? styles.undoToastVerbAccept : styles.undoToastVerbReject}>
          {accepted ? 'Accepted' : 'Rejected'}
        </span>
        <span className={styles.undoToastTitle}>{shortTitle}</span>
        <button type="button" className={styles.undoToastBtn} onClick={doUndo}>Undo</button>
      </div>,
      { toastId, autoClose: 6000 }
    );
  };

  const handleUpdatePublicationAll = (userAssertion: string) => {
    const userId = session?.data?.databaseUser?.userID;
    const pmids = getPaginatedData().map((publication) => { return publication.pmid });
    const request = {
      publications: pmids,
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: props.personIdentifier,
    }
    let SearchInfo = {
      searchedText:searchtextCarier,
      userAssertion:userAssertion
    }
    dispatch(curateSearchtextAction(SearchInfo));
    dispatch(reciterUpdatePublication(props.personIdentifier, request));
    //TODO Update publications list in the tab
    let paginatedPublications = getPaginatedData();
    let updatedPublications = [];
    pmids.forEach((pmid) => {
      let updatedPublication = {};
      let index = paginatedPublications.findIndex(publication => publication.pmid === pmid);
      if (index > -1) {
        updatedPublication = {
          ...publications[index],
          userAssertion: userAssertion
        };
        updatedPublications.push(updatedPublication);
      }
    })

    props.updatePublicationAssertionBulk(updatedPublications, userAssertion, props.tabType);
    pmids.forEach((pmid) => props.onAssertionChange?.(pmid, userAssertion));
  }


  // ── Keyboard shortcut state (Suggested tab only) ──
  const isSuggested = props.tabType === 'NULL';
  const isArticleTab = props.tabType === 'NULL' || props.tabType === 'ACCEPTED' || props.tabType === 'REJECTED';
  const [focusedIndex, setFocusedIndex] = useState<number>(isArticleTab ? 0 : -1);
  const lastActioned = useRef<{ pmid: number; prevState: string; article?: any } | null>(null);

  // Find next pending card index from a given start
  const findNextPending = useCallback((startIdx: number, data: any[]) => {
    for (let i = startIdx; i < data.length; i++) {
      if (data[i].userAssertion === 'NULL') return i;
    }
    return -1;
  }, []);

  // Count pending cards
  const pendingCount = publicationsPaginatedData.filter((p: any) => p.userAssertion === 'NULL').length;

  // Keyboard handler
  useEffect(() => {
    if (!isArticleTab) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();
      const focusedPub = publicationsPaginatedData[focusedIndex];

      if (key === 'a' && focusedPub && focusedPub.userAssertion !== 'ACCEPTED') {
        e.preventDefault();
        lastActioned.current = { pmid: focusedPub.pmid, prevState: focusedPub.userAssertion };
        handleUpdatePublication(props.personIdentifier, focusedPub.pmid, 'ACCEPTED');
        if (isSuggested) {
          const next = findNextPending(focusedIndex + 1, publicationsPaginatedData);
          if (next >= 0) setFocusedIndex(next);
        }
      } else if (key === 'r' && focusedPub && focusedPub.userAssertion !== 'REJECTED') {
        e.preventDefault();
        lastActioned.current = { pmid: focusedPub.pmid, prevState: focusedPub.userAssertion };
        handleUpdatePublication(props.personIdentifier, focusedPub.pmid, 'REJECTED');
        if (isSuggested) {
          const next = findNextPending(focusedIndex + 1, publicationsPaginatedData);
          if (next >= 0) setFocusedIndex(next);
        }
      } else if (key === 'u' && lastActioned.current) {
        e.preventDefault();
        const { pmid: undoPmid, prevState, article } = lastActioned.current;
        if (isSuggested && article) {
          setPublications(prev =>
            prev.some((p: any) => p.pmid === undoPmid)
              ? prev
              : [...prev, { ...article, userAssertion: prevState }]
          );
        }
        handleUpdatePublication(props.personIdentifier, undoPmid, prevState, article);
        lastActioned.current = null;
      } else if (key === 'e' && focusedPub) {
        e.preventDefault();
        const el = document.querySelector(`[data-pmid="${focusedPub.pmid}"]`);
        if (el) {
          const btn = el.querySelector('button[data-evidence-toggle]') as HTMLButtonElement;
          if (btn) btn.click();
        }
      } else if (key === 'arrowdown') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, publicationsPaginatedData.length - 1));
      } else if (key === 'arrowup') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isArticleTab, isSuggested, focusedIndex, publicationsPaginatedData, props.personIdentifier]);

  // Scroll focused card into view
  useEffect(() => {
    if (!isArticleTab || focusedIndex < 0) return;
    const focusedPub = publicationsPaginatedData[focusedIndex];
    if (!focusedPub) return;
    const el = document.querySelector(`[data-pmid="${focusedPub.pmid}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedIndex, isArticleTab]);

  // Close the keyboard-shortcuts popover on click outside or Escape
  useEffect(() => {
    if (!showShortcuts) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showShortcuts]);

  if (!props.publications.length) {
    if (props.tabType === 'NULL') {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconGreen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round" width="22" height="22"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div className={styles.emptyTitle}>All caught up</div>
          <div className={styles.emptyBody}>There are no new suggested publications to review. ReCiter will surface new suggestions the next time the system runs.</div>
          <div className={styles.emptyActions}>
            <button className={styles.emptyActionPrimary} onClick={() => dispatch(reciterFetchData(props.personIdentifier, true))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M13.5 8a5.5 5.5 0 11-1.1-3.3M13.5 2v3h-3"/></svg>
              Run ReCiter now
            </button>
            <button className={styles.emptyActionSecondary} onClick={() => props.onTabChange?.('ACCEPTED')}>
              View accepted publications
            </button>
          </div>
        </div>
      );
    }
    if (props.tabType === 'ACCEPTED') {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconMuted}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" strokeLinecap="round" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 8h4"/></svg>
          </div>
          <div className={styles.emptyTitle}>No accepted publications yet</div>
          <div className={styles.emptyBody}>Publications you accept will appear here. Review the suggested tab to get started.</div>
          <div className={styles.emptyActions}>
            <button className={styles.emptyActionPrimary} onClick={() => props.onTabChange?.('NULL')}>
              Go to Suggested
            </button>
          </div>
        </div>
      );
    }
    if (props.tabType === 'REJECTED') {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconMuted}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" strokeLinecap="round" width="22" height="22"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          </div>
          <div className={styles.emptyTitle}>No rejected publications</div>
          <div className={styles.emptyBody}>Publications you reject will be recorded here. You can undo a rejection at any time.</div>
          <div className={styles.emptyActions}>
            <button className={styles.emptyActionSecondary} onClick={() => props.onTabChange?.('NULL')}>
              Go to Suggested
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center" style={{padding: '40px'}}>
        <p>No articles found</p>
      </div>
    )
  }

  return (
    <>
      <FilterPubSection
        searchTextUpdate={searchTextUpdate}
        sortUpdate={sortUpdate}
        publications={publications}
        updateAll={handleUpdatePublicationAll}
        tabType={props.tabType}
        isSearchText={props.isSearchText}
        page={page}
        count={count}
        totalCount={totalCount}
        handlePaginationUpdate={handlePaginationUpdate}
        handleCountUpdate={handleCountUpdate}
      />

      {/* Keyboard shortcuts — behind a quiet "?" popover (handlers stay active regardless) */}
      {isArticleTab && (
        <div className={styles.kbdHintRow}>
          <div className={styles.kbdHintWrap} ref={shortcutsRef}>
            <button
              type="button"
              className={styles.kbdHintBtn}
              aria-label="Keyboard shortcuts"
              aria-expanded={showShortcuts}
              onClick={() => setShowShortcuts((v) => !v)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13"><circle cx="8" cy="8" r="6.5"/><path d="M6.3 6.2a1.7 1.7 0 113 .9c-.7.5-1.3.8-1.3 1.6M8 11.4v.05" strokeLinecap="round"/></svg>
              Keyboard shortcuts
            </button>
            {showShortcuts && (
              <div className={styles.kbdHintPopover}>
                <span><span className={styles.kbd}>A</span> Accept</span>
                <span><span className={styles.kbd}>R</span> Reject</span>
                <span><span className={styles.kbd}>U</span> Undo last</span>
                <span><span className={styles.kbd}>E</span> Toggle evidence</span>
                <span><span className={styles.kbd}>&uarr;</span><span className={styles.kbd}>&darr;</span> Navigate</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.articleList}>
        {publicationsPaginatedData.map((publication: any, index: number) => {
          return (
            <Publication
              key={publication.pmid}
              index={`page${page}${index+1}`}
              reciterArticle={publication}
              personIdentifier={props.personIdentifier}
              fullName={props.fullName}
              updatePublication={handleUpdatePublication}
              activekey={props.activeKey}
              totalCount={props.totalCount}
              showEvidenceDefault={props.showEvidenceDefault}
              page={page}
              paginatedPubsCount={publication.userAssertion === "NULL" ? totalNullCount : publication.userAssertion === "ACCEPTED" ? totalAcceptedCount : totalRejectedCount}
              isFocused={isArticleTab && index === focusedIndex}
              onCardMouseDown={() => { if (isArticleTab) setFocusedIndex(index); }}
            />
          )
        })}
      </div>

      {/* All caught up state */}
      {isSuggested && pendingCount === 0 && publicationsPaginatedData.length > 0 && (
        <div className={styles.allDone}>
          <div className={styles.allDoneCheck}><CheckIcon /></div>
          <p><strong>All caught up!</strong></p>
          <p>No pending suggestions remaining on this page.</p>
        </div>
      )}
    </>
  )
}

export default ReciterTabContent