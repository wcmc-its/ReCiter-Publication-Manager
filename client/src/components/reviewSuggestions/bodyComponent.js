import React, { useState } from 'react';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
import { Row, Col, Button, Form, Table, Accordion, Card, Collapse } from 'react-bootstrap';

const BodyComponent = () => {
    const [open, setOpen] = useState(false);

    return (
        <div >
            <div className=" AcceptRejectTab backgroundColorGrey">
                <Row>
                    <Col xs={2} md={2} lg={1} style={{ marginTop: 5 }}>
                        <Button variant="primary" className="backgroundColorBlue borderRadius0">Accept All</Button>
                    </Col>
                    <Col xs={2} md={2} lg={5} style={{ marginTop: 5 }}>
                        <Button className="backgroundColorWhite colorBlue borderRadius0">Reject All</Button>
                    </Col>
                    <Col xs={2} md={2} lg={3} style={{ marginTop: 5 }}>
                        <input placeholder="Filter...." className="padding10px fontStyleItalic border1px borderRadius2 width100percent" />
                    </Col>
                    <Col xs={2} md={2} lg={2} style={{ margin: 0 }}>
                        <Form.Group controlId="exampleForm.ControlSelect1" style={{ margin: 0, padding: 0 }}>
                            {/* <Form.Label>Example select</Form.Label> */}
                            <Form.Control as="select" className="border">
                                <option>Sort by Year</option>
                                <option>2</option>
                                <option>3</option>
                                <option>4</option>
                                <option>5</option>
                            </Form.Control>
                        </Form.Group>
                    </Col>
                    <Col xs={2} md={2} lg={1} style={{ margin: 0 }}>
                        <Form.Group controlId="exampleForm.ControlSelect1" style={{ margin: 0, padding: 0 }}>
                            {/* <Form.Label>Example select</Form.Label> */}
                            <Form.Control as="select" className="border pl-1 pr-0">
                                <option>1</option>
                                <option>2</option>
                                <option>3</option>
                                <option>4</option>
                                <option>5</option>
                            </Form.Control>
                        </Form.Group>
                    </Col>
                </Row>
            </div>


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
                                <Row>
                                    <Col lg={12} className="pt-1">
                                        <p> <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin </p>
                                        <p> <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.</p>
                                        <p>  <b>Journal:</b> The Journal of general physiology</p>
                                        <p> <b>Date:</b> 2016 Oct 01 </p>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col lg={8}>
                                        <Accordion defaultActiveKey="-1">
                                            <Accordion.Toggle variant="link" eventKey="0" className="accoedins_btns">
                                                <p className="suggestionText">+ Show evidence behind this suggestion</p>
                                            </Accordion.Toggle>
                                            <Accordion.Collapse eventKey="0">
                                                <div>
                                                    <p>Sample Text</p>
                                                </div>
                                            </Accordion.Collapse>
                                        </Accordion>
                                    </Col>
                                    <Col lg={4}>
                                        <span> <button className="btn button" type="button">PubMed</button>
                                            <button className="btn button" type="button">GET IT</button>
                                        </span>
                                    </Col>
                                </Row>


                            </td>
                        </tr>

                        {/* <tr><td className="plussign"><a href="#">+</a></td>
                            <td className="suggestionText"><a href="#">Show evidence behind this suggestion</a></td>
                            <td><button className="btn button1" type="button">PubMed</button></td>
                            <td><button className="btn button1" type="button">GET IT</button></td>
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
                                        <p className="evidence">Evidence</p>
                                        <h1 className="score"><b>10</b></h1>
                                    </div>
                                </div>
                                {/* </Col> */}
                                {/* </Row> */}
                            </td>

                            <td>
                                <Row>
                                    <Col lg={12} className="pt-1">
                                        <p> <b>Authors:</b> Nawreen Rahman, Cavoisier Ramos-Espiritu, Teresa A. Miller, John Buck, Lonny R Levin </p>
                                        <p> <b>Title:</b> Soluble adenylyl cyclase is essential for proper lysosomal acidification.</p>
                                        <p>  <b>Journal:</b> The Journal of general physiology</p>
                                        <p> <b>Date:</b> 2016 Oct 01 </p>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col lg={8}>
                                        <Accordion defaultActiveKey="-1">
                                            {/* <Accordion.Toggle as={Button} variant="link" eventKey="0" className="accoedins_btns">
                                                <p className="suggestionText"></p>
                                            </Accordion.Toggle> */}

                                        </Accordion>
                                        <p onClick={() => setOpen(!open)}
                                            aria-controls="example-collapse-text"
                                            aria-expanded={open}>+ Show evidence behind this suggestion </p>
                                    </Col>
                                    <Col lg={4}>
                                        <span> <button className="btn button" type="button">PubMed</button>
                                            <button className="btn button" type="button">GET IT</button>
                                        </span>
                                    </Col>
                                </Row>
                            </td>
                        </tr>
                        <tr><td colspan="3">
                            <Collapse in={open}>
                            <div className = " backgroundColorWhite">
                <Table className ="Accepted_info table table-bordered">
                    <thead>  
                        <tr >
                        <th className="firstColumn">Evidence</th>
                        <th className="secondColumn">Institutional Data</th>
                        <th className="thirdColumn">Article Data</th>
                    </tr>
                    </thead>
                  <tbody>
                  <tr>
                        <td className="firstColumnData"><b>Name <br/></b>2.0 points</td>
                        <td className="secondColumnData"> Alanoud Hejab Alanazi</td>
                        <td className="thirdColumnData">Alanoud Alanazi</td>
                    </tr>
                    
                    <tr>
                        <td className="firstColumnData"><b>Relationships<br/></b>8.1 points</td>
                        <td className="secondColumnData">
                            <ul className="d-inline-block">
                                <li className = "peronName">Wencheng Liu</li><span id="coinvestigator">Co-investigator</span>
                                <li className = "peronName">Lingzhi Zhao </li><span id="coinvestigator">Co-investigator</span>
                                <li className = "peronName">Maria Chiuchiolo </li> <span id="coinvestigator">Co-investigator</span>
                                <li className = "peronName">Dolan Sondhi </li><span id="coinvestigator">Co-investigator</span>
                                <li className = "peronName">Stephen Kaminsky</li> <span id="coinvestigator">Co-investigator</span>
                                <li className = "peronName">Steven Paul</li> <span id="coinvestigator">Co-investigator</span>
                            </ul>
                            
                        </td>
                        <td className="thirdColumnData" >
                            <ul className="d-inline-block">
                                <li>Wencheng Liu </li>
                                <li>Lingzhi Zhao </li>
                                <li>Maria Chiuchiolo </li>
                                <li>Dolan Sondhi </li>
                                <li>Stephen Kaminsky</li>
                                <li>Steven Paul </li>
                            </ul>
                            
                        </td>
                    </tr>
                    <tr>
                        <td className="firstColumnData"><b>Candidate article count</b><br/>1 points</td>
                        <td className="secondColumnData"></td>
                        <td className="thirdColumnData"><b>157</b></td>
                    </tr>
                    <tr>
                    <td className="firstColumnData"><b>Target author’s <br/>institutional affiliation<br/></b>0.71 points</td>
                        <td ></td>
                        <td className="thirdColumnData"><ul>
                            <li> Departemnt  Clinical Pharmacy College Pharmacy King Saud University Riyadh Saudi Arabia</li>
                            <li>mahalrasheed@ksu.edu.sa</li>
                            <li> <span id="coinvestigator">Co-investigator</span></li></ul></td>

                    </tr>
                    <tr>
                    <td className="firstColumnData"><b>Journal Category</b><br/>0.1 points</td>
                        <td className="secondColumnData">
                            <ul>
                                <li>Surgery</li>
                            <li> <span id="coinvestigator">Organizational Unit</span></li></ul></td>
                        <td className="thirdColumnData"><ul>
                            <li>General & Internal Medicine</li>
                                            <li> <span id="coinvestigator">Co-investigator</span></li></ul></td>

                    </tr>
                    <tr>
                    <td className="firstColumnData"><b>Degree Year Discrepancy<br/></b>0 points</td>
                        <td className="secondColumnData"> 2011-Doctorate</td>
                        <td className="thirdColumnData">2018</td>

                    </tr>
                    <tr>
                    <td className="firstColumnData"><b>Clustering</b><br/>0 points</td>
                        <td className="secondColumnData"></td>
                        <td className="thirdColumnData">
                            <ul>
                            <li> Score of article without clustering:<b>2.38</b></li>
                            <li>Average score of cluster:<b>2.38</b></li>
                        </ul>
                        </td>

                    </tr>
                    <tr>
                    <td className="firstColumnData"><b>Inferred gender of <br/>name (suorce)</b><br/>0 points</td>
                        <td className="secondColumnData">Female - 100% probability</td>
                        <td className="thirdColumnData"> Female - 100% probability</td>

                    </tr>
                  </tbody>
                   
                </Table>

            </div>
                            </Collapse>
                        </td>
                        </tr>

                        {/* <tr><td className="plussign"><a href="#">+</a></td>
                            <td className="suggestionText"><a href="#" >Show evidence behind this suggestion</a></td>
                            <td><button className="btn button1" type="button">PubMed</button></td>
                            <td><button className="btn button1" type="button">GET IT</button></td>
                        </tr> */}
                    </tbody>
                </Table>
            </div>
        </div>

    )
}

export default BodyComponent;
