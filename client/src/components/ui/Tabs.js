import React, { Component } from 'react';
import '../../css/Tabs.css';

export class Tabs extends Component {

    render() {

        var suggested = 0
        var accepted = 0
        var rejected = 0

        this.props.reciterData.reciter.forEach(function(publication){
            switch(publication.userAssertion) {
                case "NULL":
                    suggested++
                    break
                case "ACCEPTED":
                    accepted++
                    break
                case "REJECTED":
                    rejected++
                    break
                default:
                    break
            }
        })

        return (

            <ul className="nav nav-tabs tabs-headers" role="tablist">
                <li className={(this.props.tabActive === "Accepted")?"active":""}>
                    <a
                        className="h6fnhWdeg-publications-tab-link"
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                        onClick={() => { this.props.tabClickHandler("Accepted"); } }
                    >Accepted <span className={(this.props.tabActive === "Accepted")?"h6fnhWdeg-publications-tab-link-active":"h6fnhWdeg-publications-tab-link-inactive"}>{accepted}</span></a>
                </li>
                <li className={(this.props.tabActive === "Suggested")?"active":""}>
                    <a
                        className="h6fnhWdeg-publications-tab-link"
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                        onClick={() => { this.props.tabClickHandler("Suggested"); } }
                    >Suggested <span className={(this.props.tabActive === "Suggested")?"h6fnhWdeg-publications-tab-link-active":"h6fnhWdeg-publications-tab-link-inactive"}>{suggested}</span></a>
                </li>
                <li className={(this.props.tabActive === "Rejected")?"active":""}>
                    <a
                        className="h6fnhWdeg-publications-tab-link"
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                        onClick={() => { this.props.tabClickHandler("Rejected"); } }
                    >Rejected <span className={(this.props.tabActive === "Rejected")?"h6fnhWdeg-publications-tab-link-active":"h6fnhWdeg-publications-tab-link-inactive"}>{rejected}</span></a>
                </li>
                <li className={(this.props.tabActive === "Add Publication")?"active":""}>
                    <a
                        className="h6fnhWdeg-publications-tab-link"
                        aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                        onClick={() => { this.props.tabClickHandler("Add Publication"); } }
                    >Add Publication</a>
                </li>
            </ul>
        );
    }
}