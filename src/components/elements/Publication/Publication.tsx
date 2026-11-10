import React, { useState, useEffect, useRef, FunctionComponent } from "react"
import styles from './Publication.module.css';
import {} from "react-bootstrap";
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/Author';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { Sheet, Button as Btn } from "../../ui";
import { showEvidenceByDefault } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import { toast } from "react-toastify";
import Popover from "@mui/material/Popover";
import { buildEvidenceRows, determineMatchType, MATCH_COLORS as matchColors, knownCoauthorsOf, identityChips, tallyOf, affiliationParts, chipDetail } from "../../../utils/identityEvidence";
import type { CoauthorIndex } from "../../../utils/identityEvidence";
import { BANDS, BAND_NOTES, bandOf } from "../../../utils/curateGroups";

const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
const doiUrl = 'https://doi.org/';

// Friendly labels for ReCiter ArticleProvenance fields (src = source, rs = retrieval strategy).
// Unmapped values fall back to a cleaned raw value, so nothing is ever hidden.
const PROV_SOURCE_LABELS: Record<string, string> = {
  GS: 'Gold standard',
  PM: 'Publication Manager',
  CTSC: 'CTSC',
  MAN: 'Manual',
  MAN_FROM_PM: 'Manual (via Publication Manager)',
  MAN_FROM_CTSC: 'Manual (via CTSC)',
};
// ArticleProvenance.rs stores either a legacy short code (FNI, EMAIL, …) or the
// full retrieval-strategy class name (FirstNameInitialRetrievalStrategy, …),
// depending on when the row was written. Map both forms to one spelled-out label.
const PROV_STRATEGY_LABELS: Record<string, string> = {
  // legacy short codes (production data)
  FNI: 'First-name initial',
  SI: 'Second initial',
  FN: 'Full name',
  EMAIL: 'Email',
  ORC: 'ORCID',
  AFF: 'Affiliation',
  AFFD: 'Affiliation (in database)',
  DEP: 'Department',
  REL: 'Known relationship',
  GR: 'Grant',
  GS: 'Gold standard',
  // full strategy class names (current ReCiter)
  FirstNameInitialRetrievalStrategy: 'First-name initial',
  SecondInitialRetrievalStrategy: 'Second initial',
  FullNameRetrievalStrategy: 'Full name',
  EmailRetrievalStrategy: 'Email',
  OrcidRetrievalStrategy: 'ORCID',
  AffiliationRetrievalStrategy: 'Affiliation',
  AffiliationInDbRetrievalStrategy: 'Affiliation (in database)',
  DepartmentRetrievalStrategy: 'Department',
  KnownRelationshipRetrievalStrategy: 'Known relationship',
  GrantRetrievalStrategy: 'Grant',
  GoldStandardRetrievalStrategy: 'Gold standard',
};
const friendlyProvSource = (v?: string | null): string | null =>
  v ? (PROV_SOURCE_LABELS[v] || v) : null;
