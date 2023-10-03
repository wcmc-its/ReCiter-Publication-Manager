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
      }
      userRoles : Array,
      adminSettings : Array
      
    }
  }
}