import React, { useEffect, useState, forwardRef } from "react";
import DatePickerLib from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Dropdown, Button } from "react-bootstrap";
import { setReportFilterLabels } from "../../../utils/constants";

// Custom input with two placeholders

const DateRangeInput = forwardRef(
  (
    {
      startDate,
      endDate,
      isClearable,
      onClick,
      onClear,
      placeholderStart = "MM/DD/YYYY",
      placeholderEnd = "MM/DD/YYYY",
    }: any,
    ref: any
  ) => {
    const showValue =
      startDate || endDate
        ? [
            startDate
              ? new Date(startDate).toLocaleDateString("en-US")
              : placeholderStart,
            endDate
              ? new Date(endDate).toLocaleDateString("en-US")
              : placeholderEnd,
          ]
        : [placeholderStart, placeholderEnd];

    return (
      <div
        ref={ref}
        onClick={onClick}
        style={{
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: "4px 8px",
          minWidth: 287,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "20px",
          background: "#fff",
        }}
      >
        <span style={{ color: "#777" }}>{showValue[0]}</span>
        <span style={{ margin: "0 10px", color: "#aaa" }}>→</span>
        <span style={{ color: "#777" }}>{showValue[1]}</span>
        {isClearable && (startDate || endDate) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: 18,
              cursor: "pointer",
              marginLeft: 10,
            }}
            title="Clear"
            tabIndex={-1}
          >
          </button>
        )}
      </div>
    );
  }
);
DateRangeInput.displayName = 'DateRangeInput';
export const DatePicker = ({
  reportFiltersLabes,
  name,
  isFilterClear,
  range,
  selectedFilters,
  handleChange,
  filterLowerName,
  filterUpperName,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);

  // Inject custom CSS for horizontal layout
  React.useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .react-datepicker{
        margin-left: 344px;
        margin-top: 8px;
       }
      .horizontal-datepicker {
        min-width: 620px !important;
        display: flex !important;
        flex-direction: row !important;
        gap: 32px;
      }
      .horizontal-datepicker .react-datepicker__month-container {
        width: 300px;
      }
      .react-datepicker__month-container {
        min-width: 300px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Helper to format date as YYYY-MM-DD
  const formatDate = (d: Date | null) => {
    if (!d) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleCustomDateRange = () => {
    const tempEndDate = new Date();
    const tempStartDate = new Date();
    const tempMinDate = new Date();
    tempStartDate.setDate(tempEndDate.getDate() - 30);
    tempMinDate.setDate(tempEndDate.getDate() - 3000);

    setMinDate(tempMinDate);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    handleChange(
      filterLowerName,
      filterUpperName,
      formatDate(tempStartDate),
      formatDate(tempEndDate)
    );
  };

  useEffect(() => {
    const {
      personIdentifers = [],
      institutions = [],
      orgUnits = [],
      personTypes = [],
    } = selectedFilters || {};
    if (
      personIdentifers.length === 0 &&
      institutions.length === 0 &&
      orgUnits.length === 0 &&
      personTypes.length === 0
    ) {
      // handleCustomDateRange();
    } else {
      setStartDate(null);
      setEndDate(null);
      handleChange(filterLowerName, filterUpperName, null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStartDate(null);
    setEndDate(null);
  }, [isFilterClear]);

  if (!range || range.length === 0) {
    return null;
  }

  const handleDatesChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    handleChange(
      filterLowerName,
      filterUpperName,
      formatDate(start),
      formatDate(end)
    );
  };

  // Clear dates
  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    handleChange(filterLowerName, filterUpperName, null, null);
  };

  return (
    <Dropdown className="d-inline-block" autoClose>
      <Dropdown.Toggle
        variant={startDate || endDate ? "primary" : "white"}
        id="dropdown-basic"
      >
        {setReportFilterLabels(reportFiltersLabes, name)}
      </Dropdown.Toggle>
      <Dropdown.Menu className="px-4" style={{ minWidth: 339 }}>
        <div>
          <DatePickerLib
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={handleDatesChange}
            minDate={minDate ? minDate : undefined}
            dateFormat="MM/dd/yyyy"
            isClearable={true}
            monthsShown={2}
            calendarClassName="horizontal-datepicker"
            popperPlacement="bottom"
            customInput={
              <DateRangeInput
                startDate={startDate}
                endDate={endDate}
                isClearable={true}
                onClear={handleClear}
              />
            }
          />
        </div>
        <div className="mt-1">
          <Button
            variant="primary"
            className="fullWidth"
            onClick={handleCustomDateRange}
          >
            Last 30 days
          </Button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};