const friendlyProvStrategy = (v?: string | null): string | null =>
  v ? (PROV_STRATEGY_LABELS[v] || v.replace(/RetrievalStrategy$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()) : null;

const CopyButton = ({ label, value }: { label: string, value: string | number }) => (
  <button
    type="button"
    className={styles.copyBtn}
    title={`Copy ${label}`}
    aria-label={`Copy ${label}`}
    onClick={(e) => {
      e.stopPropagation();
      const done = () => toast(`Copied ${label} ${value}`);
      const fail = () => toast.error(`Couldn't copy ${label}`);
      navigator.clipboard ? navigator.clipboard.writeText(String(value)).then(done, fail) : fail();
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
  </button>
);

const CHIP_SYM = { match: '\u2713', partial: '~', mismatch: '\u2715', nodata: '?', info: '\u2022' };

//TEMP: update to required
interface FuncProps {
    onAccept?(pmid: number, id: number): void,
    onReject?(pmid: number, id: number): void,
    onUndo?(pmid: number, id: number): void,
    updatePublication?(uid: string, pmid: number, userAssertion: string): void,
    item?: any,
    faculty?: any,
    reciterArticle: any,
    index: any,
    personIdentifier: string,
    fullName: string,
    paginatedPubsCount?:any,
    activekey?:any,
    totalCount?:any,
    page?:any,
    actionSource?:any,
    countPendingArticles?:any,
    maxArticlesPerPerson?:any,
    showEvidenceDefault?:any,
    isFocused?: boolean,
    coauthorIndex?: CoauthorIndex,
    onCardMouseDown?: () => void,
    detail?: boolean,
}

const Publication: FunctionComponent<FuncProps> = (props) => {
    const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)
    const [showEvidence, setShowEvidence] = useState<boolean>(false)
    const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false)
    const [showZeroWeight, setShowZeroWeight] = useState<boolean>(false)
    const [chipOpen, setChipOpen] = useState<{ label: string, el: HTMLElement } | null>(null)

    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [showCurationLog, setShowCurationLog] = useState<boolean>(false)
    const [expandedPubIndex, setExpandedPubIndex] = useState<any>(props.showEvidenceDefault ? props.showEvidenceDefault : null)

    const maxArticlesPerPerson = reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams.maxArticlesPerPerson;
    const dispatch = useDispatch();

    const formatClogDate = (timestamp: string | Date) => {
      const d = new Date(timestamp);
      // Include time-of-day (seconds included) so rapid same-day actions -- e.g. a
      // curator clicking through several accept/reject/undo actions within seconds --
      // remain distinguishable in the history list, instead of collapsing onto one
      // calendar-date-only entry.
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    const toogleEvidence = (pubExpEvidenceNumber) => {
      let expandedPubNumber = parseInt(pubExpEvidenceNumber.slice(5));

      if(props.actionSource === "curateAll"){
        if(expandedPubNumber == maxArticlesPerPerson) setExpandedPubIndex(`page${props.page}${(expandedPubNumber - 1)}`);
        else setExpandedPubIndex(pubExpEvidenceNumber);
      }else {
      let allPaginatedPubsCount = props.paginatedPubsCount;
      let totalRecordsInTab = props.totalCount;
      if(allPaginatedPubsCount > expandedPubNumber){
        setExpandedPubIndex(pubExpEvidenceNumber);
      } else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount != totalRecordsInTab){
        setExpandedPubIndex(pubExpEvidenceNumber);
      }else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount === totalRecordsInTab && allPaginatedPubsCount != 1 && expandedPubNumber != 1){
        setExpandedPubIndex(`page${props.page}${(expandedPubNumber - 1)}`);
      }else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount === 1 && expandedPubNumber === 1){
        setExpandedPubIndex(null);
      }else{
        setExpandedPubIndex(null);
      }
    }
      setShowEvidence((showEvidence)?false:true)
    }

    const acceptPublication = ( pmid: number, index: number ) => {
      props.onAccept(pmid, index);
    }

    const rejectPublication = (pmid: number, index: number) => {
      props.onReject(pmid, index)
    }

    const undoPublication = (pmid: number, index: number) => {
      props.onUndo(pmid, index)
    }

    const Author = ({author, index, count} : {
      author: Author,
      index: number,
      count: number,
    }) => {
      let authorFullName: string = '';
      if (author.firstName) {
        authorFullName += author.firstName + " ";
      }
      if (author.lastName) {
        authorFullName += author.lastName;
      }

      return <li key={"author" + index}><span className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}</span>{(index < count - 1)?", ":""}</li>
    }

    const AuthorsList = ({ authors } : {
      authors: Author[]
    }) => {
      return (
        <ul className={styles.listInline}>
          {
            authors && authors.map((author, i) => <Author author={author} key={i} index={i} count={authors.length}></Author>  )
          }
        </ul>
      )
    }

    const displayAuthors = (authors: Author[]) => {
      let authCount = authors.length;
      if ( authCount > 0) {
        if ( authCount <= 7 || expandedAuthors) {
          return (<AuthorsList authors={authors}></AuthorsList>)
      } else {
        let authorsDefaultDisplay = authors.slice(0, 6);
        let lastAuthor = authors[authCount - 1];

        return (
          <>
            <AuthorsList authors={authorsDefaultDisplay}></AuthorsList>
            <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
            <ul className={styles.listInline}>
              <Author author={lastAuthor} index={authCount - 1} count={authCount}></Author>
            </ul>
          </>
        )
      }
    } else return (
        <span>No authors listed</span>
      )
    }

    const { item } = props;

    const { reciterArticle } = props;
    const clogEntries = feedbacklog[reciterArticle.pmid] || [];
    const hasProvenance = !!(reciterArticle.firstRetrievalDate || reciterArticle.retrievalStrategy || reciterArticle.retrievalSource);

    const CardFooter = ({pmid, userAssertion} : {
      pmid: number,
      userAssertion: string
    }) => {
      const evDefault = expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault;
      switch (userAssertion) {
        case "NULL" :
          return (
            <div className={styles.cardActions}>
              <button
                className={styles.btnAccept}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(evDefault))}}
              ><CheckIcon style={{fontSize:16}}/> Accept <span className={styles.keyHint}>A</span>
              </button>
              <button
                className={styles.btnReject}
                onClick={() =>{ props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(evDefault))}}
              ><ClearIcon style={{fontSize:16}}/> Reject <span className={styles.keyHint}>R</span>
              </button>
            </div>
          )
        case "ACCEPTED" :
          if (props.activekey === 'NULL') {
            return (
              <div className={`${styles.cardActions} ${styles.cardActionsActioned}`}>
                <button
                  className={styles.btnUndo}
                  onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                  Accepted — Undo
                </button>
              </div>
            );
          }
          return (
            <div className={styles.cardActions}>
              <button
                className={styles.btnUndo}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                Undo
              </button>
              <button
                className={styles.btnReject}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(evDefault)); }}
              ><ClearIcon style={{fontSize:16}}/> Reject
              </button>
            </div>
          );
        case "REJECTED" :
          if (props.activekey === 'NULL') {
            return (
              <div className={`${styles.cardActions} ${styles.cardActionsActioned}`}>
                <button
                  className={styles.btnUndo}
                  onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                  Rejected — Undo
                </button>
              </div>
            );
          }
          return (
            <div className={styles.cardActions}>
              <button
                className={styles.btnAccept}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(evDefault)); }}
              ><CheckIcon style={{fontSize:16}}/> Accept
              </button>
              <button
                className={styles.btnUndo}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                Undo
              </button>
            </div>
          );
        default:
          return null;
      }
    }


    const getTagClass = (tag: string): string => {
      const lower = tag.toLowerCase();
      if (['scopus', 'affiliation', 'co-investigator', 'org unit'].includes(lower)) {
        return styles.evTagOrg;
      }
      if (['pubmed', 'journal category'].includes(lower)) {
        return styles.evTagPub;
      }
      return styles.evTagDept;
    };

    const TableCellWithTypes = (props: any) => {
      return(
        <>
          {props.list.map((item, index) => {
            const hasPubmedTag = item.tags.some((t: string) => t.toLowerCase() === 'pubmed');
            return (
              <p key={index} className={hasPubmedTag && props.list.length > 1 ? styles.dataSub : undefined}>
                {item.name}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.urlName} ↗</a>}
                {
                  item.tags.map((tag, index) => {
                    return (
                      <span className={getTagClass(tag)} key={index}>{tag}</span>
                    )
                  })
                }
              </p>
            )
          })}
        </>
      )
    }


    const matchIcons: Record<string, JSX.Element> = {
      match: <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="9" height="9"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>,
      partial: <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="9" height="9"><path d="M5 2v4M5 7.5v.5"/></svg>,
      mismatch: <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="9" height="9"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>,
      nodata: <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" width="9" height="9"><path d="M2 5h6"/></svg>,
    };

    const formatEvidenceTable = (evidence: any) => {
        const evidenceTableRows = buildEvidenceRows(evidence)

        const visibleRows = evidenceTableRows.filter((r: any) => Number(r.points) !== 0);
        const zeroRows = evidenceTableRows.filter((r: any) => Number(r.points) === 0);
        const rowsToRender = showZeroWeight ? evidenceTableRows : visibleRows;
        const maxAbsPoints = Math.max(...evidenceTableRows.map((r: any) => Math.abs(Number(r.points) || 0)), 1);

        const IdentityRow = ({ evidenceRow, idx }: { evidenceRow: any; idx: number }) => {
          const mt = determineMatchType(evidenceRow.name, evidenceRow.points, evidence);
          const mc = matchColors[mt];
          const ptsNum = Number(evidenceRow.points) || 0;
          const barPct = Math.min((Math.abs(ptsNum) / maxAbsPoints) * 100, 100);
          return (
            <div className={styles.identityRow} key={idx}>
              <div className={styles.identityStrip} style={{ background: mc.border }} />
              <div className={styles.identityEvidence}>
                <div className={styles.evNameRow}>
                  <span className={styles.matchIconCircle} style={{ background: mc.bg, color: mc.border }}>{matchIcons[mt]}</span>
                  <span className={styles.evName}>{evidenceRow.title}</span>
                  {evidenceRow.source && <a href={evidenceRow.source} target="_blank" rel="noreferrer" className={styles.sourceLink}>(source)</a>}
                </div>
                {evidenceRow.pointsText ? (
                  <div style={{ fontSize: '10.5px', color: 'var(--gray-400)', marginTop: 2 }}>{evidenceRow.pointsText}</div>
                ) : (
                  <div className={styles.evPointsRow}>
                    <span className={ptsNum === 0 ? styles.pointsValueZero : styles.pointsValue}>
                      {ptsNum !== 0 ? ptsNum.toFixed(2) : '0.00'} pts
                    </span>
                    <div className={styles.miniBar}><div className={styles.miniBarFill} style={{ width: `${barPct}%`, background: mc.border }} /></div>
                  </div>
                )}
              </div>
              {evidenceRow.spanData ? (
                <div className={styles.identityDataSpan}>
                  {evidenceRow.displayInstDataList ? <TableCellWithTypes list={evidenceRow.institutionalDataList} /> : (evidenceRow.institutionalData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.institutionalData}</span>)}
                </div>
              ) : (
                <>
                  <div className={styles.identityData}>
                    {evidenceRow.displayInstDataList ? <TableCellWithTypes list={evidenceRow.institutionalDataList} /> : (evidenceRow.institutionalData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.institutionalData}</span>)}
                  </div>
                  <div className={styles.identityData}>
                    {evidenceRow.displayArticleDataList ? <TableCellWithTypes list={evidenceRow.articleDataList} /> : (evidenceRow.articleData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.articleData}</span>)}
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <>
            {/* Color legend bar */}
            <div className={styles.legendBar}>
              <div className={styles.evidenceLegend}>
                {Object.entries(matchColors).map(([key, mc]) => (
                  <span className={styles.legendItem} key={key}>
                    <span className={styles.legendDot} style={{ background: mc.border }} />
                    {mc.label}
                  </span>
                ))}
              </div>
            </div>
            {/* Table header */}
            <div className={`${styles.identityRow} ${styles.identityHeaderRow}`}>
              <div style={{ padding: 0 }} />
              <div className={styles.identityEvidence}>Evidence</div>
              <div className={styles.identityData}>Institutional Data</div>
              <div className={styles.identityData}>Article Data</div>
            </div>
            {/* Rows */}
            {rowsToRender.map((evidenceRow: any, idx: number) => (
              <IdentityRow evidenceRow={evidenceRow} idx={idx} key={idx} />
            ))}
            {/* Zero-weight toggle */}
            {zeroRows.length > 0 && (
              <button className={styles.zeroToggle} onClick={() => setShowZeroWeight(!showZeroWeight)}>
                {showZeroWeight
                  ? 'Hide zero-weight factors'
                  : `Show ${zeroRows.length} zero-weight factor${zeroRows.length > 1 ? 's' : ''} (${zeroRows.map((r: any) => r.title).join(', ')})`
                }
              </button>
            )}
          </>
        );
    }

