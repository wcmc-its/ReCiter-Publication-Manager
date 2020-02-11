import React from 'react';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
import { Row, Col, Container, Tabs, Tab } from 'react-bootstrap';
import HeaderComponent from './headerComponent';
import BodyComponent from './bodyComponent';
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";


const ReviewSuggestions = () => {
    return (
        <div className="main-container">
            <div className="header-position">
                <Header />
            </div>
            <div className="side-nav-position">
                {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                <SideNav />
            </div>
            <Container className="width100percent margin0 backgroundColorGrey">
                <HeaderComponent />
                <div className = "tabHeader">
                <Tabs defaultActiveKey="profile" id="uncontrolled-tab-example" className="tabs">  
                    <Tab eventKey="home" title="Suggested" >
                        
                    </Tab>
                    <p><span id="tab1number">20</span></p>
                    <Tab eventKey="profile" title="Accepted">

                    </Tab>
                    <Tab eventKey="contact" title="Rejected">

                    </Tab>
                </Tabs>
                <div><p><a href="#">Add new record from PubMe</a></p></div>
                </div>
                <BodyComponent />
            </Container>
            <div className="footer-position">
                <Footer />
            </div>
        </div>
    )
}

export default ReviewSuggestions;