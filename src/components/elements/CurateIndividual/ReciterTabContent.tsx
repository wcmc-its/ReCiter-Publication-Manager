import React, { useState, useEffect, useRef, useCallback } from "react";
import type { CoauthorIndex } from "../../../utils/identityEvidence";
import Publication from "../Publication/Publication";
import FilterPubSection from "./FilterPubSection";
import DuplicatesBanner from "./DuplicatesBanner";
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import sortPublications from "../../../utils/sortPublications";
import Pagination from '../Pagination/Pagination';
import { useSession } from "next-auth/react";
import { curateSearchtextAction, reciterUpdatePublication } from "../../../redux/actions/actions";
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import styles from "./CurateIndividual.module.css";
import CheckIcon from '@mui/icons-material/Check';
import { Dialog, Button } from "../../ui";
import { showUndoToast } from "../ToastHost/ToastHost";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import { BANDS, groupModeFor, groupKeyOf, groupsOf, yearHistogram, spotCheckSample, scoreOf, yearOf } from "../../../utils/curateGroups";
import type { Band } from "../../../utils/curateGroups";
import { useNextPerson } from "../../../hooks/useNextPerson";
import { useRouter } from "next/router";


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
  coauthorIndex?: CoauthorIndex,
  activeKey:any,
  totalCount:any,
  onAssertionChange?: (pmid: number, newAssertion: string) => void,
  onTabChange?: (key: string) => void,
  acceptedCount?: number,
  rejectedCount?: number,
}

const LIST_CHUNK = 50;
// Remembered view (Cards or Detail), per browser. ponytail: one key; add more prefs when asked.
const VIEW_KEY = 'pm.curate.view';

