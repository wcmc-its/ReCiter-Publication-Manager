import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import SideNavbar from "../elements/Navbar/SideNavbar";
import { Footer } from "../elements/Footer/Footer";
import Header from "../elements/Header/Header";
import { ExpandNavContext } from "../elements/Navbar/ExpandNavContext";
import styles from "./AppLayout.module.css";
import NoAccess from "../elements/NoAccess/NoAccess";
import Loader from "../elements/Common/Loader";
import ToastContainerWrapper from "../elements/ToastContainerWrapper/ToastContainerWrapper";
import ViewAsBanner from "../elements/ViewAs/ViewAsBanner";
import { reciterConfig } from "../../../config/local";
import { useDispatch, useSelector } from "react-redux";
import { clearError, clearPubSearchFilters, getAdminDepartments, getAdminRoles, notificationEmail } from "../../redux/actions/actions";

export const AppLayout = ({ children }) => {
  const router = useRouter();
  const dispatch = useDispatch();

  const { data: session, status } = useSession();
  const errors = useSelector((state) => state.errors);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (errors.length) {
      router.push("/_error");
      // Nothing else empties the errors array, so leaving it populated makes every
      // later mount of this layout bounce the user back to /_error forever.
      dispatch(clearError());
    }
  }, [status, errors, router]);

  useEffect(() => {
    if (router?.pathname !== "/report") {
      dispatch(clearPubSearchFilters());
    }

    if (router?.pathname === "/manageusers/[userId]") {
      dispatch(getAdminRoles());
      dispatch(getAdminDepartments());
    }

    if (router?.pathname !== "/notifictions/[userId]") {
      dispatch(notificationEmail(""));
    }
  }, [router]);

  const handleCloseModal = () => {
    setVissibleNoAccessModal(false);
    router.back();
  };

  const [expandedNav, setExpandedNav] = useState(true);
  const toggleExpand = () => {
    setExpandedNav(!expandedNav);
  };

  if (status === "loading") {
    return <Loader />;
  }

  return session?.data?.databaseUser?.status === 1 ? (
    <>
      <ExpandNavContext.Provider
          value={{ expand: expandedNav, updateExpand: toggleExpand }}
        >
          <SideNavbar />
        </ExpandNavContext.Provider>
      <div className={expandedNav ? styles.expandedSideBarContent : styles.nonExpandedSideBarContent}>
        <ViewAsBanner />
        {children}
        <Footer />
        {reciterConfig?.showToasts ? <ToastContainerWrapper /> : null}
      </div>
    </>
  ) : (
    <NoAccess />
  );
};
