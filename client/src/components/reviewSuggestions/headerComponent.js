import React from 'react';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
import { Row, Col } from 'react-bootstrap';

const HeaderComponent = () => {
    return (
        <Row className="backgroundColorWhite padding30px">
            <Col>
                <p className="fontSize20px fontFamily">Manage Profile</p>
            </Col>
            <Col xs={12} md={12}>
                <Row className="displayflex alignItemsCenter padding10_20px">
                    <Col xs={3} md={2} lg={2} className="displayflex justifyContentFE">
                        <Image src={require('../../images/ErikaAbrmasonMD.png')} width="100" height="100"  />
                    </Col>
                    <Col xs={6} md={4} className="justifyContentFS lineSpacing1">
                        <p className="fontWeightBold colorBlack">Jochen Buck, M.D.</p>
                        <p className="fontSize13px">Associate Professor of Physiology and Biophysics</p>
                        <a href="#" className="fontSize13px textDecorationUnderline">Manage Profile</a>
                    </Col>
                </Row>
            </Col>
        </Row>
    )
}

export default HeaderComponent;