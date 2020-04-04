import React, { Component } from "react";
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";
import Identity from "../ui/Identity";
import IdentityTable from "../ui/IdentityTable"
import "../../css/ManageProfile.css";
import { connect } from 'react-redux'
import { identityFetchData } from '../../actions'
import { withRouter } from 'react-router-dom'

class ManageProfile extends Component {

    constructor(props) {
        super(props)
    }

    componentDidMount() {
        this.props.getIdentity(this.props.match.params.uid)
    }



    render() {
        return (
            <div className="main-container">
                <div className="header-position">
                    <Header username={this.props.username} />
                </div>
                <div className="side-nav-position">
                    <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                </div>
                <div className="manage-profile-content-container">
                    <div className="manage-profile-identity">
                        <Identity
                            identityData={this.props.identityData}
                            identityFetching={this.props.identityFetching}
                            history={this.props.history}
                            uid={this.props.match.params.uid}
                            buttonName='Review Suggestions'
                            isProfileRounded
                        />
                    </div>
                    <div className="identity-table-container">
                        <div className="manageprogiletopcolumn-text col-lg-8 col-sm-12 col-xs-12">
                        <p className="identity-manageprofiletop-text">
                            <b>
                                The following are attributes from institutional data sources.
                                These data can only be corrected in authoritative systems of
                                record.
                            </b>
                        </p>
                        </div>
                        <IdentityTable identityData={this.props.identityData} identityFetching={this.props.identityFetching} />
                    </div>
                </div>

                <div className="footer-position">
                    <Footer />
                </div>
            </div>
        );
    }
}

export default ManageProfile
