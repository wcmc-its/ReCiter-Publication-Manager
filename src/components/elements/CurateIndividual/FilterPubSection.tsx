import React, { useState, FormEvent, useEffect } from "react";
import { Dropdown, DropdownButton } from "react-bootstrap";
import { Publication } from "../../../../types/publication";
import styles from "./CurateIndividual.module.css";
import { Dialog, Button } from '../../ui';

interface FilterPubSectionProps {
  searchTextUpdate: (searchText: string) => void
  sortUpdate: (sort: string) => void
  publications: Array<Publication>
  updateAll: any
  tabType: string
  isSearchText: any
  totalCount?: number
}

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
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const el = e.currentTarget;
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


  return (
    <div className={styles.controlsBar}>
      {props.tabType !== 'ACCEPTED' && <button className={styles.btnBulkAccept} onClick={() => updateAll('ACCEPTED')}>Accept all {n}</button>}
      {props.tabType !== 'REJECTED' && <button className={styles.btnBulkReject} onClick={() => updateAll('REJECTED')}>Reject all {n}</button>}
      {props.tabType !== 'NULL' && <button className={styles.btnBulkUndo} onClick={() => updateAll('NULL')}>Undo all {n}</button>}
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
      <div className={styles.controlsSpacer} />
      <form onSubmit={handleFormSubmit} style={{display:'flex', gap: 8, alignItems:'center'}}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Filter..."
          value={searchText}
          onChange={handleInputChange}
          onPaste={handlePaste}
          aria-label="Filter, or paste PMIDs and DOIs"
          title="Filter by text, or paste a list of PMIDs, DOIs or their URLs"
        />
      </form>
      <DropdownButton className={styles.sortDropdown} title="Sort by" id="curate-sort" onSelect={(eventKey) => handleSortChange(eventKey)}>
        <Dropdown.Item eventKey="1" className={styles.sortItem}>Score ↓</Dropdown.Item>
        <Dropdown.Item eventKey="3" className={styles.sortItem}>Score ↑</Dropdown.Item>
        <Dropdown.Item eventKey="2" className={styles.sortItem}>Date ↓</Dropdown.Item>
        <Dropdown.Item eventKey="4" className={styles.sortItem}>Date ↑</Dropdown.Item>
      </DropdownButton>
      <span className={styles.listCount} aria-live="polite">{props.totalCount} publication{props.totalCount === 1 ? '' : 's'}</span>
    </div>
  )
}

export default FilterPubSection