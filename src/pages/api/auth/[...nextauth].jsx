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
                  console.log('direct Login*******************************',apiResponse)
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
                console.log('samlBody*******************************',samlBody)
                const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
                console.log('samlBody1*******************************',sp)
                const postAssert = (identityProvider, samlBody) =>
                    new Promise((resolve, reject) => {
                        console.log('coming into postAssert*********************************');
                        sp.post_assert(
                            identityProvider,
                            {
                                request_body: samlBody,
                            },
                            (error, response) => {
                                if (error) {
                                    reject(error);
                                }
                                console.log('received response from SAML*******************',response);
                                resolve(response);
                            }
                        );
                    });

                try {
                    const idp = new saml2.IdentityProvider(
                        reciterSamlConfig.saml_idp_options
                    );
                    const { user } = await postAssert(idp, samlBody);
                    console.log('SAML User*******************************',user);
                    let cwid = null;
                    let email = null;
                    console.log("user.attributes**********************************", user.attributes)
                    if (user.attributes && user.attributes.CWID) {
                        cwid = user.attributes.CWID[0];
                    }else if (user.attributes && user.attributes.email) {
                        email = user.attributes.user.email[0];
                    }

                    if (email || cwid) {
                        console.log('entered into email authorization**********************************',email)
                        const adminUser =null;
                        if(email)
                        {
                            const dbAdminUser = await findAdminUser(email,"email")
                            adminUser.databaseUser = dbAdminUser
                        //adminUser.personIdentifier
                        console.log('After fecting adminUser from DB inside email*********************',adminUser)
                             const dbUserRoles = await findUserPermissions(email,"email");
                            adminUser.userRoles = dbUserRoles;
                            console.log('After fecting adminRoles from DB inside email*********************',adminUser)

                        }
                        console.log('adminUser after email Authorization**********************************',adminUser)
                        if(!adminUser && cwid) // if adminUser is empty then try authorizing with cwid
                        {
                            console.log('entered into CWID authorization**********************************',cwid)
                            const dbAdminUser = await findAdminUser(cwid, "cwid");
                            adminUser.databaseUser = dbAdminUser
                            console.log('After fecting adminUser from DB inside cwid*********************',adminUser)
                           // adminUser.personIdentifier
                            const dbUserRoles = await findUserPermissions(cwid, "cwid");
                            adminUser.userRoles = dbUserRoles;
                            console.log('After fecting adminRoles from DB inside cwid*********************',adminUser)
                          
                        } 
                        return adminUser;
                        
                    }

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