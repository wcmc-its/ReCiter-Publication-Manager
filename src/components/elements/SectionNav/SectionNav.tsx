import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useSession } from "next-auth/react";
import { withoutScopeKeys } from '../../../utils/scopeResolver';
import { RootStateOrAny } from "../../../types/redux";
import { useNextPerson } from "../../../hooks/useNextPerson";
import styles from "./SectionNav.module.css";

// Section row under the top bar. Not sticky: it scrolls away while the top bar stays pinned.
const SectionNav = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const filters = useSelector((state: RootStateOrAny) => state.filters);
  const { next, goNext } = useNextPerson();

  let roles: any[] = [];
  try {
    roles = (session as any)?.data?.userRoles ? JSON.parse((session as any).data.userRoles) : [];
  } catch {
    roles = [];
  }

  // A user "has their own profile" when they hold a Curator_Self role carrying a
  // personIdentifier (faculty/postdoc who can curate themselves). Those users may open
  // Curate directly; everyone else (e.g. a Superuser with no profile of their own) must
  // first pick a person from Find People, so the item stays disabled until a search is active.
  const hasOwnProfile = roles.some(
    (role: any) => role.roleLabel === "Curator_Self" && role.personIdentifier
  );

  const items = [
    { title: "People", to: "/search", disabled: false, allowedRoleNames: ["Superuser", "Curator_All", "Reporter_All"] },
    {
      title: "Curate",
      to: "/curate",
      disabled: (Object.keys(withoutScopeKeys(filters)).length === 0) && !hasOwnProfile,
      allowedRoleNames: ["Superuser", "Curator_All", "Curator_Self"],
    },
    { title: "Authorships", to: "/authorships", disabled: false, allowedRoleNames: ["Superuser", "Curator_All"] },
    { title: "Reports", to: "/report", disabled: false, allowedRoleNames: ["Superuser", "Reporter_All", "Curator_All", "Curator_Self", "Curator_Scoped"] },
  ].filter((item) => roles.some((role: any) => item.allowedRoleNames.includes(role.roleLabel)));

  if (items.length === 0) return null;

  // Lit on its route or a sub-route (Curate stays lit on /curate/[id]); the trailing '/'
  // keeps /report from matching /reportbuilder.
  const isActive = (to: string) => router.pathname === to || router.pathname.startsWith(to + "/");

  return (
    <nav className={styles.sectionNav} aria-label="Sections">
      {items.map((item) => {
        const active = isActive(item.to);
        if (item.disabled && !active) {
          return (
            <span
              key={item.to}
              className={`${styles.item} ${styles.disabled}`}
              aria-disabled="true"
              title="Select a person from Find People first"
            >
              {item.title}
            </span>
          );
        }
        return (
          <Link
            key={item.to}
            href={item.to}
            className={`${styles.item} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.title}
          </Link>
        );
      })}
      {next && (
        <button
          type="button"
          className={styles.nextPill}
          onClick={goNext}
          title={`Next person with suggestions: ${next.name}`}
        >
          <span className={styles.nextLabel}>Next</span>
          <span className={styles.nextName}>{next.name}</span>
          <span className={styles.nextCount}>{next.pending.toLocaleString()}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}
    </nav>
  );
};

export default SectionNav;
