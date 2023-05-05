import {NextRequest, NextResponse } from 'next/server'
import { allowedPermissions } from './utils/constants'
import * as jose from "jose";


//middleware should run for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*','/report','/search','/configuration','/notifications/:path*'],
}

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const pathName = request.nextUrl.pathname;
  
    if(request && request.cookies && request.cookies.has('next-auth.session-token')) 
    {
      let decodedTokenJson = jose.decodeJwt(request.cookies.get('next-auth.session-token'));
      let allUserRoles ='';
      if(decodedTokenJson )//&& decodedTokenJson.userRoles)
          allUserRoles = JSON.stringify(decodedTokenJson);//.userRoles;
      if (allUserRoles && allUserRoles.length > 0) {
          let userRoles = allUserRoles && allUserRoles?.length > 0 && JSON.parse(allUserRoles)
          userRoles = JSON.parse(userRoles.userRoles);
          if (userRoles && userRoles.length > 0) {
            
            let loggedInUserInfo = userRoles[0].personIdentifier; //should be reverted after testing
            let isCuratorSelf = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_Self)
            let isSuperUser = userRoles.some((role) => role.roleLabel === allowedPermissions.Superuser)
            let isCuratorAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_All)
            let isReporterAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Reporter_All)

           
            if (pathName && pathName.startsWith('/curate')  &&  !isCuratorAll  && !isSuperUser) 
            {
                if (userRoles.length == 1 && isReporterAll  && !isCuratorSelf) {
                  return redirectToLandingPage(request,'/search');
                }
                else if (userRoles.length == 1  && (pathName !==  '/curate/'+loggedInUserInfo || pathName.endsWith('curate'))&& isCuratorSelf && !isReporterAll ) {
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                }
                else if (userRoles.length == 2 && (pathName !==  '/curate/'+loggedInUserInfo || pathName.endsWith('curate')) && isCuratorSelf && isReporterAll ) {
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                }
               
            }
            else if (pathName && pathName.startsWith('/search') && !isReporterAll && !isSuperUser && !isCuratorAll) 
            {
              if (userRoles.length == 1 && isCuratorSelf )  
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
            }
            else if (pathName && pathName.startsWith('/report')  && !isReporterAll && !isSuperUser) 
            {
                if (userRoles.length == 1 && isCuratorSelf  && !isCuratorAll)  
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                else if (userRoles.length == 1 && !isCuratorSelf  && isCuratorAll)  
                      return redirectToLandingPage(request,'/search');
                else if (userRoles.length == 2 && isCuratorSelf  && isCuratorAll) 
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
            }
            else if (pathName && pathName.startsWith('/notifications')) 
            {
              //correct role restrictions will be implemented once notification functionality is ready. It is just a placeholder for now.
              
              if(isCuratorSelf)
                return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              else if (isReporterAll || isCuratorAll || isSuperUser)  
                return redirectToLandingPage(request,'/search');     
            }
            else if (pathName && pathName.startsWith('/manageusers')  && !isSuperUser)  
            {
                if (userRoles.length == 1 && (isReporterAll || isCuratorAll) &&  !isCuratorSelf) 
                       return redirectToLandingPage(request,'/search');
                else if (userRoles.length == 1 &&  isCuratorSelf && !isReporterAll && !isCuratorAll) 
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                else if (userRoles.length == 2 && isCuratorSelf && isReporterAll && !isCuratorAll) 
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                else if (userRoles.length == 2 && isCuratorSelf && !isReporterAll && isCuratorAll) 
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                else if (userRoles.length == 2 && !isCuratorSelf && isReporterAll && isCuratorAll) 
                      return redirectToLandingPage(request,'/search');
                else if (userRoles.length == 3 && isCuratorSelf && isReporterAll && isCuratorAll) 
                      return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);                  
                     
            }
            else if (pathName && pathName.startsWith('/configuration')  && !isSuperUser)
            {
              if (userRoles.length == 1 && (isReporterAll || isCuratorAll) &&  !isCuratorSelf) 
                    return redirectToLandingPage(request,'/search');
              else if (userRoles.length == 1 &&  isCuratorSelf && !isReporterAll  && !isCuratorAll) 
                   return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              else if (userRoles.length == 2 && isCuratorSelf && isReporterAll  && !isCuratorAll)  
                   return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              else if (userRoles.length == 2 && !isCuratorSelf && isReporterAll && isCuratorAll) 
                  return redirectToLandingPage(request,'/search');
              else if (userRoles.length == 2 && isCuratorSelf && !isReporterAll && isCuratorAll) 
              return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);    
              else if (userRoles.length == 3 && isCuratorSelf && isReporterAll && isCuratorAll)  
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
            }       
    }
    }
    else // redirects to error page when no roles found in access token
    {
      redirectToLandingPage(request,'/error');
    }
  }
  return res;
}
function decodeJwt(token:any) {
  //let base64Payload = token.split(".")[1];
  //let payloadBuffer = Buffer.from(base64Payload, "base64");
  //return JSON.parse(payloadBuffer.toString());
  //return jwt_decode(token);
}
function redirectToLandingPage(request:NextRequest,pathName:any){
  const redirectedUrl = request.nextUrl.clone()
  redirectedUrl.pathname =pathName;
  return NextResponse.redirect(redirectedUrl);
}
