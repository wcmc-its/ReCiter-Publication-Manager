module.exports = {
  formatAuthorName: (author) => {
    let displayName = "";
    if (author.primaryOrganizationalUnit) displayName = `${author.lastName}, ${author.firstName} (${author.primaryOrganizationalUnit})`;
    else displayName = `${author.lastName}, ${author.firstName}`;
    return displayName;
   }
}