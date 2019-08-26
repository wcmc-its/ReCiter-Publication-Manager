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
        if(this.props.buttonName === 'Manage Profile'){
            return this.props.history.push('/manage/' + this.props.uid)
        }
        if(this.props.buttonName === 'Review Suggestions'){
            return this.props.history.push('/app/' + this.props.uid)
        }
    }

    render() {
        if (this.props.identityFetching || this.props.identityData.length <= 0) {
            return (
                    <div className="h6fnhWdeg-app-loader"> </div>
            );
        } else {
            const identityData = this.props.identityData
            const image = (
                <img src={`https://directory.weill.cornell.edu/api/v1/person/profile/${identityData.uid}.png?returnGenericOn404=true`} width="144"/>
            );
            const userData = {
                primaryName: identityData.primaryName.firstName + ((identityData.primaryName.middleName !== undefined)? ' ' + identityData.primaryName.middleName + ' ':' ') + identityData.primaryName.lastName,
                title: identityData.title
            };

            return (
                <div className="userContainer">
                    <div className="userImg">{image}</div>
                    <div className="userName">
                        <h1>{userData.primaryName}</h1>
                    </div>
                    <div className="userTitle">
                        <h3>{userData.title}</h3>
                    </div>
                    <div className="btnContainer">
                        <Button className="manageBtn" variant="outline-dark" onClick={this.manageProfile}>
                            {this.props.buttonName}
                        </Button>
                    </div>
                </div>
            );
        }
    }
}
