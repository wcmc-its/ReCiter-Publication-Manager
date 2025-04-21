import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findOrCreateAdminUsers,findOrCreateAdminUserRole } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';
import { createAdminUser } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import { findOnePerson } from "../../../../controllers/db/person.controller";
import { allowedPermissions } from "../../../utils/constants";

// Determine the condition for choosing the authentication method
const isSamlEnabled = process.env.SAML_ENABLED === 'true';

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const sleep = ms => new Promise(res => setTimeout(res, ms));
function isEmptyString(val) {
    console.log('type of val *********', typeof val)
    console.log('val *********', val);	
    return typeof val !== 'string' || val.trim() === '';
  };
const findOrcreateAdminUser = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    if(createdAdminUser)
    {
	
        await grantDefaultRolesToAdminUser(createdAdminUser);
        await sleep(50);
        let userRoles ='';
         if(samlEmail)
         {   
	    console.log('coming into this method***********');    	 
            userRoles = await findUserPermissions(samlEmail, "email")
	    console.log('coming into this method***********',userRoles);    	 
            if(isEmptyString(userroles))
            {
	      console.log('fecthing userroles using cwid in email');				    
              userRoles = await findUserPermissions(cwid, "cwid")
	      console.log('userroles are : ',userRoles);	    
            }
         }
         if(isEmptyString(userroles) && cwid)
         {  
	   
	      console.log('fecthing userroles using cwid');	 
            userRoles = await findUserPermissions(cwid, "cwid")
	     console.log('userroles are : ',userRoles);	 
         }
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
    let assignRolesPayload =[];
    if(adminSettings && adminSettings.viewAttributes && adminSettings.viewAttributes.length > 0)
    {
        let viewAttributes = JSON.parse(adminSettings.viewAttributes);
        viewAttributes && viewAttributes.forEach(attr => {
            attr.roles.map(role=>{
                if(role.isChecked)
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

    }
    let personAPIResponse;
    let existingAdminUserRoles =[];
    let finalAssignRolesPayload =[];
    if(adminUser && adminUser.personIdentifier)
    {
        personAPIResponse = await findOnePerson("personIdentifier",adminUser.personIdentifier);
        existingAdminUserRoles = JSON.parse(await findUserPermissions(adminUser.personIdentifier, "cwid"))
    } 
    if(assignRolesPayload && assignRolesPayload.length >= 2)
    {
        //nothing continue
    } 
    //Check for Curator_All role in assignRolesPaylaod if it is there then continue otherwise, 
    // check for an entry in person table with the personIdentifier, if exist then assign curator_self role 
    else if(personAPIResponse && personAPIResponse.personIdentifier 
        && ((assignRolesPayload && assignRolesPayload.length <=0) || (assignRolesPayload && assignRolesPayload.length >0 && !assignRolesPayload.some((role) => role.roleID == 2)))
        && ((existingAdminUserRoles && existingAdminUserRoles.length <=0) || (existingAdminUserRoles && existingAdminUserRoles.length > 0 && (!existingAdminUserRoles.some((role) => role.roleLabel == allowedPermissions.Curator_All)
                        && !existingAdminUserRoles.some((role) => role.roleLabel == allowedPermissions.Curator_Self )))))
    {
        let assignRolePayload = {
            'userID': (JSON.parse(JSON.stringify(adminUser))).userID,
            'roleID': 4,
            'createTimestamp': new Date() 
            }
            //check for the role assigned to the user or not
            assignRolesPayload.push(assignRolePayload);
    }
    //filtering the assignRolePayload with existingAdminUserRoles  if any 
    if(existingAdminUserRoles && existingAdminUserRoles.length >0 && assignRolesPayload && assignRolesPayload.length >0)
    {
        finalAssignRolesPayload = assignRolesPayload.filter(value1 => !existingAdminUserRoles.some(value2 => value1.roleID === value2.roleID))
    }
    else if(assignRolesPayload && assignRolesPayload.length >0)
    {
        finalAssignRolesPayload = assignRolesPayload;
    }

    if(finalAssignRolesPayload && finalAssignRolesPayload.length > 0)
    {
        const userRole = await  findOrCreateAdminUserRole (finalAssignRolesPayload); 
        return userRole;
    }
    //raise an error and display a message on the UI as "You have successfully authenticated, but you don't have any roles assigned. Please contact a system administrator".
    else if(finalAssignRolesPayload && finalAssignRolesPayload.length <=0 && existingAdminUserRoles && existingAdminUserRoles.length <= 0)
    {
        return null;    
    }
    return existingAdminUserRoles;
    
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
                           const adminUser =  await findOrcreateAdminUser(cwid,smalUserEmail||userPrincipalName,firstName,lastName)
                           await sleep(100)
                          if(adminUser){
                                if(cwid && reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                                            && reciterConfig.asms.userTrackingAPIAuthorization)
                                    persistUserLogin(cwid);	
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
             
              if(apiResponse.databaseUser || apiResponse.personIdentifier) {
                token.email = apiResponse.email || ""
                if(apiResponse.databaseUser.personIdentifier)
                {
                    token.username = apiResponse.databaseUser.personIdentifier
                }
                else
                {
                    token.username = apiResponse.personIdentifier || apiResponse.email // shows email as signed user in absence of the personIdetifier. for ex: HSS WCM institution 
                }
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

