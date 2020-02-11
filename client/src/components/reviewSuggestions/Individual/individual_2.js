import React, { Component } from "react";
import { Table, Button, Form, Row, Col, Container, Pagination } from "react-bootstrap";
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import "./individual_2.css";
import profilePic from '../../../images/profile-pic.jpg';
export default class individual_2 extends Component {

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
                <div className="container">
                    <div className="row">
                        <div className="col-md-12 findscholar">
                            <h4> <span className="scholarlink"><a href="#">Find Scholar </a></span><span className="gtsymbol">&gt;</span><span className="review">Review Pendings Suggestions</span></h4>
                        </div>
                    </div>
                    <div className="searchby">
                        <div className="search">
                            <div className="row">
                                <div className="col-md-12">
                                    <ul className="listtable">
                                        <li className="searchedby">Searched by:</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="row searchtable">
                                <div className="col-md-5">
                                    <ul className="listtable">
                                        <li className="tablehead">Department</li>
                                        <li>Pediatric Cardiology</li>
                                        <li>Pediatric Anesthesiology</li>
                                        <li>Pediatric Cardiothoracic Surgery</li>
                                    </ul>
                                </div>
                                <div className="col-md-4">
                                    <ul className="listtable2">
                                        <li className="tablehead">Affiliation</li>
                                        <li>Affiliation Affiliation</li>
                                        <li>Affiliation</li>
                                        <li>Affiliation Affiliation</li>
                                    </ul>
                                </div>
                                <div className="col-md-3">
                                    <ul className="listtable3">
                                        <li className="tablehead">Person Type</li>
                                        <li>Person Type Person </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="row edit">
                            <div className="col-md-12">
                                <ul className="editsearch">
                                    <a href="#">Edit Search</a>
                                </ul>
                            </div>
                        </div>
                    </div>
                    {/* <table className="table table-borderless">

                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Affiliation</th>
                                        <th>Person Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Pediatric Cardiology</td>
                                        <td>Affiliation Affiliation</td>
                                        <td>Person Type Person </td>
                                    </tr>
                                    <tr>
                                        <td>Pediatric Anesthesiology</td>
                                        <td>Affiliation </td>
                                    </tr>
                                    <tr>
                                        <td>Pediatric Cardiothoracic Surgery</td>
                                        <td>Affiliation Affiliation </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <a href="#">Edit Search</a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table> */}

                    <div className="row scholars">
                        <div className="col-md-2">
                            <h4>11,201 scholars</h4>
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
                                        <button className="btn button1" type="button">First</button>
                                        <Pagination id="individual_page">
                                            {/* <Pagination.First /> */}
                                            <Pagination.Prev />


                                            <Pagination.Item disabled>{10}</Pagination.Item>
                                            <Pagination.Item>{11}</Pagination.Item>
                                            <Pagination.Ellipsis />
                                            <Pagination.Item>{25}</Pagination.Item>
                                            <Pagination.Item >{26}</Pagination.Item>


                                            <Pagination.Next />
                                            {/* <Pagination.Last /> */}
                                            <button className="btn button2" type="button">Last</button>
                                        </Pagination>
                                    </div>
                                </div>
                                </div>
                                <div className="firsttable">
                                <div className="row">                                    <div className="col-md-12">
                                        <h4><span className="link"><a href="#">Rainu Kaushal</a></span><span className="name">Chairman of Healthcare Policy and Research</span></h4>
                                    </div>
                                </div>
                                <div className="row recordstable">
                                    <div className="col-md-12">
                                        <div className="tableBody backgroundColorWhite">
                                            {/* <Col xs={12} md={12} lg={12}> */}
                                            <Table>
                                                <tbody>
                                                    <tr>
                                                        <td>
                                                            {/* <Row>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentSpaceBt">
                                            <div className="displayflex alignItemsCenter border1pxGreen borderRadius2 backgroundColorGreen padding5px">
                                                <span class="glyphicon glyphicon-ok"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Accept</p>
                                            </div>
                                        </Col>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentFS">
                                            <div className="displayflex alignItemsCenter colorWhite borderRadius2 backgroundColorRed padding5px">
                                                <span class="glyphicon glyphicon-remove"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Reject</p>
                                            </div>
                                        </Col>
                                    </Row> */}

