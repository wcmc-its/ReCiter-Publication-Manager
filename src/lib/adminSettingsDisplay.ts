/**
 * Display copy for the Configuration page (AdminSettings).
 *
 * The admin_settings rows keep their stored viewLabel values; other screens look rows up by
 * viewName, so renames happen here, keyed on the stable viewName, and never in the DB.
 */

export const SETTING_DISPLAY: Record<string, { name: string; desc: string }> = {
  reportingArticleCSV: {
    name: "Excel export · publications",
    desc: "Columns and row limit for the Publications sheet (and its CSV download)",
  },
  reportingAuthorshipCSV: {
    name: "Excel export · authorships",
    desc: "Row limit for the Authorships sheet (and its CSV download)",
  },
  reportingArticleRTF: {
    name: "Word export",
    desc: "Layout and record limits for Word (.docx) bibliography reports and bibliometric analyses",
  },
};

export const displayName = (s: { viewName?: string; viewLabel?: string }): string =>
  SETTING_DISPLAY[s.viewName]?.name ?? s.viewLabel ?? "";

/** Display description override, or undefined to fall back to the viewLabel-based copy. */
export const displayDesc = (s: { viewName?: string }): string | undefined =>
  SETTING_DISPLAY[s.viewName]?.desc;

/* The Word export max limit is validated against 30000. Older call sites passed the stored
   viewLabel, so both keys are accepted. */
export const WORD_EXPORT_LIMIT = 30000;
export const isWordExportSetting = (key: unknown): boolean =>
  key === "reportingArticleRTF" || key === "Reporting Article RTF";
export const exceedsWordExportLimit = (value: unknown): boolean =>
  Number(value) > WORD_EXPORT_LIMIT;

/** Short right-hand summary for a collapsed setting row. */
export const settingSummary = (
  s: { viewName?: string; viewAttributes?: any[] },
  dirty: boolean,
): string => {
  if (dirty) return "Unsaved changes";
  const attrs = Array.isArray(s.viewAttributes) ? s.viewAttributes : [];
  if (s.viewName === "EmailNotifications") {
    const master = attrs.find(a => a && a.labelUserKey === "emailNotifications");
    if (master && "isVisible" in master) return master.isVisible ? "Enabled" : "Off";
  }
  const limit = attrs.find(a => a && "maxLimit" in a && a.maxLimit !== "" && a.maxLimit != null);
  if (limit && SETTING_DISPLAY[s.viewName]) return `Max ${Number(limit.maxLimit).toLocaleString("en-US")}`;
  return `${attrs.length} setting${attrs.length === 1 ? "" : "s"}`;
};
