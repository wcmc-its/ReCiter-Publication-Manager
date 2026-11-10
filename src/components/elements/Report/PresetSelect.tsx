import React from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import { setReportFilterLabels } from "../../../utils/constants";

// Single-choice threshold presets (Journal rank: "SJR 1.0 and above"). Writes the preset's
// lower/upper bounds into the two range filters; "Any" clears both.
export const PresetSelect = ({ reportFiltersLabes, title, options, handleChange, filterLowerName, filterUpperName, selectedLower, onClose }: any) => {
  const active = options.find((o: any) => selectedLower !== undefined && selectedLower !== "" && selectedLower !== null && Number(selectedLower) === o.lower);
  const label = setReportFilterLabels(reportFiltersLabes, title) || title;
  const choose = (o: any) => handleChange(filterLowerName, filterUpperName, o ? o.lower : null, o ? o.upper : null);
  const rows = [{ key: "", label: "Any", lower: null }, ...options];

  return (
    <DropdownWrapper title={active ? active.label : label} variant={active ? "primary" : "white"} onClose={onClose}>
      <div role="radiogroup" aria-label={label}>
        {rows.map((o: any) => {
          const on = o.key ? active?.key === o.key : !active;
          return (
            <div key={o.key || "any"} role="radio" aria-checked={on} className={styles.posItem} onClick={() => choose(o.key ? o : null)}>
              <div className={on ? styles.radioOn : styles.radio} />
              <div className={styles.posLabel}>{o.label}</div>
            </div>
          );
        })}
      </div>
    </DropdownWrapper>
  )
}
