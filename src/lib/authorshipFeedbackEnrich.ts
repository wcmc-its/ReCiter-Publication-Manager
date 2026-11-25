// The server half of a problem report (/api/db/authorships/feedback): blocks C (the row), D (each
// person) and E (run context) of the feedback plan. Read-only. Runs after the report is saved and
// the reporter has been answered, so nothing here can lose a report: every block has its own
// status, and a failing one is recorded and skipped.
//
// Gentle on the shared pool: one query per table over all people, at most three at once, each
// statement stopped by the database after 5 s, 20 s overall. SET STATEMENT ... FOR scopes the
// limit to that one statement, so it never stays on a pooled connection.
//
// logging: false on every query: Sequelize prints replacements in its SQL log. Columns are checked
// against information_schema before they are selected, because dev and prod differ and one unknown
// column would lose the whole block; one a query cannot do without makes the block unavailable.

import { AsyncLocalStorage } from 'async_hooks'
import { QueryTypes } from 'sequelize'
import { DynamoDBClient, BatchGetItemCommand } from '@aws-sdk/client-dynamodb'
import sequelize from '../db/db'
import { getGoldStandardStrict } from './goldStandardRejections'
import { retiredCwidIndex, retiredCensusInfo } from './directory'
import {
  Block, BlockStop, PEOPLE_DETAIL_CAP, PersonRef, RowKeys, asBlock, blockFailed, buildPeople, bylineSurnames, candidateCwids,
  combineParts, createRunner, dataBlock, errorInfo, expectedCwid, normSurname, orcidForms, part, peopleBlockSkip, personKeys,
  rowKeys, snapshotState, statusBlock, typedKeys,
} from './authorshipFeedback'

const SIBLING_CAP = 20
const COHORT_CAP = 200
const HOLDER_CAP = 500

const TABLES: Record<string, string[]> = {
  person_article: ['id', 'personIdentifier', 'pmid', 'userAssertion', 'authorshipLikelihoodScore'],
  person_article_author: ['personIdentifier', 'pmid', 'rank', 'authorFirstName', 'authorLastName', 'targetAuthor', 'orcid'],
  analysis_summary_author: ['id', 'personIdentifier', 'pmid', 'authorPosition', 'role', 'authorRoleV2', 'soleAuthor', 'authors'],
  external_article: ['uid', 'article_id', 'source_type', 'doi', 'pmid', 'title', 'journal_or_venue', 'pub_date',
    'publication_type', 'added_by', 'date_added', 'method', 'suppressed', 'superseded_by_pmid', 'status', 'author_position'],
  external_record: ['id', 'uid', 'article_id', 'source_type', 'status', 'prev_status', 'status_by', 'status_impersonated_by',
    'status_at', 'added_by', 'added_at', 'provenance', 'method', 'merged_into_id', 'merged_into_pmid', 'superseded_by_pmid',
    'pmid', 'doi', 'doi_norm', 'scopus_eid', 'openalex_id', 'title', 'title_year_key', 'pub_type', 'source_pub_type',
    'type_notice', 'pub_date', 'container_title', 'target_author_index', 'author_count', 'sync_origin', 'pm_touched',
    'created_at', 'updated_at'],
  external_rejection: ['id', 'uid', 'key_type', 'key_value', 'record_id', 'reason', 'rejected_by', 'rejected_at'],
  scholar_active: ['cwid', 'has_confirmed_orcid', 'orcid', 'campus', 'refreshed_at'],
  pubsource_orcid_person: ['personIdentifier', 'personIdentifierType', 'orcid', 'confidence_type', 'mapping_source',
    'articles_accepted', 'articles_pending', 'articles_rejected', 'verified'],
  cornell_pub_orcid_mapping: ['netid', 'orcid'],
  admin_orcid: ['personIdentifier', 'orcid'],
  // Not `notes`.
  identity: ['cwid', 'surname', 'middleName', 'givenName', 'primaryTitle', 'primaryAcademicDepartment',
    'primaryAcademicDivision', 'primaryProgram', 'facultyRank', 'primaryOrg', 'fullTimeFaculty', 'postdoc', 'studentMDNYC',
    'studentMDQatar', 'studentMDPhD', 'studentPhDTriI', 'studentPhDWeill', 'partTimeFaculty', 'voluntaryFaculty',
    'emeritusFaculty', 'adjunctFaculty', 'residentNYP', 'fellow', 'faculty', 'nonFaculty', 'inactiveFaculty', 'alumniMD',
    'alumniMDPHD', 'alumniPHD', 'alumniResidentNYP', 'inactiveNonAlumniStudent', 'startDateWCMFaculty',
    'endDateWCMFaculty', 'startDateWCMStudent', 'endDateWCMStudent', 'createTimestamp', 'modifyTimestamp'],
  // Not `primaryEmail`.
  person: ['id', 'personIdentifier', 'firstName', 'middleName', 'lastName', 'title', 'primaryOrganizationalUnit',
    'primaryInstitution', 'dateAdded', 'dateUpdated', 'countPendingArticles', 'mode'],
  person_person_type: ['id', 'personIdentifier', 'personType'],
  identity_cornell_directory: ['netid', 'display_name', 'given_name', 'surname', 'cwid', 'netid_created', 'loaded_at'],
  admin_feedback_log: ['feedbackID', 'userID', 'personIdentifier', 'articleIdentifier', 'feedback', 'impersonatedByUserID',
    'createTimestamp', 'modifyTimestamp'],
  aar_lane_guard: ['metric', 'value', 'observed_at'],
}
const SIBLING_OMIT = ['authors_json', 'title']

