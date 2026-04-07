import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import SideNavbar from "../elements/Navbar/SideNavbar";
import { Footer } from "../elements/Footer/Footer";
import { ExpandNavContext } from "../elements/Navbar/ExpandNavContext";
import { signOut } from "next-auth/react";
import styles from "./AppLayout.module.css";
import NoAccess from "../elements/NoAccess/NoAccess";
import Loader from "../elements/Common/Loader";
import ToastContainerWrapper from "../elements/ToastContainerWrapper/ToastContainerWrapper";
import { reciterConfig } from "../../../config/local";
import { useDispatch, useSelector } from "react-redux";
import { clearPubSearchFilters, getAdminDepartments, getAdminRoles, notificationEmail } from "../../redux/actions/actions";

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
        {session?.data?.username && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#6b6560', padding: '5px 12px', borderRadius: 20, background: '#f3f1ed' }}>{session.data.username}</span>
            <button
              type="button"
              onClick={() => signOut({ redirect: false }).then(() => { window.location.href = '/api/auth/saml-logout'; })}
              style={{ fontSize: 13, color: '#a09a92', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
            >Logout</button>
          </div>
        )}
        {children}
        <Footer />
        {reciterConfig?.showToasts ? <ToastContainerWrapper /> : null}
      </div>
    </>
  ) : (
    <NoAccess />
  );
};
