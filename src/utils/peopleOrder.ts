// Find People's default order: last name, then first name, then CWID. People with no last name
// (a handful of name-less person rows) go last instead of first, and underscore CWIDs such as
// `_djulius` no longer lead the list, since the CWID is only the final tie-break.
//
// Used by findAll in controllers/db/person.controller.ts. `alias` is the person table's alias in
// the surrounding query (Sequelize uses the model name, `Person`). Next in results on /curate
// follows this order, because it walks the People results as returned.
export const peopleOrderSql = (alias: string): string => {
  const col = (name: string) => `\`${alias}\`.\`${name}\``;
  return [
    `(TRIM(COALESCE(${col("lastName")}, '')) = '') ASC`,
    `TRIM(${col("lastName")}) ASC`,
    `TRIM(${col("firstName")}) ASC`,
    `${col("personIdentifier")} ASC`,
  ].join(", ");
};
