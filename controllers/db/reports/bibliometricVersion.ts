// Which bibliometric report the UI offers (5h P5): the v1 RTF (CALL generateBibliometricReport) or
// the v2 .docx. Read from the admin_settings row viewName = 'bibliometricReport', viewAttributes
// {"version":"rtf"|"docx"}, toggled by SQL with no deploy. Anything other than exactly "docx"
// (row missing, NULL, unparseable JSON, another value) means "rtf", so the default is v1.
// Pure, no imports: node --test loads it directly.

export type BibliometricVersion = "rtf" | "docx";

export const BIBLIOMETRIC_SETTING = "bibliometricReport";

export const parseBibliometricVersion = (raw: unknown): BibliometricVersion => {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return "rtf";
    }
  }
  // A JSON column read raw can come back double-encoded.
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return "rtf";
    }
  }
  if (Array.isArray(v)) v = v[0];
  const version = v && typeof v === "object" ? (v as { version?: unknown }).version : undefined;
  return typeof version === "string" && version.trim().toLowerCase() === "docx" ? "docx" : "rtf";
};
