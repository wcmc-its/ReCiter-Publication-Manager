import { reportConfig } from "../../../../config/report"
import { Button } from "react-bootstrap";
import styles from "./FilterSection.module.css";

const Buttons = () => {
  return (
    <div className="d-flex align-items-center">
      <Button variant="warning">Search</Button>
      <div className="m-3 text-button">Reset</div>
    </div>
  )
}

const FilterRow = ({title, filters}) => {
  return (
    <div className="filter-row flex-grow-1">
      <div className={`title ${styles.filterName}`}>{title}</div>
      <div className={`filters-container ${styles.filtersContainer}`}>
        {Object.keys(filters).map((filter) => {
          return (
            <Button>{filters[filter].name}</Button>
          )
        })}
      </div>
    </div>
  )
}

export const FilterSection = () => {
  return (
    <div className={`d-flex flex-row flex-wrap ${styles.filterContainer}`}>
      {Object.keys(reportConfig).map((config, index) => {
        return (
          <>
            <FilterRow
              title={reportConfig[config].name}
              filters={reportConfig[config].list}
              />
              {index < Object.keys(reportConfig).length - 1 && <div className="break"></div>}
          </>
        )
      })}
      <Buttons />
    </div>
  )
}