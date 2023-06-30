import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { authenticate } from "../../../../controllers/authentication.controller";
import { findAdminUser, findOrCreateAdminUsers,findOrCreateAdminUserRole } from '../../../../controllers/db/admin.users.controller';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import {fetchUpdatedAdminSettings, findOneAdminSettings} from '../../../../controllers/db/admin.settings.controller';
import { ContactSupportOutlined } from "@mui/icons-material";

const authHandler = async (req, res) => {
    await NextAuth(req, res, options);
};

const fetchAdminUserWithCWID = async (cwid) =>{

    const adminUser =  await findAdminUser(cwid,"cwid")
    if(adminUser)
    {
        console.log('adminUser*********************',adminUser)
        adminUser.databaseUser = adminUser
        adminUser.personIdentifier
        let [assignedRoles, userRoles] = await Promise.all([grantDefaultRolesToAdminUser(adminUser), findUserPermissions(cwid, "cwid")]);
       // const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
       // const userRoles = await findUserPermissions(cwid, "cwid");
       console.log('assigned roles and userRoles******************',assignedRoles,userRoles); 
       adminUser.userRoles = userRoles;
        if(adminUser)
            return adminUser;
    }
 
    return false;
}

const createAdminUserWithCWID = async(cwid,samlEmail,samlFirstName,samlLastName) => {

    console.log('All attributes**********************',cwid,samlEmail,samlFirstName,samlLastName);
    let adminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    console.log('adminUser after creating*************************',adminUser.toJSON());
    if(adminUser || (adminUser!=null && adminUser!='' && adminUser!=undefined))
    {
        Console.log('AdminUser inside condition****************************',adminUser);
        let [assignedRoles, userRoles] = await Promise.all([grantDefaultRolesToAdminUser(adminUser), findUserPermissions(cwid, "cwid")]);
       // const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
       // const userRoles = await findUserPermissions(cwid, "cwid");
       console.log('assigned roles and userRoles******************',assignedRoles,userRoles); 
       adminUser.userRoles = userRoles;
        if(adminUser)
            return adminUser;
    }
    console.log('returning admin user quickly withthout waiting for the roles to be assigned************');
    
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
                    let adminUser =null;
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
                           console.log('coming into samlEmail section*******************');
                            adminUser = await findAdminUser(smalUserEmail,"email")
                          if(adminUser){
                            adminUser.databaseUser = adminUser
                            adminUser.personIdentifier
                            let [assignedRoles, userRoles] = await Promise.all([grantDefaultRolesToAdminUser(adminUser), findUserPermissions(smalUserEmail,"email")]);
                           // const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
                          //  const userRoles = await findUserPermissions(smalUserEmail,"email");
                            adminUser.userRoles = userRoles;
                            if(adminUser)
                                return adminUser;
                         }
                         else if(cwid)
                         {
                            console.log('coming into cwid section*******************');
                             adminUser = await fetchAdminUserWithCWID(cwid);
                            if(adminUser)
                            {
                                return adminUser;
                            }
                            else
                            {
                                console.log('coming into createAdminUserWithCWID1*******************');
                                adminUser =  await createAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
                                if(adminUser)
                                    return adminUser;
                            }    
                         }
                         else
                         {
                            console.log('coming into createAdminUserWithCWID2*******************');
                            adminUser = await createAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
                            if(adminUser)
                                return adminUser;
                           
                         }
                    }
                    else if(cwid){
                             //find an adminUser and if exists then assign default role(REPORTER_ALL) and selected roles from configuration
                             console.log('coming into cwid section1*******************');
                             adminUser = fetchAdminUserWithCWID(cwid);
                            if(adminUser)
                            {
                                return adminUser;
                            }
                            else
                            {
                                console.log('coming into createAdminUserWithCWID3*******************'); 
                               adminUser = await createAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
                                if(adminUser)
                                    return adminUser;
                            }  
                        
                    }
                   else { //create an adminUser and assign default role(REPORTER_ALL) and selected roles from configuration 
                    console.log('coming into createAdminUserWithCWID3*******************');
                            adminUser = await createAdminUserWithCWID(cwid,smalUserEmail,firstName,lastName)
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
                console.log('roles in session**************************',session.userRoles);            
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
                    console.log('roles in token*****************',token.userRoles);
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
