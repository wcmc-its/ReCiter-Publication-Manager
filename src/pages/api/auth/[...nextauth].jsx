import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findAdminUser, findOrCreateAdminUsers,findOrCreateAdminUserRole } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';
import { createAdminUser } from "../../../redux/actions/actions";
import sequelizeASMS from "../../../db/asmsDB";
import DateTime from "tedious/lib/data-types/datetime";

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const sleep = ms => new Promise(res => setTimeout(res, ms));

const findOrcreateAdminUserWithCWID = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    if(createdAdminUser)
    {
        const assignedRoles = await grantDefaultRolesToAdminUser(createdAdminUser);
        await sleep(50);
        const userRoles = await findUserPermissions(cwid, "cwid")
         createdAdminUser.userRoles = userRoles;
          let databaseUser = {
            "userID" : createdAdminUser.userID,
            "personIdentifier": createdAdminUser.personIdentifier,
            "nameFirst": createdAdminUser.firstName,
            "nameMiddle": createdAdminUser.nameMiddle,
            "nameLast":createdAdminUser.lastName,
            "email" : createdAdminUser.samlEmail,
            "status":createdAdminUser.status,
            "createTimestamp":createdAdminUser.createTimestamp,
            "modifyTimestamp":createdAdminUser.modifyTimestamp
        }
        createdAdminUser.databaseUser = databaseUser
        createdAdminUser.personIdentifier    
        if(createdAdminUser)
            return createdAdminUser;
    }
    return createAdminUser;
}
const grantDefaultRolesToAdminUser = async(adminUser) => {
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

        if(assignRolesPayload && assignRolesPayload.length > 0)
        {
            const userRole = await  findOrCreateAdminUserRole (assignRolesPayload); 
            return userRole;
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
                    const adminUser = await findOrCreateAdminUsers(credentials.username,credentials.email,credentials.firstName,credentials.lastName)
                    apiResponse.databaseUser = adminUser;
                    const assignedRoles = await grantDefaultRolesToAdminUser(adminUser)
                    const userRoles = await findUserPermissions(credentials.username, "cwid");
                    apiResponse.userRoles = userRoles;
					persistUserLogin(credentials.username);									   
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
                    let usrAttr = null;
                    if (user.attributes && user.attributes.CWID) {
                        cwid = user.attributes.CWID[0];
                    }
                    let dupUser = JSON.stringify(user.attributes);
                    let smalUserEmail = null;
                    let firstName = null;
                    let lastName = null;
                    if(dupUser)
                        usrAttr = JSON.parse(dupUser);
                    if(usrAttr && usrAttr['user.email'] && usrAttr['user.email'].length > 0)
                        smalUserEmail = usrAttr['user.email'][0];
                    if(usrAttr && usrAttr['urn:oid:2.5.4.42'] && usrAttr['urn:oid:2.5.4.42'].length > 0)
                        firstName = usrAttr['urn:oid:2.5.4.42'][0];
                    if(usrAttr && usrAttr['urn:oid:2.5.4.4'] && usrAttr['urn:oid:2.5.4.4'].length > 0)
                        lastName = usrAttr['urn:oid:2.5.4.4'][0];   
                    if(smalUserEmail){
                       // find an adminUser with email and if exists then assign default role(REPORTER_ALL) and selected roles from configuration  
                            const adminUser = await findAdminUser(smalUserEmail,"email")
                            await sleep(100)
                          if(adminUser){
                                adminUser.databaseUser = adminUser
                                adminUser.personIdentifier
                                const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
                                await sleep(100)
                                const userRoles = await findUserPermissions(smalUserEmail,"email");
                                adminUser.userRoles = userRoles;
                                persistUserLogin(cwid);	
                                if(adminUser)
                                    return adminUser;
                         }
                         else if(cwid)
                         {
                               const adminUser =  await findOrcreateAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
                               persistUserLogin(cwid);	
                               if(adminUser)
                                    return adminUser;
                         }
                         
                    }
                    else if(cwid){
                           const adminUser = await findOrcreateAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
                           persistUserLogin(cwid);	
                           if(adminUser)
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

const persistUserLogin =async (cwid)=>{

    console.log('coming into persistUserLogin**************************',cwid);
    let userLoginDetails1 = await sequelizeASMS.query(
        "SELECT au.default_title, au.id FROM wp_module as au WHERE au.slug = 'publication_manager' ",
        {
            raw: true
        }
    );
    let wpModuleID = userLoginDetails1[0]
    console.log('coming into wpModuleID**************************',wpModuleID);
    let userLoginDetails = sequelizeASMS.query(
        'INSERT INTO wp_module_usage (module_id,created_at,cwid) values (:moduleId, :createdAt , :cwid )',
        {
             type: sequelizeASMS.QueryTypes.INSERT ,
             replacements: {moduleId: wpModuleID[0].id,  createdAt: new Date(Date.now()).toISOString(), cwid: cwid },
             raw:true
        }
    ).then(function (userInsertUsageId) {
        console.log(userInsertUsageId);
    });
    console.log('inserted**************************',userLoginDetails);
}

export default authHandler;