                                                            {/* <Row style={{marginTop:10}}> */}
                                                            {/* <Col xs={12} md={12} lg={12}> */}
                                                            <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                                            </div>
                                                            <div className="padding15px ">
                                                                <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                                    <p className="evidence">Evidence Score</p>
                                                                    <h1 className="score"><b>10</b></h1>
                                                                </div>
                                                            </div>
                                                            {/* </Col> */}
                                                            {/* </Row> */}
                                                        </td>

                                                        <td>
                                                            <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                            <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                            <b>Journal:</b> The Journal of general physiology<br />
                                                            <b>Date:</b> 2016 Oct 01<br />
                                                            <span className="plussign"><a href="#">+
                                                                <p className="suggestionText">Show evidence behind this suggestion</p></a>
                                                                </span>
                                                               <span> <button className="btn button" type="button">PubMed</button>
                                                                <button className="btn button" type="button">GET IT</button>
                                                            </span>
                                                            </td>
                                                    </tr>

                                                    {/* <tr><td className="plussign"><a href="#">+</a></td>
                                                        <td className="suggestionText"><a href="#">Show evidence behind this suggestion</a></td>
                                                        <td><button className="btn button" type="button">PubMed</button></td>
                                                        <td><button className="btn button" type="button">GET IT</button></td>
                                                    </tr> */}

                                                </tbody>
                                            </Table>

                                        </div>
                                        <div className="tableBody backgroundColorWhite">
                                            <Table>
                                                <tbody>
                                                    <tr className="tablerow2">
                                                        <td>
                                                            {/* <Row>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentSpaceBt">
                                            <div className="displayflex alignItemsCenter border1pxGreen borderRadius2 backgroundColorGreen padding5px">
                                                <span class="glyphicon glyphicon-ok"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Accept</p>
                                            </div>
                                        </Col>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentFS">
                                            <div className="displayflex alignItemsCenter colorWhite borderRadius2 backgroundColorRed padding5px">
                                                <span class="glyphicon glyphicon-remove"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Reject</p>
                                            </div>
                                        </Col>
                                    </Row> */}

                                                            {/* <Row style={{marginTop:10}}> */}
                                                            {/* <Col xs={12} md={12} lg={12}> */}
                                                            <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                                            </div>
                                                            <div className="padding15px ">
                                                                <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                                    <p className="evidence">Evidence Score</p>
                                                                    <h1 className="score"><b>10</b></h1>
                                                                </div>
                                                            </div>
                                                            {/* </Col> */}
                                                            {/* </Row> */}
                                                        </td>

                                                        <td>
                                                            <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                            <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                            <b>Journal:</b> The Journal of general physiology<br />
                                                            <b>Date:</b> 2016 Oct 01<br />
                                                            <span className="plussign"><a href="#">+
                                                                <p className="suggestionText">Show evidence behind this suggestion</p></a></span>
                                                               <span> <button className="btn button" type="button">PubMed</button>
                                                                <button className="btn button" type="button">GET IT</button>
                                                            </span>
                                                            </td>
                                                    </tr>

                                                    {/* <tr className="plus">
                                                        <td className="plussign">
                                                            <a href="#">+</a></td>
                                                        <td className="suggestionText"><a href="#" >Show evidence behind this suggestion</a></td>
                                                        <td><button className="btn button" type="button">PubMed</button></td>
                                                        <td><button className="btn button" type="button">GET IT</button></td>
                                                    </tr> */}
                                                </tbody>
                                            </Table>
                                        </div>
                                        
                                    </div>

                                </div>
                                </div>
                                <div className="secondtable">
                                <div className="row">
                                    <div className="col-md-12">
                                        <h4><span className="link"><a href="#">Nathaniel Hupert</a></span><span className="name">Chairman of Healthcare Policy and Research</span></h4>
                                    </div>
                                </div>
                                <div className="row recordstable">
                                    <div className="col-md-12">
                                        <div className="tableBody backgroundColorWhite">
                                            {/* <Col xs={12} md={12} lg={12}> */}
                                            <Table>
                                                <tbody>
                                                    <tr>
                                                        <td>
                                                            {/* <Row>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentSpaceBt">
                                            <div className="displayflex alignItemsCenter border1pxGreen borderRadius2 backgroundColorGreen padding5px">
                                                <span class="glyphicon glyphicon-ok"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Accept</p>
                                            </div>
                                        </Col>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentFS">
                                            <div className="displayflex alignItemsCenter colorWhite borderRadius2 backgroundColorRed padding5px">
                                                <span class="glyphicon glyphicon-remove"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Reject</p>
                                            </div>
                                        </Col>
                                    </Row> */}

