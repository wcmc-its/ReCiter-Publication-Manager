import { reportConfig } from "../../../../config/report"
import { Button } from "react-bootstrap";
import styles from "./FilterSection.module.css";
import { DatePicker } from "./DatePicker";
import { SliderFilter } from "./SliderFilter";
import { CheckList } from "./CheckList";

const Buttons = () => {
  return (
    <div className="d-flex align-items-center">
      <Button variant="warning">Search</Button>
      <div className="m-3 text-button">Reset</div>
    </div>
  )
}

const DisplayFilter = ({ filter, index, filterOptions}) => {
  let filterType = filter.filterType || undefined;
  switch (filterType) {
    case ("DateRange"):
      return (
        <DatePicker 
          name={filter.name}
          range={filterOptions[filter.options]}
        />
      )
    case "Range":
      return (
        <SliderFilter 
          name={filter.name}
        />
      )
    case "Checklist":
      return (
        <CheckList
          title={filter.name}
          options={filter.options}
        />
      )
    default:
      return (
        <Button key={index}>{filter.name}</Button>
      )
  }
}

const FilterRow = ({title, filters, filterOptions}) => {
  return (
    <div className="filter-row flex-grow-1">
      <div className={`title ${styles.filterName}`}>{title}</div>
      <div className={`filters-container ${styles.filtersContainer}`}>
        {Object.keys(filters).map((filter, index) => {
          return (
            <DisplayFilter 
              filter={filters[filter]}
              index={index}
              filterOptions={filterOptions}
              />
          )
        })}
      </div>
    </div>
  )
}

export const FilterSection = ({ filterOptions }) => {
  return (
    <div className={`d-flex flex-row flex-wrap ${styles.filterContainer}`}>
      {Object.keys(reportConfig).map((config, index) => {
        return (
          <>
            <FilterRow
              title={reportConfig[config].name}
              filters={reportConfig[config].list}
              filterOptions={filterOptions}
              />
              {index < Object.keys(reportConfig).length - 1 && <div className="break"></div>}
          </>
        )
      })}
      <Buttons />
    </div>
  )
}