// ---------------------------------------------------------------------------- queries

// Set for the length of one enrichment: has its overall time run out? A block that was cut off
// keeps running in the background, and must not start its next query.
const outOfTime = new AsyncLocalStorage<() => boolean>()

async function q(sql: string, replacements: Record<string, any> = {}): Promise<any[]> {
  if (outOfTime.getStore()?.()) throw new BlockStop('timeout')
  return sequelize.query(`SET STATEMENT max_statement_time=5 FOR ${sql}`,
    { replacements, type: QueryTypes.SELECT, logging: false }) as Promise<any[]>
}

type Schema = Map<string, Set<string>>
const SCHEMA_TTL_MS = 10 * 60 * 1000
let schemaCache: { schema: Schema; expires: number } | null = null

async function loadSchema(): Promise<Schema> {
  if (schemaCache && schemaCache.expires > Date.now()) return schemaCache.schema
  const rows = await q(
    'SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (:tables) ORDER BY ORDINAL_POSITION',
    { tables: [...Object.keys(TABLES), 'authorship_review'] })
  const schema: Schema = new Map()
  for (const r of rows) schema.set(r.t, (schema.get(r.t) ?? new Set<string>()).add(r.c))
  schemaCache = { schema, expires: Date.now() + SCHEMA_TTL_MS }
  return schema
}

/** "`a`, `b`" for the wanted columns this database has; a table or `needed` column it lacks stops the block. */
async function cols(table: string, alias = '', needed: string[] = []): Promise<string> {
  const have = (await loadSchema()).get(table)
  if (!have || needed.some((c) => !have.has(c))) throw new BlockStop('unavailable')
  return TABLES[table].filter((c) => have.has(c)).map((c) => `${alias}\`${c}\``).join(', ')
}

const rowsOf = async (sql: string, r: Record<string, any>) => ({ rows: await q(sql, r) })
const uniqueBy = (rows: any[], key: (r: any) => string) => [...new Map(rows.map((r) => [key(r), r])).values()]

// ---------------------------------------------------------------------------- C: the row

