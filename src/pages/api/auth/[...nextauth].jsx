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
import { reciterConfig } from "../../../../config/local";


// Determine the condition for choosing the authentication method
const isSamlEnabled = process.env.SAML_ENABLED === 'true';

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const sleep = ms => new Promise(res => setTimeout(res, ms));

const findOrcreateAdminUser = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    console.log('createdAdminUser*******************',createdAdminUser);
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
    console.log('adminSettings*********************',adminSettings);
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
            console.log('userRole*******************************',userRole);
            return userRole;
        }
    }
}

const options = {
    providers:[
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
                    if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                            && reciterConfig.asms.userTrackingAPIAuthorization)
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
                                console.log('response from SAML**********************',response);
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
                    let userPrincipalName = null;
                    if(dupUser)
                        usrAttr = JSON.parse(dupUser);
                    if(usrAttr && usrAttr['user.email'] && usrAttr['user.email'].length > 0)
                        smalUserEmail = usrAttr['user.email'][0];
                    if(usrAttr && usrAttr['urn:oid:2.5.4.42'] && usrAttr['urn:oid:2.5.4.42'].length > 0)
                        firstName = usrAttr['urn:oid:2.5.4.42'][0];
                    if(usrAttr && usrAttr['urn:oid:2.5.4.4'] && usrAttr['urn:oid:2.5.4.4'].length > 0)
                        lastName = usrAttr['urn:oid:2.5.4.4'][0];
                    if(usrAttr && usrAttr['userPrincipalName'] && usrAttr['userPrincipalName'].length > 0)
                        userPrincipalName = usrAttr['userPrincipalName'][0];
                    
                        
                    /*
                        User is trying to authenticate to Publication Manager.
 
                        1. Does user have first, middle, and last name in SAML payload? 
                        - If yes, get data from SAML. Create record in admin_users
                        - If no, go to 2.
                        
                        2. Does record exist in person table?
                        - If yes, get name data from person table.
                        - If no, create record without populating name data.
                        
                        In all cases, populate email in admin_users. Failing that, populate userPrincipalName (EPPN).
                    */  
                    if(smalUserEmail || userPrincipalName){
                       // find an adminUser with email and if exists then assign default role(REPORTER_ALL) and selected roles from configuration  
                           // const adminUser = await findAdminUser(smalUserEmail||userPrincipalName,"email")
                           console.log('smalUserEmail************************',smalUserEmail);
                           console.log('userPrincipalName************************',userPrincipalName);
                           const adminUser =  await findOrcreateAdminUser(cwid,smalUserEmail||userPrincipalName,firstName,lastName)
                           console.log('adminUser************************',adminUser);
                           await sleep(100)
                          if(adminUser){
                               /* adminUser.databaseUser = adminUser
                                adminUser.personIdentifier
                                console.log('coming here as well*************');
                                const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
                                console.log('After assigning the roles*************',assignedRoles);
                                await sleep(100)
                                const userRoles = await findUserPermissions(smalUserEmail,"email");
                                console.log('After finding the user roles*************',userRoles);
                                adminUser.userRoles = userRoles;*/
                                if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                            && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                                 console.log('returning adminUser******************',adminUser);   
                                if(adminUser)
                                    return adminUser;
                         }
                         else if(cwid)
                         {
                               const adminUser =  await findOrcreateAdminUser(cwid,smalUserEmail,firstName,lastName)
                               if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                        && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
                               if(adminUser)
                                    return adminUser;
                         }
                         
                    }
                    else if(cwid){
                           const adminUser = await findOrcreateAdminUser(cwid,smalUserEmail,firstName,lastName)
                           if(reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                    && reciterConfig.asms.userTrackingAPIAuthorization)
                                persistUserLogin(cwid);	
                           if(adminUser)
                                    return adminUser;
                    }
                    console.log('coming no access******************'.cwid);  
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
                    token.email = apiResponse.databaseUser.email ?? ""
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
    let payload = {
        "cwid":  cwid,
        "module":  "publication_manager"
    }

    let uri = `${reciterConfig.asms.userTrackingAPI}`
    return fetch(uri, {
            method: "POST",
            headers: {
                'Authorization': 'Bearer ' + reciterConfig.asms.userTrackingAPIAuthorization,
            },
            body: JSON.stringify(payload)
        })
            .then(async(res)=> {
                console.log('ASMS User tracker end point api is Successfull: ', res)
                if(res.status == 200) {
                } 
            })
            .catch((error) => {
                console.log('ASMS User tracker end point api is not reachable: ' + error)
                return {
                    statusCode: error.status,
                    statusText: error
                }
            });
            
}


export default authHandler;

