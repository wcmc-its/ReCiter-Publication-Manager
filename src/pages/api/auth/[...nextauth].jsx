import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
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

const findOrcreateAdminUser = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    if(createdAdminUser)
    {
        await grantDefaultRolesToAdminUser(createdAdminUser);
        await sleep(50);
        let userRoles ='';
         if(samlEmail)
            userRoles = await findUserPermissions(samlEmail, "email")
         else if(cwid)
            userRoles = await findUserPermissions(cwid, "cwid")
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
	debug: true,
      providers: [
    CredentialsProvider({
      id: 'direct_login',
      name: 'ReCiter Publication Manager App',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await authenticate(credentials);
        if (user?.statusCode !== 200) return null;

        const adminUser = await findOrCreateAdminUsers(
          credentials.username,
          credentials.email,
          credentials.firstName,
          credentials.lastName
        );

        const assignedRoles = await grantDefaultRolesToAdminUser(adminUser);
        const userRoles = await findUserPermissions(credentials.username, 'cwid');

        if (process.env.ASMS_API_BASE_URL)
          persistUserLogin(credentials.username);

        user.databaseUser = adminUser;
        user.userRoles = userRoles;
        return user;
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      console.log('signIn Callback:', user);
      return true;
    },

    async jwt({ token, user }) {
      console.log("jwt callback******************",token,user);  
      if (user) {
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser;
        token.userRoles = user.userRoles || [];
      }
      return token;
    },

    async session({ session, token }) {
      console.log("Calling session callback*************");  
      session.data = token;
      session.adminSettings = await fetchUpdatedAdminSettings();
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,
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

