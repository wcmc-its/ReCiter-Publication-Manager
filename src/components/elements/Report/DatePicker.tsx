// @ts-nocheck
import React, { useEffect, useState } from "react";
import { DateRangePicker, SingleDatePicker, DayPickerRangeController } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import moment from 'moment';
import { Dropdown } from "react-bootstrap";

export const DatePicker = ({ name, isFilterClear,range,selectedFilters, handleChange, filterLowerName, filterUpperName, selectedStartDate, selectedEndDate }) => {
  const [focusedInput, setFocusedInput] = useState();
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [startDate, setStartDate] = useState();
  const [endDate, setEndDate] = useState();
  const [miniDate, setMindate] = useState();


  


  useEffect(()=>{
  // const rangeDates = range[0];
  console.log("isFilterClearCalling", )
  const {personIdentifers,institutions, orgUnits,personTypes, datePublicationAddedToEntrezLowerBound,datePublicationAddedToEntrezUpperBound } = selectedFilters
  if(personIdentifers.length === 0 && institutions.length === 0 && orgUnits.length === 0 && personTypes.length === 0){
  let tempStartDate = new Date();
  let tempMinDate = new Date();
  let tempEndDate = new Date();
  tempStartDate.setDate(tempEndDate.getDate() - 30);
  tempMinDate.setDate(tempEndDate.getDate() - 3000)
  setMindate(moment(tempMinDate))
  setStartDate(moment(tempStartDate))
  setEndDate(moment(tempEndDate))
  handleChange(filterLowerName, filterUpperName, moment(tempStartDate).format('YYYY-MM-DD'), moment(tempEndDate).format('YYYY-MM-DD'));
  }else {
    setStartDate()
    setEndDate()
    handleChange(filterLowerName, filterUpperName, null, null);
  }
  },[])

  useEffect(()=>{
    // const rangeDates = range[0];
    const {personIdentifers,institutions, orgUnits,personTypes, datePublicationAddedToEntrezLowerBound,datePublicationAddedToEntrezUpperBound } = selectedFilters
  if(personIdentifers.length === 0 && institutions.length === 0 && orgUnits.length === 0 && personTypes.length === 0){
  let tempStartDate = new Date();
  let tempMinDate = new Date();
  let tempEndDate = new Date();
  tempStartDate.setDate(tempEndDate.getDate() - 30);
  tempMinDate.setDate(tempEndDate.getDate() - 3000)
  setMindate(moment(tempMinDate))
  setStartDate(moment(tempStartDate))
  setEndDate(moment(tempEndDate))
  handleChange(filterLowerName, filterUpperName, moment(tempStartDate).format('YYYY-MM-DD'), moment(tempEndDate).format('YYYY-MM-DD'));
  }else {
    setStartDate()
    setEndDate()
    handleChange(filterLowerName, filterUpperName, null, null);
  }
    },[isFilterClear])

    if (!range || range.length == 0) {
      return null;
    }

  const handleDatesChange = ({ startDate, endDate }) => {
    setStartDate(startDate)
    setEndDate(endDate)
    let formattedStartDate = startDate ? startDate.format('YYYY-MM-DD') : null;
    let formattedEndDate = endDate ? endDate.format('YYYY-MM-DD') : null;
    handleChange(filterLowerName, filterUpperName, formattedStartDate, formattedEndDate);
  };

  
  // const rangeDates = range[0];
  // const minDate = moment(rangeDates.minDate);
  // const maxDate = moment(rangeDates.maxDate);

  const isOutsideRange = day =>
    day.isAfter(startDate) || day.isBefore(endDate);

  const toggleDropdown = () => {
    setShowDropdown(prevShowDropdown => !prevShowDropdown);
  }

  return (
    <Dropdown className="d-inline-block" autoClose>
      <Dropdown.Toggle variant={(startDate || endDate) ? "primary" : "white"} id="dropdown-basic">
        {name}
      </Dropdown.Toggle>
      <Dropdown.Menu className="px-4">
        
        <DateRangePicker
          startDate={startDate ? startDate : null}
          minDate={miniDate? miniDate : null} // momentPropTypes.momentObj or null,
          startDateId="date_picker_start_date_id" // PropTypes.string.isRequired,
          maxDate={endDate ? endDate : null}
          endDate={endDate ? endDate : null}  // momentPropTypes.momentObj or null,
          endDateId="date_picker_end_date_id" // PropTypes.string.isRequired,
          onDatesChange={handleDatesChange} // PropTypes.func.isRequired,
          focusedInput={focusedInput} // PropTypes.oneOf([START_DATE, END_DATE]) or null,
          onFocusChange={focusedInput =>{ setFocusedInput(focusedInput); console.log("focusedInput")}} // PropTypes.func.isRequired,
          isOutsideRange={()=> false}
        />
      </Dropdown.Menu>
    </Dropdown>
  )
}