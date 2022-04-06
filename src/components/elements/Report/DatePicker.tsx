import React, { useState } from "react";
import { DateRangePicker, SingleDatePicker, DayPickerRangeController } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import moment from 'moment';
import { Dropdown } from "react-bootstrap";

export const DatePicker = ({ name }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const handleDatesChange = ({ startDate, endDate }) => {
    setStartDate(startDate);
    setEndDate(endDate);
  };

  // TODO: pass from props
  const minDate = moment("1948-06-01");
  const maxDate = moment("2022-03-23");

  const isOutsideRange = day =>
    day.isAfter(maxDate) || day.isBefore(minDate);

  const toggleDropdown = () => {
    setShowDropdown(prevShowDropdown => !prevShowDropdown);
  }
  
  return (
    <Dropdown show={showDropdown} className="d-inline-block">
      <Dropdown.Toggle variant="primary" id="dropdown-basic" onClick={toggleDropdown}>
        {name}
      </Dropdown.Toggle>
      <Dropdown.Menu className="px-4">
        <DateRangePicker
          startDate={startDate} // momentPropTypes.momentObj or null,
          startDateId="date_picker_start_date_id" // PropTypes.string.isRequired,
          endDate={endDate} // momentPropTypes.momentObj or null,
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