const ReciterTabContent: React.FC<TabContentProps> = (props) => {
  const [sort, setSort] = useState<string>("0")
  const [publications, setPublications] = useState<any>(props.publications);
  const [searchtextCarier, setSearchtextCarier] = useState<any>("");

  // Progressive list: render a window that grows by LIST_CHUNK as the sentinel nears the
  // viewport. ponytail: never shrinks, so a fully scrolled 2,000-card tab keeps 2,000 cards
  // mounted; switch to real virtualization if that measures slow.
  const page = 1
  const [visible, setVisible] = useState(LIST_CHUNK)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { data: session, status } = useSession(); const loading = status === "loading";
  const [totalCount, setTotalCount] = useState<number>(publications.length || 0);
  const dispatch = useDispatch();
  const router = useRouter();
  const { next, goNext, markCaughtUp } = useNextPerson();
  const caughtUp = props.tabType === 'NULL' && !props.publications.length;
  // Nothing left in Suggested: drop this person out of the "Next" cycle.
  useEffect(() => { if (caughtUp) markCaughtUp(); }, [caughtUp, markCaughtUp]);

  const searchTextUpdate = (searchText: string) => {
    let filteredPublications = filterPublicationsBySearchText(props.publications, searchText.trim());
    setPublications(filteredPublications);
    setTotalCount(filteredPublications.length);
    setSearchtextCarier(searchText);
    setVisible(LIST_CHUNK);
  }

  const sortUpdate = (sort: string) => {
    setSort(sort);
    let sortedPublications = sortPublications(props.publications, sort);
    setPublications(sortedPublications);
    setVisible(LIST_CHUNK);
  }

  // Grouping (bands on long Suggested lists sorted by score, years on long Accepted/Rejected
  // lists sorted by date). Collapsed groups keep their header and drop out of the window.
  const mode = groupModeFor(props.tabType, sort, publications.length);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  // Groups must be contiguous, so grouped modes sort a copy by the active key (default "0" = score).
  const ordered = mode === 'flat' ? publications : sortPublications([...publications], sort);
  const openList = mode === 'flat' ? publications : ordered.filter((p: any) => !closed[groupKeyOf(mode, p)]);
  const groups = groupsOf(mode, ordered);
  const hist = mode === 'year' ? yearHistogram(publications) : [];
  const pendingJump = useRef<string | null>(null);

  let publicationsPaginatedData = openList.slice(0, visible);

  const jumpToYear = (year: string) => {
    const nextClosed = { ...closed, [year]: false };
    const idx = ordered.filter((p: any) => !nextClosed[yearOf(p)]).findIndex((p: any) => yearOf(p) === year);
    if (idx < 0) return;
    setClosed(nextClosed);
    setVisible((v) => Math.max(v, idx + LIST_CHUNK));
    pendingJump.current = year;
  };
  useEffect(() => {
    if (!pendingJump.current) return;
    const el = document.querySelector(`[data-year-head="${pendingJump.current}"]`) as HTMLElement | null;
    pendingJump.current = null;
    if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= openList.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + LIST_CHUNK);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, openList.length]);

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



  const handleUpdatePublication = (uid: string, pmid: number, userAssertion: string) => {
    // Suggested tab: keep card in place with actioned visual state
    if (isSuggested) {
      setPublications(prev => prev.map((p: any) =>
        p.pmid === pmid ? { ...p, userAssertion } : p
      ));
      if (userAssertion !== 'NULL') {
        lastActioned.current = { pmid, prevState: 'NULL' };
      }
      props.onAssertionChange?.(pmid, userAssertion);
      // ...and persist it. The card deliberately stays put here, but the accept/reject
      // still has to reach the goldstandard. Without this the action lived only in local
      // state and was silently discarded by the next Refresh/re-run — nothing was saved.
      dispatch(reciterUpdatePublication(uid, {
        publications: [pmid],
        userAssertion: userAssertion,
        manuallyAddedFlag: false,
        userID: session?.data?.databaseUser?.userID,
        personIdentifier: uid,
      }));
      return;
    }

    const userId = session?.data?.databaseUser?.userID;
    const request = {
      publications: [pmid],
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: userId,
      personIdentifier: uid,
    }
    // TODO: send request

    let SearchInfo = {
      searchedText:searchtextCarier,
      userAssertion:userAssertion
    }
    dispatch(curateSearchtextAction(SearchInfo));

    dispatch(reciterUpdatePublication(uid, request));

    // update user assertion of the publication
    let updatedPublication = {};
    let index = publications.findIndex(publication => publication.pmid === pmid);
    if (index > -1) {
      updatedPublication = {
        ...publications[index],
        userAssertion: userAssertion
      };
    }

    // move updated data to the right Tab
    props.updatePublicationAssertion(updatedPublication, userAssertion, props.tabType);
    props.onAssertionChange?.(pmid, userAssertion);
  }

  // Suggested tab: cards stay in place with an actioned look; the change is persisted at once.
  const applySuggested = (pmids: number[], userAssertion: string) => {
    if (!pmids.length) return;
    const set = new Set(pmids);
    pmids.forEach((pmid) => props.onAssertionChange?.(pmid, userAssertion));
    setPublications(prev => prev.map((p: any) => set.has(p.pmid) ? { ...p, userAssertion } : p));
    dispatch(reciterUpdatePublication(props.personIdentifier, {
      publications: pmids,
      userAssertion: userAssertion,
      manuallyAddedFlag: false,
      userID: session?.data?.databaseUser?.userID,
      personIdentifier: props.personIdentifier,
    }));
  };

  // Per-band bulk (Suggested): accept the strong band or reject the weak band after a spot-check
  // of the records likeliest to be wrong. Only still-pending records are touched, so Undo is exact.
  const [bandBulk, setBandBulk] = useState<{ band: Band, verb: 'ACCEPTED' | 'REJECTED', excl: Record<number, boolean> } | null>(null);
  const bandPending = (band: string) => publications.filter((p: any) => groupKeyOf('band', p) === band && p.userAssertion === 'NULL');
  const bulkItems = bandBulk ? bandPending(bandBulk.band) : [];
  const bulkSample = bandBulk ? spotCheckSample(bulkItems, bandBulk.verb) : [];
  const bulkPmids = bulkItems.filter((p: any) => !bandBulk?.excl[p.pmid]).map((p: any) => p.pmid);
  const confirmBandBulk = () => {
    if (!bandBulk) return;
    const { verb } = bandBulk;
    const pmids = bulkPmids;
    setBandBulk(null);
    applySuggested(pmids, verb);
    if (pmids.length) {
      showUndoToast(`${verb === 'ACCEPTED' ? 'Accepted' : 'Rejected'} ${pmids.length} publication${pmids.length === 1 ? '' : 's'}`, () => applySuggested(pmids, 'NULL'));
    }
  };

  const handleUpdatePublicationAll = (userAssertion: string) => {
    // Suggested tab: keep cards in place with actioned visual state
    if (isSuggested) {
      applySuggested(publications.map((p: any) => p.pmid), userAssertion);
      return;
    }

    const userId = session?.data?.databaseUser?.userID;
    const pmids = publications.map((publication) => { return publication.pmid });
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
    let updatedPublications = [];
    pmids.forEach((pmid) => {
      let updatedPublication = {};
      let index = publications.findIndex(publication => publication.pmid === pmid);
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
  const lastActioned = useRef<{ pmid: number; prevState: string } | null>(null);

  // Find next pending card index from a given start
  const findNextPending = useCallback((startIdx: number, data: any[]) => {
    for (let i = startIdx; i < data.length; i++) {
      if (data[i].userAssertion === 'NULL') return i;
    }
    return -1;
  }, []);

  // Detail (split) view: a sticky list on the left, the focused record in full on the right.
  const [view, setView] = useState<'cards' | 'detail'>('cards');
  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === 'detail') setView('detail'); } catch {} }, []);
  const chooseView = (v: 'cards' | 'detail') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };
  const split = isArticleTab && view === 'detail';
  const detailIdx = Math.min(Math.max(focusedIndex, 0), publicationsPaginatedData.length - 1);
  const detailPub = split ? publicationsPaginatedData[detailIdx] : undefined;
  // Acting in the pane on Suggested moves on to the next pending record, like the A/R keys.
  const updateFromDetail = (uid: string, pmid: number, userAssertion: string) => {
    handleUpdatePublication(uid, pmid, userAssertion);
    if (isSuggested && userAssertion !== 'NULL') {
      const next = findNextPending(detailIdx + 1, publicationsPaginatedData);
      if (next >= 0) setFocusedIndex(next);
    }
  };

  // Count pending cards
  const pendingCount = publicationsPaginatedData.filter((p: any) => p.userAssertion === 'NULL').length;

  // Keyboard handler
  useEffect(() => {
    if (!isArticleTab) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      // An open Dialog/Sheet (profile, history, ...) owns the keyboard.
      if (document.querySelector('[role="dialog"]')) return;

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
        handleUpdatePublication(props.personIdentifier, lastActioned.current.pmid, lastActioned.current.prevState);
        const undoneIdx = publicationsPaginatedData.findIndex((p: any) => p.pmid === lastActioned.current.pmid);
        if (undoneIdx >= 0) setFocusedIndex(undoneIdx);
        lastActioned.current = null;
      } else if (key === 'e' && focusedPub) {
        e.preventDefault();
        // In Detail view the list row shares the data-pmid; the toggle is in the pane's card.
        const btn = document.querySelector(`[data-pmid="${focusedPub.pmid}"] button[data-evidence-toggle]`) as HTMLButtonElement | null;
        if (btn) btn.click();
      } else if (key === 'arrowdown') {
        e.preventDefault();
        // Keyboard can walk past the rendered window: grow it before focus reaches the end.
        const next = Math.min(focusedIndex + 1, openList.length - 1);
        if (next >= visible - 5) setVisible(v => v + LIST_CHUNK);
        setFocusedIndex(next);
      } else if (key === 'arrowup') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isArticleTab, isSuggested, focusedIndex, publicationsPaginatedData, props.personIdentifier, visible, openList.length]);

  // Scroll focused card into view
  useEffect(() => {
    if (!isArticleTab || focusedIndex < 0) return;
    const focusedPub = publicationsPaginatedData[focusedIndex];
    if (!focusedPub) return;
    const el = document.querySelector(`[data-pmid="${focusedPub.pmid}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedIndex, isArticleTab]);

  // Cards, with group headers interleaved. Stops at the end of the rendered window (the sentinel
  // brings in more), except that headers of collapsed groups still render.
  const renderRows = (card: (p: any, index: number) => React.ReactNode) => {
    if (mode === 'flat') return publicationsPaginatedData.map(card);
    const rows: React.ReactNode[] = [];
    let i = 0;
    for (const g of groups) {
      if (i >= publicationsPaginatedData.length && publicationsPaginatedData.length < openList.length) break;
      const isClosed = !!closed[g.key];
      const band = mode === 'band' ? BANDS.find((b) => b.key === g.key) : undefined;
      const pending = isSuggested && band && band.key !== 'moderate' ? bandPending(band.key).length : 0;
      rows.push(
        <div key={`h-${g.key}`} className={styles.groupHead} data-band={band?.key}>
          <button
            type="button"
            className={styles.groupToggle}
            aria-expanded={!isClosed}
            data-year-head={mode === 'year' ? g.key : undefined}
            onClick={() => setClosed((c) => ({ ...c, [g.key]: !c[g.key] }))}
          >
            <span className={styles.groupChevron} aria-hidden="true">{'\u203A'}</span>
            {band && <span className={styles.groupDot} aria-hidden="true" />}
            <span className={styles.groupLabel}>{band ? band.label : g.key}</span>
            <span className={styles.groupCount}>{g.count.toLocaleString()}{band ? ` \u00B7 ${band.range}` : ` publication${g.count === 1 ? '' : 's'}`}</span>
          </button>
          {pending > 0 && (
            <button
              type="button"
              className={band!.key === 'strong' ? styles.groupBulkAccept : styles.groupBulkReject}
              onClick={() => setBandBulk({ band: band!.key, verb: band!.key === 'strong' ? 'ACCEPTED' : 'REJECTED', excl: {} })}
            >
              {band!.key === 'strong' ? 'Accept' : 'Reject'} all {pending}{'\u2026'}
            </button>
          )}
        </div>
      );
      if (!isClosed) {
        while (i < publicationsPaginatedData.length && groupKeyOf(mode, publicationsPaginatedData[i]) === g.key) {
          rows.push(card(publicationsPaginatedData[i], i));
          i++;
        }
      }
    }
    return rows;
  };

  if (!props.publications.length) {
    if (props.tabType === 'NULL') {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>All caught up</div>
          <div className={styles.emptyBody}>
            No suggested publications for {props.fullName?.trim().split(' ')[0] || 'this person'}. {(props.acceptedCount ?? 0).toLocaleString()} accepted, {(props.rejectedCount ?? 0).toLocaleString()} rejected.
          </div>
          <div className={styles.emptyActions}>
            {next && (
              <Button variant="primary" onClick={goNext}>
                Next: {next.name} · {next.pending.toLocaleString()} pending
              </Button>
            )}
            <Button variant="secondary" onClick={() => router.push('/search')}>
              Back to people
            </Button>
            <Button variant="ghost">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M13.5 8a5.5 5.5 0 11-1.1-3.3M13.5 2v3h-3"/></svg>
              Run ReCiter now
            </Button>
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
        totalCount={totalCount}
      />

      {props.tabType === 'ACCEPTED' && <DuplicatesBanner uid={props.personIdentifier} accepted={props.publications} />}

      {/* Keyboard hint bar — Suggested tab only */}
      {isArticleTab && (
        <div className={styles.kbdHint}>
          <span><span className={styles.kbd}>A</span> Accept</span>
          <span><span className={styles.kbd}>R</span> Reject</span>
          <span><span className={styles.kbd}>U</span> Undo last</span>
          <span><span className={styles.kbd}>E</span> Toggle Evidence</span>
          <span><span className={styles.kbd}>&uarr;</span><span className={styles.kbd}>&darr;</span> Navigate</span>
          <div className={styles.viewSwitch} role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'cards'} onClick={() => chooseView('cards')}>Cards</button>
            <button type="button" aria-pressed={view === 'detail'} onClick={() => chooseView('detail')}>Detail</button>
          </div>
        </div>
      )}

      {hist.length > 1 && (
        <div className={styles.yearHist} role="group" aria-label="Publications by year">
          <span className={styles.yearHistEnd}>{hist[0].year}</span>
          <div className={styles.yearHistBars}>
            {hist.map((h) => (
              <button
                type="button"
                key={h.year}
                className={styles.yearHistBar}
                title={`${h.year}: ${h.count} publication${h.count === 1 ? '' : 's'}`}
                aria-label={`${h.year}: ${h.count} publication${h.count === 1 ? '' : 's'}`}
                disabled={!h.count}
                onClick={() => jumpToYear(String(h.year))}
              >
                <span style={{ height: h.count ? Math.max(3, Math.round((h.count / Math.max(...hist.map((x) => x.count))) * 30)) : 1 }} />
              </button>
            ))}
          </div>
          <span className={styles.yearHistEnd}>{hist[hist.length - 1].year}</span>
        </div>
      )}

      {split ? (
        <div className={styles.split}>
          <div className={styles.splitList} aria-label="Publications">
            {renderRows((p: any, index: number) => (
              <button
                type="button"
                key={p.pmid}
                data-pmid={p.pmid}
                data-state={p.userAssertion}
                className={styles.splitRow}
                aria-current={index === detailIdx ? 'true' : undefined}
                onClick={() => setFocusedIndex(index)}
              >
                <span className={styles.splitScore}>{scoreOf(p)}</span>
                <span className={styles.splitText}>
                  <span className={styles.splitTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(p.articleTitleRTF || p.articleTitle) }} />
                  <span className={styles.splitMeta}>{p.journalTitleVerbose} · {yearOf(p)}</span>
                </span>
              </button>
            ))}
            {visible < openList.length && <div ref={sentinelRef} className={styles.listSentinel} aria-hidden="true" />}
          </div>
          <div className={styles.splitDetail}>
            {detailPub && (
              <Publication
                key={detailPub.pmid}
                index="detail"
                reciterArticle={detailPub}
                personIdentifier={props.personIdentifier}
                fullName={props.fullName}
                updatePublication={updateFromDetail}
                activekey={props.activeKey}
                totalCount={props.totalCount}
                showEvidenceDefault="detail"
                coauthorIndex={props.coauthorIndex}
                page={page}
                paginatedPubsCount={detailPub.userAssertion === "NULL" ? totalNullCount : detailPub.userAssertion === "ACCEPTED" ? totalAcceptedCount : totalRejectedCount}
              />
            )}
          </div>
        </div>
      ) : (<>
      <div className={styles.articleList}>
        {renderRows((publication: any, index: number) => {
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
              coauthorIndex={props.coauthorIndex}
              page={page}
              paginatedPubsCount={publication.userAssertion === "NULL" ? totalNullCount : publication.userAssertion === "ACCEPTED" ? totalAcceptedCount : totalRejectedCount}
              isFocused={isArticleTab && index === focusedIndex}
              onCardMouseDown={() => { if (isArticleTab) setFocusedIndex(index); }}
            />
          )
        })}
      </div>
      {visible < openList.length && <div ref={sentinelRef} className={styles.listSentinel} aria-hidden="true" />}
      </>)}

      <Dialog
        open={!!bandBulk}
        onClose={() => setBandBulk(null)}
        width={600}
        title={bandBulk ? `${bandBulk.verb === 'ACCEPTED' ? 'Accept' : 'Reject'} ${bulkPmids.length} ${bandBulk.band === 'strong' ? 'strong' : 'weak'}-match suggestion${bulkPmids.length === 1 ? '' : 's'}?` : ''}
        description={bandBulk ? (bandBulk.verb === 'ACCEPTED'
          ? `Spot-check first. These are the ${bulkSample.length} lowest-scoring in the band, where mistakes are likeliest. Exclude any that look wrong; they stay in Suggested.`
          : `Spot-check first. These are the ${bulkSample.length} highest-scoring in the band, the likeliest to be real. Exclude any that should stay; they remain in Suggested.`) : ''}
        footer={<>
          <Button variant="ghost" onClick={() => setBandBulk(null)}>Cancel</Button>
          <Button variant={bandBulk?.verb === 'REJECTED' ? 'danger' : 'primary'} disabled={!bulkPmids.length} onClick={confirmBandBulk}>
            {bandBulk?.verb === 'REJECTED' ? 'Reject' : 'Accept'} {bulkPmids.length}
          </Button>
        </>}
      >
        <ul className={styles.spotList}>
          {bulkSample.map((p: any) => {
            const ex = !!bandBulk?.excl[p.pmid];
            return (
              <li key={p.pmid} className={ex ? styles.spotExcluded : undefined}>
                <span className={styles.spotScore}>{scoreOf(p)}</span>
                <span className={styles.spotText}>
                  <span className={styles.spotTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(p.articleTitleRTF || p.articleTitle) }} />
                  <span className={styles.spotMeta}>{p.journalTitleVerbose} · {yearOf(p)} · PMID {p.pmid}</span>
                </span>
                <Button size="sm" variant="ghost" aria-pressed={ex} onClick={() => setBandBulk((b) => b && ({ ...b, excl: { ...b.excl, [p.pmid]: !ex } }))}>
                  {ex ? 'Include' : 'Exclude'}
                </Button>
              </li>
            );
          })}
        </ul>
        {bulkItems.length > bulkSample.length && <p className={styles.spotMore}>+ {bulkItems.length - bulkSample.length} more not shown</p>}
      </Dialog>

      {/* All caught up state */}
      {isSuggested && pendingCount === 0 && publicationsPaginatedData.length > 0 && (
        <div className={styles.allDone}>
          <div className={styles.allDoneCheck}><CheckIcon /></div>
          <p><strong>All caught up!</strong></p>
          <p>No pending suggestions remaining.</p>
        </div>
      )}
    </>
  )
}

export default ReciterTabContent