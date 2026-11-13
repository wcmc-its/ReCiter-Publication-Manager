import React, { useState, FormEvent, useEffect } from "react";
import { createPortal } from "react-dom";
import { Publication } from "../../../../types/publication";
import styles from "./CurateIndividual.module.css";
import { Dialog, Button, Input, Select } from '../../ui';

interface FilterPubSectionProps {
  searchTextUpdate: (searchText: string) => void
  sortUpdate: (sort: string) => void
  publications: Array<Publication>
  updateAll: any
  tabType: string
  isSearchText: any
  totalCount?: number
  sort: string
  // Toolbar row above the tab strip (owned by ReciterTabs); filter, sort and view render there.
  toolbarSlot?: HTMLElement | null
  view?: 'cards' | 'detail'
  onViewChange?: (view: 'cards' | 'detail') => void
  // Detail view: the list header (count, bulk actions, hide-list caret) renders at the top of
  // the list pane instead of across the page. null = pane not mounted (or hidden): no header.
  inSplit?: boolean
  listHeaderSlot?: HTMLElement | null
  onHideList?: () => void
}

const SORT_OPTIONS = [
  { value: '1', label: 'Highest score' },
  { value: '3', label: 'Lowest score' },
  { value: '2', label: 'Newest' },
  { value: '4', label: 'Oldest' },
];
const LIST_NOUN: Record<string, string> = { NULL: 'suggested', ACCEPTED: 'accepted', REJECTED: 'rejected' };

const BULK_CONFIRM = 20;

const FilterPubSection: React.FC<FilterPubSectionProps> = (props) => {
  const [searchText, setSearchText] = useState<any>(props.isSearchText.searchedText);

  const [confirm, setConfirm] = useState<string | null>(null);

  const handleInputChange = (e: any) => {
    setSearchText(e.target.value);
    props.searchTextUpdate(e.target.value);
  }

  // A one-line input drops pasted newlines, which would glue a pasted PMID/DOI list into one
  // token; turn them into spaces instead.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLInputElement;
    const next = el.value.slice(0, el.selectionStart ?? el.value.length) + text.trim().replace(/\s*[\r\n]+\s*/g, ' ') + el.value.slice(el.selectionEnd ?? el.value.length);
    handleInputChange({ target: { value: next } });
  }

  const handleSortChange = (e: string) => {
    props.sortUpdate(e);
  }

  useEffect(() => {
    const { searchedText, userAssertion } = props.isSearchText;
    // if (userAssertion === props.tabType) setSearchText(searchedText);
    if (searchedText){
      props.searchTextUpdate(searchedText);
    } 
  }, [props.isSearchText])

  // Bulk actions cover every record in the (filtered) list, not just what has rendered so far.
  // More than BULK_CONFIRM at once asks first.
  const n = props.publications.length;
  const updateAll = (userAssertion: string) => {
    if (n > BULK_CONFIRM && !confirm) { setConfirm(userAssertion); return; }
    setConfirm(null);
    props.updateAll(userAssertion);
  }
  const verb = (a: string | null) => a === 'ACCEPTED' ? 'Accept' : a === 'REJECTED' ? 'Reject' : 'Undo';

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }


  const toolbar = (
    <>
      <form onSubmit={handleFormSubmit} className={styles.toolbarFilter}>
        <Input
          fullWidth
          placeholder="Filter by title, author, journal, DOI, or PMID(s)"
          value={searchText}
          onChange={handleInputChange}
          inputProps={{ onPaste: handlePaste, 'aria-label': 'Filter, or paste PMIDs and DOIs', title: 'Filter by text, or paste a list of PMIDs, DOIs or their URLs' }}
          sx={{ fontSize: 13, height: 32 }}
        />
      </form>
      <Select
        value={props.sort === '0' ? '1' : props.sort}
        onChange={handleSortChange}
        options={SORT_OPTIONS}
        inputProps={{ 'aria-label': 'Sort' }}
        sx={{ fontSize: 13, height: 32, width: 144 }}
      />
      {props.onViewChange && (
        <div className={styles.viewSeg} role="group" aria-label="View">
          <button type="button" aria-pressed={props.view === 'detail'} onClick={() => props.onViewChange('detail')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16" /></svg>
            Detail
          </button>
          <button type="button" aria-pressed={props.view === 'cards'} onClick={() => props.onViewChange('cards')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></svg>
            Cards
          </button>
        </div>
      )}
    </>
  );

  const bulkSx = { height: 26, fontSize: 12.5 };

  const header = (
    <div className={props.inSplit ? styles.splitListHeader : styles.listHeader}>
      <span
        aria-live="polite"
        title={'Keyboard: A accept, R reject, U undo last, E supporting evidence, \u2191 \u2193 move between records'}
      >
        {(props.totalCount ?? n).toLocaleString()} {LIST_NOUN[props.tabType] ?? `publication${props.totalCount === 1 ? '' : 's'}`}
      </span>
      <div className={styles.listHeaderActions}>
        {props.tabType !== 'ACCEPTED' && <Button variant="ghost" size="sm" sx={bulkSx} onClick={() => updateAll('ACCEPTED')}>Accept all</Button>}
        {props.tabType !== 'REJECTED' && <Button variant="ghost" size="sm" sx={bulkSx} onClick={() => updateAll('REJECTED')}>Reject all</Button>}
        {props.tabType !== 'NULL' && <Button variant="ghost" size="sm" sx={bulkSx} onClick={() => updateAll('NULL')}>Undo all</Button>}
        {props.onHideList && (
          <button
            type="button"
            className={styles.listHideBtn}
            title="Hide list (L)"
            aria-label="Hide list"
            aria-expanded={true}
            aria-controls="curate-split-list"
            onClick={props.onHideList}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {props.toolbarSlot && createPortal(toolbar, props.toolbarSlot)}
      {!props.inSplit ? header : props.listHeaderSlot ? createPortal(header, props.listHeaderSlot) : null}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`${verb(confirm)} all ${n} publications?`}
        description={confirm === 'NULL' ? `All ${n} go back to Suggested.` : `This changes all ${n} publications in this list, including ones you haven't scrolled to.`}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant={confirm === 'REJECTED' ? 'danger' : 'primary'} onClick={() => { const a = confirm!; setConfirm(null); props.updateAll(a); }}>{verb(confirm)} all {n}</Button>
        </>}
      />
    </>
  )
}

export default FilterPubSection