import React, { useState, useEffect } from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import { setReportFilterLabels } from "../../../utils/constants";

const positionDescriptions: Record<string, string> = {
  first: "Article's first listed author",
  last: "Corresponding / senior author",
};

export const CheckList = ({ reportFiltersLabes, title, options, onUpdateFilter, filterName, selectedOptions, isFilterClear }) => {
  const [selectedList, setSelectedList] = useState<any>([]);

  const onSelect = (key: string) => {
    const isChecked = selectedOptions && selectedOptions.includes(key);
    let updatedSelected = [];

    if (!isChecked) {
      updatedSelected = [...selectedOptions, key];
      let optionObj = options.find(option => option.key === key);
      if (optionObj) {
        setSelectedList([...selectedList, optionObj]);
      }
    } else {
      updatedSelected = selectedOptions.filter(option => option !== key);
      setSelectedList(selectedList.filter(item => item.key !== key));
    }
    onUpdateFilter(filterName, updatedSelected);
  }

  useEffect(() => {
    if (selectedList) setSelectedList([]);
  }, [isFilterClear])

  return (
    <DropdownWrapper title={setReportFilterLabels(reportFiltersLabes, title)} variant={selectedOptions && selectedOptions.length > 0 ? "primary" : "white"}>
      <div>
        {options.map((option) => {
          const isChecked = selectedOptions && selectedOptions.includes(option.key);
          const desc = positionDescriptions[option.key];
          return (
            <div
              key={option.key}
              className={styles.posItem}
              onClick={() => onSelect(option.key)}
            >
              <div className={isChecked ? styles.cbOn : styles.cb} />
              <div>
                <div className={styles.posLabel}>{option.label} author</div>
                {desc && <div className={styles.posDesc}>{desc}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </DropdownWrapper>
  )
}