async function siblings(k: RowKeys, selfId: number | null) {
  const have = (await loadSchema()).get('authorship_review')
  if (!have) throw new BlockStop('unavailable')
  const list = [...have].filter((c) => !SIBLING_OMIT.includes(c)).map((c) => `\`${c}\``).join(', ')
  // Separate queries: an OR over these columns cannot use their indexes. The PubMed twin goes both
  // ways through matched_pmid. Capped per query, so a paper with many rows cannot crowd out the
  // twin or the same-DOI rows. Blank ids are null here and never asked about.
  const wheres: Array<[string, Record<string, any>] | null> = [
    k.matchedPmid != null ? ['`pmid` = :v', { v: k.matchedPmid }] : null,
    k.pmid != null ? ['`matched_pmid` = :v', { v: k.pmid }] : null,
    k.pmid != null ? ['`pmid` = :v', { v: k.pmid }] : null,
    k.dois.length ? ['`doi` IN (:v)', { v: k.dois }] : null,
    k.externalId ? ['`external_id` = :v', { v: k.externalId }] : null,
  ]
  const found: any[] = []
  let capped = false
  for (const w of wheres) {
    if (!w) continue
    const rows = (await q(`SELECT ${list} FROM \`authorship_review\` WHERE ${w[0]} ORDER BY \`id\` LIMIT ${SIBLING_CAP + 2}`, w[1]))
      .filter((r: any) => Number(r.id) !== selfId)
    capped = capped || rows.length > SIBLING_CAP
    found.push(...rows.slice(0, SIBLING_CAP))
  }
  return { rows: uniqueBy(found, (r) => String(r.id)), capped }
}

// EVERY holder of the article, not only the people on the card: the real one is often someone else.
async function byline(k: RowKeys) {
  const r = { pmids: k.pmids }
  return combineParts({
    person_article: await part(async () => rowsOf(
      `SELECT ${await cols('person_article')} FROM \`person_article\` WHERE \`pmid\` IN (:pmids) ` +
      `ORDER BY \`userAssertion\` = 'ACCEPTED' DESC, \`authorshipLikelihoodScore\` DESC LIMIT ${HOLDER_CAP}`, r)),
    // LIKE '1%': stored targetAuthor values carry a trailing carriage return.
    target_authors: await part(async () => rowsOf(
      `SELECT ${await cols('person_article_author')} FROM \`person_article_author\` ` +
      `WHERE \`pmid\` IN (:pmids) AND \`targetAuthor\` LIKE '1%' LIMIT ${HOLDER_CAP}`, r)),
    analysis_summary_author: await part(async () => rowsOf(
      `SELECT ${await cols('analysis_summary_author')} FROM \`analysis_summary_author\` WHERE \`pmid\` IN (:pmids) LIMIT ${HOLDER_CAP}`, r)),
  })
}

async function duplicates(k: RowKeys, cwids: string[]) {
  // Asked by DOI, and for these people by article id and (external_record) title+year.
  const both = async (table: string, doiColumn: string, dois: string[], key: (r: any) => string, titleYear: string | null = null) => {
    if (!dois.length && !(cwids.length && (k.articleId || titleYear))) throw new BlockStop('not_applicable')
    const list = await cols(table, '', [...(dois.length ? [doiColumn] : []), ...(titleYear ? ['title_year_key'] : [])])
    const found: any[] = []
    if (dois.length) found.push(...await q(`SELECT ${list} FROM \`${table}\` WHERE \`${doiColumn}\` IN (:dois) LIMIT 100`, { dois }))
    if (k.articleId && cwids.length) {
      found.push(...await q(`SELECT ${list} FROM \`${table}\` WHERE \`uid\` IN (:cwids) AND \`article_id\` = :aid LIMIT 100`,
        { cwids, aid: k.articleId }))
    }
    if (titleYear && cwids.length) {
      found.push(...await q(`SELECT ${list} FROM \`${table}\` WHERE \`uid\` IN (:cwids) AND \`title_year_key\` = :ty LIMIT 100`,
        { cwids, ty: titleYear }))
    }
    return { rows: uniqueBy(found, key) }
  }
  // As rejections are written: SOURCE_ID, DOI, TITLE_YEAR.
  const rejectionKeys = [k.articleId, k.doiNorm, k.externalId, k.titleYear].filter(Boolean)
  return combineParts({
    external_article: await part(() => both('external_article', 'doi', k.dois, (r) => `${r.uid}|${r.article_id}`)),
    external_record: await part(() => both('external_record', 'doi_norm', k.doiNorm ? [k.doiNorm] : [], (r) => String(r.id), k.titleYear)),
    external_rejection: !cwids.length || !rejectionKeys.length ? statusBlock('not_applicable') : await part(async () => rowsOf(
      `SELECT ${await cols('external_rejection')} FROM \`external_rejection\` WHERE \`uid\` IN (:cwids) AND \`key_value\` IN (:keys) LIMIT 200`,
      { cwids, keys: rejectionKeys })),
  })
}

