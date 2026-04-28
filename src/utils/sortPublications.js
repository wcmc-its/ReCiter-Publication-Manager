// Sort
const sortPublications = (publications, sortBy) =>
{
  publications.sort((a, b) => {
    switch(sortBy) {
        case "1":
            return b.totalArticleScoreStandardized - a.totalArticleScoreStandardized;
        case "2":
            return new Date(b.publicationDateStandardized) - new Date(a.publicationDateStandardized);
        case "3":
          return a.totalArticleScoreStandardized - b.totalArticleScoreStandardized;
        case "4":
            return new Date(a.publicationDateStandardized) - new Date(b.publicationDateStandardized);
        default:
            return b.totalArticleScoreStandardized - a.totalArticleScoreStandardized;
    }
  })
  return publications;
};

export default sortPublications;