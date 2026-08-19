import NextAuth from "next-auth"
import { Json } from "sequelize/types/lib/utils"

declare module "next-auth" {
  /**
  * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
  */
  interface Session {
    user: {
    /** The user's postal address. */
    address: string
    },
    data: {
      /** The user name */
      username: string,
      email: string,
      databaseUser: {
        userID: number,
        status: number,
        nameFirst: string,
      }
      userRoles : Array,
      adminSettings : Array,
      /** Set on the JWT from the server-only LITERATURE_SEARCH_CWIDS pilot allowlist. One boolean
       *  about THIS user — the roster never reaches the browser. Hides the sidebar link; the API
       *  route is the actual gate. */
      literatureAccess? : boolean

    },
    adminSettings?: string
  }
}