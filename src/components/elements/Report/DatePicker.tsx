import React, { useState } from "react";
import { DateRangePicker, SingleDatePicker, DayPickerRangeController } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import moment from 'moment';
import { Dropdown } from "react-bootstrap";

export const DatePicker = ({ name, range, handleChange, filterLowerName, filterUpperName, selectedStartDate, selectedEndDate }) => {
  const [focusedInput, setFocusedInput] = useState(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  if (!range || range.length == 0) {
    return null;
  }

  const handleDatesChange = ({ startDate, endDate }) => {
    let formattedStartDate = startDate ? startDate.format('YYYY-MM-DD') : null;
    let formattedEndDate = endDate ? endDate.format('YYYY-MM-DD') : null;
    handleChange(filterLowerName, filterUpperName, formattedStartDate, formattedEndDate);
  };

  const rangeDates = range[0];
  const minDate = moment(rangeDates.minDate);
  const maxDate = moment(rangeDates.maxDate);

  const isOutsideRange = day =>
    day.isAfter(maxDate) || day.isBefore(minDate);

  const toggleDropdown = () => {
    setShowDropdown(prevShowDropdown => !prevShowDropdown);
  }
  
  return (
    <Dropdown show={showDropdown} className="d-inline-block">
      <Dropdown.Toggle variant={(selectedStartDate !== "" || selectedEndDate !== "") ? "primary" : "white"} id="dropdown-basic" onClick={toggleDropdown}>
        {name}
      </Dropdown.Toggle>
      <Dropdown.Menu className="px-4">
        <DateRangePicker
          startDate={selectedStartDate ? moment(selectedStartDate) : null} // momentPropTypes.momentObj or null,
          startDateId="date_picker_start_date_id" // PropTypes.string.isRequired,
          endDate={selectedEndDate ? moment(selectedEndDate) : null} // momentPropTypes.momentObj or null,
          endDateId="date_picker_end_date_id" // PropTypes.string.isRequired,
          onDatesChange={handleDatesChange} // PropTypes.func.isRequired,
          focusedInput={focusedInput} // PropTypes.oneOf([START_DATE, END_DATE]) or null,
          onFocusChange={focusedInput => setFocusedInput(focusedInput)} // PropTypes.func.isRequired,
          isOutsideRange={isOutsideRange}
        />
      </Dropdown.Menu>
    </Dropdown>
  )
}