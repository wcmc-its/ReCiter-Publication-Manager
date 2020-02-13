import React from 'react';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
import { Row, Col, Container, Tabs, Tab, Button, Table, FormControl, Form } from 'react-bootstrap'
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";


const NewRecord = () => {
    return (
        <div className="main-container">
            <div className="header-position">
                <Header />
            </div>
            <div className="side-nav-position">
                {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                <SideNav />
            </div>
            <Container className="paddig_top0">
                <Row>
                    <Col lg={12}>
                        <h3>Review Suggestions</h3>
                    </Col>
                    <Col lg={8}>
                        <ul className="list-inline newrecord-profile">
                            <li>
                            <Image src={require('../../images/ErikaAbrmasonMD.png')} width="100" height="100"  />
                            </li>
                            <li>
                                <h4>Jochen Buck, M.D.</h4>
                                <p>Associate Professor of Physiology and Biophysics</p>
                                <a href="#">Manage Profile</a>
                            </li>
                        </ul>
                    </Col>
                    <Col lg={4}>
                        <div className="pubmed_get_itbtns">
                            <Button variant="outline-primary">Pub Med</Button> <Button variant="outline-primary">Get It</Button>
                        </div>
                    </Col>
                </Row>
                <div className="pubmedaddnewrecordtxt">
                    <p>Adding new record from PubMed…</p>
                </div>
                <div className="new_records_tabs">
                <Tabs defaultActiveKey="home" id="uncontrolled-tab-example" className="tabs">
                    <Tab eventKey="home" title={<p> <span> Suggested </span> <span className="second_childrecords"> 40 </span></p>}>
                        <div className="grey_background">
                            <Row className="serach_new_block">
                                <Col lg={4}>
                                    <div className="input-group">
                                        <input type="text" className="form-control" placeholder="Search..." aria-describedby="basic-addon1" />
                                        <span className="search_newcord_icon input-group-addon" id="basic-addon1"><span class="glyphicon glyphicon-search" aria-hidden="true"></span></span>
                                    </div>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Earliest</b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Latest </b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                            </Row>
                            <div className="white_bgm">
                                <Row className="first_new_record">
                                    <Col lg={12}>
                                        <p>Number of results: <span><b>8 </b> </span></p>
                                        <p>See also: <span> <b> 0 </b>  </span> already accepted, <span> <b> 0 </b> </span> already rejected</p>
                                    </Col>
                                </Row>
                                <Row className="second_new_record">
                                    <Col lg={6}>
                                        <ul className="list-inline">
                                            <li>
                                              <b>  Show Entries </b> 
                                        </li>
                                            <li>
                                                <Form.Control as="select" className="newRecord_selectinput">
                                                    <option>1</option>
                                                    <option>2</option>
                                                    <option>3</option>
                                                    <option>4</option>
                                                    <option>5</option>
                                                </Form.Control>
                                            </li>
                                        </ul>
                                    </Col>
                                    <Col lg={{ span: 3, offset: 3 }}>
                                        <Form.Control type="text" placeholder="search" />
                                    </Col>
                                </Row>
                                <Row>
                                    <Table responsive className="new_record_table">
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                    </Table>
                                </Row>
                            </div>


                        </div>
                    </Tab>
                    <Tab eventKey="profile" title={<p> <span> Accepted</span> <span className="second_childrecords"> 30 </span></p>}>
                    <div className="grey_background">
                            <Row className="serach_new_block">
                                <Col lg={4}>
                                    <div className="input-group">
                                        <input type="text" className="form-control" placeholder="Search..." aria-describedby="basic-addon1" />
                                        <span className="search_newcord_icon input-group-addon" id="basic-addon1"><span class="glyphicon glyphicon-search" aria-hidden="true"></span></span>
                                    </div>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Earliest</b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Latest </b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                            </Row>
                            <div className="white_bgm">
                                <Row className="first_new_record">
                                    <Col lg={12}>
                                        <p>Number of results: <span><b>8 </b> </span></p>
                                        <p>See also: <span> <b> 0 </b>  </span> already accepted, <span> <b> 0 </b> </span> already rejected</p>
                                    </Col>
                                </Row>
                                <Row className="second_new_record">
                                    <Col lg={6}>
                                        <ul className="list-inline">
                                            <li>
                                              <b>  Show Entries </b> 
                                        </li>
                                            <li>
                                                <Form.Control as="select" className="newRecord_selectinput">
                                                    <option>1</option>
                                                    <option>2</option>
                                                    <option>3</option>
                                                    <option>4</option>
                                                    <option>5</option>
                                                </Form.Control>
                                            </li>
                                        </ul>
                                    </Col>
                                    <Col lg={{ span: 3, offset: 3 }}>
                                        <Form.Control type="text" placeholder="search" />
                                    </Col>
                                </Row>
                                <Row>
                                    <Table responsive className="new_record_table">
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                    </Table>
                                </Row>
                            </div>


                        </div>
                    </Tab>
                    <Tab eventKey="contact" title={<p><span>Rejected</span> <span className="second_childrecords"> 20 </span></p>}>
                    <div className="grey_background">
                            <Row className="serach_new_block">
                                <Col lg={4}>
                                    <div className="input-group">
                                        <input type="text" className="form-control" placeholder="Search..." aria-describedby="basic-addon1" />
                                        <span className="search_newcord_icon input-group-addon" id="basic-addon1"><span class="glyphicon glyphicon-search" aria-hidden="true"></span></span>
                                    </div>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Earliest</b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                                <Col lg={2}>
                                    <ul className="list-inline">
                                        <li>
                                           <b>Latest </b> 
                                        </li>
                                        <li>
                                            <Form.Control as="select" className="newRecord_selectinput">
                                                <option>1</option>
                                                <option>2</option>
                                                <option>3</option>
                                                <option>4</option>
                                                <option>5</option>
                                            </Form.Control>
                                        </li>
                                    </ul>
                                </Col>
                            </Row>
                            <div className="white_bgm">
                                <Row className="first_new_record">
                                    <Col lg={12}>
                                        <p>Number of results: <span><b>8 </b> </span></p>
                                        <p>See also: <span> <b> 0 </b>  </span> already accepted, <span> <b> 0 </b> </span> already rejected</p>
                                    </Col>
                                </Row>
                                <Row className="second_new_record">
                                    <Col lg={6}>
                                        <ul className="list-inline">
                                            <li>
                                              <b>  Show Entries </b> 
                                        </li>
                                            <li>
                                                <Form.Control as="select" className="newRecord_selectinput">
                                                    <option>1</option>
                                                    <option>2</option>
                                                    <option>3</option>
                                                    <option>4</option>
                                                    <option>5</option>
                                                </Form.Control>
                                            </li>
                                        </ul>
                                    </Col>
                                    <Col lg={{ span: 3, offset: 3 }}>
                                        <Form.Control type="text" placeholder="search" />
                                    </Col>
                                </Row>
                                <Row>
                                    <Table responsive className="new_record_table">
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>

                                            </td>
                                            <td>
                                                <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin<br />
                                                <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.<br />
                                                <b>Journal:</b> The Journal of general physiology<br />
                                                <b>Date:</b> 2016 Oct 01<br />
                                            </td>
                                        </tr>
                                    </Table>
                                </Row>
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

export default NewRecord;