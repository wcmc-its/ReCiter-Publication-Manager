import React, { Component } from 'react';
import "../../css/IdentityTable.css";

class RelationshipBtn extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isOpen: false
        };
    }

    toggle = () => {
        this.setState({ isOpen: !this.state.isOpen });
    };

    getRenderedItems() {
        if (this.state.isOpen) {
            return this.props.relationships.join(", ");
        }
        return this.props.relationships.slice(0, 10).join(", ");
    }
    render() {
        if (this.props.relationships.length > 10) {
            return (
                <div>
                    {this.getRenderedItems()}
                    <a className="expand-relationships" onClick={this.toggle}>
                        {this.state.isOpen ? "...Show Less" : "...Show More"}
                    </a>
                </div>
            );
        }
        return this.getRenderedItems();
    }
}

export default class IdentityTable extends Component {

    render() {
        if (this.props.identityFetching) {
            return (
                <div className="h6fnhWdeg-main-container">
                    <div className="h6fnhWdeg-app-loader"> </div>
                </div>
            );
        } else {
            const identityData = this.props.identityData;
            if(identityData.primaryName !== undefined) {
            //Get array of primary name and alternate names
             let uniqueNames = [];
            uniqueNames.push(
                identityData.primaryName.firstName +
                ((identityData.primaryName.middleName !== undefined)
                    ? " " + identityData.primaryName.middleName + " "
                    : " ") +
                identityData.primaryName.lastName
            );
            if(identityData.alternateNames !== undefined && identityData.alternateNames !== null) {
                for (var i = 0; i < identityData.alternateNames.length; i++) {
                    var altName = identityData.alternateNames[i];
                    uniqueNames.push(
                        altName.firstName +
                        ((altName.middleName !== undefined)
                            ? " " + altName.middleName + " "
                            : " ") +
                        altName.lastName
                    );
                }
            }

            //Get degree types and years
            let degree = [];
            //var i = 0;
            if(identityData.degreeYear !== undefined && identityData.degreeYear !== null) {
                for (i in identityData.degreeYear) {
                    if (i === "bachelorYear" && identityData.degreeYear[i] !== 0) {
                        degree.push(<p>{identityData.degreeYear[i] + ' - Bachelor\'s'}</p>);
                    }
                    if (i === "doctoralYear" && identityData.degreeYear[i] !== 0) {
                        degree.push(<p>{identityData.degreeYear[i] + ' - PhD'}</p>);
                    }
                }
            }   

            //Get array of names and types of known relationships
            let relationships = [];
            if(identityData.knownRelationships !== undefined && identityData.knownRelationships !== null) {
                for (i = 0; i < identityData.knownRelationships.length; i++) {
                    var relationship = identityData.knownRelationships[i];
                    relationships.push(
                        relationship.name.firstName +
                        " " +
                        relationship.name.lastName +
                        " (" +
                        relationship.type +
                        ")"
                    );
                }
            }

            //Eliminate duplicates organizational units
            let orgUnits = [];
            if(identityData.organizationalUnits !== undefined && identityData.organizationalUnits !== null) {
                for (i = 0; i < identityData.organizationalUnits.length; i++) {
                    orgUnits.push(
                        identityData.organizationalUnits[i].organizationalUnitLabel
                    );
                }
            }
            const uniqueOrgUnits = Array.from(new Set(orgUnits));

            let emails = []
            if(identityData.emails === null) {
                console.log('No Emails')
            } else {
                emails = identityData.emails
            }
            let grants = []
            if(identityData.grants === null) {
                console.log('No grants')
            } else {
                grants = identityData.grants
            }
            let personTypes = []
            if(identityData.personTypes === null) {
                console.log('No grants')
            } else {
                personTypes = identityData.personTypes
            }

            //Fields to populate table
            const field = {
                names: Array.from(new Set(uniqueNames)).join(", "),
                orgUnits: uniqueOrgUnits.map((org, i) => {
                    return <div key={i}>{org}</div>;
                }),
                degreeYr: degree,
                institutions: identityData.institutions.map((institution, i) => (
                    <div key={i}>{institution}</div>
                )),
                emails: emails.join(", "),
                grants: grants.join(", "),
                personTypes: personTypes.join(", ")
            };

            return (
                <table className="h6fnhWdeg-identity-table table table-striped">
                    <thead className="thead-dark">
                        <tr>
                            <th className="text-right" scope="col">
                                Field
              </th>
                            <th scope="col">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th className="text-right" scope="row">
                                Names
              </th>
                            <td>{field.names}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Organizational units
              </th>
                            <td>{field.orgUnits}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Degree Year
              </th>
                            <td>{field.degreeYr}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Instituitions
              </th>
                            <td>{field.institutions}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Relationships
              </th>
                            <td>
                                <RelationshipBtn relationships={relationships} />
                            </td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Email
              </th>
                            <td>{field.emails}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Grants
              </th>
                            <td>{field.grants}</td>
                        </tr>
                        <tr>
                            <th className="text-right" scope="row">
                                Person Types
              </th>
                            <td>{field.personTypes}</td>
                        </tr>
                    </tbody>
                </table>
            );
            }
            return (
                <div className="h6fnhWdeg-main-container">
                    <div className="h6fnhWdeg-app-loader"> </div>
                </div>
            );
        }
    }
}