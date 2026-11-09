import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { signOut, useSession } from "next-auth/react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import styles from "./Header.module.css";
import { getSigninUrl } from "../../../utils/loginHelper";
import { getCapabilities, getLandingPage } from "../../../utils/constants";
import { RootStateOrAny } from "../../../types/redux";
import ViewAsModal from "../ViewAs/ViewAsModal";

const Chevron = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Highest-privilege role first; the avatar menu names the first one the user holds.
const ROLE_ORDER = ["Superuser", "Curator_All", "Curator_Scoped", "Reporter_All", "Curator_Self", "Department_user"];

const hasRole = (roles: any[], names: string[]) => roles.some((role: any) => names.includes(role.roleLabel));

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// Notifications shows for a Superuser always, for everyone else only when the
// EmailNotifications admin setting is visible and the user has an email (the side rail's rule).
const useNotificationsVisible = (session: any) => {
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings);
  let manageNotifications: any[] = [];
  try {
    if (updatedAdminSettings?.length > 0) {
      manageNotifications = updatedAdminSettings.find((obj: any) => obj.viewName === "EmailNotifications")?.viewAttributes || [];
    } else if (session?.adminSettings) {
      const data = JSON.parse(session.adminSettings).find((obj: any) => obj.viewName === "EmailNotifications");
      manageNotifications = data ? JSON.parse(data.viewAttributes) : [];
    }
  } catch {
    manageNotifications = [];
  }
  return !!manageNotifications.find((data: any) => data.isVisible);
};

const menuPaperSx = {
  mt: 1,
  minWidth: 200,
  borderRadius: "var(--radius)",
  border: "1px solid var(--pm-border-strong)",
  boxShadow: "0 8px 24px rgba(34,30,28,0.14)",
  "& .MuiList-root": { p: "6px" },
  "& .MuiMenuItem-root": { fontSize: 13, borderRadius: "6px", minHeight: 0, py: 1, px: 1.25, color: "var(--pm-foreground)" },
  "& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible": { bgcolor: "var(--pm-surface-2)" },
};

const Header = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const s: any = session;
  const [adminAnchor, setAdminAnchor] = useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);
  const [showViewAsModal, setShowViewAsModal] = useState(false);
  const notificationsVisible = useNotificationsVisible(s);

  // The header outlives page changes, so close any open menu on navigation.
  useEffect(() => {
    setAdminAnchor(null);
    setUserAnchor(null);
  }, [router.asPath]);

  let roles: any[] = [];
  try {
    roles = s?.data?.userRoles ? JSON.parse(s.data.userRoles) : [];
  } catch {
    roles = [];
  }
  const signedIn = !!s?.data;
  const homeHref = signedIn ? getLandingPage(getCapabilities(roles)) : "/";

  const username: string = s?.data?.username || "";
  const displayName: string = s?.data?.name || username;
  const roleLabel = ROLE_ORDER.find((r) => hasRole(roles, [r]));
  const isSuperuser = hasRole(roles, ["Superuser"]);

  // Same role rules the retired side rail used.
  const adminItems = isSuperuser
    ? [
        { label: "Manage users", to: "/manageusers" },
        { label: "Configuration", to: "/configuration" },
      ]
    : [];
  const userItems = hasRole(roles, ["Department_user", "Curator_Self", "Superuser", "Curator_All"])
    ? [
        { label: "Manage profile", to: `/manageprofile/${username}` },
        ...(isSuperuser || (notificationsVisible && s?.data?.email)
          ? [{ label: "Notifications", to: `/notifications/${username}` }]
          : []),
      ]
    : [];

  const go = (to: string) => {
    setAdminAnchor(null);
    setUserAnchor(null);
    router.push(to);
  };

  return (
    <header className={styles.topNav}>
      <Link href={homeHref} className={styles.wordmark}>
        <span className={styles.wordmarkKicker}>ReCiter</span>
        <span className={styles.wordmarkTitle}>Publication Manager</span>
      </Link>

      {signedIn && (
        <div className={styles.actions}>
          {adminItems.length > 0 && (
            <>
              <button
                type="button"
                id="pm-admin-trigger"
                className={styles.barButton}
                aria-haspopup="menu"
                aria-expanded={!!adminAnchor}
                aria-controls={adminAnchor ? "pm-admin-menu" : undefined}
                onClick={(e) => setAdminAnchor(e.currentTarget)}
              >
                Admin <Chevron />
              </button>
              <Menu
                id="pm-admin-menu"
                anchorEl={adminAnchor}
                open={!!adminAnchor}
                onClose={() => setAdminAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                MenuListProps={{ "aria-labelledby": "pm-admin-trigger" }}
                PaperProps={{ sx: menuPaperSx }}
              >
                {adminItems.map((item) => (
                  <MenuItem key={item.to} onClick={() => go(item.to)}>{item.label}</MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* Hidden while an overlay is active: the banner's "Return to my view" is the exit. */}
          {s.canViewAs && !s.viewAs && (
            <button type="button" className={styles.barButton} onClick={() => setShowViewAsModal(true)}>
              View as…
            </button>
          )}

          <button
            type="button"
            id="pm-user-trigger"
            className={styles.avatarButton}
            aria-haspopup="menu"
            aria-expanded={!!userAnchor}
            aria-controls={userAnchor ? "pm-user-menu" : undefined}
            aria-label={`Account menu for ${displayName}`}
            onClick={(e) => setUserAnchor(e.currentTarget)}
          >
            <span className={styles.avatar} aria-hidden="true">{initialsOf(displayName)}</span>
            <span className={styles.avatarName}>{displayName}</span>
            <Chevron size={14} />
          </button>
          <Menu
            id="pm-user-menu"
            anchorEl={userAnchor}
            open={!!userAnchor}
            onClose={() => setUserAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            MenuListProps={{ "aria-labelledby": "pm-user-trigger" }}
            PaperProps={{ sx: { ...menuPaperSx, minWidth: 220 } }}
          >
            <li className={styles.menuIdentity} role="presentation">
              <span className={styles.menuName}>{displayName}</span>
              <span className={styles.menuMeta}>
                {username}{roleLabel ? ` · ${roleLabel.replace(/_/g, " ")}` : ""}
              </span>
            </li>
            <Divider sx={{ my: "4px !important", borderColor: "var(--pm-border)" }} />
            {userItems.map((item) => (
              <MenuItem key={item.to} onClick={() => go(item.to)}>{item.label}</MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                setUserAnchor(null);
                signOut({ callbackUrl: getSigninUrl() });
              }}
            >
              Log out
            </MenuItem>
          </Menu>

          <ViewAsModal show={showViewAsModal} onHide={() => setShowViewAsModal(false)} />
        </div>
      )}
    </header>
  );
};
export default Header;
