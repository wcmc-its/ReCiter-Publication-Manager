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
      userRoles : any,
      adminSettings : any,
      /** Phase 9: JSON-serialized scope data for Curator_Scoped users */
      scopeData?: string,
      /** Phase 9: JSON-serialized array of proxy person identifiers */
      proxyPersonIds?: string,

    },
    adminSettings?: string
  }
}