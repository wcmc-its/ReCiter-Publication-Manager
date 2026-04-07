import React, { useState, useEffect } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import { useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { setReportFilterLabels } from "../../../utils/constants";

export const CheckboxSelect: React.FC<any> = ({ reportFiltersLabes,onLoadMore,isFilterClear, title, value, options, formatOptionTitle, optionLabel, filterUpdateOptions,authorsFilteredData, isDynamicFetch, optionValue, filterName, onUpdateFilter, selectedOptions }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [selectedList, setSelectedList] = useState<any>([]);
  const [totalCount, setTotalCount] = useState<number>(10);
  const [isHideSeeMoreLink, setHideSeeMoreLink] = useState<boolean>(false);

  const authorFilterDataFromSearch = useSelector((state: RootStateOrAny) => state.authorFilterDataFromSearch)

  const isPersonType = filterName === 'personTypes';

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputBySearch = e.target.value;
    await setUserInput(inputBySearch);
     if(inputBySearch.length >= 3) {
      if(!isHideSeeMoreLink) setHideSeeMoreLink(!isHideSeeMoreLink)
      dataPreparation(inputBySearch)
     }
  }

  useEffect(() => {
    if(userInput) setUserInput("");
    if(isHideSeeMoreLink) setHideSeeMoreLink(false);
    if(totalCount > 10) setTotalCount(10);
    if(selectedList) setSelectedList([]);
  }, [isFilterClear])

  useEffect(() => {
    dataPreparation();
  }, [selectedOptions, authorFilterDataFromSearch])

  const dataPreparation = (inputBySearch?: any) => {
    if (isDynamicFetch) {
      filterUpdateOptions[value](inputBySearch);
    }

    let updatedSelectedList = selectedOptions && selectedOptions.map((selectedOption) => {
      return options.find(option => option[optionValue] == selectedOption);
    })

    let filteredData = updatedSelectedList?.filter(item => item !== undefined)

    if (filteredData.length > 0 && filteredData?.every((currentValue) => currentValue !== undefined)) {
      const uniqueIds = selectedList;
      let isPersonIdentifier = false;
      let isJournalTitleVerbose = false;
      filteredData.filter(element => {
        if(element.hasOwnProperty("journalTitleVerbose")){
          if(element.hasOwnProperty("journalTitleVerbose")) isJournalTitleVerbose = true;
          const isDuplicate = uniqueIds.includes(element);
          if (!isDuplicate) { uniqueIds.push(element); return true; }
          return false;
        }else if(element.hasOwnProperty("personIdentifier")){
          if(element.hasOwnProperty("personIdentifier")) isPersonIdentifier = true;
          const isDuplicate = uniqueIds.includes(element.personIdentifier);
          if (!isDuplicate) { uniqueIds.push(element); return true; }
          return false;
        }
      });
      let filtered = [];
      if(uniqueIds.some(i=> i.hasOwnProperty("personIdentifier"))){
        const ids = uniqueIds.map(i => i.personIdentifier)
        filtered = uniqueIds.filter(({ personIdentifier }, index) => !ids.includes(personIdentifier, index + 1))
      }else if(uniqueIds.some(i=> i.hasOwnProperty("journalTitleVerbose"))){
        const ids = uniqueIds.map(i => i.journalTitleVerbose)
        filtered = uniqueIds.filter(({ journalTitleVerbose }, index) => !ids.includes(journalTitleVerbose, index + 1))
      }
      if(isPersonIdentifier || isJournalTitleVerbose) setSelectedList(filtered);
      else setSelectedList(filteredData)
    }
  }

  const filteredOptions = (options: any[], isDynamicFetch: boolean) => {
    if (userInput != '' && !isDynamicFetch) {
      return options.filter(option => getLabel(option).toUpperCase().includes(userInput.toUpperCase()));
    }
    return options;
  }

  const getLabel = (option: any) => {
    return formatOptionTitle ? formatOptionTitle(option) : optionLabel ? option[optionLabel] : option.label;
  }

  const getPersonTypeLabel = (slug: string) => {
    return slug
      .replace(/^academic-/, '')
      .replace(/-/g, ' — ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  const highlightMatch = (text: string) => {
    if (!userInput) return text;
    const idx = text.toUpperCase().indexOf(userInput.toUpperCase());
    if (idx === -1) return text;
    return (
      <>
        {text.substring(0, idx)}
        <span className={styles.match}>{text.substring(idx, idx + userInput.length)}</span>
        {text.substring(idx + userInput.length)}
      </>
    );
  }

  const onSelect = (optionVal: string) => {
    const isChecked = selectedOptions && selectedOptions.includes(optionVal);
    let updatedSelected = [];

    if (!isChecked) {
      updatedSelected = [...selectedOptions, optionVal];
      let optionObj = options.find(option => option[optionValue] == optionVal);
      if (optionObj) {
        setSelectedList([...selectedList, optionObj]);
      }
    } else {
      updatedSelected = selectedOptions.filter(option => option != optionVal);
      setSelectedList(selectedList.filter(item => item[optionValue] != optionVal));
    }
    onUpdateFilter(filterName, updatedSelected);
  }

  const onClearAll = () => {
    setSelectedList([]);
    onUpdateFilter(filterName, []);
  }

  const onClickLoadMore = (title: string) => {
    let updatedCount = totalCount + 12;
    setTotalCount(updatedCount);
    onLoadMore(title, updatedCount);
  }

  const filtered = filteredOptions(options, isDynamicFetch);
  const matchCount = userInput.length >= 1 ? filtered.length : null;
  const selectedCount = selectedOptions?.length || 0;

  return (
    <DropdownWrapper title={setReportFilterLabels(reportFiltersLabes, title)} variant={selectedOptions && selectedOptions.length > 0 ? "primary" : "white"}>
      <div className={styles.dropdownContainer}>
        {/* Search bar */}
        <div className={styles.ddSearch}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:14,height:14}}>
            <circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/>
          </svg>
          <input
            type="text"
            placeholder={isDynamicFetch ? "Type 3 letters to search" : "Search..."}
            value={userInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onInputChange(e)}
          />
        </div>

        {/* Match count header */}
        {matchCount !== null && (
          <div className={styles.ddHeader}>
            <span className={styles.ddCount}>{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
          </div>
        )}

        {/* Options list */}
        <div className={styles.selectListContainer}>
          {filtered.map((option, index) => {
            const val = option[optionValue];
            const isChecked = selectedOptions && selectedOptions.includes(val);
            const label = getLabel(option);

            if (isPersonType) {
              return (
                <button
                  type="button"
                  key={val}
                  className={styles.ptItem}
                  onClick={() => onSelect(val)}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  <div className={isChecked ? styles.cbOn : styles.cb} style={{marginTop: 3}} />
                  <div>
                    <div className={styles.ptLabel}>{getPersonTypeLabel(label)}</div>
                    <div className={styles.ptSlug}>{label}</div>
                  </div>
                </button>
              );
            }

            return (
              <button
                type="button"
                key={val}
                className={isChecked ? styles.ddItemChecked : styles.ddItem}
                onClick={() => onSelect(val)}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div className={isChecked ? styles.cbOn : styles.cb} />
                <span className={styles.ddItemLabel}>{highlightMatch(label)}</span>
              </button>
            );
          })}
        </div>

        {/* See more for dynamic fetch */}
        {isDynamicFetch && !isHideSeeMoreLink && (
          <div className={styles.ddFooter}>
            <button className={styles.ddClear} onClick={() => onClickLoadMore(title)}>Load more</button>
            <span className={styles.ddSelectedCount}>{selectedCount} selected</span>
          </div>
        )}

        {/* Footer with clear + selected count */}
        {(!isDynamicFetch || isHideSeeMoreLink) && (
          <div className={styles.ddFooter}>
            <button className={styles.ddClear} onClick={onClearAll}>Clear</button>
            <span className={styles.ddSelectedCount}>{selectedCount} selected</span>
          </div>
        )}
      </div>
    </DropdownWrapper>
  )
}
