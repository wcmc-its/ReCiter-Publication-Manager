import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findOrCreateAdminUsers } from '../../../../controllers/db/admin.users.controller'

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const options = {
    providers: [
        Providers.Credentials({
            name: "ReCiter Publication Manager App",
            id: "direct_login",
            async authorize(credentials) {
                if(credentials.username !== undefined && credentials.password !== undefined) {
                  const apiResponse = await authenticate(credentials);
                console.log(apiResponse)
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
        Providers.Credentials({
            id: "saml",
            name: "SAML",
            authorize: async ({ samlBody }) => {
                samlBody = JSON.parse(decodeURIComponent(samlBody));
                const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);

                const postAssert = (identityProvider, samlBody) =>
                    new Promise((resolve, reject) => {
                        sp.post_assert(
                            identityProvider,
                            {
                                request_body: samlBody,
                            },
                            (error, response) => {
                                if (error) {
                                    reject(error);
                                }

                                resolve(response);
                            }
                        );
                    });

                try {
                    const idp = new saml2.IdentityProvider(
                        reciterSamlConfig.saml_idp_options
                    );
                    const { user } = await postAssert(idp, samlBody);
                    let cwid = null;

                    if (user.attributes && user.attributes.CWID) {
                        cwid = user.attributes.CWID[0];
                    }
                    console.log(user)

                    if (cwid) {
                        const adminUser = await findOrCreateAdminUsers(cwid)

                        adminUser.databaseUser = adminUser
                        adminUser.personIdentifier
                        console.log(adminUser)
                        return adminUser;
                    }

                    return { cwid, has_access: false };
                } catch (error) {
                    console.log(error);
                    return null;
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
            console.log(session)
            return session
        },
        async jwt(token, apiResponse) {
            if(apiResponse) {
              if(apiResponse.statusMessage) {
                token.username = apiResponse.statusMessage.username
              }
              if(apiResponse.databaseUser) {
                if(apiResponse.databaseUser.personIdentifier)
                    token.username = apiResponse.databaseUser.personIdentifier
                token.databaseUser = apiResponse.databaseUser
              }
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