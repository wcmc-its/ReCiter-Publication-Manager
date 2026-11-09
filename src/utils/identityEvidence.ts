// Identity-evidence rows for the Curate card (moved from Publication.tsx, logic unchanged).
// Pure: no React, so it can be tested with `node --test` and reused by the 2b chips and tally bar.

export type MatchType = 'match' | 'partial' | 'mismatch' | 'nodata'

export interface EvidenceItem {
  name: string
  tags: string[]
  source?: string
  url?: string
  urlName?: string
}

export interface EvidenceRow {
  title: string[]
  name: string
  points: string | number
  pointsText: string
  institutionalData: string
  articleData: string
  displayInstDataList: boolean
  displayArticleDataList: boolean
  institutionalDataList: EvidenceItem[]
  articleDataList: EvidenceItem[]
  source: string
  spanData: boolean
}

export const fullName = (person: any) => {
  let userName = "";
  if(person !== undefined) {
      if(person.firstName !== undefined) {
        userName += person.firstName + ' ';
      }
      if(person.middleInitial !== undefined) {
        userName += person.middleName + ' ';
      }
      if(person.lastName !== undefined) {
        userName += person.lastName + ' ';
      }
  }
  return userName; 
}

export const EVIDENCE_ROW_TITLES = [
  { authorNameEvidence: 'Name' },
  { relationshipEvidence: 'Relationships'},
  { emailEvidence : 'Email'},
  { organizationalUnitEvidence : 'Departmental affiliation'},
  { affiliationEvidence: 'Target author affiliation' },
  { grantEvidence: 'Grants' },
  { journalCategoryEvidence: 'Journal category'},
  { educationYearEvidence: 'Degree year discrepancy'},
  { genderEvidence: 'Inferred gender of name '},
  { articleCountEvidence: 'Candidate article count'},
  { authorCountEvidence: 'Candidate author count'},
  //{ averageClusteringEvidence: 'Clustering'},
  { coAuthorAffiliationEvidence: 'Co-author affiliation'},
]

export const EVIDENCE_CELL_FIELDS = {
   authorNameEvidence: { points: 'nameScoreTotal', dataFormat: 'true' },
   relationshipEvidence: { relationshipNegativeScore: 'relationshipNegativeMatchScore',relationshipPostiveScore: 'relationshipPositiveMatchScore', relationshipIdentityCount: 'relationshipIdentityCount', dataFormat: 'true'},
   emailEvidence: { points: 'emailMatchScore', institutionalData:'emailMatch', articleData: 'emailMatch'}, 
   organizationalUnitEvidence: { dataFormat: 'true' },
   affiliationEvidence: { scopusUrl: 'https://www.scopus.com/affil/profile.uri?afid=', dataFormat: 'true' } ,
   grantEvidence: { dataFormat: 'true' },
   journalCategoryEvidence: { points: 'journalSubfieldScore', dataFormat: 'true'},
   educationYearEvidence: { points: 'educationYearEvidence', articleData: 'articleYear', dataFormat: 'true'},
   genderEvidence: { source: 'https://data.world/howarder/gender-by-name', dataFormat: 'true'},
   articleCountEvidence: { institutionalData:'-', articleData: 'countArticlesRetrieved', points: 'articleCountScore'},
   authorCountEvidence: { institutionalData:'-', articleData: 'countAuthors', points: 'authorCountScore'},
   //averageClusteringEvidence: { institutionalData:'-', dataFormat: 'true', points: 'clusterScoreModificationOfTotalScore'},
   personTypeEvidence: { institutionalData: 'personType', points: 'personTypeScore'},
   coAuthorAffiliationEvidence: { dataFormat: 'true'},
}