async function orcid(forms: string[]) {
  const r = { forms }
  return combineParts({
    scholar_active: await part(async () => rowsOf(
      `SELECT ${await cols('scholar_active', '', ['orcid'])} FROM \`scholar_active\` WHERE \`orcid\` IN (:forms)`, r)),
    pubsource_orcid_person: await part(async () => rowsOf(
      `SELECT ${await cols('pubsource_orcid_person', '', ['orcid'])} FROM \`pubsource_orcid_person\` ` +
      "WHERE `orcid` IN (:forms) AND `personIdentifierType` = 'CWID' LIMIT 200", r)),
    cornell_pub_orcid_mapping: await part(async () => rowsOf(
      `SELECT ${await cols('cornell_pub_orcid_mapping', '', ['orcid'])} FROM \`cornell_pub_orcid_mapping\` WHERE \`orcid\` IN (:forms) LIMIT 200`, r)),
  })
}

// Cohort size drives single_candidate and the confidence, and only five candidates are stored.
// Compared without spaces and punctuation, as the producer keys it ("Example-Sample", "Example
// Sample" and "ExampleSample" are one cohort); the collation folds case and accents.
const SURNAME_MARKS = '[[:space:][:punct:]\u2018\u2019\u02BC\u2010\u2011\u2013]'
async function surnameCohort(surnames: string[]) {
  const normalised = [...new Set(surnames.map(normSurname).filter(Boolean))]
  if (!normalised.length) throw new BlockStop('not_applicable')
  // COLLATE on identity.cwid, the driving side, so person's own index answers the join.
  const rows = await q(
    `SELECT ${await cols('identity', 'i.')}, p.\`firstName\` AS personFirstName, p.\`middleName\` AS personMiddleName, ` +
    'p.`lastName` AS personLastName FROM `identity` i LEFT JOIN `person` p ' +
    'ON p.`personIdentifier` = i.`cwid` COLLATE utf8mb4_unicode_ci ' +
    "WHERE REGEXP_REPLACE(i.`surname`, :marks, '') IN (:normalised) OR REGEXP_REPLACE(p.`lastName`, :marks, '') IN (:normalised) " +
    `ORDER BY i.\`cwid\` LIMIT ${COHORT_CAP + 1}`, { normalised, marks: SURNAME_MARKS })
  const kept = rows.slice(0, COHORT_CAP)
  const cwids = [...new Set(kept.map((r) => String(r.cwid || '')).filter(Boolean))]
  const types = !cwids.length ? [] : await q(
    'SELECT `personIdentifier`, `personType` FROM `person_person_type` ' +
    "WHERE `personIdentifier` IN (:cwids) AND `personType` LIKE 'cornell-%'", { cwids })
  return { surnames, normalised, rows: kept, capped: rows.length > COHORT_CAP, cornell_types: types }
}

// ---------------------------------------------------------------------------- D: each person

const identityDdb = new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1' })

