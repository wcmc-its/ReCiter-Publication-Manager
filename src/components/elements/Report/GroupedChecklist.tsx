import React from "react";
import { DropdownWrapper } from "../Common/DropdownWrapper";
import styles from "./ChecboxSelect.module.css";
import gStyles from "./GroupedChecklist.module.css";
import { setReportFilterLabels } from "../../../utils/constants";
import type { TypeOption } from "../../../utils/reportRow";

// Type filter (5c): the publication types in their four groups (PUB_TYPE_GROUPS), each group with
// a select-all box, each type with its count. Options come from /api/db/reports/filter/articletype,
// already in taxonomy order; the selection is a list of type names (filter key `pubTypes`).
export const GroupedChecklist = ({ reportFiltersLabes, title, options, onUpdateFilter, filterName, selectedOptions, onClose }: {
  reportFiltersLabes: any;
  title: string;
  options: TypeOption[];
  onUpdateFilter: (filterName: string, value: string[]) => void;
  filterName: string;
  selectedOptions: string[];
  onClose?: () => void;
}) => {
  const selected = new Set(selectedOptions || []);
  const groups: Array<{ key: string; label: string; items: TypeOption[] }> = [];
  for (const o of options || []) {
    let g = groups.find((x) => x.key === o.group);
    if (!g) groups.push((g = { key: o.group, label: o.groupLabel, items: [] }));
    g.items.push(o);
  }

  // Keep the selection in taxonomy order so the request (and the export's About sheet) is stable.
  const update = (next: Set<string>) => onUpdateFilter(filterName, (options || []).map((o) => o.type).filter((t) => next.has(t)));

  const toggleType = (type: string) => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type); else next.add(type);
    update(next);
  };

  const toggleGroup = (items: TypeOption[]) => {
    const next = new Set(selected);
    const all = items.every((o) => next.has(o.type));
    items.forEach((o) => (all ? next.delete(o.type) : next.add(o.type)));
    update(next);
  };

  const label = setReportFilterLabels(reportFiltersLabes, title) || title;
  const count = (selectedOptions || []).filter((t) => (options || []).some((o) => o.type === t)).length;

  return (
    <DropdownWrapper title={count ? `${label} · ${count}` : label} variant={count > 0 ? "primary" : "white"} onClose={onClose}>
      <div data-testid="type-filter">
        <div className={gStyles.list}>
          {groups.map((g) => {
            const on = g.items.filter((o) => selected.has(o.type)).length;
            const all = on === g.items.length;
            return (
              <div key={g.key} className={gStyles.group} data-testid={`type-group-${g.key}`}>
                <div
                  role="menuitemcheckbox"
                  aria-checked={all ? true : on ? "mixed" : false}
                  className={gStyles.groupHead}
                  onClick={() => toggleGroup(g.items)}
                >
                  <div className={all ? styles.cbOn : on ? gStyles.cbSome : styles.cb} />
                  <span className={gStyles.groupLabel}>{g.label}</span>
                  <span className={gStyles.groupAll}>{all ? "Clear group" : "Select all"}</span>
                </div>
                {g.items.map((o) => {
                  const isChecked = selected.has(o.type);
                  return (
                    <div
                      key={o.type}
                      role="menuitemcheckbox"
                      aria-checked={isChecked}
                      className={gStyles.typeItem}
                      onClick={() => toggleType(o.type)}
                    >
                      <div className={isChecked ? styles.cbOn : styles.cb} />
                      <span className={gStyles.typeLabel}>{o.type}</span>
                      <span className={gStyles.typeCount}>{o.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {count > 0 && (
          <div className={styles.ddFooter}>
            <button className={styles.ddClear} onClick={() => onUpdateFilter(filterName, [])}>Clear</button>
            <span className={styles.ddSelectedCount}>{count} selected</span>
          </div>
        )}
      </div>
    </DropdownWrapper>
  );
};
