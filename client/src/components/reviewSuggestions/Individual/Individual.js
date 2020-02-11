import React, { Component } from "react";
import { Table, Form, Row, Col, Container, Pagination } from "react-bootstrap";
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import "./individual.css";
import profilePic from '../../../images/profile-pic.jpg';
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
                <div className="manage-profile-content-container">
                    <div className="container">
                        <div className="row">
                            <div className="col-md-12">
                                <h4>Find Scholar</h4>
                            </div>
                            <div className="col-md-6">
                                <div className="individual_search_well well well-sm">
                                    <form className="individual_search">
                                        <div className="form-group">
                                            <div class="input-group">
                                                <input type="text" class="form-control" placeholder="Enter name or CWID" aria-describedby="basic-addon2" />
                                                <span class="inputadds input-group-addon" id="basic-addon2"><span class="glyphicon glyphicon-search" aria-hidden="true"></span></span>
                                            </div>
                                        </div>
                                        <div>
                                            <p>Advanced Search : <a href="#">Clear All</a></p>
                                        </div>
                                        <div className="row">
                                            <div className="col-md-4">
                                                <div className="form-group">
                                                    <select className="form-control" placeholder="Department">
                                                    <option selected>Department</option>
                                                        <option>Pediatric Cardiology</option>
                                                        <option>Pediatric Anesthesiology</option>
                                                        <option>Pediatric Cardiothoracic Surgery</option>
                                                    </select>
                                                </div>
                                                <div>
                                                <p className="tags"><span>Pediatric Cardiology</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags"><span>Pediatric Anesthesiology</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags"><span>Pediatric Cardiothoracic Surgery</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="form-group">
                                                    <select className="form-control" placeholder="Affiliation">
                                                    <option>Affiliation</option>
                                                        <option>Affiliation Affiliation</option>
                                                    </select>
                                                </div>
                                                <div>
                                                <p className="tags"><span>Affiliation Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags"><span>Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags"><span>Affiliation Affiliation</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="form-group">
                                                    <select className="form-control" defaultvalue="Person Type" placeholder="Person Type">
                                                    <option selected>Person Type</option>
                                                        <option>Person Type Person </option>
                                                    </select>
                                                </div>
                                                <div>
                                                <p className="tags"><span>Person Type Person </span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    {/* <p className="tags"><span>space</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    <p className="tags"><span>space</span> <span className="close_icons"> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p> */}
                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-12">
                                <h4><span className="scholars"> 11,201 scholar </span> <span className="btn-span">   <button type="button" class="btn-primes btn btn-primary">Review  All Pending Suggestions</button></span></h4>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-xs-12">
                                <div className="individual">
                                    <div className="searchHeader">
                                        <div className="col-sm-4">

                                            <div className="individual_search">
                                                <Form>

                                                    <Form.Group as={Row} id="form_group">
                                                        <Form.Label column sm="4" id="form-label_number">Show records</Form.Label>
                                                        <Col sm="4"> <Form.Control as="select" >

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
                                            <Pagination id="individual_page">
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
                                        <div className="col-md-12">
                                            <Table responsive>
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Organizational units</th>
                                                        <th>Instructions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="individualImgTd">
                                                            <ul className="list-inline">
                                                                <li> <img src={profilePic} className="profileimg" />
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul>
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul>
                                                                <li>Weill Cornell Medical College, Cornell University New York-Presbyterian Hospital</li>
                                                                <li>Browdoin College</li>
                                                                <li>Cornell University Medical College</li>
                                                                <li>Weill Cornell Medical College</li>
                                                            </ul>
                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td className="individualImgTd">
                                                            <ul className="list-inline">
                                                                <li> <img src={profilePic} className="profileimg" />
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul>
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul>
                                                                <li>Weill Cornell Medical College, Cornell University New York-Presbyterian Hospital</li>
                                                                <li>Browdoin College</li>
                                                                <li>Cornell University Medical College</li>
                                                                <li>Weill Cornell Medical College</li>
                                                            </ul>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="individualImgTd">
                                                            <ul className="list-inline">
                                                                <li> <img src={profilePic} className="profileimg" />
                                                                </li>
                                                                <li><p><b>Jochen Buck, M.D.</b></p>
                                                                    <p>Associate Professor of <br></br> Physiology and Biophysics</p>
                                                                </li>

                                                            </ul>

                                                        </td>
                                                        <td><ul>
                                                            <li>Medicine *</li>
                                                            <li>General Internal Medicine </li>
                                                            <li>Healthcare Policy and Research</li>
                                                            <li>Information Technologies and Services</li>
                                                        </ul></td>
                                                        <td>
                                                            <ul>
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