// The four DynamoDB shapes a name record uses.
function plain(v: any): any {
  if (v == null || v.NULL) return null
  if (v.S !== undefined) return v.S
  if (v.N !== undefined) return Number(v.N)
  if (v.BOOL !== undefined) return v.BOOL
  if (v.L) return v.L.map(plain)
  if (v.M) return Object.fromEntries(Object.entries(v.M).map(([k, x]) => [k, plain(x)]))
  return null
}

// Keys as rendered AND canonical: they are case-exact there, so "not found" under one spelling is
// itself the finding. At most 24 keys, well under BatchGetItem's 100.
async function ddbIdentity(uids: string[]) {
  const resp = await identityDdb.send(new BatchGetItemCommand({
    RequestItems: {
      Identity: {
        Keys: uids.map((uid) => ({ uid: { S: uid } })),
        ProjectionExpression: 'uid, #i.#p, #i.#a',
        ExpressionAttributeNames: { '#i': 'identity', '#p': 'primaryName', '#a': 'alternateNames' },
      },
    },
  }))
  if (resp.UnprocessedKeys?.Identity?.Keys?.length) throw new BlockStop('error', undefined, { name: 'Throttled', code: null })
  const by = new Map((resp.Responses?.Identity ?? []).map((it: any) => [it.uid?.S, it.identity?.M]))
  return {
    rows: uids.map((uid) => ({
      uid, exists: by.has(uid),
      primaryName: plain(by.get(uid)?.primaryName), alternateNames: plain(by.get(uid)?.alternateNames),
    })),
  }
}

// The state AFTER anything the reporter just did. Membership and list lengths only. One read at a
// time; stops at the first failure and keeps what it read.
async function goldStandard(uids: string[], pmids: number[]) {
  const rows: any[] = []
  for (const uid of uids) {
    if (outOfTime.getStore()?.()) throw new BlockStop('timeout')
    try {
      const { known, rejected } = await getGoldStandardStrict(uid)
      rows.push({
        uid, read_at: new Date().toISOString(), known_length: known.length, rejected_length: rejected.length,
        known: pmids.filter((p) => known.includes(p)), rejected: pmids.filter((p) => rejected.includes(p)),
      })
    } catch (e) {
      const { name, code } = errorInfo(e)
      throw new BlockStop('error', { rows, failed_uid: uid }, { name, code })
    }
  }
  return { pmids, rows }
}

async function orcidByCwid(cwids: string[]) {
  const by = (table: string, column: string) => part(async () => rowsOf(
    `SELECT ${await cols(table, '', [column])} FROM \`${table}\` WHERE \`${column}\` IN (:cwids) LIMIT 500`, { cwids }))
  return combineParts({
    scholar_active: await by('scholar_active', 'cwid'),
    pubsource_orcid_person: await by('pubsource_orcid_person', 'personIdentifier'),
    cornell_pub_orcid_mapping: await by('cornell_pub_orcid_mapping', 'netid'),
    admin_orcid: await by('admin_orcid', 'personIdentifier'),
  })
}

// An empty census is also what a directory outage looks like, so availability and age travel with it.
async function retired(people: PersonRef[]) {
  if (!retiredCensusInfo().configured) throw new BlockStop('unavailable')
  const index = await retiredCwidIndex()
  const census = retiredCensusInfo()
  if (!census.available) throw new BlockStop('error', { census }, { name: 'CensusUnavailable', code: null })
  return {
    census,
    people: people.map((p) => {
      const id = (p.canonical ?? p.as_rendered).toLowerCase()
      return { cwid: p.as_rendered, retired: index.has(id), superseded_by: index.get(id) ?? null }
    }),
  }
}

// ---------------------------------------------------------------------------- all of it

export interface EnrichInput {
  reviewId: number | null
  typedRef: string | null
  expected: string | null
  aboutCwids: string[]
  env: Record<string, any> // block E's context, assembled by the caller
}

export interface EnrichResult {
  server_snapshot: string
  snapshot_state: 'complete' | 'partial'
  author_key: string | null
  source: string | null
  pmid: number | null
  external_id: string | null
}

