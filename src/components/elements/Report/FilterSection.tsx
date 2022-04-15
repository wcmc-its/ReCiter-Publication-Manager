import { reportConfig } from "../../../../config/report"
import { Button } from "react-bootstrap";
import styles from "./FilterSection.module.css";
import { DatePicker } from "./DatePicker";
import { SliderFilter } from "./SliderFilter";
import { CheckList } from "./CheckList";
import { CheckboxSelect } from "./CheckboxSelect";
import * as utils from "../../../utils/reportFilters";

// given filter name which redux state object property should be updated
const filterNameToState = {
  author: "personIdentifers",
  organization: "orgUnits",
  institution: "institutions",
  personType: "personTypes",
  authorPosition: "authorPosition",
  date: ["datePublicationAddedToEntrezLowerBound", "datePublicationAddedToEntrezUpperBound"],
  type: "publicationTypeCanonical",
  journal: "journalTitleVerbose",
  journalRank: ["journalImpactScoreLowerBound", "journalImpactScoreUpperBound"],
}

const Buttons = () => {
  return (
    <div className="d-flex align-items-center">
      <Button variant="warning">Search</Button>
      <div className="m-3 text-button">Reset</div>
    </div>
  )
}

const DisplayFilter = ({ filter, index, filterOptions, filterUpdateOptions, onSetSearchFilters, filterName, onSetRangeFilters, selectedFilters }) => {
  let filterType = filter.filterType || undefined;
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
          selectedOptions={selectedFilters[filterName]}
        />
      )
    case "Checklist":
      return (
        <CheckList
          title={filter.name}
          options={filter.options}
          onUpdateFilter={onSetSearchFilters}
          filterName={filterName}
          selectedOptions={selectedFilters[filterName]}
        />
      )
    default:
      return (
        <Button key={index}>{filter.name}</Button>
      )
  }
}

const FilterRow = ({title, filters, filterOptions, filterUpdateOptions, onSetSearchFilters, onSetRangeFilters, selectedFilters}) => {
  return (
    <div className="filter-row flex-grow-1">
      <div className={`title ${styles.filterName}`}>{title}</div>
      <div className={`filters-container ${styles.filtersContainer}`}>
        {Object.keys(filters).map((filter, index) => {
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
              />
          )
        })}
      </div>
    </div>
  )
}

export const FilterSection = ({ filterOptions, filterUpdateOptions, onSetSearchFilters, onSetRangeFilters, selectedFilters }) => {
  return (
    <div className={`d-flex flex-row flex-wrap ${styles.filterContainer}`}>
      {Object.keys(reportConfig).map((config, index) => {
        return (
          <>
            <FilterRow
              title={reportConfig[config].name}
              filters={reportConfig[config].list}
              filterOptions={filterOptions}
              filterUpdateOptions={filterUpdateOptions}
              onSetSearchFilters={onSetSearchFilters}
              onSetRangeFilters={onSetRangeFilters}
              selectedFilters={selectedFilters}
              />
              {index < Object.keys(reportConfig).length - 1 && <div className="break"></div>}
          </>
        )
      })}
      <Buttons />
    </div>
  )
}