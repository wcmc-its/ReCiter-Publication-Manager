import React, { Component } from 'react';
import Data from '../Data'
import genericImage from '../images/profile-pic.jpg'
import '../css/Faculty.css'

class Faculty extends Component {

    render() {
        if(Data.faculty !== undefined) {
            var facultyUserName = "";
            var cwid = "";
            //var institution = "";

            if(Data.faculty.firstName !== undefined) {
                facultyUserName += Data.faculty.firstName + ' ';
            }

            if(Data.faculty.middleName !== undefined) {
                facultyUserName += Data.faculty.middleName + ' ';
            }

            if(Data.faculty.lastName !== undefined) {
                facultyUserName += Data.faculty.lastName + ' ';
            }

            if(Data.faculty.suffix !== undefined) {
                facultyUserName += Data.faculty.suffix + ' ';
            }

            if(Data.faculty.degreeDisplay !== undefined) {
                facultyUserName += Data.faculty.degreeDisplay;
            }
            if(Data.faculty.cwid !== undefined) {
                cwid = Data.faculty.cwid;
            }


        }

        return (
            <div className="h6fnhWdeg-profile-info">
                <div className="h6fnhWdeg-img-container">
                    <div className="h6fnhWdeg-img-bar">
                        {(cwid !== undefined)?
                        <img
                            src={"https://directory.weill.cornell.edu/api/v1/person/profile/"+cwid+".png?returnGenericOn404=true"}
                            width="100px"
                            alt="profile"/>
                        :
                        <img
                            src={genericImage}
                            width="100px"
                            alt="generic"/>}

                    </div>
                </div>
                <h2>
                    {facultyUserName}
                </h2>
            </div>
        );
    }
}

export default Faculty