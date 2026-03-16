import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findAdminUser, findOrCreateAdminUsers, findOrCreateSamlUser } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings} from '../../../../controllers/db/admin.settings.controller';

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
                    console.log('[AUTH] Local login attempt:', credentials.username);
                    const apiResponse = await authenticate(credentials);
                    if (apiResponse.statusCode == 200) {
                        const adminUser = await findOrCreateAdminUsers(credentials.username);
                        apiResponse.databaseUser = adminUser;
                        const userRoles = await findUserPermissions(credentials.username, "cwid");
                        apiResponse.userRoles = userRoles;
                        console.log('[AUTH] Local login success:', credentials.username, 'roles:', userRoles);
                        return apiResponse;
                    } else {
                        console.log('[AUTH] Local login failed:', credentials.username, 'status:', apiResponse.statusCode);
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
                    let samlEmail = null;
                    if (user.attributes && user.attributes.CWID) {
                        cwid = user.attributes.CWID[0];
                    }
                    let dupUser = JSON.stringify(user.attributes);
                    let smalUserEmail = null;
                    if(dupUser)
                        samlEmail = JSON.parse(dupUser);
                    if(samlEmail && samlEmail['user.email'] && samlEmail['user.email'].length > 0)
                        smalUserEmail = samlEmail['user.email'][0];

                    console.log('[AUTH] SAML login attempt:', { email: smalUserEmail, cwid });

                    // Email-first lookup (PRESERVE EXACTLY -- battle-tested matching logic)
                    if(smalUserEmail){
                        const adminUser = await findAdminUser(smalUserEmail, "email");
                        if (adminUser) {
                            console.log('[AUTH] Account matched by email:', smalUserEmail, 'personIdentifier:', adminUser.personIdentifier);
                            adminUser.databaseUser = adminUser;
                            const userRoles = await findUserPermissions(smalUserEmail, "email");
                            adminUser.userRoles = userRoles;
                            console.log('[AUTH] Roles resolved:', userRoles);
                            return adminUser;
                        }
                        console.log('[AUTH] No admin_users match for email:', smalUserEmail);
                    }

                    // CWID fallback (PRESERVE EXACTLY -- battle-tested matching logic)
                    if (cwid) {
                        const adminUser = await findAdminUser(cwid, "cwid");
                        if (adminUser) {
                            console.log('[AUTH] Account matched by CWID:', cwid, 'personIdentifier:', adminUser.personIdentifier);
                            adminUser.databaseUser = adminUser;
                            const userRoles = await findUserPermissions(cwid, "cwid");
                            adminUser.userRoles = userRoles;
                            console.log('[AUTH] Roles resolved:', userRoles);
                            return adminUser;
                        }
                        console.log('[AUTH] No admin_users match for CWID:', cwid);
                    }

                    // AUTO-CREATE: No existing admin_users row found for this SAML user
                    console.log('[AUTH] WARN AUTO-CREATE: No existing account for', cwid, '(' + smalUserEmail + ') -- creating admin_users record');
                    const newUser = await findOrCreateSamlUser(cwid, smalUserEmail);
                    if (newUser) {
                        newUser.databaseUser = newUser;
                        // New user has no roles -- empty array means baseline access (canReport + canSearch)
                        newUser.userRoles = JSON.stringify([]);
                        console.log('[AUTH] WARN AUTO-CREATE: New user', cwid, '(' + smalUserEmail + ') -- admin_users created, personIdentifier=' + newUser.personIdentifier + ', baseline access granted');
                        return newUser;
                    }

                    console.log('[AUTH] ERROR: Auto-create failed for', cwid, smalUserEmail);
                    return { cwid, has_access: false };
                } catch (error) {
                    console.log('[AUTH] ERROR: SAML auth failed:', error);
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
            //loading adminsettings after creating users specific data as it does not belogs to specific user.
          //  if(session || !session.adminSettings)
                session.adminSettings = await fetchUpdatedAdminSettings();
            return session
        },
        async jwt(token, apiResponse) {
            if (apiResponse) {
                // Unified session structure for both SAML and local auth (AUTH-03)
                if (apiResponse.databaseUser) {
                    token.username = apiResponse.databaseUser.personIdentifier;
                    token.databaseUser = apiResponse.databaseUser;
                } else if (apiResponse.statusMessage) {
                    token.username = apiResponse.statusMessage.username;
                }
                if (apiResponse.userRoles) {
                    token.userRoles = apiResponse.userRoles;
                }
                console.log('[AUTH] JWT created: personIdentifier=' + token.username + ', hasRoles=' + !!apiResponse.userRoles);
            }
            return token;
        },
    },
    session: {
        jwt: true,
        maxAge: 7200,
    },
};

export default authHandler;
