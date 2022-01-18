import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import { authenticate } from "../../../../controllers/authentication.controller";
import { findOrCreateAdminUsers } from '../../../../controllers/db/admin.users.controller'

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const options = {
    providers: [
        Providers.Credentials({
            name: "Stars App",
            async authorize(credentials) {
                if(credentials.username !== undefined && credentials.password !== undefined) {
                  const apiResponse = await authenticate(credentials);

                  if (apiResponse.statusCode == 200) {
                        const adminUser = await findOrCreateAdminUsers(credentials.username)
                        apiResponse.databaseUser = adminUser
                      return apiResponse;
                  } else {
                      return null;
                  }
                }
            },
        }),
    ],
    callbacks: {
        async signIn(apiResponse) {
            return apiResponse
        },
        async session(session, token) {
            session.data = token
            return session
        },
        async jwt(token, apiResponse) {
            if(apiResponse !== undefined && apiResponse.statusMessage && apiResponse.databaseUser) {
              token.accessToken = apiResponse.statusMessage.accessToken
              token.username = apiResponse.statusMessage.username
              token.databaseUser = apiResponse.databaseUser
            }
            return token
        },
    },
    session: {
        jwt: true,
        maxAge: 7200,
    },
};

export default authHandler;