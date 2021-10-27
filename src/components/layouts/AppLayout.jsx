import { Container, Row, Col } from "react-bootstrap";
import { useSelector } from 'react-redux'
import AppNavbar from "../elements/Navbar/Navbar_New";
import { Footer } from "../elements/Footer/Footer";
import Header from "../elements/Header/Header"; 

export const AppLayout = ({ children }) => {
    return (
        <>  
            <Header/>
            <Container fluid={true}>
                <Row>
                    <AppNavbar />
                    <Col xs={10} id="page-content-wrapper">
                        <Container fluid={true}>{children}</Container>
                    </Col>
                </Row>
            </Container>
            <Footer />
        </>
    );
};
