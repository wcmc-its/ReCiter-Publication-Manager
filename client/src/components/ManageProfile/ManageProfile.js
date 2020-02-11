import React from 'react';
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";
import './ManageProfile.css';
import Image from 'react-bootstrap/Image'
import HeaderComponent from '../reviewSuggestions/headerComponent';
import { Row, Col, Container, Table } from 'react-bootstrap';

const ManageProfile = () => {
    return (
        <div className="main-container">
            <div className="header-position">
                <Header />
            </div>
            <div className="side-nav-position">
                {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                <SideNav />
            </div>
            <Container className="width100percent margin0">
                <HeaderComponent/>
                <Row className="backgroundColorGrey padding20px">
                    <Col xs={12} md={12} lg={5}>
                        <p className="fontSize13px fontWeightBold">The following are attributes from institutional data sources. These data can only be corrected in authoritative systems of record.</p>
                    </Col>
                    <Col xs={12} md={12} lg={12}>
                        <Table responsive className="backgroundColorWhite">
                            <thead className="backgroundColor202b3b colorWhite">
                                <tr>
                                    <th className="width25Percent textAlignRight">Field</th>
                                    <th>Data</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Names</td>
                                    <td>Michel Alain Cuendet, Michel Cuendet</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Relationships</td>
                                    <td>Physiology and Biophysics</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Degree Year</td>
                                    <td>2007 - PhD</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Instituitions</td>
                                    <td>Swiss Federal Institute of Technology (Switzerland) Weill Cornell Medical College, Cornell University</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Relationships</td>
                                    <td>George Khelashvili (CO_INVESTIGATOR), Sebastian Stolzenberg (CO_INVESTIGATOR), Michelle Sahai (CO_INVESTIGATOR), Audrey Rivera (CO_INVESTIGATOR), Niklaus Johner (CO_INVESTIGATOR), Jian Sun (CO_INVESTIGATOR), Jose manuel Perez aguilar (CO_INVESTIGATOR), Lei Shi (CO_INVESTIGATOR), Ozge Sensoy (CO_INVESTIGATOR), Harel Weinstein (CO_INVESTIGATOR)...Show More</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Email</td>
                                    <td>mac2109@med.cornell.edu, michelcuendet@hotmail.com</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Grants</td>
                                    <td>GM087519, DA012408</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>Person Types</td>
                                    <td>academic, academic-faculty, academic-faculty-assistant, academic-faculty-adjunct</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </Table>
                    </Col>
                </Row>
            </Container>
            <div className="footer-position">
                <Footer />
            </div>
        </div>
    )
}

export default ManageProfile