import React, { Component } from 'react';
import '../../css/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Tabs from '../containers/Tabs'
import TabAccepted from '../containers/TabAccepted';
import TabSuggested from '../containers/TabSuggested';
import TabRejected from '../containers/TabRejected';
import TabAddPublication from '../containers/TabAddPublication';
import SideNav from "../ui/SideNav";
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import Identity from "../ui/Identity";
import {Error} from "./Error";
//import jsonData from './sample-data.json';

class App extends Component {

    state = {
        tabActive: "Suggested",
        identityData: {

        }
    }

    constructor(props) {
        super(props)

        // bind elements
        this.tabClickHandler = this.tabClickHandler.bind(this)
        this.refreshHandler = this.refreshHandler.bind(this)
    }

    componentDidMount() {
        this.props.onLoad(this.props.match.params.uid, false)
        if(!this.props.auth.isLoggedIn)
        {
            //return this.props.history.push('/login')
        }
        //this.props.getIdentity(this.props.auth.username)
        this.props.getIdentity(this.props.match.params.uid)
    }

    tabClickHandler(str = 'Suggested') {
        this.setState({
            tabActive: str
        });
    }

    refreshHandler(event) {
        event.preventDefault()
        this.props.onLoad(this.props.match.params.uid, true)
    }

    render() {
        const thisObject = this;

        /*if(this.props.errors && this.props.errors.length > 0) {
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
        }*/

        if (this.props.reciterFetching) {
            return (
                <div className="tab-container">
                    <div className="h6fnhWdeg-app-loader"> </div>
                </div>
            );
        } else {
            var tabActiveContent = (
                <TabSuggested tabClickHandler={this.tabClickHandler} />
            );
            switch (this.state.tabActive) {
                case "Accepted":
                    tabActiveContent = (
                        <TabAccepted tabClickHandler={this.tabClickHandler} />
                    );
                    break;
                case "Suggested":
                    tabActiveContent = (
                        <TabSuggested tabClickHandler={this.tabClickHandler} />
                    );
                    break;
                case "Rejected":
                    tabActiveContent = (
                        <TabRejected tabClickHandler={this.tabClickHandler} />
                    );
                    break;
                case "Add Publication":
                    tabActiveContent = <TabAddPublication />;
                    break;
                default:
                    tabActiveContent = (
                        <TabSuggested
                            getData={this.getData}
                            tabClickHandler={this.tabClickHandler}
                        />
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
                    <div className="publications-content">
                        <div className="identity-container">
                            <Identity
                                identityData={this.props.identityData}
                                identityFetching={this.props.identityFetching}
                                history={this.props.history}
                                uid={this.props.match.params.uid}
                                buttonName='Manage Profile'
                            />
                        </div>
                        <div className="tab-container">
                            {thisObject.props.reciterData.reciterPending.length > 0 ? (
                                <div className="h6fnhWdeg-reciter-pending-banner">
                                    <span>You have provided feedback on </span>
                                    <strong>{`${
                                        thisObject.props.reciterData.reciterPending.length
                                        } record(s). `}</strong>
                                    <a href="#" onClick={thisObject.refreshHandler}>
                                        Refresh
                        </a>
                                    <span> to get new suggestions.</span>
                                </div>
                            ) : null}
                            <Tabs
                                tabActive={this.state.tabActive}
                                tabClickHandler={this.tabClickHandler}
                            />
                            <div className="h6fnhWdeg-tab-content h6fnhWdeg-tabs-container">
                                <div className="h6fnhWdeg-tabs-content">{tabActiveContent}</div>
                            </div>
                        </div>
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
    }
}

export default App;
