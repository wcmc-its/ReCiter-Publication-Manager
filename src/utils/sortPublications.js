// Sort
const sortPublications = (publications, sortBy) =>
{
  publications.sort((a, b) => {
    switch(sortBy) {
        case "1":
            return b.authorshipLikelihoodScore - a.authorshipLikelihoodScore;
        case "2":
            return new Date(b.publicationDateStandardized) - new Date(a.publicationDateStandardized);
        case "3":
          return a.authorshipLikelihoodScore - b.authorshipLikelihoodScore;
        case "4":
            return new Date(a.publicationDateStandardized) - new Date(b.publicationDateStandardized);
        default:
            return b.authorshipLikelihoodScore - a.authorshipLikelihoodScore;
    }
  })
  return publications;
};

export default sortPublications;