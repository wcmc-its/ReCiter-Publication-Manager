// @ts-nocheck
import React, { useEffect, useState } from "react";
import moment from 'moment';
import { Dropdown } from "react-bootstrap";
import { setReportFilterLabels } from "../../../utils/constants";
import styles from './DatePicker.module.css';

const PRESETS = [
  { label: "Last year", years: 1 },
  { label: "Last 3 years", years: 3 },
  { label: "Last 5 years", years: 5 },
  { label: "Last 10 years", years: 10 },
  { label: "This year", thisYear: true },
  { label: "Last 30 days", days: 30 },
];

export const DatePicker = ({ reportFiltersLabes, name, isFilterClear, range, selectedFilters, handleChange, filterLowerName, filterUpperName }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyDates = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    handleChange(filterLowerName, filterUpperName, start || null, end || null);
  };

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const now = moment();
    let start: moment.Moment;
    let end = now;

    if (preset.thisYear) {
      start = moment().startOf("year");
    } else if (preset.days) {
      start = moment().subtract(preset.days, "days");
    } else {
      start = moment().subtract(preset.years, "years");
    }

    setActivePreset(preset.label);
    applyDates(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  };

  const handleClear = () => {
    setActivePreset(null);
    applyDates("", "");
  };

  useEffect(() => {
    setStartDate("");
    setEndDate("");
    setActivePreset(null);
  }, [isFilterClear]);

  if (!range || range.length === 0) {
    return null;
  }

  const displayStart = startDate ? moment(startDate).format("MM/DD/YYYY") : "";
  const displayEnd = endDate ? moment(endDate).format("MM/DD/YYYY") : "";

  return (
    <Dropdown className="d-inline-block" autoClose="outside">
      <Dropdown.Toggle variant={(startDate || endDate) ? "primary" : "white"} id="dropdown-date">
        {setReportFilterLabels(reportFiltersLabes, name)}
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ padding: 0, minWidth: 280 }}>
        {/* Header */}
        <div className={styles.ddHeader}>
          <span className={styles.ddHeaderLabel}>Date range</span>
          <button className={styles.ddClear} onClick={handleClear}>Clear</button>
        </div>

        {/* From / To inputs */}
        <div className={styles.dateInputs}>
          <div className={styles.dateField}>
            <label htmlFor="report-date-from">From</label>
            <input
              id="report-date-from"
              className={startDate ? styles.dateInputFilled : styles.dateInput}
              type="date"
              value={startDate}
              onChange={(e) => {
                setActivePreset(null);
                applyDates(e.target.value, endDate);
              }}
            />
          </div>
          <div className={styles.dateField}>
            <label htmlFor="report-date-to">To</label>
            <input
              id="report-date-to"
              className={endDate ? styles.dateInputFilled : styles.dateInput}
              type="date"
              value={endDate}
              onChange={(e) => {
                setActivePreset(null);
                applyDates(startDate, e.target.value);
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Quick ranges */}
        <div className={styles.presetsLabel}>Quick ranges</div>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={activePreset === p.label ? styles.presetBtnActive : styles.presetBtn}
              onClick={() => handlePreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};