export function enrichFeedback(input: EnrichInput): Promise<EnrichResult> {
  const { run, expired } = createRunner()
  return outOfTime.run(expired, () => collect(input, run))
}

async function collect(input: EnrichInput, run: (fn: () => Promise<any>) => Promise<Block>): Promise<EnrichResult> {
  const rawRow: Block = input.reviewId == null ? statusBlock('not_applicable')
    : await run(async () => (await q('SELECT * FROM `authorship_review` WHERE `id` = :id LIMIT 1', { id: input.reviewId }))[0])
  const row: any = rawRow.status === 'ok' ? rawRow.data : null
  const keys = row ? rowKeys(row) : typedKeys(input.typedRef)
  // Ids unknown because the row could not be read, as against a report that has no row.
  const rowUnread = !keys && blockFailed(rawRow)
  const noKeys = (): Block => statusBlock(rowUnread ? 'not_loaded' : 'not_applicable')
  const when = async (applies: any, fn: () => Promise<any>): Promise<Block> => {
    if (!keys) return noKeys()
    const b = applies ? await run(fn) : statusBlock('not_applicable')
    return keys.from === 'typed' ? { ...b, from: 'typed' } : b
  }

  const forms = orcidForms(row?.byline_orcid)
  const surnames = bylineSurnames(row?.wcm_author)
  const [sib, by, orc, cohort, laneGuard, scholarActive] = await Promise.all([
    when(true, () => siblings(keys!, row ? Number(row.id) : null)),
    when(keys?.pmids.length, () => byline(keys!)),
    when(forms.length, () => orcid(forms)),
    when(surnames.length, () => surnameCohort(surnames)),
    run(async () => rowsOf(`SELECT ${await cols('aar_lane_guard')} FROM \`aar_lane_guard\``, {})),
    run(async () => {
      await cols('scholar_active', '', ['refreshed_at']) // stops the block when the table is absent
      return rowsOf('SELECT MAX(`refreshed_at`) AS refreshed_at, COUNT(*) AS n FROM `scholar_active`', {})
    }),
  ])

  // Most direct first: the list is capped.
  const holders: any[] = by.data?.person_article?.data?.rows ?? []
  const targets: any[] = by.data?.target_authors?.data?.rows ?? []
  const atSlot = new Set(targets
    .filter((t) => row && Number(t.pmid) === keys?.pmid && Number(t.rank) === Number(row.author_position))
    .map((t) => String(t.personIdentifier)))
  const siblingRows: any[] = sib.data?.rows ?? []
  const people = buildPeople([
    { cwid: row?.top_cwid, why: 'top' },
    ...candidateCwids(row?.candidate_cwids_json).map((cwid) => ({ cwid, why: 'candidate' })),
    { cwid: row?.resolution_cwid, why: 'resolution' },
    { cwid: expectedCwid(input.expected), why: 'expected' },
    ...input.aboutCwids.map((cwid) => ({ cwid, why: 'about' })),
    ...holders.filter((h) => h.userAssertion === 'ACCEPTED' && atSlot.has(String(h.personIdentifier)))
      .map((h) => ({ cwid: h.personIdentifier, why: 'accepted_by' })),
    ...holders.map((h) => ({ cwid: h.personIdentifier, why: 'byline' })),
    ...siblingRows.flatMap((s) => [
      { cwid: s.resolution_cwid, why: 'sibling_resolution' },
      { cwid: s.top_cwid, why: 'sibling_candidate' },
      ...candidateCwids(s.candidate_cwids_json).map((cwid) => ({ cwid, why: 'sibling_candidate' })),
    ]),
  ])
  const list = people.list
  const cwids = personKeys(list)
  const detail = personKeys(list.slice(0, PEOPLE_DETAIL_CAP))
  const pmids = keys?.pmids ?? []
  const forPeople = async (needsPmid: boolean, fn: () => Promise<any>): Promise<Block> => {
    const skip = peopleBlockSkip({
      people: list.length, needsPmid, pmids: pmids.length, rowUnread, seedsFailed: blockFailed(by) || blockFailed(sib),
    })
    return skip ? statusBlock(skip) : run(fn)
  }
  const byColumn = (table: string, column: string, ids: string[], extra = '') => async () => rowsOf(
    `SELECT ${await cols(table, '', [column])} FROM \`${table}\` WHERE \`${column}\` IN (:ids)${extra}`, { ids })

  const [dup, identity, person, personTypes, cornellDirectory, dynamoIdentity, gold, feedbackLog, bylines, orcids, retiredBlock] =
    await Promise.all([
      when(keys?.dois.length || keys?.articleId || keys?.titleYear, () => duplicates(keys!, cwids)),
      forPeople(false, byColumn('identity', 'cwid', detail)),
      // ALL rows: one cwid can have several.
      forPeople(false, byColumn('person', 'personIdentifier', detail, ' ORDER BY `personIdentifier`, `id`')),
      forPeople(false, byColumn('person_person_type', 'personIdentifier', detail)),
      forPeople(false, async () => rowsOf(
        `SELECT ${await cols('identity_cornell_directory')} FROM \`identity_cornell_directory\` ` +
        'WHERE `netid` IN (:ids) OR `cwid` IN (:ids)', { ids: detail })),
      forPeople(false, () => ddbIdentity(detail)),
      forPeople(true, () => goldStandard(cwids, pmids)),
      forPeople(true, async () => rowsOf(
        `SELECT ${await cols('admin_feedback_log', 'f.', ['impersonatedByUserID'])}, u.\`personIdentifier\` AS actor_cwid, v.\`personIdentifier\` AS impersonator_cwid ` +
        'FROM `admin_feedback_log` f LEFT JOIN `admin_users` u ON u.`userID` = f.`userID` ' +
        'LEFT JOIN `admin_users` v ON v.`userID` = f.`impersonatedByUserID` ' +
        'WHERE f.`personIdentifier` IN (:cwids) AND f.`articleIdentifier` IN (:pmids) ORDER BY f.`feedbackID`', { cwids, pmids })),
      // Uncut: the matcher needs two or more papers under a form.
      forPeople(false, () => rowsOf(
        'SELECT `personIdentifier`, `articleAuthorNameFirstName`, `articleAuthorNameLastName`, COUNT(*) AS n, ' +
        "MAX(NULLIF(`articleYear`, 0)) AS last_year FROM `person_article` WHERE `personIdentifier` IN (:cwids) AND `userAssertion` = 'ACCEPTED' " +
        'GROUP BY `personIdentifier`, `articleAuthorNameFirstName`, `articleAuthorNameLastName`', { cwids })),
      forPeople(false, () => orcidByCwid(cwids)),
      forPeople(false, () => retired(list)),
    ])

  const snapshot = {
    row: { raw_row: rawRow, siblings: sib, byline: by, duplicates: dup, orcid: orc, surname_cohort: cohort },
    people: {
      list, identity, person, person_types: personTypes, cornell_directory: cornellDirectory, ddb_identity: dynamoIdentity,
      goldstandard: gold, feedback_log: feedbackLog, accepted_bylines: bylines, orcid_by_cwid: orcids, retired: retiredBlock,
    },
    run: {
      lane_guard: laneGuard, scholar_active: scholarActive,
      env: dataBlock({ ...input.env, people_dropped: people.dropped, people_detailed: Math.min(list.length, PEOPLE_DETAIL_CAP) }),
    },
  }
  return {
    server_snapshot: JSON.stringify(snapshot),
    snapshot_state: snapshotState(snapshot),
    author_key: row?.author_key ?? null,
    source: row?.source ?? null,
    pmid: keys?.pmid ?? null,
    external_id: row?.external_id ?? null,
  }
}
