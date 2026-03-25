import {NextRequest, NextResponse } from 'next/server'
import { allowedPermissions } from './utils/constants'
import { getToken } from "next-auth/jwt";


//middleware should run for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*','/report','/search','/configuration','/notifications/:path*','/manageprofile/:path*'],
}
					 

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next();
    const pathName = request.nextUrl.pathname;

    if (pathName && pathName.includes('.git')) { //redirect to forbidden if any request contains .git in the path.
      return new NextResponse(null, { status: 403 })
    }
   
    // 1. SKIP LOGIC: Define paths that should never be blocked or checked for roles
  const isAuthRoute = pathName.startsWith('/api/auth') ||
                     pathName.startsWith('/api/saml') || 
                     pathName.startsWith('/auth/finalize');
  if (isAuthRoute) {
    return NextResponse.next();
  }
   if(request && request.cookies && (request.cookies.has('next-auth.session-token') || request.cookies.has('__Secure-next-auth.session-token')))
    {
      const loginUrl = new URL('/login', request.url)
      let decodedTokenJson = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      let allUserRoles ='';
      if(decodedTokenJson )
          allUserRoles = JSON.stringify(decodedTokenJson);
      if (allUserRoles && allUserRoles.length > 0) {
          let userRoles = allUserRoles && allUserRoles?.length > 0 && JSON.parse(allUserRoles)
          userRoles = JSON.parse(userRoles.userRoles);
          if (userRoles && userRoles.length > 0) {
            let loggedInUserInfo = userRoles[0].personIdentifier;
            let isCuratorSelf = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_Self)
            let isSuperUser = userRoles.some((role) => role.roleLabel === allowedPermissions.Superuser)
            let isCuratorAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Curator_All)
            let isReporterAll = userRoles.some((role) => role.roleLabel === allowedPermissions.Reporter_All)
            if (pathName && pathName.startsWith('/curate')  &&  !isCuratorAll  && !isSuperUser)
            {
                if (userRoles.length == 1 && isReporterAll  && !isCuratorSelf) {
                  return redirectToLandingPage(request,'/search');
                }
                else if (userRoles.length == 1  && pathName !==  '/curate/'+loggedInUserInfo && isCuratorSelf && !isReporterAll ) {
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                }
                else if (userRoles.length == 2 && pathName !==  '/curate/'+loggedInUserInfo && isCuratorSelf && isReporterAll ) {
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
              if (userRoles.length == 1 && isReporterAll )
                return redirectToLandingPage(request,'/search');
              else if (userRoles.length == 1  && (pathName !==  '/notifications/'+loggedInUserInfo && isCuratorSelf )) {
                return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              }
              else if (userRoles.length == 2 && (pathName !==  '/notifications/'+loggedInUserInfo || pathName.endsWith('notifications')) && isCuratorSelf && isReporterAll ) {
                return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              }

            }else if (pathName && pathName.startsWith('/manageprofile')){

              if (userRoles.length == 1 && isReporterAll )
                  return redirectToLandingPage(request,'/search');
                else if (userRoles.length == 1  && (pathName !==  '/manageprofile/'+loggedInUserInfo && isCuratorSelf )) {
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                }
                else if (userRoles.length == 2 && (pathName !==  '/manageprofile/'+loggedInUserInfo || pathName.endsWith('notifications')) && isCuratorSelf && isReporterAll ) {
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
                }

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
  else
  {
    const loginUrl = new URL('/login', request.url)
    // redirect to the new URL
    return NextResponse.redirect(loginUrl)
	 
  }
  return res;
  } catch (error) {
    console.error("[MIDDLEWARE]", error);
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = '/error';
    errorUrl.searchParams.set('code', 'AUTH_MIDDLEWARE');
    return NextResponse.redirect(errorUrl);
  }
}

function redirectToLandingPage(request:NextRequest,pathName:any){
  const redirectedUrl = request.nextUrl.clone()
  redirectedUrl.pathname =pathName;
  return NextResponse.redirect(redirectedUrl);
}