export const displayRow = (row: Record<string, string>, evidence: any) => {
  if (evidence.hasOwnProperty(Object.keys(row)[0])) {
    if (Object.keys(row)[0] === 'relationshipEvidence') {
        return true;
    } else {
      return true
    }
  } else if (Object.keys(row)[0] === 'coAuthorAffiliationEvidence') {
    if(evidence.affiliationEvidence !== undefined) {
      if (evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation !== undefined) {
        return true;
      }
    }
  } else{
    return false;
  }
}

export const determineMatchType = (rowName: string, points: any, evidence?: any): MatchType => {
  const p = Number(points);
  if (isNaN(p) || p === 0) return 'nodata';
  if (p > 1) return 'match';
  if (p > 0) return 'partial';
  return 'mismatch';
};

export const MATCH_COLORS: Record<MatchType, { bg: string; border: string; label: string }> = {
  match: { bg: '#dcfce7', border: '#22c55e', label: 'Strong match' },
  partial: { bg: '#fef3c7', border: '#f59e0b', label: 'Partial / weak' },
  mismatch: { bg: '#fee2e2', border: '#ef4444', label: 'Mismatch' },
  nodata: { bg: '#f3f4f6', border: '#9ca3af', label: 'No data' },
};

export const buildEvidenceRows = (evidence: any): EvidenceRow[] => {
  let evidenceTableRows: EvidenceRow[] = []
    EVIDENCE_ROW_TITLES.filter((row) => displayRow(row, evidence)).map((title, index) => {
      let rowName = Object.keys(title)[0];
      let rowFields = EVIDENCE_CELL_FIELDS[rowName];
      let points = '';
      let pointsText = '';
      let source = '';
      let institutionalData = '-';
      let articleData = '-';
      let displayInstDataList = false;
      let displayArticleDataList = false;
      let institutionalDataList: EvidenceItem[] = [];
      let articleDataList: EvidenceItem[] = [];
      if (rowFields && evidence[rowName]) {
        if (rowFields.hasOwnProperty('points')) {
          if (evidence[rowName]) {
            if (evidence[rowName][rowFields['points']]) {
              let unFormattedpoints = evidence[rowName][rowFields['points']]
              points = (Math.round(unFormattedpoints * 100 + Number.EPSILON) / 100).toString();
            }
          }
        }

        if (rowFields['dataFormat']) {
          if (rowName === 'authorNameEvidence') {
            institutionalData = fullName(evidence[rowName].institutionalAuthorName)
            articleData = fullName(evidence[rowName].articleAuthorName)
          }

          if (rowName === 'relationshipEvidence') {
            points = (evidence[rowName].relationshipPositiveMatchScore + evidence[rowName].relationshipNegativeMatchScore).toFixed(2)
            const posScore = (evidence[rowName].relationshipPositiveMatchScore ?? 0).toFixed(2);
            const negScore = (evidence[rowName].relationshipNegativeMatchScore ?? 0).toFixed(2);
            const idCount = evidence[rowName].relationshipIdentityCount || 0;
            pointsText = `+${posScore} / \u2212${Math.abs(Number(negScore)).toFixed(2)} \u00B7 ${idCount} identities`
            if (evidence[rowName].hasOwnProperty('relationshipPositiveMatch')) {
              displayInstDataList = true;
              displayArticleDataList = true;
              evidence[rowName].relationshipPositiveMatch.forEach(match => {
                let username = fullName(match.relationshipNameIdentity);
                let tags = match.relationshipType;
                institutionalDataList.push({ name: username, tags: tags});
                articleDataList.push({ name: username, tags: []});
              });
            }
          }

          if (rowName === 'affiliationEvidence') {
            let scopusTargetAuthorAffiliationScore = 0;
            let pubmedTargetAuthorAffiliationScore = 0;
            displayInstDataList = true;
            displayArticleDataList = true;
            if (evidence[rowName].hasOwnProperty('scopusTargetAuthorAffiliation')) {
              let matchType = ''
              evidence[rowName].scopusTargetAuthorAffiliation.forEach((scopusTargetAuthorAffiliation: any) => {
                scopusTargetAuthorAffiliationScore = scopusTargetAuthorAffiliationScore + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore
                if(scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                  if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                      matchType = 'Affiliation'
                  } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                      matchType = 'Affiliation'
                  } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                      matchType = 'No data available'
                  } else {
                      matchType = 'No Match'
                  }
                }
                let targetAuthorInstitutionalAffiliationIdentity = ''
                if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationIdentity')) {
                  targetAuthorInstitutionalAffiliationIdentity = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationIdentity
                }
                if (matchType === 'No data available') {
                  institutionalDataList.push({ name: '-', tags: []})
                  articleDataList.push({ name: '', tags: [matchType]})
                } else {
                  institutionalDataList.push({ name: targetAuthorInstitutionalAffiliationIdentity, tags: [matchType]});
                  let targetAuthorInstitutionalAffiliationArticleScopusLabel = ''
                  if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationArticleScopusLabel')) {
                      targetAuthorInstitutionalAffiliationArticleScopusLabel = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusLabel
                  }
                  articleDataList.push({ name: targetAuthorInstitutionalAffiliationArticleScopusLabel, tags: ['Scopus'], source: rowFields['scopusUrl'] + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusAffiliationId});
                }
              })
            }
            if(evidence[rowName].hasOwnProperty('pubmedTargetAuthorAffiliation')) {
              displayInstDataList = true;
              displayArticleDataList = true;
              let matchType = ''
              pubmedTargetAuthorAffiliationScore = Number(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore)
              if (evidence[rowName].pubmedTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                  if (evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                      matchType = 'Affiliation'
                  } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                      matchType = 'Affiliation'
                  } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                      matchType = 'No data available'
                  } else {
                      matchType = 'No Match'
                  }
              }
              displayInstDataList = false;
              institutionalData = '-';
              articleDataList.push({ name: evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticlePubmedLabel, tags: ['PubMed']})
            }
            let totalScore = scopusTargetAuthorAffiliationScore + pubmedTargetAuthorAffiliationScore
            points = totalScore.toString();
          }

          if (rowName === 'organizationalUnitEvidence') {
            let scoreTotal = 0
            let itemCount = 0
            displayInstDataList = true;
            displayArticleDataList = true;
            evidence[rowName].forEach((orgUnitItem: any) => {
                itemCount++
                scoreTotal = scoreTotal + Number(orgUnitItem.organizationalUnitMatchingScore + orgUnitItem.organizationalUnitModifierScore)
                if(orgUnitItem.hasOwnProperty('organizationalUnitType')) {
                  const unitType = orgUnitItem.organizationalUnitType.charAt(0).toUpperCase() + orgUnitItem.organizationalUnitType.slice(1).toLowerCase();
                  institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: [unitType]})
                } else {
                  institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: []})
                }
                if(itemCount === 1) {
                  articleDataList.push({ name: orgUnitItem.articleAffiliation, tags: ['PubMed']})
                }
            })
            points = scoreTotal.toString();
          }

          if (rowName === 'journalCategoryEvidence') {
            displayInstDataList = true;
            displayArticleDataList = true;
            if (evidence[rowName].journalSubfieldDepartment === 'NO_MATCH') {
              displayInstDataList = false;
              institutionalData = '-';
            } else {
              institutionalDataList.push({ name: evidence[rowName].journalSubfieldDepartment, tags: ['Org Unit'] })
            }
            articleDataList.push({ name: evidence[rowName].journalSubfieldScienceMetrixLabel, tags: ['Journal Category']})
          }

          if (rowName === 'educationYearEvidence') {
            if (evidence[rowName].identityBachelorYear !== undefined) {
              institutionalData = evidence[rowName].identityBachelorYear + ' - Bachelors'
            }
            if (evidence[rowName].identityDoctoralYear !== undefined) {
              institutionalData = (institutionalData === '-') ? evidence[rowName].identityDoctoralYear + ' - Doctoral' : institutionalData + ' , ' + evidence[rowName].identityDoctoralYear + ' - Doctoral';
            }
            points = evidence[rowName].discrepancyDegreeYearBachelorScore + evidence[rowName].discrepancyDegreeYearDoctoralScore
          }

          if (rowName === 'genderEvidence') {
            if(evidence[rowName].hasOwnProperty('genderScoreIdentity')) {
              if(Number(evidence[rowName].genderScoreIdentity) >= 0.5) {
                  institutionalData = 'Male - ' + (Number(evidence[rowName].genderScoreIdentity) * 100) + '% probability'
              } else {
                institutionalData = 'Female - ' + Math.round(((1 - Number(evidence[rowName].genderScoreIdentity)) * 100)) + '% probability'
              }
            }
            if (evidence[rowName].hasOwnProperty('genderScoreArticle')) {
              if(Number(evidence[rowName].genderScoreArticle) >= 0.5) {
                articleData = 'Male - ' + (Number(evidence[rowName].genderScoreArticle) * 100) + '% probability'
            } else {
                articleData = 'Female - ' + Math.round(((1 - Number(evidence[rowName].genderScoreArticle)) * 100)) + '% probability'
            }
            }
          }

          if (rowName === 'averageClusteringEvidence') {
            displayArticleDataList = true;
            articleDataList.push({ name: 'Score of article without clustering: ' + evidence[rowName].totalArticleScoreWithoutClustering, tags: []});
            articleDataList.push({ name: 'Average score of cluster: ' + evidence[rowName].clusterScoreAverage, tags: []});
          }
        }

        if (rowName == 'grantEvidence') {
          let scoreTotal = 0
          if(evidence[rowName].grants !== undefined && evidence[rowName].grants.length > 0) {
            evidence[rowName].grants.forEach((grant: any) => {
                scoreTotal = scoreTotal + grant.grantMatchScore
                displayInstDataList = true;
                displayArticleDataList = true;
                institutionalDataList.push({ name: grant.institutionGrant, tags: []})
                articleDataList.push({ name: grant.articleGrant, tags: []})
            })
            points = scoreTotal.toString();
          }
        }

        if (rowName == 'genderEvidence') {
          points = evidence[rowName].genderScoreIdentityArticleDiscrepancy.toString();
        }

        if (rowFields.hasOwnProperty('source')) {
          source = rowFields['source'];
        }

        if (rowFields.hasOwnProperty('institutionalData')) {
          if (evidence[rowName] && evidence[rowName][rowFields['institutionalData']]) {
            institutionalData = evidence[rowName][rowFields['institutionalData']];
          }
        }

        if (rowFields.hasOwnProperty('articleData')) {
          if (evidence[rowName] && evidence[rowName][rowFields['articleData']]) {
            articleData = evidence[rowName][rowFields['articleData']];
          }
        }
      }

      if (rowName === 'coAuthorAffiliationEvidence') {
        let scopusNonTargetAuthorAffiliationScore = evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationScore;
        if(evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution !== undefined) {
          displayInstDataList = true;
          displayArticleDataList = true;
          evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution.forEach((matchingKnownInst: any) => {
              let knownInst = matchingKnownInst.split(', ')
              let articleDataName = knownInst[2] + ' author(s) from '
              institutionalDataList.push({ name: knownInst[0], tags: ['Affiliation']})
              articleDataList.push({ name: articleDataName, tags: ['Scopus'], url: "https://www.scopus.com/affil/profile.uri?afid=" + knownInst[1], urlName: knownInst[0]})
          })
        }

        if(evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution !== undefined) {
          displayInstDataList = true;
          displayArticleDataList = true;
          evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution.forEach((matchingCollabInst: any) => {
            let collabInst = matchingCollabInst.split(', ')
            institutionalDataList.push({ name: collabInst[0], tags: ['Affiliation']})
            articleDataList.push({ name: collabInst[2] + ' author(s) from ', url: "https://www.scopus.com/affil/profile.uri?afid=" + collabInst[1], urlName: collabInst[0], tags: ['Scopus']})
          })
        }

        points = scopusNonTargetAuthorAffiliationScore.toString()
      }

      let evidenceTableRowData = {
        title: Object.values(title),
        name: Object.keys(title)[0],
        points: points,
        pointsText: pointsText,
        institutionalData: institutionalData,
        articleData: articleData,
        displayInstDataList: displayInstDataList,
        displayArticleDataList: displayArticleDataList,
        institutionalDataList: institutionalDataList,
        articleDataList: articleDataList,
        source: source,
        spanData: Object.keys(title)[0] === 'relationshipEvidence',
      }

      evidenceTableRows.push(evidenceTableRowData);
    })

    // Sort Evidence Rows by highest score first
    evidenceTableRows.sort((a: any, b: any) => Math.abs(b.points) - Math.abs(a.points))

    // Keep Author Name Evidence at the top
    const authorNameEvidenceIndex = evidenceTableRows.findIndex((e) => e.name === 'authorNameEvidence');
    if (authorNameEvidenceIndex > 0) {
      const authorNameEvidenceData = evidenceTableRows[authorNameEvidenceIndex];
      evidenceTableRows.splice(authorNameEvidenceIndex, 1);
      evidenceTableRows.unshift(authorNameEvidenceData);
    }
  return evidenceTableRows
}

