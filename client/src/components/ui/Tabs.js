import React, { Component } from 'react';
import { Breadcrumb } from 'react-bootstrap';
import '../../css/Tabs.css';

export class Tabs extends Component {

    render() {

        var suggested = 0
        var accepted = 0
        var rejected = 0

        this.props.reciterData.reciter.forEach(function (publication) {
            switch (publication.userAssertion) {
                case "NULL":
                    suggested++
                    break
                case "ACCEPTED":
                    accepted++
                    break
                case "REJECTED":
                    rejected++
                    break
            }
        })

        return (
            <div>
                {
                    this.props.tabActive === 'Add Publication' ?
                        (<div className="addPubmed_record_link">
                            <p className="addnewrecordfrompubmed"><i>Adding new record from PubMed...</i></p>
                        </div>) : (<div className="addPubmed_record_link">
                            <p>Add New Record:</p>
                            <Breadcrumb className="bread_crumb_record">
                                <Breadcrumb.Item onClick={() => { this.props.tabClickHandler("Add Publication"); }}>PubMed</Breadcrumb.Item>
                                <Breadcrumb.Item href="https://getbootstrap.com/docs/4.0/components/breadcrumb/">
                                    Scopus
                        </Breadcrumb.Item>
                                <Breadcrumb.Item >Manually</Breadcrumb.Item>
                            </Breadcrumb>
                        </div>)
                }
                <ul className="nav nav-tabs tabs-headers" role="tablist">
                    <li className={(this.props.tabActive === "Suggested") ? "active" : ""}>
                        <a
                            className="h6fnhWdeg-publications-tab-link"
                            aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                            onClick={() => { this.props.tabClickHandler("Suggested"); }}
                        >Suggested <span className={(this.props.tabActive === "Suggested") ? "h6fnhWdeg-publications-tab-link-active" : "h6fnhWdeg-publications-tab-link-inactive"}>{suggested}</span></a>
                    </li>
                    <li className={(this.props.tabActive === "Accepted") ? "active" : ""}>
                        <a
                            className="h6fnhWdeg-publications-tab-link"
                            aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                            onClick={() => { this.props.tabClickHandler("Accepted"); }}
                        >Accepted <span className={(this.props.tabActive === "Accepted") ? "h6fnhWdeg-publications-tab-link-active" : "h6fnhWdeg-publications-tab-link-inactive"}>{accepted}</span></a>
                    </li>
                    <li className={(this.props.tabActive === "Rejected") ? "active" : ""}>
                        <a
                            className="h6fnhWdeg-publications-tab-link"
                            aria-controls="publications-tabpanel" role="tab" data-toggle="tab" data-page="accepted"
                            onClick={() => { this.props.tabClickHandler("Rejected"); }}
                        >Rejected <span className={(this.props.tabActive === "Rejected") ? "h6fnhWdeg-publications-tab-link-active" : "h6fnhWdeg-publications-tab-link-inactive"}>{rejected}</span></a>
                    </li>
                </ul>
            </div>
        );
    }
}
