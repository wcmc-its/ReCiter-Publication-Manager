export const reportConfig = {
  authorFilters: {
    name: "People",
    list: {
      author: {
        name: "Author",
        options: "authorFilterData",
        formatOptionTitle: "formatAuthorName",
        filterType: "CheckboxSelect",
        isEnabled: true,
        dynamicFetchOptions: true,
        value: "personIdentifier",
      },
      organization: {
        name: "Organization",
        options: "orgUnitsData",
        optionLabel: "primaryOrganizationalUnit",
        value: "primaryOrganizationalUnit",
        filterType: "CheckboxSelect",
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      institution: {
        name: "Institution",
        options: "institutionsData",
        optionLabel: "primaryInstitution",
        value: "primaryInstitution",
        filterType: "CheckboxSelect",
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      personType: {
        name: "Person Type",
        options: "personTypesData",
        optionLabel: "personType",
        value: "personType",
        filterType: "CheckboxSelect",
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      authorPosition: {
        name: "Author Position",
        // middle = NULL in analysis_summary_author (PubMed and external rows alike)
        options: [
          {key: "first", label: "First author", desc: "Article's first listed author"},
          {key: "middle", label: "Middle author", desc: "Any position between first and last"},
          {key: "last", label: "Last author", desc: "Corresponding / senior author"}
        ],
        filterType: "Checklist",
        isEnabled: true,
        dynamicFetchOptions: false,
      }
    }
  },
  articleFilters: {
    name: "Publications",
    list: {
      // Date added: when the record entered PubMed, or (external rows) when a curator added it;
      // publication date when neither is known (5c, "date added where present, else publication
      // date"). Keeps its old filter keys (datePublicationAddedToEntrez*Bound).
      date: {
        name: "Date added",
        options: "dateFilterData",
        isEnabled: true,
        filterType: "DateRange",
      },
      pubDate: {
        name: "Publication date",
        options: "pubDateFilterData",
        isEnabled: true,
        filterType: "DateRange",
      },
      source: {
        name: "Source",
        // analysis_summary_article.source_type; external rows are unioned in by ReCiterDB STEP 6b
        options: [
          {key: "PUBMED", label: "PubMed", desc: "Indexed in PubMed"},
          {key: "SCOPUS", label: "Scopus", desc: "In Scopus, not PubMed"},
          {key: "OPENALEX", label: "OpenAlex", desc: "Preprints, abstracts and other works"},
          {key: "CROSSREF", label: "Crossref", desc: "Books, chapters and DOI-only records"},
          {key: "WOS", label: "Web of Science", desc: "In Web of Science, not PubMed"}
        ],
        filterType: "Checklist",
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      // 5c: the 18 types in their 4 groups (filter key `pubTypes`) once ReCiterDB fills
      // analysis_summary_article.pubType; until then the flat list of publicationTypeCanonical
      // values (optionLabel / value, filter key `publicationTypeCanonical`).
      type: {
        name: "Type",
        options: "articleTypeFilterData",
        optionLabel: "publicationTypeCanonical",
        value: "publicationTypeCanonical",
        groupedValue: "pubTypes",
        filterType: "GroupedChecklist",
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      // 5d-1: Yes / No / Any on analysis_summary_article.peerReviewed (ReCiterDB v3.10). Options
      // (with counts) come from filter/peerreview; the chip is hidden while that list is empty.
      peerReview: {
        name: "Peer review",
        options: "peerReviewFilterData",
        filterType: "Checklist",
        single: true,
        isEnabled: true,
        dynamicFetchOptions: false,
      },
      journal: {
        name: "Journal",
        options: "journalFilterData",
        filterType: "CheckboxSelect",
        optionLabel: "journalTitleVerbose",
        value: "journalTitleVerbose",
        isEnabled: true,
        dynamicFetchOptions: true,
      },
      // SJR threshold presets (was a min-max slider). Lower bound is inclusive; the upper bound
      // only exists because some search paths need both bounds set.
      journalRank: {
        name: "Journal Rank",
        options: [
          {key: "1", label: "SJR 1.0 and above", lower: 1, upper: 1000},
          {key: "3", label: "SJR 3.0 and above", lower: 3, upper: 1000}
        ],
        isEnabled: true,
        filterType: "Preset",
      }
    }
  }
}

export const sortOptions = {
  datePublicationAddedToEntrez: true,
  journalImpactScore1: true,
  journalImpactScore2: true,
  percentileNIH: true,
  citationCountNIH: true,
  // TrendingPubs and Mendeley sorts dropped in the UI refresh (5b)
  trendingPubsScore: false,
  readersMendeley: false,
  publicationDateStandardized: true,
  // legacy admin_settings key spelling; kept so the option stays visible until the setting is renamed
  publicationDateStandarized: true,
  relativeCitationRatioNIH:true,
  citationCountScopus:true,
  // 5e: NIH, else Scopus, else OpenAlex (reportSort.ts citationsExpr). Shown even when the
  // reportingWebViewSort admin setting has no row for it (SearchSummary.tsx).
  citations: true
}

export const infoBubblesConfig = {
  relativeCitationRatio: "Relative Citation Ratio (RCR) is the ratio between the number of times an article was cited in comparison to publications of the same date and field (as inferred by co-citation networks). A value of 1.0 is the median. Higher is better. The benchmark consists of research articles that are the product of R01 grants, the NIH's most prestigious and competitive funding mechanism.",
  nihPercentile: "NIH percentile is the value of RCR provided as a percentile in which 100 is the highest and 0 is the lowest. For example, if an article has an NIH percentile of 63.2, it has received more citations than 631 articles when measured against a field and time-weighted benchmark of 1,000 NIH-funded research articles from the same year. A percentile is not computed for an article published in the past two years.",
  hindexNIH: "h-index is the number of an author's articles in PubMed that have been cited, as defined by NIH's iCite service, at least that many times.",
  h5indexNIH: "h5-index is the number of an author's articles in PubMed that have been cited, as defined by NIH's iCite service, at least that many times within the past 5 years.",
  hindexScopus: "h-index is the number of an author's articles in Scopus that have been cited, as defined by Scopus, at least that many times.",
  h5indexScopus: "h5-index is the number of an author's articles in Scopus that have been cited, as defined by Scopus, at least that many times within the past 5 years.",
  journalImpactScore1: "SCImago Journal Rank is a measure of the relative number of inbound citations articles in a given journal receive compared to outbound citations. It is closely correlated with Journal Impact Factor.",
  citationCountNIH: "This is the number of citations an article has received from CrossRef, MEDLINE, PubMed Central, and Entrez. NIH citation counts generally correlate closely with the counts in Scopus and Web of Knowledge.",
  includeHeadshot: true,
  headshotSyntax: "https://directory.weill.cornell.edu/api/v1/person/profile/{personID}.png?returnGenericOn404=false",
  journalImpactScore2: "An additional journal-level metric",
  citationCountScopus:"citationCountScopus"
}

export const limits = {
  maxCountPubsReturn: 1800
}

/******** Article-level Configuration ********/
// Metrics to display in CSV report
export const metrics = {
  person: {
    hindexNIH: true,
    h5indexNIH: true,
    hindexScopus: true,
    h5indexScopus: true,
  },
  article: {
    journalImpactScore1: true,
    journalImpactScore2: true,
    readersMendeley: true,
    percentileNIH: true,
    relativeCitationRatioNIH: true,
    trendingPubsScore: true,
    citationCountNIH: true,
    citationCountScopus: true 
  }
}

// Labels for CSV columns
export const labels = {
  person: {
    // personLabel: "CWID",
    // hindexNIH: "h-index (NIH)",
    // h5indexNIH: "h5-index (NIH)",
    // hindexScopus: "h-index (Scopus)",
    // h5indexScopus: "h5-index (Scopus)",
    personIdentifier: "personIdentifier",
    lastName: "Last Name",
    firstName: "First Name",
    primaryOrganizationalUnit: "Organization",
    primaryInstitution: "Institution",
  },
  article: {
    journalImpactScore1: "Scimago Journal Rank",
    journalImpactScore2: "Journal Metric",
    readersMendeley: "Mendeley readers",
    percentileNIH: "NIH Percentile Rank",
    relativeCitationRatioNIH: "Relative Citation Ratio (NIH)",
    trendingPubsScore: "TrendingPubs score",
    citationCountNIH: "Citation count (NIH)",
    citationCountScopus: "Citation count (Scopus)",
    personTypes: "Person types"
  },
  reporting: {
    name: "Author",
    personType: "Person type",
    journalTitleVerbose: "Journal",
    authorPosition: "Position",
  },
  articleInfo: {
    pmid: "pmid",
    articleTitle: "Article title",
    articleYear: "Article year",
    pmcid: "pmcid",
    publicationDateDisplay: "Publication date display",
    publicationDateStandardized: "Date standardized",
    datePublicationAddedToEntrez: "Date added",
    journalTitleVerbose: "Journal",
    doi: "doi",
    issue: "Issue",
    pages: "Pages",
    volume: "Volume",
  },
  authorsInfo:
  {
    authors:"Authors",
    authorPosition:"Author Position"
  } 
}