// ---- Card summary (Phase 2b): chips, tally, raw affiliation, known co-authors ----

export interface IdentityChip { label: string; kind: MatchType; tip: string }

// Chip kind = the evidence-table row's kind, so a chip never disagrees with the row it summarizes.
const CHIP_ROWS: [string, string][] = [
  ['authorNameEvidence', 'Name'],
  ['educationYearEvidence', 'Career'],
  ['affiliationEvidence', 'Affiliation'],
  ['journalCategoryEvidence', 'Field'],
]

const norm = (s: any) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Last name + first initial. ponytail: initial-level matching, so two co-authors sharing both
// collide; byline author ids would fix that if PM ever gets them.
export const authorKey = (a: any): string => {
  const last = norm(a?.lastName).replace(/[^a-z]/g, '')
  const first = norm(a?.firstName).replace(/[^a-z]/g, '')
  return last ? `${last}|${first.charAt(0)}` : ''
}

export interface CoauthorIndex { byKey: Map<string, Set<number>>; names: Map<string, string>; self: Set<string> }

// Co-authors on the person's accepted papers. Every name that was ever the target author is "self"
// and never counts.
export const buildCoauthorIndex = (articles: any[] = []): CoauthorIndex => {
  const byKey = new Map<string, Set<number>>(), names = new Map<string, string>(), self = new Set<string>()
  for (const art of articles) {
    for (const a of art?.reCiterArticleAuthorFeatures || []) if (a.targetAuthor) self.add(authorKey(a))
    if (art?.userAssertion !== 'ACCEPTED') continue
    for (const a of art.reCiterArticleAuthorFeatures || []) {
      const k = authorKey(a)
      if (!k || a.targetAuthor) continue
      if (!byKey.has(k)) byKey.set(k, new Set())
      byKey.get(k)!.add(art.pmid)
      if (!names.has(k)) names.set(k, `${a.firstName || ''} ${a.lastName || ''}`.trim())
    }
  }
  self.delete('')
  return { byKey, names, self }
}

