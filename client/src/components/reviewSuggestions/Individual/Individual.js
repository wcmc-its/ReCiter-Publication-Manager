import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Row, Col, Container, Pagination, FormControl, InputGroup } from "react-bootstrap";
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import "./individual.css";
import profilePic from '../../../images/profile_pic.png';
export default class Individual extends Component {

    render() {
        return (
            <div className="main-container">
                <div className="header-position">
                    <Header />
                </div>
                <div className="side-nav-position">
                    {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                    <SideNav />
                </div>
                <div className="mt-5 manage-profile-content-container">
                    <div className="container">
                        <div className="row">
                            <div className="col-md-12">
                                <h4>Find Scholar</h4>
                            </div>
                            <div className="mt-5 mb-5 col-md-6">
                                <div className="individual_search_well well well-sm">

                                    <Form className="individual_search">
                                        <div className="form-group">
                                            <div className="input-group">
                                                <input type="text" className="mt-0 font-italic form-control" placeholder="Enter name or CWID" aria-describedby="basic-addon2" />
                                                <span className="inputadds input-group-addon" id="basic-addon2"><span className="glyphicon glyphicon-search" aria-hidden="true"></span></span>
                                            </div>
                                        </div>
                                        {/* <Form.Row>
                                        <InputGroup className="mb-3">
                                            <FormControl
                                                placeholder="Username"
                                                aria-label="Username"
                                                aria-describedby="basic-addon1"
                                                className="d-inline-block"
                                            />
                                            <InputGroup.Prepend className="d-inline-block">
                                                <InputGroup.Text id="basic-addon1">@</InputGroup.Text>
                                            </InputGroup.Prepend>
                                        </InputGroup>
                                        </Form.Row> */}
                                        <div>
                                            <p><span className="font-italic">Advanced Search</span> : <a href="#"> <u>Clear All</u></a></p>
                                        </div>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1">
                                                    <Form.Control as="select" className="border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        <option selected>Department</option>
                                                        <option>Pediatric Cardiology</option>
                                                        <option>Pediatric Anesthesiology</option>
                                                        <option>Pediatric Cardiothoracic Surgery</option>
                                                    </Form.Control>
                                                </Form.Group>
                                                <div>
                                                    <p className="tags bg-primary"><span>Pediatric Cardiology</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags bg-primary"><span>Anesthesiology</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags bg-primary"><span>Pediatric  Surgery</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1">
                                                    <Form.Control as="select" className="border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        <option>Affiliation</option>
                                                        <option>Affiliation Affiliation</option>
                                                    </Form.Control>
                                                </Form.Group>
                                                <div>
                                                    <p className="bg-primary tags"><span>Affiliation Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="bg-primary tags"><span>Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="bg-primary tags"><span>Affiliation Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1">
                                                    <Form.Control as="select" className="border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        <option selected>Person Type</option>
                                                        <option>Person Type Person </option>
                                                    </Form.Control>
                                                </Form.Group>
                                                <div>
                                                    <p className="bg-primary tags"><span>Person Type Person </span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Form>
                                </div>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-12">
                                <h4><span className="scholars"> 11,201 scholar </span> <span className="btn-span"> <Link to="/individual_suggestions">  <button type="button" class="btn-primes btn btn-primary">Review  All Pending Suggestions</button> </Link></span></h4>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-xs-12">
                                <div className="individual">
                                    <div className="searchHeader">
                                        <div className="col-sm-4 pt-1">

                                            <div className="individual_search">
                                                <Form>

                                                    <Form.Group as={Row} id="form_group">
                                                        <Form.Label column sm="4" id="form-label_number" className="pt-1 font-weight-normal">Show records</Form.Label>
                                                        <Col sm="2" className="pl-0"> <Form.Control as="select" className="mt-0 pl-1 pr-0">

                                                            <option>10</option>
                                                            <option>20</option>
                                                            <option>30</option>
                                                            <option>40</option>
                                                            <option>50</option>
                                                        </Form.Control>
                                                        </Col>
                                                    </Form.Group>
                                                </Form>
                                            </div>
                                        </div>
                                        <div className="col-sm-8">
                                            <Pagination id="individual_page" className="m-0 pull-right">
                                                <Pagination.First />
                                                <Pagination.Prev />
                                                <Pagination.Item>{1}</Pagination.Item>
                                                <Pagination.Ellipsis />

                                                <Pagination.Item>{10}</Pagination.Item>
                                                <Pagination.Item>{11}</Pagination.Item>
                                                <Pagination.Item active>{12}</Pagination.Item>
                                                <Pagination.Item>{13}</Pagination.Item>
                                                <Pagination.Item disabled>{14}</Pagination.Item>

                                                <Pagination.Ellipsis />
                                                <Pagination.Item>{20}</Pagination.Item>
                                                <Pagination.Next />
                                                <Pagination.Last />
                                            </Pagination>
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="col-md-12 pr-5 pl-5">
                                            <Table responsive className="individual_table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Organizational units</th>
                                                        <th>Instructions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td >
                                                            <ul className="list-inline">
                                                                <li> <img src={profilePic} className="profileimg" height="65px" width="65px"/>
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul className="pl-4">
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul className="pl-4">
                                                                <li>Weill Cornell Medical College, Cornell University New York-Presbyterian Hospital</li>
                                                                <li>Browdoin College</li>
                                                                <li>Cornell University Medical College</li>
                                                                <li>Weill Cornell Medical College</li>
                                                            </ul>
                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td >
                                                            <ul className="list-inline">
                                                                <li><img src={profilePic} className="profileimg" height="65px" width="65px"/>
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul className="pl-4">
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul className="pl-4">
                                                                <li>Weill Cornell Medical College, Cornell University New York-Presbyterian Hospital</li>
                                                                <li>Browdoin College</li>
                                                                <li>Cornell University Medical College</li>
                                                                <li>Weill Cornell Medical College</li>
                                                            </ul>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td >
                                                            <ul className="list-inline">
                                                                <li><img src={profilePic} className="profileimg" height="65px" width="65px"/>
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul className="pl-4">
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul className="pl-4">
                                                                <li>Weill Cornell Medical College, Cornell University New York-Presbyterian Hospital</li>
                                                                <li>Browdoin College</li>
                                                                <li>Cornell University Medical College</li>
                                                                <li>Weill Cornell Medical College</li>
                                                            </ul>
                                                        </td>
                                                    </tr>

                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>

                                </div>
                            </div>
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
