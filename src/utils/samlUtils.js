import { findOrCreateAdminUsers,findOrCreateAdminUserRole } from "../../controllers/db/admin.users.controller"
import {findOneAdminSettings} from '../../controllers/db/admin.settings.controller';
import { findOnePerson } from "../../controllers/db/person.controller";
import { findUserPermissions } from '../../controllers/db/userroles.controller';
import { allowedPermissions } from "./constants";
import { reciterConfig } from "../../config/local";
import jwt from 'jsonwebtoken';


const sleep = ms => new Promise(res => setTimeout(res, ms));
export const findOrcreateAdminUser = async(cwid,samlEmail,samlFirstName,samlLastName) => {
    console.log('=== SAML UTILS - findOrcreateAdminUser START ===');
    console.log('findOrcreateAdminUser - Input params:', {
        cwid,
        samlEmail,
        samlFirstName,
        samlLastName
    });
    
    const createdAdminUser = await findOrCreateAdminUsers(cwid,samlEmail,samlFirstName,samlLastName)
    console.log('findOrcreateAdminUser - createdAdminUser from DB:', JSON.stringify(createdAdminUser, null, 2));
    
    if(createdAdminUser)
    {
        console.log('findOrcreateAdminUser - Granting default roles to admin user');
        await grantDefaultRolesToAdminUser(createdAdminUser);
        await sleep(50);
        
        let userRoles ='';
         if(samlEmail) {
            console.log('findOrcreateAdminUser - Finding user permissions by email:', samlEmail);
            userRoles = await findUserPermissions(samlEmail, "email")
         } else if(cwid) {
            console.log('findOrcreateAdminUser - Finding user permissions by cwid:', cwid);
            userRoles = await findUserPermissions(cwid, "cwid")
         }
         
         console.log('findOrcreateAdminUser - userRoles found:', JSON.stringify(userRoles, null, 2));
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
        if(createdAdminUser)
             console.log('=== SAML UTILS - findOrcreateAdminUser END (SUCCESS) ===');
            return createdAdminUser;
        
    }
    
    console.log('findOrcreateAdminUser - No admin user created, returning:', createdAdminUser);
    console.log('=== SAML UTILS - findOrcreateAdminUser END (NO USER) ===');
    return createdAdminUser;
}
export const grantDefaultRolesToAdminUser = async(adminUser) => {
    console.log('=== SAML UTILS - grantDefaultRolesToAdminUser START ===');
    console.log('grantDefaultRolesToAdminUser - Input adminUser:', JSON.stringify(adminUser, null, 2));
    
    const adminSettings = await findOneAdminSettings('userRoles');
    console.log('grantDefaultRolesToAdminUser - adminSettings:', JSON.stringify(adminSettings, null, 2));
    
    let assignRolesPayload =[];
    if(adminSettings && adminSettings.viewAttributes && adminSettings.viewAttributes.length > 0)
    {
        console.log('grantDefaultRolesToAdminUser - Processing admin settings view attributes');
        let viewAttributes = JSON.parse(adminSettings.viewAttributes);
        console.log('grantDefaultRolesToAdminUser - Parsed viewAttributes:', JSON.stringify(viewAttributes, null, 2));
        
        viewAttributes && viewAttributes.forEach(attr => {
            console.log('grantDefaultRolesToAdminUser - Processing attribute:', JSON.stringify(attr, null, 2));
            attr.roles.map(role=>{
                console.log('grantDefaultRolesToAdminUser - Processing role:', JSON.stringify(role, null, 2));
                if(role.isChecked)
                {
                    let assignRolePayload = {
                            'userID': (JSON.parse(JSON.stringify(adminUser))).userID,
                            'roleID': role.roleId,
                            'createTimestamp': new Date() 
                            }
                            console.log('grantDefaultRolesToAdminUser - Adding role to payload:', JSON.stringify(assignRolePayload, null, 2));
                            //check for the role assigned to the user or not
                            assignRolesPayload.push(assignRolePayload);
                }
            })
        });

    }
    
    console.log('grantDefaultRolesToAdminUser - Initial assignRolesPayload:', JSON.stringify(assignRolesPayload, null, 2));
    
    let personAPIResponse;
    let existingAdminUserRoles =[];
    let finalAssignRolesPayload =[];
    if(adminUser && adminUser.personIdentifier)
    {
        console.log('grantDefaultRolesToAdminUser - Finding person by personIdentifier:', adminUser.personIdentifier);
        personAPIResponse = await findOnePerson("personIdentifier",adminUser.personIdentifier);
        console.log('grantDefaultRolesToAdminUser - personAPIResponse:', JSON.stringify(personAPIResponse, null, 2));
        
        existingAdminUserRoles = JSON.parse(await findUserPermissions(adminUser.personIdentifier, "cwid"))
        console.log('grantDefaultRolesToAdminUser - existingAdminUserRoles:', JSON.stringify(existingAdminUserRoles, null, 2));
    } 
    if(assignRolesPayload && assignRolesPayload.length >= 2)
    {
        console.log('grantDefaultRolesToAdminUser - assignRolesPayload has >= 2 roles, continuing');
        //nothing continue
    } 
    //Check for Curator_All role in assignRolesPaylaod if it is there then continue otherwise, 
    // check for an entry in person table with the personIdentifier, if exist then assign curator_self role 
    else if(personAPIResponse && personAPIResponse.personIdentifier 
        && ((assignRolesPayload && assignRolesPayload.length <=0) || (assignRolesPayload && assignRolesPayload.length >0 && !assignRolesPayload.some((role) => role.roleID == 2)))
        && ((existingAdminUserRoles && existingAdminUserRoles.length <=0) || (existingAdminUserRoles && existingAdminUserRoles.length > 0 && (!existingAdminUserRoles.some((role) => role.roleLabel == allowedPermissions.Curator_All)
                        && !existingAdminUserRoles.some((role) => role.roleLabel == allowedPermissions.Curator_Self )))))
    {
        console.log('grantDefaultRolesToAdminUser - Adding Curator_Self role (roleID: 4)');
        let assignRolePayload = {
            'userID': (JSON.parse(JSON.stringify(adminUser))).userID,
            'roleID': 4,
            'createTimestamp': new Date() 
            }
            console.log('grantDefaultRolesToAdminUser - Curator_Self role payload:', JSON.stringify(assignRolePayload, null, 2));
            //check for the role assigned to the user or not
            assignRolesPayload.push(assignRolePayload);
    }
    
    //filtering the assignRolePayload with existingAdminUserRoles  if any 
    if(existingAdminUserRoles && existingAdminUserRoles.length >0 && assignRolesPayload && assignRolesPayload.length >0)
    {
        console.log('grantDefaultRolesToAdminUser - Filtering roles against existing roles');
        finalAssignRolesPayload = assignRolesPayload.filter(value1 => !existingAdminUserRoles.some(value2 => value1.roleID === value2.roleID))
        console.log('grantDefaultRolesToAdminUser - Filtered finalAssignRolesPayload:', JSON.stringify(finalAssignRolesPayload, null, 2));
    }
    else if(assignRolesPayload && assignRolesPayload.length >0)
    {
        console.log('grantDefaultRolesToAdminUser - No existing roles, using all assigned roles');
        finalAssignRolesPayload = assignRolesPayload;
    }

    if(finalAssignRolesPayload && finalAssignRolesPayload.length > 0)
    {
        console.log('grantDefaultRolesToAdminUser - Creating user roles with payload:', JSON.stringify(finalAssignRolesPayload, null, 2));
        const userRole = await  findOrCreateAdminUserRole (finalAssignRolesPayload); 
        console.log('grantDefaultRolesToAdminUser - Created userRole:', JSON.stringify(userRole, null, 2));
        console.log('=== SAML UTILS - grantDefaultRolesToAdminUser END (ROLES CREATED) ===');
        return userRole;
    }
    //raise an error and display a message on the UI as "You have successfully authenticated, but you don't have any roles assigned. Please contact a system administrator".
    else if(finalAssignRolesPayload && finalAssignRolesPayload.length <=0 && existingAdminUserRoles && existingAdminUserRoles.length <= 0)
    {
        console.log('grantDefaultRolesToAdminUser - No roles to assign and no existing roles - returning null');
        console.log('=== SAML UTILS - grantDefaultRolesToAdminUser END (NO ROLES) ===');
        return null;    
    }
    
    console.log('grantDefaultRolesToAdminUser - Returning existing roles:', JSON.stringify(existingAdminUserRoles, null, 2));
    console.log('=== SAML UTILS - grantDefaultRolesToAdminUser END (EXISTING ROLES) ===');
    return existingAdminUserRoles;
    
}
export const persistUserLogin =async (cwid)=>{
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