// This article's co-authors who also appear on a DIFFERENT accepted paper, never the person.
export const knownCoauthorsOf = (article: any, index: CoauthorIndex | null | undefined) => {
  if (!index) return null
  const ev = article?.evidence?.authorNameEvidence
  const self = new Set([...index.self, authorKey(ev?.institutionalAuthorName), authorKey(ev?.articleAuthorName)])
  const hits: string[] = []
  let total = 0
  const seen = new Set<string>()
  for (const a of article?.reCiterArticleAuthorFeatures || []) {
    const k = authorKey(a)
    if (!k || a.targetAuthor || self.has(k) || seen.has(k)) continue
    seen.add(k)
    total++
    const pmids = index.byKey.get(k)
    if (pmids && [...pmids].some((p) => p !== article.pmid)) hits.push(`${a.firstName || ''} ${a.lastName || ''}`.trim())
  }
  return { hits, total, indexEmpty: index.byKey.size === 0 }
}

export const identityChips = (evidence: any, co: ReturnType<typeof knownCoauthorsOf>): IdentityChip[] => {
  if (!evidence) return []
  const rows = new Map(buildEvidenceRows(evidence).map((r) => [r.name, r]))
  const chips: IdentityChip[] = CHIP_ROWS.map(([name, label]) => {
    const r = rows.get(name)
    const kind = r ? determineMatchType(name, r.points) : 'nodata'
    return { label, kind, tip: `${r ? r.title[0].trim() : label}: ${MATCH_COLORS[kind].label}${r && kind !== 'nodata' ? ` (${Number(r.points).toFixed(2)} pts)` : ''}` }
  })
  const coKind: MatchType = !co || co.indexEmpty || co.total === 0 ? 'nodata' : co.hits.length ? 'match' : 'partial'
  const coTip = !co || co.indexEmpty ? 'No accepted papers to compare against' : `${co.hits.length} of ${co.total} co-authors on other accepted papers`
  chips.push({ label: 'Co-authors', kind: coKind, tip: `Co-authors: ${coTip}` })
  return chips
}

