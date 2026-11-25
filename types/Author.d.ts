export type Author = {
  firstName: string
  lastName: string
  targetAuthor?: boolean
  highlightAuthor?: string
  personIdentifier?: string
  // analysis_summary_author.role (ReCiterDB v3.10) when it isn't Author
  role?: string
  // the note shown after the name, e.g. "translator" (reportRow.ts authorRoleNote)
  roleNote?: string
}