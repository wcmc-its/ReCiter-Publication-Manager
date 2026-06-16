import { getSession } from "next-auth/client"
import { getPermissionsFromRaw, getPermissionsFromRoles, getLandingPageFromPermissions } from "../utils/permissionUtils"

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx)

  if (!session || !session.data) {
    // Not authenticated
    if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
      return { redirect: { destination: "/login", permanent: false } }
    }
    return { redirect: { destination: "/api/saml/assert?callbackUrl=/search", permanent: false } }
  }

  // Check inactive user
  if (session.data.databaseUser && session.data.databaseUser.status == 0) {
    return { redirect: { destination: "/noaccess", permanent: false } }
  }

  // Resolve permissions and landing page
  let permissions = getPermissionsFromRaw(session.data.permissions)
  const userRoles = session.data.userRoles ? JSON.parse(session.data.userRoles) : []

  // Fallback when the data-driven permission set is empty (RBAC permission
  // tables not seeded in this env, or the login-time lookup failed): derive
  // permissions from role labels so privileged users are never sent to
  // /noaccess. Mirrors the middleware MW-03 fallback.
  if (permissions.length === 0) {
    permissions = getPermissionsFromRoles(userRoles)
  }

  const landingPage = getLandingPageFromPermissions(permissions, userRoles)

  return { redirect: { destination: landingPage, permanent: false } }
}

export default function Home() {
  return <></>
}