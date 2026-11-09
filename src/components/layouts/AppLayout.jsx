import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Footer } from "../elements/Footer/Footer";
import SectionNav from "../elements/SectionNav/SectionNav";
import styles from "./AppLayout.module.css";
import NoAccess from "../elements/NoAccess/NoAccess";
import Loader from "../elements/Common/Loader";
import ViewAsBanner from "../elements/ViewAs/ViewAsBanner";
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

  if (status === "loading") {
    return <Loader />;
  }

  return session?.data?.databaseUser?.status === 1 ? (
    <>
      <ViewAsBanner />
      <SectionNav />
      <div className={styles.content}>
        {children}
        <Footer />
      </div>
    </>
  ) : (
    <NoAccess />
  );
};
