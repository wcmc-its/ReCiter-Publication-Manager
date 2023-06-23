const fullName = (person) => {
  let userName = "";
  if(person) {
      if(person.firstName) {
        userName += person.firstName + ' ';
      }
      if(person.middleName) {
        userName += person.middleName + ' ';
      }
      if(person.lastName) {
        userName += person.lastName + ' ';
      }
  }
  return userName; 
}

export default fullName;