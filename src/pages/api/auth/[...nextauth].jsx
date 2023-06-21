import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findAdminUser, findOrCreateAdminUsers,findOrCreateAdminUserRole } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const fetchAdminUserByCWIDOrEmail = async (attrValue,attrIndicator) =>{
    const adminUser = await findAdminUser(attrValue, attrIndicator);
    if(adminUser)
    {
        adminUser.databaseUser = adminUser
        adminUser.personIdentifier
        await grantDefaultRolesToAdminUser(adminUser);
        const userRoles = await findUserPermissions(attrValue, attrIndicator);
        adminUser.userRoles = userRoles;
        return adminUser;
    }
    return false;
}
const grantDefaultRolesToAdminUser = async(adminUserResp) => {

    let adminUser = adminUserResp;
    const adminSettings = await findOneAdminSettings('userRoles');
    if(adminSettings && adminSettings.viewAttributes && adminSettings.viewAttributes.length > 0)
    {
        let viewAttributes = JSON.parse(adminSettings.viewAttributes);
        let configuredRoles = [];
        let assignRolesPayload =[];
        configuredRoles = viewAttributes && viewAttributes.forEach(attr => {
            attr.roles.map(role=>{
                if(role.isChecked && role.roleName !=='Repoter_All' )
                {
                    let assignRolePayload = {
                        'userID': (JSON.parse(JSON.stringify(adminUser))).userID,
                        'roleID': role.roleId,
                        'createTimestamp': new Date() 
                        }
                        //check for the role assigned to the user or not
                        assignRolesPayload.push(assignRolePayload);
                } 
                
                })

        });
        
        //Adding default Role as Reporter_All regardless of the roles assigned
            assignRolesPayload.push({
            'userID': (JSON.parse(JSON.stringify(adminUser))).userID,
            'roleID': 3,
            'createTimestamp': new Date()
            });

        // let  assignRolesPayload1=  findRolesDifference(userRoles,assignRolesPayload);
        if(assignRolesPayload && assignRolesPayload.length > 0)
        {
            const adminSettings = await  findOrCreateAdminUserRole (assignRolesPayload); 
            return adminSettings;
        }
    }
}


const options = {
    providers: [
        Providers.Credentials({
            name: "ReCiter Publication Manager App",
            id: "direct_login",
            async authorize(credentials) {
                
                if(credentials.username !== undefined && credentials.password !== undefined) {
                  const apiResponse = await authenticate(credentials);
                  if (apiResponse.statusCode == 200) {
                       // const adminUser = await findOrCreateAdminUsers(credentials.username)
                        //apiResponse.databaseUser = adminUser;
                    await fetchAdminUserByCWIDOrEmail(credentials.username,'cwid')
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

                    if(smalUserEmail){
                        const adminUser = await fetchAdminUserByCWIDOrEmail(smalUserEmail,"email")
                        if(adminUser){
                            return adminUser;
                        }
                        else{
                           return await fetchAdminUserByCWIDOrEmail(cwid,'cwid')
                        }
                    }
                    if (cwid) {
                        return await fetchAdminUserByCWIDOrEmail(cwid,'cwid')
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
            //loading adminsettings after creating users specific data as it does not belongs to specific user.
          //  if(session || !session.adminSettings)
                session.adminSettings = await fetchUpdatedAdminSettings();
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
