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
                <div className = "review_suggested_tabs new_records_tabs tabHeader">
                <Tabs defaultActiveKey="profile" id="uncontrolled-tab-example" className="tabs">  
                    <Tab eventKey="home" title={<p> <span> Suggested </span> <span className="second_childrecords"> 40 </span></p>} >
                        
                    </Tab>
                    <Tab eventKey="profile" title={<p> <span> Accepted</span> <span className="second_childrecords"> 30 </span></p>}>

                    </Tab>
                    <Tab eventKey="contact" title={<p><span>Rejected</span> <span className="second_childrecords"> 20 </span></p>}>

                    </Tab>
                </Tabs>
                <div><p><a href="#"><u>Add new record</u></a></p></div>
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