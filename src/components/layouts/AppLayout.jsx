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
import { clearPubSearchFilters } from "../../redux/actions/actions";
import { allowedPermissions } from "../../utils/constants";


export const AppLayout = ({ children }) => {
  const router = useRouter();
  const dispatch = useDispatch ()

  const [session, loading] = useSession();
  const errors = useSelector((state) => state.errors);

  useEffect(() => {
    console.log("session in session",session)
    routerController()

    if (!session && !loading) {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
    }
  }, [session, loading, errors]);

  useEffect(() => {
    routerController()
    if (!session && !loading) {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
    }
  }, [router.asPath]);
  const routerController = async ()=>{

    console.log("session", session);
    if(session){
    let userRoles = JSON.parse(session?.data?.userRoles)
    let loggedInUserInfo= session?.data?.databaseUser
    let loggedInUserPersonIdentifier = loggedInUserInfo.personIdentifier;
     let isCuratorSelf = userRoles.some((role)=> role.roleLabel === allowedPermissions.Curator_Self) 
     let isSuperUser = userRoles.some((role)=> role.roleLabel === allowedPermissions.Superuser) 
     let isCuratorAll = userRoles.some((role)=> role.roleLabel === allowedPermissions.Curator_All) 
     let isReporterAll = userRoles.some((role)=> role.roleLabel === allowedPermissions.Reporter_All)


    if(router?.pathname === "/curate/[id]" && isCuratorSelf || isReporterAll ){
      if(loggedInUserPersonIdentifier === router.query.id){
        console.log("isCuratorSelf", isSuperUser)
      }else{
        router.back();
      }
    }else if(router?.pathname != "/report") {
      dispatch( clearPubSearchFilters());
    }else{
    }
  }
  }

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
