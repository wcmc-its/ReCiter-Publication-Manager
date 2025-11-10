import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';
import {findOrcreateAdminUser,persistUserLogin} from "../../../utils/samlUtils";

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const options = {
	debug: true,
      providers: [
    CredentialsProvider({
      id: 'direct_login',
      name: 'ReCiter Publication Manager App',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await authenticate(credentials);
        if (user?.statusCode !== 200) return null;

        const adminUser = await findOrcreateAdminUser(
          credentials.username,
          credentials.email,
          credentials.firstName,
          credentials.lastName
        );

        const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
        const userRoles = await findUserPermissions(credentials.username, 'cwid');

        if (process.env.ASMS_API_BASE_URL)
          persistUserLogin(credentials.username);

        user.databaseUser = adminUser;
        user.userRoles = userRoles;
        return user;
      },
    })

  ],

  callbacks: {
    async signIn({ user }) {
      console.log('signIn Callback:', user);
      return true;
    },

    async jwt({ token, user }) {
      console.log("jwt callback******************",token,user); 
      if (user) console.log("JWT callback: new login for", user.email);
       else console.log("JWT callback: existing token", token.email);
 
      if (user) {
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser;
        token.userRoles = user.userRoles || [];
      }
      return token;
    },

    async session({ session, token }) {
      console.log("Calling session callback*************");  
      console.log("Session callback:", session.user.email);
      session.data = token;
      session.adminSettings = await fetchUpdatedAdminSettings();
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,
};




export default authHandler;