export const tallyOf = (chips: IdentityChip[]) => {
  const c = { match: 0, partial: 0, mismatch: 0, nodata: 0 }
  chips.forEach((k) => { c[k.kind]++ })
  const text = ['Identity ' + c.match + ' match', c.partial ? c.partial + ' partial' : '', c.mismatch ? c.mismatch + ' mismatch' : ''].filter(Boolean).join(' · ')
  return { ...c, text }
}

const STOP = new Set(['university', 'college', 'medical', 'medicine', 'school', 'hospital', 'center', 'centre', 'institute', 'department', 'the', 'and', 'for', 'new', 'york', 'usa'])
const sigTokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t))

// The PubMed affiliation statement, split so the segment naming the matched institution can be
// highlighted. Institution names come from Scopus affiliations ReCiter scored as positive matches.
export const affiliationParts = (evidence: any): { pre: string; hit: string; post: string } | null => {
  const ae = evidence?.affiliationEvidence
  const raw: string = ae?.pubmedTargetAuthorAffiliation?.targetAuthorInstitutionalAffiliationArticlePubmedLabel
  if (!raw) return null
  // PubMed's own match type is often absent (only Scopus scored it); highlight unless PubMed says no match.
  const pubmedType = ae.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType
  const positive = !pubmedType || /^POSITIVE_MATCH/.test(pubmedType)
  const inst = new Set<string>()
  for (const s of ae.scopusTargetAuthorAffiliation || []) {
    if (/^POSITIVE_MATCH/.test(s.targetAuthorInstitutionalAffiliationMatchType || '')) sigTokens(s.targetAuthorInstitutionalAffiliationIdentity).forEach((t) => inst.add(t))
  }
  if (!positive || !inst.size) return { pre: raw, hit: '', post: '' }
  const need = Math.min(2, inst.size)
  let pos = 0
  for (const seg of raw.split(/(?<=[,;])/)) {
    const shared = new Set(sigTokens(seg).filter((t) => inst.has(t))).size
    if (shared >= need) {
      const lead = seg.length - seg.trimStart().length
      const body = seg.replace(/[,;]\s*$/, '').trim()
      return { pre: raw.slice(0, pos + lead), hit: body, post: raw.slice(pos + lead + body.length) }
    }
    pos += seg.length
  }
  return { pre: raw, hit: '', post: '' }
}
