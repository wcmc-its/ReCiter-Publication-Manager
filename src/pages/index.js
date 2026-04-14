import { getSession } from "next-auth/client"
import { getPermissionsFromRaw, getLandingPageFromPermissions } from "../utils/permissionUtils"

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
  const permissions = getPermissionsFromRaw(session.data.permissions)
  const userRoles = session.data.userRoles ? JSON.parse(session.data.userRoles) : []
  const landingPage = getLandingPageFromPermissions(permissions, userRoles)

  return { redirect: { destination: landingPage, permanent: false } }
}

export default function Home() {
  return <></>
}