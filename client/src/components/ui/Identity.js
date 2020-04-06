import React, { Component } from "react";
import { Button } from "react-bootstrap";
import "../../css/Identity.css";
import { Redirect } from 'react-router-dom'

export default class Identity extends Component {

    constructor(props) {
        super(props)
        this.manageProfile = this.manageProfile.bind(this)
    }

    manageProfile(event) {
        event.preventDefault()
        if (this.props.buttonName === 'Manage Profile') {
            return this.props.history.push('/manage/' + this.props.uid)
        }
        if (this.props.buttonName === 'Review Suggestions') {
            return this.props.history.push('/app/' + this.props.uid)
        }
    }

    render() {

        const picStyle = this.props.isProfileRounded ? { borderRadius: '50%' } : {};


        if (this.props.identityFetching || this.props.identityData.length <= 0) {
            return (
                <div className="h6fnhWdeg-app-loader"> </div>
            );
        }

        const identityData = this.props.identityData
        let imageUrl = ''

        if (identityData.identityImageEndpoint !== undefined) {
            if (identityData.identityImageEndpoint.length > 0)
                imageUrl = identityData.identityImageEndpoint
            else
                imageUrl = '../images/generic-headshot.png'
        }
        const image = (
            <img src={`${imageUrl}`} alt="contest-cover" className="profile_identity" />
        );
        const userData = {
            primaryName: identityData.primaryName.firstName + ((identityData.primaryName.middleName !== undefined) ? ' ' + identityData.primaryName.middleName + ' ' : ' ') + identityData.primaryName.lastName,
            title: identityData.title
        };
        const displayBanner = this.props.buttonName == 'Manage Profile' ? <h3>Review Suggestions</h3> : <h3 className="manageProfileheadinngText">Manage Profile</h3>;
        // const buttonPubMed = this.props.buttonName == 'Manage Profile' ? null : <div className="mangaeprofilerowbtns h6fnhWdeg-publication-row-buttons">
        //     <a href='#' className="btn btn-default" target="_blank" rel="noopener noreferrer">PubMed</a>
        //     <a href='#' className="btn btn-default" target="_blank" rel="noopener noreferrer">GET IT</a>
        // </div>;
        return (
            <div>
                <div className="reviewSuggestionHeading">
                    {displayBanner}
                </div>
                <div className="userContainer">

                    <div className="userImg">{image}</div>
                    <div className="userName">
                        <h3>{userData.primaryName}</h3>
                    </div>
                    <div className="userTitle">
                        <p>{userData.title}</p>
                    </div>
                    <div className="btnContainer">
                        <Button className="manageBtn" variant="link" onClick={this.manageProfile}>
                            {this.props.buttonName}
                        </Button>
                        {/* <div>
                            {buttonPubMed}
                        </div> */}
                    </div>
                </div>
            </div>

        );

    }
}
