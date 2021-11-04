import { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import SideNavbar from "../elements/Navbar/SideNavbar";
import { Footer } from "../elements/Footer/Footer";
import Header from "../elements/Header/Header";
import { ExpandNavContext } from "../elements/Navbar/ExpandNavContext";
import styles from './AppLayout.module.css';

export const AppLayout = ({ children }) => {

    const [expandedNav, setExpandedNav] = useState(true);

    const toggleExpand = () => {setExpandedNav(!expandedNav)};

    return (
        <>
            <Header/>
            <Container fluid={true} className={styles.containerFluid}>
              <div id="navbar-wrapper">
                <ExpandNavContext.Provider value={{ expand: expandedNav, updateExpand: toggleExpand}}>
                  <SideNavbar />
                </ExpandNavContext.Provider>
              </div>
              <div className={`d-flex flex-column ${styles.main} ${expandedNav ? styles.mainCompact : ''}`} id="page-content-wrapper">
                  <Container fluid={true} className={styles.containerFluid}>{children}</Container>
                  <Footer />
              </div>
            </Container>
        </>
    );
};
