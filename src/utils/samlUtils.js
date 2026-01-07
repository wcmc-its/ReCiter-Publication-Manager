import { findOrCreateAdminUsers,findOrCreateAdminUserRole } from "../../controllers/db/admin.users.controller"
import {findOneAdminSettings} from '../../controllers/db/admin.settings.controller';
import { findOnePerson } from "../../controllers/db/person.controller";
import { findUserPermissions } from '../../controllers/db/userroles.controller';
import { allowedPermissions } from "./constants";
import { reciterConfig } from "../../config/local";
import jwt from 'jsonwebtoken';


const sleep = ms => new Promise(res => setTimeout(res, ms));
export const findOrcreateAdminUser = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    console.log("createdAdminUser*********",createdAdminUser);
    if(createdAdminUser)
    {
        console.log("coming into createdAdminUser**************",createdAdminUser);
        await grantDefaultRolesToAdminUser(createdAdminUser);
        console.log("coming into createdAdminUser**************",createdAdminUser);
        await sleep(50);
        let userRoles ='';
         if(samlEmail)
            userRoles = await findUserPermissions(samlEmail, "email")
         else if(cwid)
            userRoles = await findUserPermissions(cwid, "cwid")
         console.log("userRoles**************",userRoles);
         createdAdminUser['userRoles'] = userRoles;
          let databaseUser = {
            "userID" : createdAdminUser.userID,
            "personIdentifier": createdAdminUser.personIdentifier,
            "nameFirst": createdAdminUser.nameFirst,
            "nameMiddle": createdAdminUser.nameMiddle,
            "nameLast":createdAdminUser.nameLast,
            "email" : createdAdminUser.email,
            "status":createdAdminUser.status,
            "createTimestamp":createdAdminUser.createTimestamp,
            "modifyTimestamp":createdAdminUser.modifyTimestamp
        }
        createdAdminUser['databaseUser'] = databaseUser
        createdAdminUser.personIdentifier 
        console.log("createdAdminUser*****************",createdAdminUser);
        if(createdAdminUser)
            return createdAdminUser;
        
    }
    return createdAdminUser;
}
export const grantDefaultRolesToAdminUser = async(adminUser) => {
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
export const persistUserLogin =async (cwid)=>{
    let payload = {
        "cwid":  cwid,
        "module":  "publication_manager"
    }
    let uri = `${reciterConfig.asms.userTrackingAPI}`
    console.log("PersisstUserLogin*******************",uri,cwid);
   
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
const JWT_SECRET = process.env.NEXTAUTH_SECRET;

export const createOneTimeToken = (profile) => {
  return jwt.sign(profile, JWT_SECRET, { expiresIn: '300s' });
};

// Verifies and decodes the token
export const verifyOneTimeToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    // Returns null if verification fails (e.g., expired, modified)
    return null;
  }
};

