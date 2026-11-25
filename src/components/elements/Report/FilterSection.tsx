// @ts-nocheck
import { reportConfig } from "../../../../config/report"
import { Button } from "react-bootstrap";
import styles from "./FilterSection.module.css";
import { DatePicker } from "./DatePicker";
import { SliderFilter } from "./SliderFilter";
import { CheckList } from "./CheckList";
import { CheckboxSelect } from "./CheckboxSelect";
import { PresetSelect } from "./PresetSelect";
import { GroupedChecklist } from "./GroupedChecklist";
import { isGroupedTypeOptions } from "../../../utils/reportRow";
import * as utils from "../../../utils/reportFilters";
import React from 'react';

// given filter name which redux state object property should be updated
const filterNameToState = {
  author: "personIdentifers",
  organization: "orgUnits",
  institution: "institutions",
  personType: "personTypes",
  authorPosition: "authorPosition",
  source: "sourceTypes",
  date: ["datePublicationAddedToEntrezLowerBound", "datePublicationAddedToEntrezUpperBound"],
  pubDate: ["pubDateLowerBound", "pubDateUpperBound"],
  type: "publicationTypeCanonical",
  peerReview: "peerReview",
  journal: "journalTitleVerbose",
  journalRank: ["journalImpactScoreLowerBound", "journalImpactScoreUpperBound"],
}

const DisplayFilter = ({onClose, reportFiltersLabes,onLoadMore, filter, index,isFilterClear, filterOptions, filterUpdateOptions, onSetSearchFilters, filterName, onSetRangeFilters, selectedFilters }) => {
  let filterType = filter.filterType || undefined;
  // Don't modify filterName - it should be a string or array as passed from filterNameToState
  selectedFilters = selectedFilters || {}
  
  switch (filterType) {
    case ("DateRange"):
      return (
        <DatePicker 
          name={filter.name}
          range={filterOptions[filter.options]}
          handleChange={onSetRangeFilters}
          filterLowerName={filterName[0]}
          filterUpperName={filterName[1]}
          selectedStartDate={selectedFilters[filterName[0]]}
          selectedEndDate={selectedFilters[filterName[1]]}
          selectedFilters={selectedFilters}
          isFilterClear={isFilterClear}
          reportFiltersLabes={reportFiltersLabes}
          onClose={onClose}
        />
      )
    case "Preset":
      return (
        <PresetSelect
          title={filter.name}
          options={filter.options}
          handleChange={onSetRangeFilters}
          filterLowerName={filterName[0]}
          filterUpperName={filterName[1]}
          selectedLower={selectedFilters[filterName[0]]}
          reportFiltersLabes={reportFiltersLabes}
          onClose={onClose}
        />
      )
    case "Range":
      {
        let rangeDates = filterOptions[filter.options];
        let range = rangeDates.length ? rangeDates[0] : {};
        let values = Object.keys(range).map((r) => range[r]);
        let min = values.length ? values[0] : 0;
        let max = values.length ? values[1] : 100;
        return (
          <SliderFilter 
            name={filter.name}
            min={min}
            max={max}
            handleChange={onSetRangeFilters}
            filterLowerName={filterName[0]}
            filterUpperName={filterName[1]}
            values={[selectedFilters[filterName[0]], selectedFilters[filterName[1]]]}
            reportFiltersLabes={reportFiltersLabes}
          />
        )
      }
    case "CheckboxSelect":
      return (
        <CheckboxSelect
          title={filter.name}
          options={filterOptions[filter.options]}
          formatOptionTitle={filter.formatOptionTitle ? utils[filter.formatOptionTitle] : null}
          optionLabel={filter.optionLabel ? filter.optionLabel : ""}
          filterUpdateOptions={filterUpdateOptions}
          isDynamicFetch={filter.dynamicFetchOptions}
          value={filter.options}
          optionValue={filter.value}
          filterName={filterName}
          onUpdateFilter={onSetSearchFilters}
          selectedOptions={selectedFilters[filterName] || []}
          authorsFilteredData = {filterOptions.authorFilterData}
          isFilterClear={isFilterClear}
          onLoadMore = {onLoadMore}
          reportFiltersLabes={reportFiltersLabes}
          onClose={onClose}
        />
      )
    case "GroupedChecklist": {
      // Grouped when the endpoint sent (group, type, count) rows; otherwise the old flat list.
      const options = filterOptions[filter.options];
      if (isGroupedTypeOptions(options)) {
        return (
          <GroupedChecklist
            title={filter.name}
            options={options}
            onUpdateFilter={onSetSearchFilters}
            filterName={filter.groupedValue}
            selectedOptions={selectedFilters[filter.groupedValue] || []}
            reportFiltersLabes={reportFiltersLabes}
            onClose={onClose}
          />
        )
      }
      return (
        <CheckboxSelect
          title={filter.name}
          options={options}
          formatOptionTitle={null}
          optionLabel={filter.optionLabel}
          filterUpdateOptions={filterUpdateOptions}
          isDynamicFetch={filter.dynamicFetchOptions}
          value={filter.options}
          optionValue={filter.value}
          filterName={filterName}
          onUpdateFilter={onSetSearchFilters}
          selectedOptions={selectedFilters[filterName] || []}
          authorsFilteredData = {filterOptions.authorFilterData}
          isFilterClear={isFilterClear}
          onLoadMore = {onLoadMore}
          reportFiltersLabes={reportFiltersLabes}
          onClose={onClose}
        />
      )
    }
    case "Checklist": {
      // Options are inline in config/report.js, or (a string) the name of a fetched list; a
      // fetched list that is empty hides the filter (Peer review before ReCiterDB v3.10).
      const options = typeof filter.options === "string" ? filterOptions[filter.options] : filter.options;
      if (!Array.isArray(options) || !options.length) return null;
      return (
        <CheckList
          title={filter.name}
          options={options}
          single={!!filter.single}
          onUpdateFilter={onSetSearchFilters}
          filterName={filterName}
          selectedOptions={selectedFilters[filterName] || []}
          reportFiltersLabes={reportFiltersLabes}
          isFilterClear={isFilterClear}
          onClose={onClose}
        />
      )
    }
    default:
      return (
        <Button key={index}>{filter.name}</Button>
      )
  }
}

