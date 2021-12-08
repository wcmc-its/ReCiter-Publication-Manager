import { useState } from "react";
import { Row, Col } from "react-bootstrap";
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
          <Row className="row-content">
            <ExpandNavContext.Provider value={{ expand: expandedNav, updateExpand: toggleExpand}}>
              <SideNavbar />
            </ExpandNavContext.Provider>
            <div className={`col-md-12 d-flex flex-column ${styles.main} ${expandedNav ? styles.mainCompact : ''}`} id="page-content-wrapper">
                <Row className="row-content"><Col className="main-content p-0" lg={12}>{children}</Col></Row>
                <Row><Footer /></Row>
            </div>
          </Row>
        </>
    );
};
