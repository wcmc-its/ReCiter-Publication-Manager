import { reportConfig } from "../../../../config/report"
import { Button } from "react-bootstrap";

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
    <div className="filter-row">
      <div className="title">{title}</div>
      <div className="filters-container">
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
    <div>
      {Object.keys(reportConfig).map((config, index) => {
        return (
          <>
            <FilterRow
              title={reportConfig[config].name}
              filters={reportConfig[config].list}
              />
             {index < Object.keys(reportConfig).length && <div className="break"></div>}
          </>
        )
      })}
      <Buttons />
    </div>
  )
}