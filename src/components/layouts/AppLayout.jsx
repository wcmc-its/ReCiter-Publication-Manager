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
import { useDispatch, useSelector } from "react-redux";
import { clearPubSearchFilters, getAdminDepartments, getAdminRoles,notificationEmail } from "../../redux/actions/actions";


export const AppLayout = ({ children }) => {
  const router = useRouter();
  const dispatch = useDispatch ()

  const [session, loading] = useSession();
  const errors = useSelector((state) => state.errors);

  useEffect(() => {
    if (!session && !loading) {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
    }
  }, [session, loading, errors]);

  useEffect(() => {
    if (router?.pathname !== "/report") {
      dispatch(clearPubSearchFilters());
    }


    if(router?.pathname === "/manageusers/[userId]") {
      dispatch(getAdminRoles());
      dispatch(getAdminDepartments())
    }

    if(router?.pathname !== "/notifictions/[userId]") {
      dispatch(notificationEmail(""));
    }


    
    if (!session && !loading) {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
    }
  }, [router]);


  const handleCloseModal = ()=> {
    setVissibleNoAccessModal(false)
    router.back();
}

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
      {/* <Header /> */}
      <Row>
      <Col lg={ expandedNav ? 2 :1}>
      <ExpandNavContext.Provider
          value={{ expand: expandedNav, updateExpand: toggleExpand }}
        >
          <SideNavbar />
        </ExpandNavContext.Provider>
      </Col>
      <Col lg={expandedNav ? 10 :11} >
      <div className={expandedNav ? styles.expandedSideBarContent : styles.nonExpandedSideBarContent}>
               {children} 
            </div>
            {reciterConfig?.showToasts?<ToastContainerWrapper/>: null}
      </Col>
     </Row>
    </>
  ) : (
    <NoAccess />
  );
};
