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
      },
      organization: {
        name: "Organization",
        isEnabled: true,
      },
      institution: {
        name: "Institution",
        isEnabled: true,
      },
      personType: {
        name: "Person Type",
        isEnabled: true,
      },
      order: {
        name: "Order",
        isEnabled: true,
      }, 
      authorPosition: {
        name: "Author Position",
        isEnabled: true,
        options: [
          {key: "first", label: "First"},
          {key: "last", label: "Last"}
        ],
        filterType: "Checklist",
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
        isEnabled: true,
      },
      journal: {
        name: "Journal",
        options: "journalFilterData",
        filterType: "CheckboxSelect",
        optionLabel: "journalTitleVerbose",
        isEnabled: true,
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
  includeHeadshot: true,
  headshotSyntax: "https://directory.weill.cornell.edu/api/v1/person/profile/{personID}.png?returnGenericOn404=false"
}