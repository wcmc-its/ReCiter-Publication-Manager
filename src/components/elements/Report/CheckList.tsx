import React from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import { setReportFilterLabels } from "../../../utils/constants";

// Fixed list of options (Author position, Source, Peer review). Options carry their own label,
// description and, when fetched, a count. `single`: pick one or none (Peer review: Yes / No / Any);
// the selection is still an array, so it clears and serializes like the others.
export const CheckList = ({ reportFiltersLabes, title, options, onUpdateFilter, filterName, selectedOptions, onClose, single = false }: any) => {
  const onSelect = (key: string) => {
    const isChecked = selectedOptions && selectedOptions.includes(key);
    const updatedSelected = single
      ? (isChecked ? [] : [key])
      : isChecked
        ? selectedOptions.filter((option: string) => option !== key)
        : [...(selectedOptions || []), key];
    onUpdateFilter(filterName, updatedSelected);
  }

  const label = setReportFilterLabels(reportFiltersLabes, title) || title;
  const count = selectedOptions?.length || 0;
  const picked = single && count ? options.find((o: any) => o.key === selectedOptions[0]) : null;
  const chipTitle = picked ? `${label} · ${picked.label}` : count ? `${label} · ${count}` : label;

  return (
    <DropdownWrapper title={chipTitle} variant={count > 0 ? "primary" : "white"} onClose={onClose}>
      <div>
        {options.map((option: any) => {
          const isChecked = selectedOptions && selectedOptions.includes(option.key);
          return (
            <div
              key={option.key}
              role={single ? "menuitemradio" : "menuitemcheckbox"}
              aria-checked={!!isChecked}
              className={styles.posItem}
              onClick={() => onSelect(option.key)}
            >
              <div className={isChecked ? styles.cbOn : styles.cb} />
              <div>
                <div className={styles.posLabel}>
                  {option.label}
                  {typeof option.count === "number" && <span className={styles.posCount}> {option.count.toLocaleString()}</span>}
                </div>
                {option.desc && <div className={styles.posDesc}>{option.desc}</div>}
              </div>
            </div>
          );
        })}
        {count > 0 && (
          <div className={styles.ddFooter}>
            <button className={styles.ddClear} onClick={() => onUpdateFilter(filterName, [])}>Clear</button>
            {!single && <span className={styles.ddSelectedCount}>{count} selected</span>}
          </div>
        )}
      </div>
    </DropdownWrapper>
  )
}
