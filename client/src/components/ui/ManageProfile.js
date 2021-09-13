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
import {Error} from "./Error"

class ManageProfile extends Component {

    constructor(props) {
        super(props)
    }

    componentDidMount() {
        if(this.props.identityData.length<=0) {
            this.props.getIdentity(this.props.match.params.uid)
        }
    }



    render() {
        if(this.props.errors && this.props.errors.length > 0) {
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header  username={this.props.username}  />
                    </div>

                    <div className="side-nav-position">
                        <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                    </div>
                    <div>
                        <Error {...this.props} />
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
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
                        />
                    </div>
                    <div className="identity-table-container">
                        <p>
                            <b>
                                The following are attributes from institutional data sources.
                                These data can only be corrected in authoritative systems of
                                record.
                            </b>
                        </p>
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