const formatFeedbackLabel = (key: string): string => {
  return key
    .replace('feedbackScore', '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace('Orcid', 'ORCID')
    .replace('Co Author Name:', 'Co-Author Name')
    .replace('Co Author', 'Co-Author')
    .replace('Journal Sub Field', 'Journal Subfield');
};

const displayFeedbackEvidence = (feedbackEvidence: Record<string, number>): JSX.Element => {
  const sortedFeedback = feedbackEvidence && Object.entries(feedbackEvidence)
    .map(([key, value]) => [formatFeedbackLabel(key), Math.round(value as number)] as [string, number])
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return (
    <div className={styles.feedbackChart}>
      <div className={styles.chartAxisHeader}>
        <div />
        <span className={styles.chartAxisNeg}>&larr; Negative</span>
        <div />
        <span className={styles.chartAxisPos}>Positive &rarr;</span>
        <span className={styles.chartScale}>Scale: &plusmn;100</span>
      </div>
      {sortedFeedback?.map(([label, value], i) => {
        const absVal = Math.abs(value);
        const isOverflow = absVal > 100;
        const isDominant = isOverflow;
        const barWidth = Math.min(absVal, 100);
        return (
          <div className={`${styles.chartRow} ${isDominant ? styles.chartRowDominant : ''}`} key={i}>
            <div className={`${styles.chartLabel} ${isDominant ? styles.chartLabelDominant : ''}`}>
              <span className={styles.chartLabelText}>{label}</span>
              <span className={`${styles.chartVal} ${isDominant ? styles.chartValDominant : value < 0 ? styles.chartValNeg : styles.chartValPos}`}>
                {value < 0 ? `\u2212${absVal}` : value}{isOverflow && <span className={styles.chartValOverflowMarker}> »</span>}
              </span>
            </div>
            <div className={styles.chartBarNeg}>
              {value < 0 && <div className={`${styles.barNeg} ${isDominant ? styles.barDominant : ''} ${isOverflow ? styles.barOverflow : ''}`} style={{ width: `${barWidth}%` }} />}
            </div>
            <div className={styles.chartCenterLine} />
            <div className={styles.chartBarPos}>
              {value > 0 && <div className={`${styles.barPos} ${isDominant ? styles.barDominant : ''} ${isOverflow ? styles.barOverflow : ''}`} style={{ width: `${barWidth}%` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

    const rawScore = reciterArticle.authorshipLikelihoodScore ?? null;
    const score = rawScore !== null ? Math.round(rawScore) : null;
    const scoreNum = typeof score === 'number' ? score : 0;
    const pipClass = scoreNum >= 70 ? styles.scoreHigh : scoreNum >= 40 ? styles.scoreMedium : styles.scoreLow;
    const userAssertion = reciterArticle.userAssertion;
    const isActioned = userAssertion === 'ACCEPTED' || userAssertion === 'REJECTED';
    const isActionedInSuggested = props.activekey === 'NULL' && isActioned;
    const evDefault = expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault;
    const coauthors = knownCoauthorsOf(reciterArticle, props.coauthorIndex);
    const idChips = identityChips(reciterArticle.evidence, coauthors);
    const tally = tallyOf(idChips);
    const tallyBase = (tally.match + tally.partial + tally.mismatch) || 1;
    const affil = affiliationParts(reciterArticle.evidence);
    // Shared by the card and the Detail pane (#1102).
    const chipList = (<>
                  <ul className={styles.idChips} aria-label="Identity evidence summary">
                    {idChips.map((c) => (
                      <li key={c.label}>
                        <button
                          type="button"
                          className={styles.idChip}
                          data-kind={c.kind}
                          title={c.tip}
                          aria-haspopup="dialog"
                          aria-expanded={chipOpen?.label === c.label}
                          onClick={(e) => { e.stopPropagation(); setChipOpen({ label: c.label, el: e.currentTarget }); }}
                        >
                          <span className={styles.idChipSym} aria-hidden="true">{CHIP_SYM[c.kind]}</span>
                          {c.label}
                          <span className={styles.srOnly}>: {matchColors[c.kind].label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {/* Drill-down: opens upward over the card (portal, so nothing shifts); Escape or click away closes and returns focus to the chip */}
                  <Popover
                    open={!!chipOpen}
                    anchorEl={chipOpen?.el}
                    onClose={() => setChipOpen(null)}
                    anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    PaperProps={{ role: 'dialog', 'aria-label': `${chipOpen?.label} evidence`, className: styles.chipPop }}
                  >
                    <div className={styles.chipPopHead}>{chipOpen?.label}</div>
                    <ul className={styles.chipPopLines}>
                      {chipOpen && chipDetail(reciterArticle.evidence, chipOpen.label, coauthors).map((l, i) => (
                        <li key={i}>
                          <span className={styles.idChipSym} data-kind={l.kind} aria-hidden="true">{CHIP_SYM[l.kind]}</span>
                          <span>
                            {l.text}
                            {l.sub && <span className={styles.chipPopSub}>{l.sub}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Popover>
    </>);
    const tallyEl = (
                  <span className={styles.idTally}>
                    <span className={styles.idTallyBar} aria-hidden="true">
                      <span data-kind="match" style={{ width: `${(100 * tally.match) / tallyBase}%` }} />
                      <span data-kind="partial" style={{ width: `${(100 * tally.partial) / tallyBase}%` }} />
                      <span data-kind="mismatch" style={{ width: `${(100 * tally.mismatch) / tallyBase}%` }} />
                    </span>
                    {tally.text}
                  </span>
    );
    const linksLeft = (
                <div className={styles.articleLinksLeft}>
                  <span>PMID: <a href={`${pubMedUrl}${reciterArticle.pmid}`} target="_blank" rel="noreferrer">{reciterArticle.pmid}</a><CopyButton label="PMID" value={reciterArticle.pmid} /></span>
                  {reciterArticle.doi && <span><a href={`${doiUrl}${reciterArticle.doi}`} target="_blank" rel="noreferrer">DOI ↗</a><CopyButton label="DOI" value={reciterArticle.doi} /></span>}
                  {(hasProvenance || clogEntries.length > 0) && (
                    <span className={styles.curationWrap}>
                      <button className={styles.evidenceBtn} onClick={(e) => { e.stopPropagation(); setShowCurationLog(!showCurationLog); }}>History</button>
                      <Sheet open={showCurationLog} onClose={() => setShowCurationLog(false)} title="History" description={`PMID ${reciterArticle.pmid}`}>
                        <div className={styles.curationLogSheet}>
                          <div className={styles.clogHead}>Provenance</div>
                          {hasProvenance ? (
                            <div className={styles.provBlock}>
                              {reciterArticle.firstRetrievalDate && (
                                <div className={styles.provRow}><span className={styles.provLabel}>First retrieved</span><span className={styles.provValue}>{reciterArticle.firstRetrievalDate}</span></div>
                              )}
                              {reciterArticle.retrievalStrategy && (
                                <div className={styles.provRow}><span className={styles.provLabel}>Strategy</span><span className={styles.provValue}>{friendlyProvStrategy(reciterArticle.retrievalStrategy)}</span></div>
                              )}
                              {reciterArticle.retrievalSource && (
                                <div className={styles.provRow}><span className={styles.provLabel}>Source</span><span className={styles.provValue}>{friendlyProvSource(reciterArticle.retrievalSource)}</span></div>
                              )}
                            </div>
                          ) : (
                            <div className={styles.clogEmpty}>Retrieval details unavailable</div>
                          )}
                          <div className={styles.clogHead}>Curation history</div>
                          {clogEntries.length > 0 ? (
                            clogEntries.map((entry: any, i: number) => {
                              const action = entry.feedback === 'ACCEPTED' ? 'accepted' : entry.feedback === 'REJECTED' ? 'rejected' : 'undone';
                              const verb = entry.feedback === 'ACCEPTED' ? 'Accepted' : entry.feedback === 'REJECTED' ? 'Rejected' : 'Suggested';
                              const who = entry.curatorName || entry.actorPersonIdentifier || 'Unknown';
                              const date = entry.modifyTimestamp ? formatClogDate(entry.modifyTimestamp) : '';
                              return (
                                <div className={styles.clogEntry} key={entry.feedbackID || i}>
                                  <div className={styles.clogAction}>
                                    <div className={`${styles.clogDot} ${action === 'accepted' ? styles.clogDotAccepted : action === 'rejected' ? styles.clogDotRejected : styles.clogDotUndone}`} />
                                    <span className={`${styles.clogVerb} ${action === 'accepted' ? styles.clogVerbAccepted : action === 'rejected' ? styles.clogVerbRejected : styles.clogVerbUndone}`}>{verb}</span>
                                    <span className={styles.clogWho}>{who}</span>
                                  </div>
                                  <span className={styles.clogDate}>{date}</span>
                                </div>
                              );
                            })
                          ) : (
                            // A curated article with no FeedbackLog rows was accepted/rejected
                            // before per-action history was logged (rows only go back so far).
                            // Say so honestly rather than imply it was never curated; the real
                            // curator/date for those pre-logging actions was never recorded.
                            <div className={styles.clogEmpty}>
                              {userAssertion === 'ACCEPTED'
                                ? 'Accepted before curation history was recorded'
                                : userAssertion === 'REJECTED'
                                ? 'Rejected before curation history was recorded'
                                : 'No curation events yet'}
                            </div>
                          )}
                        </div>
                      </Sheet>
                    </span>
                  )}
                </div>
    );
    const band = bandOf(reciterArticle);
    const evOpen = props.detail ? !showEvidence : (props.index === props.showEvidenceDefault || showEvidence);

    return (
      <div className={`${styles.articleCard}${props.isFocused ? ` ${styles.focused}` : ''}${isActionedInSuggested ? ` ${styles.actionedCard}` : ''}`} data-pmid={reciterArticle.pmid} onMouseDown={props.onCardMouseDown}>
        {/* Status strip for accepted/rejected */}
        {userAssertion === 'ACCEPTED' && <div className={styles.statusStripAccepted} />}
        {userAssertion === 'REJECTED' && <div className={styles.statusStripRejected} />}

        {/* Main content column */}
        <div className={styles.cardMain}>
          <div className={styles.cardTop}>
            {/* Content area */}
            <div className={styles.cardContent}>
              {props.detail ? (<>
                <div className={styles.detailKicker}>
                  {reciterArticle.publicationType?.publicationTypeCanonical && <span className={styles.typeBadge}>{reciterArticle.publicationType.publicationTypeCanonical}</span>}
                  <span>{[reciterArticle.journalTitleVerbose, reciterArticle.publicationDateDisplay].filter(Boolean).join(' \u00B7 ')}</span>
                </div>
                <h2 className={styles.detailTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml((reciterArticle as any).articleTitleRTF || reciterArticle.articleTitle) }} />
              </>) : (
              <div className={styles.titleRow}>
                <span className={styles.scoreTip}>
                  <span className={scoreNum >= 70 ? styles.scoreInlineHigh : scoreNum >= 40 ? styles.scoreInlineMedium : styles.scoreInlineLow}>
                    {score !== null ? score : "N/A"}
                  </span>
                  {score !== null && (
                    <span className={styles.scoreTooltip}>
                      <span className={styles.stRow}>
                        <span className={styles.stLabel}>Score</span>
                        <span className={scoreNum >= 70 ? styles.stValGreen : scoreNum >= 40 ? styles.stValAmber : styles.stValMuted}>{rawScore !== null ? Number(rawScore).toFixed(2) : scoreNum}</span>
                      </span>
                      <span className={styles.stRow}>
                        <span className={styles.stLabel}>Tier</span>
                        <span className={scoreNum >= 70 ? styles.stValGreen : scoreNum >= 40 ? styles.stValAmber : styles.stValMuted}>
                          {scoreNum >= 70 ? 'Strong match' : scoreNum >= 40 ? 'Moderate match' : 'Weak match'}
                        </span>
                      </span>
                    </span>
                  )}
                </span>
                <div className={styles.articleTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml((reciterArticle as any).articleTitleRTF || reciterArticle.articleTitle) }} />
              </div>
            )}
              <div className={`${styles.articleAuthors}${props.detail ? ` ${styles.detailAuthors}` : ''}`}>
                {reciterArticle.reCiterArticleAuthorFeatures?.length > 0 &&
                  displayAuthors(reciterArticle.reCiterArticleAuthorFeatures)}
              </div>
              {affil && (
                <div className={styles.rawAffiliation} title="Affiliation statement from PubMed">
                  {affil.pre}{affil.hit && <mark>{affil.hit}</mark>}{affil.post}
                </div>
              )}
              {coauthors && coauthors.hits.length > 0 && (
                <div className={styles.knownCoauthors}>
                  Known co-authors: {coauthors.hits.join(', ')}
                </div>
              )}
              {props.detail ? (<>
                <div className={styles.articleLinks}>{linksLeft}</div>
                <div className={styles.detailActions}>
                  {!isActionedInSuggested && userAssertion !== 'ACCEPTED' && (
                    <Btn variant="primary" onClick={() => { props.updatePublication(props.personIdentifier, reciterArticle.pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(evDefault)); }}>
                      <CheckIcon style={{fontSize:16}}/> Accept <span className={styles.detailKbd}>A</span>
                    </Btn>
                  )}
                  {userAssertion !== 'NULL' && (
                    <Btn variant="secondary" onClick={() => { props.updatePublication(props.personIdentifier, reciterArticle.pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}>
                      <UndoIcon style={{fontSize:16}}/> {isActionedInSuggested ? `${userAssertion === 'ACCEPTED' ? 'Accepted' : 'Rejected'} \u2014 Undo` : 'Undo'}
                    </Btn>
                  )}
                  {!isActionedInSuggested && userAssertion !== 'REJECTED' && (
                    <Btn variant="secondary" onClick={() => { props.updatePublication(props.personIdentifier, reciterArticle.pmid, 'REJECTED'); dispatch(showEvidenceByDefault(evDefault)); }}>
                      <ClearIcon style={{fontSize:16}}/> Reject <span className={styles.detailKbd}>R</span>
                    </Btn>
                  )}
                </div>
                <div className={styles.detailEvidence}>
                  {reciterArticle.evidence !== undefined && (
                    <button type="button" className={styles.detailEvHead} data-evidence-toggle aria-expanded={evOpen} onClick={() => setShowEvidence((v) => !v)}>
                      <span className={styles.detailEvTitle}>Supporting evidence</span>
                      <span className={styles.detailKbdKey}>E</span>
                      <span className={styles.detailEvToggle}>
                        {evOpen ? 'Summary only' : 'Details'}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${evOpen ? 90 : 0}deg)` }}><path d="m9 18 6-6-6-6" /></svg>
                      </span>
                    </button>
                  )}
                  <div className={styles.detailSummary}>
                    <div className={styles.detailScore}>{score !== null ? score : 'N/A'}</div>
                    {score !== null && (
                      <div className={styles.detailVerdict}>
                        <strong>{BANDS.find((b) => b.key === band)?.label}</strong>
                        <span>{BAND_NOTES[band]}</span>
                      </div>
                    )}
                    {idChips.length > 0 && tallyEl}
                  </div>
                  {idChips.length > 0 && <div className={styles.idSummary}>{chipList}</div>}
                </div>
              </>) : (<>
              <div className={styles.articleMeta}>
                <span>{reciterArticle.journalTitleVerbose}</span>
                {reciterArticle.publicationDateDisplay && <span>{reciterArticle.publicationDateDisplay}</span>}
                {reciterArticle.publicationType?.publicationTypeCanonical &&
                  <span>
                    <span className={styles.typeBadge}>{reciterArticle.publicationType.publicationTypeCanonical}</span>
                  </span>
                }
              </div>
              {idChips.length > 0 && (
                <div className={styles.idSummary}>
                  {chipList}
                  {tallyEl}
                </div>
              )}
              <div className={styles.articleLinks}>
                {linksLeft}
                {reciterArticle.evidence !== undefined && (
                  <button className={styles.evidenceBtnPrimary} data-evidence-toggle onClick={() => toogleEvidence(props.index)}>
                    Supporting evidence
                  </button>
                )}
              </div>
              </>)}

              {/* Evidence panel */}
              {reciterArticle.evidence !== undefined && (
                <div className={`${styles.publicationShowEvidenceContainer} ${evOpen ? styles.publicationShowEvidenceContainerOpen : ""}`}>

                  {/* Feedback-based scores panel */}
                  <div className={`${styles.sectionPanel}${props.detail ? ` ${styles.detailCard}` : ''}`}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitleGroup}>
                        <span className={styles.sectionTitle}>{props.detail ? 'Feedback scores' : 'Feedback-based scores'}</span>
                        {props.detail
                          ? <span className={styles.detailLegend}>{'\u2212'} against {'\u00B7'} for +</span>
                          : <span className={styles.sectionSubtitle}>Scores learned from curation history</span>}
                      </div>
                      <div className={styles.learnMoreWrap}>
                        <div className={styles.learnMoreBtn}>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5" strokeLinecap="round"/></svg>
                          Learn more
                        </div>
                        <div className={styles.learnMorePopover}>
                          <p>Based on attributes from articles you&apos;ve previously accepted or rejected, we&apos;ve generated the following feedback-based scores for <strong>{props.fullName}.</strong> Each subscore represents the contribution of a specific attribute to the overall likelihood that the article was authored by <strong>{props.fullName}.</strong></p>
                          <p>A score of <strong>100</strong> for an attribute indicates strong evidence supporting authorship, while a score of <strong>&minus;100</strong> suggests strong evidence against it. Scores closer to 0 represent attributes that provide less definitive evidence.</p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.sectionBody}>
                      {reciterArticle.evidence.feedbackEvidence && Object.keys(reciterArticle.evidence.feedbackEvidence).length > 0
                        ? displayFeedbackEvidence(reciterArticle.evidence.feedbackEvidence)
                        : <p style={{color:'var(--gray-400)', fontStyle:'italic', margin:'0'}}>No feedback available.</p>
                      }
                    </div>
                  </div>

                  {/* Identity-based scores panel */}
                  <div className={styles.sectionPanel}>
                    <div className={styles.sectionHeader} style={{borderBottom: 'none'}}>
                      <div className={styles.sectionTitleGroup}>
                        <span className={styles.sectionTitle}>Identity-based scores</span>
                        <span className={styles.sectionSubtitle}>Comparison of institutional profile data against article metadata</span>
                      </div>
                    </div>
                    <div className={styles.identityTable}>
                      {formatEvidenceTable(reciterArticle.evidence)}
                    </div>
                  </div>

                </div>
              )}

              {/* Action buttons (inside card-content, per mockup) */}
              {!props.detail && <CardFooter pmid={reciterArticle.pmid} userAssertion={userAssertion} />}
            </div>
          </div>
        </div>


      </div>
    );
}

export default Publication;
