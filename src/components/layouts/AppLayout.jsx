import { Container, Row, Col } from "react-bootstrap";
import SideNavbar from "../elements/Navbar/SideNavbar";
import { Footer } from "../elements/Footer/Footer";
import Header from "../elements/Header/Header";
import Box from '@mui/material/Box';

export const AppLayout = ({ children }) => {
    return (
        <>
            <Header/>
            <Container fluid={true}>
                <Row>
                    <Col xs={2} id="navbar-wrapper">
                      <SideNavbar />
                    </Col>
                    <Box component="main" sx={{ flexGrow: 1, p: 3 }} id="page-content-wrapper">
                        <Container fluid={true}>{children}</Container>
                    </Box>
                </Row>
            </Container>
            <Footer />
        </>
    );
};
