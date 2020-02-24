import React from 'react';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
import { Link } from "react-router-dom";
import { Row, Col, Container, Tabs, Tab, Table, Breadcrumb, BreadcrumbItem } from 'react-bootstrap';
import HeaderComponent from './headerComponent';
import BodyComponent from './bodyComponent';
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";


const ReviewSuggestions = (props) => {
    return (
        <div className="main-container">
            <div className="header-position">
                <Header username={props.username}/>
            </div>
            {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
            <SideNav />
            <Container className="width100percent margin0 backgroundColorGrey">
                <HeaderComponent />
                <Row className="backgroundColorWhite">
                    <Col md={12}>
                        <div><p className="add_record_p"><span className="add_record_spans">Add new record</span> <span className="add_record_spans"><Breadcrumb>
                            <Breadcrumb.Item href="/newrecord">Pub Med</Breadcrumb.Item>
                            <Breadcrumb.Item href="#">
                                Scopus
                        </Breadcrumb.Item>
                            <Breadcrumb.Item href="#">Manually</Breadcrumb.Item>
                        </Breadcrumb> </span></p></div>
                    </Col>
                </Row>
                <div className="review_suggested_tabs new_records_tabs tabHeader">

                    <Tabs defaultActiveKey="profile" id="uncontrolled-tab-example" className="tabs">
                        <Tab eventKey="home" title={<p> <span> Suggested </span> <span className="second_childrecords"> 40 </span></p>} >
                            <div className="row">
                                <div className="col-md-12">
                                    <BodyComponent />
                                </div>
                            </div>
                        </Tab>
                        <Tab eventKey="profile" title={<p> <span> Accepted</span> <span className="second_childrecords"> 30 </span></p>}>
                            <div className="row">
                                <div className="col-md-12">
                                    <BodyComponent />
                                </div>
                            </div>
                        </Tab>
                        <Tab eventKey="contact" title={<p><span>Rejected</span> <span className="second_childrecords"> 20 </span></p>}>
                            <div className="row">
                                <div className="col-md-12">
                                    <BodyComponent />
                                </div>
                            </div>

                        </Tab>
                    </Tabs>

                </div>

            </Container>
            <div className="footer-position">
                <Footer />
            </div>
        </div>
    )
}

export default ReviewSuggestions;