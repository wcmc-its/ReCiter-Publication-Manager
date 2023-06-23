export const reportConfig = {
  authorFilters: {
    name: "Author Filters",
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
        options: [
          {key: "first", label: "First"},
          {key: "last", label: "Last"}
        ],
        filterType: "Checklist",
        isEnabled: true,
        dynamicFetchOptions: false,
      }
    }
  },
  articleFilters: {
    name: "Article Filters",
    list: {
      date: {
        name: "Date",
        options: "dateFilterData",
        isEnabled: true,
        filterType: "DateRange",
      },
      type: {
        name: "Type",
        options: "articleTypeFilterData",
        optionLabel: "publicationTypeCanonical",
        value: "publicationTypeCanonical",
        filterType: "CheckboxSelect",
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
      journalRank: {
        name: "Journal Rank",
        options: "journalRankFilterData",
        isEnabled: true,
        filterType: "Range",
      }
    }
  }
}

export const sortOptions = {
  datePublicationAddedToEntrez: true,
  journalImpactScore1: true,
  percentileNIH: true,
  citationCountNIH: true,
  trendingPubsScore: true,
  readersMendeley: false,
  publicationDateStandarized: false
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
    journalImpactScore2: false,
    readersMendeley: true,
    percentileNIH: true,
    relativeCitationRatioNIH: false,
    trendingPubsScore: true,
    citationCountNIH: true,
    citationCountScopus: false
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
    journalImpactScore2: "Journal impact",
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
  } 
}

