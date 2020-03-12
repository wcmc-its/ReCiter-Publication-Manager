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
            <span style={{ backgroundImage: `url(${imageUrl})`, ...picStyle }} />
        );
        const userData = {
            primaryName: identityData.primaryName.firstName + ((identityData.primaryName.middleName !== undefined) ? ' ' + identityData.primaryName.middleName + ' ' : ' ') + identityData.primaryName.lastName,
            title: identityData.title
        };

        return (
            <div>
                <div className="reviewSuggestionHeading">
                    <h3>Review Suggestions</h3>
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
                    </div>
                </div>
            </div>

        );

    }
}
