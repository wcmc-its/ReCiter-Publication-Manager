import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findAdminUser, findOrCreateAdminUsers } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';

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
                  if (apiResponse.statusCode == 200) {
                        const adminUser = await findOrCreateAdminUsers(credentials.username)
                        apiResponse.databaseUser = adminUser;
                        const userRoles = await findUserPermissions(credentials.username, "cwid");
                        apiResponse.userRoles = userRoles;
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
                    let email = null;
                    const samlEmail = null;
                    console.log("user )))))))))))))))))))", user)
                    console.log("user.attributes)))))))))))))))))))", user.attributes)
                  //  console.log('user attributes email********************', user['user.email'][0]);
                    if (user.attributes && user.attributes.CWID) {
                        cwid = user.attributes.CWID[0];
                    }
                    const dupUser = JSON.stringify(user.attributes);
                    console.log("user )))))))))))))))))))", dupUser);
                    if(dupUser && JSON.parse(dupUser)['user.email'] && JSON.parse(dupUser)['user.email'].length > 0)
                     samlEmail = JSON.parse(dupUser)['user.email'][0];
                    console.log('samlEmail****************************',samlEmail); 
                    /*if (user.attributes &&  user['user.email'] &&  user['user.email'].length > 0 && user['user.email'][0]) {
                        email = user['user.email'][0];
                    }*/
                    if(samlEmail){
                        const adminUser = await findAdminUser(samlEmail,"email")
                        adminUser.databaseUser = adminUser
                        adminUser.personIdentifier
                        const userRoles = await findUserPermissions(samlEmail,"email");
                        adminUser.userRoles = userRoles;
                        console.log('adminUser**************************',adminUser);
                    }
                    if (!adminUser && cwid) {
                        // const adminUser = await findOrCreateAdminUsers(cwid)
                        const adminUser = await findAdminUser(cwid, "cwid");
                        adminUser.databaseUser = adminUser
                        adminUser.personIdentifier
                        const userRoles = await findUserPermissions(cwid, "cwid");
                        adminUser.userRoles = userRoles;
                        console.log('adminUser**************************',adminUser);
                    }  
                    return adminUser;
                    /*if (cwid) {
                        // const adminUser = await findOrCreateAdminUsers(cwid)
                        const adminUser = await findAdminUser(cwid, "cwid");
                        adminUser.databaseUser = adminUser
                        adminUser.personIdentifier
                        const userRoles = await findUserPermissions(cwid, "cwid");
                        adminUser.userRoles = userRoles;
                        return adminUser;
                    }else if(email){
                        const adminUser = await findAdminUser(email,"email")
                        adminUser.databaseUser = adminUser
                        adminUser.personIdentifier
                        const userRoles = await findUserPermissions(email,"email");
                        adminUser.userRoles = userRoles;
                        return adminUser;
                    }*/

                    return { cwid, has_access: false };
                } catch (error) {
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async signIn(apiResponse) {
            return apiResponse
        },
        async session(session, token,apiResponse) {
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
              if(apiResponse.userRoles) {
                if(apiResponse.userRoles)
                    token.userRoles = apiResponse.userRoles
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