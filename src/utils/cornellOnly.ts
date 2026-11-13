// "Cornell-only" person: a Cornell Ithaca person (a `cornell-ithaca` row in person_person_type)
// whose reciterdb `person` row has no ReCiter Analysis behind it. ReCiterDB inserts those rows
// from Identity alone, so every Analysis column -- dateAdded included -- is NULL. They are never
// run through ReCiter: Find People labels them and sends them to /authorships, /curate refuses
// them, and the reports person picker leaves them out. Dual WCM/Cornell appointees have an
// Analysis-backed row (dateAdded set), so they are NOT Cornell-only and behave as before.
//
// One SQL fragment for every caller, so the flag, the exclusion and the guard can't disagree.
// `alias` is the person table's alias in the surrounding query (Sequelize uses the model name,
// `Person`).
export const CORNELL_ITHACA_PERSON_TYPE = "cornell-ithaca";

export const cornellOnlySql = (alias: string): string =>
  `(\`${alias}\`.\`dateAdded\` IS NULL AND EXISTS (SELECT 1 FROM \`person_person_type\` \`cornellPpt\`` +
  ` WHERE \`cornellPpt\`.\`personIdentifier\` = \`${alias}\`.\`personIdentifier\`` +
  ` AND \`cornellPpt\`.\`personType\` = '${CORNELL_ITHACA_PERSON_TYPE}'))`;
