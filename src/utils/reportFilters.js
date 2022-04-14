module.exports = {
  formatAuthorName: (author) => {
    let displayName = `${author.lastName}, ${author.firstName} (${author.primaryOrganizationalUnit})`;
    return displayName;
   }
}