const FilterRow = ({onClose, reportFiltersLabes,onLoadMore,title, filters, filterOptions,isFilterClear, filterUpdateOptions, onSetSearchFilters, onSetRangeFilters, selectedFilters}) => {
  return (
    <div className={styles.filterRow}>
      <div className={styles.filterName}>{title}</div>
      <div className={styles.filtersContainer}>
        {Object.keys(filters).map((filter, index) => {
          if (filters[filter].isEnabled) {
            return (
              <DisplayFilter 
                filter={filters[filter]}
                index={index}
                key={index}
                filterOptions={filterOptions}
                filterUpdateOptions={filterUpdateOptions}
                onSetSearchFilters={onSetSearchFilters}
                filterName={filterNameToState[filter]}
                onSetRangeFilters={onSetRangeFilters}
                selectedFilters={selectedFilters}
                isFilterClear={isFilterClear}
                onLoadMore={onLoadMore}
                reportFiltersLabes={reportFiltersLabes}
                onClose={onClose}
                />
            )
          } else {
            return null;
          }
        })}
      </div>
    </div>
  )
}

// Two rows of filter chips (People, Publications). A filter applies when its menu closes, so
// there's no Search button; "Clear all" replaces Reset.
export const FilterSection = ({reportFiltersLabes, onLoadMore, filterOptions,isFilterClear, filterUpdateOptions, onSetSearchFilters, onSetRangeFilters, selectedFilters, clearFilters, searchResults, hasActiveFilters }) => {

  return (
    <div className={styles.filterContainer} data-testid="report-filters">
      {Object.keys(reportConfig).map((config, index) => {
        return (
          <React.Fragment key={config}>
            {index > 0 && <div className={styles.rowDivider} />}
            <FilterRow 
              title={reportConfig[config].name}
              filters={reportConfig[config].list}
              filterOptions={filterOptions}
              filterUpdateOptions={filterUpdateOptions}
              onSetSearchFilters={onSetSearchFilters}
              onSetRangeFilters={onSetRangeFilters}
              selectedFilters={selectedFilters}
              isFilterClear={isFilterClear}
              onLoadMore={onLoadMore}
              reportFiltersLabes={reportFiltersLabes}
              onClose={searchResults}
              />
         </React.Fragment>
        )
      })}
      {hasActiveFilters && (
        <button type="button" className={styles.clearAll} onClick={clearFilters}>Clear all</button>
      )}
    </div>
  )
}