                                                            {/* <Row style={{marginTop:10}}> */}
                                                            {/* <Col xs={12} md={12} lg={12}> */}
                                                            <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                                            </div>
                                                            <div className="padding15px ">
                                                                <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                                    <p className="evidence">Evidence Score</p>
                                                                    <h1 className="score"><b>10</b></h1>
                                                                </div>
                                                            </div>
                                                            {/* </Col> */}
                                                            {/* </Row> */}
                                                        </td>

                                                        <td>
                                                            <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                            <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                            <b>Journal:</b> The Journal of general physiology<br />
                                                            <b>Date:</b> 2016 Oct 01<br />
                                                            <span className="plussign"><a href="#">+
                                                                <p className="suggestionText">Show evidence behind this suggestion</p></a>
                                                                </span>
                                                               <span> <button className="btn button" type="button">PubMed</button>
                                                                <button className="btn button" type="button">GET IT</button>
                                                            </span>
                                                            </td>
                                                    </tr>

                                                    {/* <tr><td className="plussign"><a href="#">+</a></td>
                                                        <td className="suggestionText"><a href="#">Show evidence behind this suggestion</a></td>
                                                        <td><button className="btn button" type="button">PubMed</button></td>
                                                        <td><button className="btn button" type="button">GET IT</button></td>
                                                    </tr> */}

                                                </tbody>
                                            </Table>

                                        </div>
                                        <div className="tableBody backgroundColorWhite">
                                            <Table>
                                                <tbody>
                                                    <tr className="tablerow2">
                                                        <td>
                                                            {/* <Row>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentSpaceBt">
                                            <div className="displayflex alignItemsCenter border1pxGreen borderRadius2 backgroundColorGreen padding5px">
                                                <span class="glyphicon glyphicon-ok"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Accept</p>
                                            </div>
                                        </Col>
                                        <Col xs={12} md={6} lg={6} className="displayflex justifyContentFS">
                                            <div className="displayflex alignItemsCenter colorWhite borderRadius2 backgroundColorRed padding5px">
                                                <span class="glyphicon glyphicon-remove"/>
                                                <p style={{fontWeight:"normal",margin:0}}>Reject</p>
                                            </div>
                                        </Col>
                                    </Row> */}

                                                            {/* <Row style={{marginTop:10}}> */}
                                                            {/* <Col xs={12} md={12} lg={12}> */}
                                                            <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                                            </div>
                                                            <div className="padding15px ">
                                                                <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                                    <p className="evidence">Evidence Score</p>
                                                                    <h1 className="score"><b>10</b></h1>
                                                                </div>
                                                            </div>
                                                            {/* </Col> */}
                                                            {/* </Row> */}
                                                        </td>

                                                        <td>
                                                            <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                            <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                            <b>Journal:</b> The Journal of general physiology<br />
                                                            <b>Date:</b> 2016 Oct 01<br />
                                                            <span className="plussign"><a href="#">+
                                                                <p className="suggestionText">Show evidence behind this suggestion</p></a></span>
                                                               <span> <button className="btn button" type="button">PubMed</button>
                                                                <button className="btn button" type="button">GET IT</button>
                                                            </span>
                                                            </td>
                                                    </tr>

                                                    {/* <tr className="plus">
                                                        <td className="plussign">
                                                            <a href="#">+</a></td>
                                                        <td className="suggestionText"><a href="#" >Show evidence behind this suggestion</a></td>
                                                        <td><button className="btn button" type="button">PubMed</button></td>
                                                        <td><button className="btn button" type="button">GET IT</button></td>
                                                    </tr> */}
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
            </div >



        );
    }
}