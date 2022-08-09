import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/client";
import { Row, Col } from "react-bootstrap";
import SideNavbar from "../elements/Navbar/SideNavbar";
import { Footer } from "../elements/Footer/Footer";
import Header from "../elements/Header/Header";
import { ExpandNavContext } from "../elements/Navbar/ExpandNavContext";
import styles from "./AppLayout.module.css";
import NoAccess from "../elements/NoAccess/NoAccess";
import Loader from "../elements/Common/Loader";
import ToastContainerWrapper from "../elements/ToastContainerWrapper/ToastContainerWrapper";
import { reciterConfig } from "../../../config/local";
import { useSelector } from "react-redux";

export const AppLayout = ({ children }) => {
  const router = useRouter();
  const [session, loading] = useSession();
  const errors = useSelector((state) => state.errors);

  useEffect(() => {
    if (!session && !loading) {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
    }
  }, [session, router, loading, errors]);

  const [expandedNav, setExpandedNav] = useState(true);
  const toggleExpand = () => {
    setExpandedNav(!expandedNav);
  };

  if (loading) {
    return <Loader />;
  }

  return session &&
    session.data &&
    session.data.databaseUser &&
    session.data.databaseUser.status == 1 ? (
    <>
      <Header />
      <Row className="row-content">
        <ExpandNavContext.Provider
          value={{ expand: expandedNav, updateExpand: toggleExpand }}
        >
          <SideNavbar />
        </ExpandNavContext.Provider>
        <div
          className={`col-md-12 d-flex flex-column ${styles.main} ${
            expandedNav ? styles.mainCompact : ""
          }`}
          id="page-content-wrapper"
        >
          <Row className="row-content">
            <Col className="main-content p-0" lg={12}>
              {children}
            </Col>
            {reciterConfig?.showToasts?<ToastContainerWrapper/>: null}
          </Row>
          <Row>
            <Footer />
          </Row>
        </div>
      </Row>
    </>
  ) : (
    <NoAccess />
  );
};
