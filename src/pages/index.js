import { getServerSession } from "next-auth/next"
import { options } from "./api/auth/[...nextauth]";
import { allowedPermissions } from "../utils/constants";

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, options);
    let userPermissions = null;
    let personIdentifier = null;
    if (session && session.data && session.data.userRoles) {
      userPermissions = JSON.parse(session.data?.userRoles);
      personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : "";
    }

    // No session — redirect to login
    if (!session || !session.data) {
      if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
        return { redirect: { destination: "/login", permanent: false } };
      }
      return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
    }

    // Disabled user
    if (session.data.databaseUser && session.data.databaseUser.status == 0) {
      return { redirect: { destination: "/noaccess", permanent: false } };
    }

    // Curator_Self — redirect to their own curate page
    if (userPermissions && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
      return { redirect: { destination: `/curate/${personIdentifier}`, permanent: false } };
    }

    // Curator_All, Reporter_All, Superuser — redirect to search
    if (userPermissions && userPermissions.some(role =>
      role.roleLabel === allowedPermissions.Curator_All ||
      role.roleLabel === allowedPermissions.Reporter_All ||
      role.roleLabel === allowedPermissions.Superuser
    )) {
      return { redirect: { destination: "/search", permanent: false } };
    }

    // Authenticated but no recognized role
    return { redirect: { destination: "/noaccess", permanent: false } };
  } catch (error) {
    console.error("[INDEX:getServerSideProps]", error);
    if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
      return { redirect: { destination: "/login", permanent: false } };
    }
    return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
  }
}

export default function Home() {

    // @ts-ignore
    return <></>;
}