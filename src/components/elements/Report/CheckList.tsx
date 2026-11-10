import React from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import { setReportFilterLabels } from "../../../utils/constants";

// Fixed multi-select list (Author position, Source). Options carry their own label and
// description in config/report.js.
export const CheckList = ({ reportFiltersLabes, title, options, onUpdateFilter, filterName, selectedOptions, onClose }: any) => {
  const onSelect = (key: string) => {
    const isChecked = selectedOptions && selectedOptions.includes(key);
    const updatedSelected = isChecked
      ? selectedOptions.filter((option: string) => option !== key)
      : [...(selectedOptions || []), key];
    onUpdateFilter(filterName, updatedSelected);
  }

  const label = setReportFilterLabels(reportFiltersLabes, title) || title;
  const count = selectedOptions?.length || 0;

  return (
    <DropdownWrapper title={count ? `${label} · ${count}` : label} variant={count > 0 ? "primary" : "white"} onClose={onClose}>
      <div>
        {options.map((option: any) => {
          const isChecked = selectedOptions && selectedOptions.includes(option.key);
          return (
            <div
              key={option.key}
              role="menuitemcheckbox"
              aria-checked={!!isChecked}
              className={styles.posItem}
              onClick={() => onSelect(option.key)}
            >
              <div className={isChecked ? styles.cbOn : styles.cb} />
              <div>
                <div className={styles.posLabel}>{option.label}</div>
                {option.desc && <div className={styles.posDesc}>{option.desc}</div>}
              </div>
            </div>
          );
        })}
        {count > 0 && (
          <div className={styles.ddFooter}>
            <button className={styles.ddClear} onClick={() => onUpdateFilter(filterName, [])}>Clear</button>
            <span className={styles.ddSelectedCount}>{count} selected</span>
          </div>
        )}
      </div>
    </DropdownWrapper>
  )
}
