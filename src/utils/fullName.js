const fullName = (person) => {
  let userName = "";
  if(person !== undefined) {
      if(person.firstName !== undefined) {
        userName += person.firstName + ' ';
      }
      if(person.middleName !== undefined) {
        userName += person.middleName + ' ';
      }
      if(person.lastName !== undefined) {
        userName += person.lastName + ' ';
      }
  }
  return userName; 
}

export default fullName;