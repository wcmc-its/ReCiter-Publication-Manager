import { signIn,getSession } from "next-auth/client"
import { allowedPermissions } from "../utils/constants";
import Router from "next/router"
export const getSigninUrl = () => {

    const session =  getSession();
    console.log("session parameters******************************",session);
    /*let userPermissions = JSON.parse(session.data.userRoles);
    let userName = session.data.username;
    let personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
    console.log("userPermission***********************",userPermissions);*/
    console.log("allowedPermissions***********************",allowedPermissions);
   /* getSession().then((session) => 
    {
        if (session) 
        {
            let userPermissions = JSON.parse(session.data.userRoles);
            let userName = session.data.username;
            let personIdentifier = userPermissions && userPermissions.length > 0 ? userPermissions[0].personIdentifier : ""
            console.log("userPermission***********************",userPermissions);
            if(process.env.LOGIN_PROVIDER !== "SAML")
                return `${window.location.origin}/login`;
            else if((userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) && userName)  
               return `${window.location.origin}/api/saml/assert?callbackUrl = /curate/${personIdentifier}`;
            else
            {
                return `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
            }
        
        } 
    });*/
    return process.env.LOGIN_PROVIDER !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};