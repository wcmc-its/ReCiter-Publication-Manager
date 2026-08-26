import {NextRequest, NextResponse } from 'next/server'
import { allowedPermissions } from './utils/constants'
import { getToken } from "next-auth/jwt";


//middleware should run for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*','/report','/search','/configuration','/notifications/:path*','/manageprofile/:path*','/authorships/:path*','/literature/:path*','/api/db/:path*'],
}

// Every /api/db/** route today only checks req.headers.authorization against
// NEXT_PUBLIC_RECITER_BACKEND_API_KEY -- a NEXT_PUBLIC_ env var Next.js inlines into the
// client bundle, so it is not a secret (and is "" in this deployment, meaning an absent
// header satisfies the check). This gate is the real authorization control for those routes:
// any /api/db request without a valid, signed next-auth session gets a 401 here before the
// handler runs. It intentionally does not add role checks -- handlers keep their own
// (e.g. authorships/action.ts's canCurate logic); this only proves "a logged-in user", same
// bar the page middleware already applies to /curate, /authorships, etc.
function unauthorizedJson() {
  return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}


export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next();
    const pathName = request.nextUrl.pathname;
    const isApiDbRoute = pathName.startsWith('/api/db');

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
            // A proxy grant (admin_users.proxy_person_ids, PM#849) allows curating the named
            // people regardless of role, so /curate/<granted-uid> must not be bounced by the
            // role-based rules below. canCurate on the write API stays the real enforcement;
            // this only stops the middleware from redirecting a page the API would allow.
            let proxyPersonIds = [];
            try {
              const parsed = JSON.parse((decodedTokenJson as any)?.proxyPersonIds || '[]');
              if (Array.isArray(parsed)) proxyPersonIds = parsed;
            } catch (e) { /* malformed token field -> no proxy allowance */ }
            const curateTarget = pathName.startsWith('/curate/') ? decodeURIComponent(pathName.split('/')[2] || '') : '';
            const isProxiedTarget = curateTarget.length > 0 && proxyPersonIds.includes(curateTarget);
            // A configured Curator_Scoped scope (admin_users.scope_person_types/scope_org_units)
            // is self-sufficient the same way a proxy grant is, above -- and got the same gap:
            // canCurate.ts and Search.js were both updated to let a non-empty scope through
            // regardless of role assignment (#909/#911), but this /curate redirect was never
            // touched, so a scoped curator with e.g. Reporter_All+Curator_Self (2 roles, no
            // Curator_Scoped role row -- exactly est4003's case) still got bounced back to their
            // own /curate/<uid> before ever reaching the target profile. Mirrors hasScope's exact
            // definition in authorization.controller.ts/Search.js. Unlike isProxiedTarget this is
            // NOT narrowed to the specific target's actual scope membership -- doing that here
            // would need a DB lookup of the target's personType/orgUnit, which this Edge
            // middleware doesn't have. canCurate on the write API is what actually enforces scope
            // membership per-target; this only stops the middleware from redirecting a page the
            // API would allow, exactly like the proxy-grant comment above already establishes.
            let scopeData: { personTypes?: string[] | null; orgUnits?: string[] | null } | null = null;
            try {
              scopeData = JSON.parse((decodedTokenJson as any)?.scopeData || 'null');
            } catch (e) { /* malformed token field -> no scope allowance */ }
            const hasScope = !!scopeData && (
              (Array.isArray(scopeData.personTypes) && scopeData.personTypes.length > 0) ||
              (Array.isArray(scopeData.orgUnits) && scopeData.orgUnits.length > 0)
            );
            if (pathName && pathName.startsWith('/curate')  &&  !isCuratorAll  && !isSuperUser && !isProxiedTarget && !hasScope)
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
            else if (pathName && pathName.startsWith('/authorships') && !isCuratorAll && !isSuperUser)
            {
              // Authorships review is restricted to Curator_All and Superuser.
              if (userRoles.length == 1 && isCuratorSelf && !isReporterAll)
                  return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
              return redirectToLandingPage(request,'/search');
            }
            // Same hasScope exemption as the /curate guard above (#914) -- a scoped curator with
            // e.g. Reporter_All+Curator_Self must not be bounced off /search either.
            else if (pathName && pathName.startsWith('/search') && !isReporterAll && !isSuperUser && !isCuratorAll && !hasScope)
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
            // Literature Search. The matcher alone only proves a session EXISTS — any
            // logged-in role would otherwise walk in, and this page fronts a route that
            // spends institutional money per call. Gate it to the same roles as the nav
            // item. (The API route additionally enforces the LITERATURE_SEARCH_CWIDS pilot
            // allowlist; that check, not this one, is the real control.)
            else if (pathName && pathName.startsWith('/literature') && !isSuperUser && !isCuratorAll && !isReporterAll)
            {
              if (isCuratorSelf) return redirectToLandingPage(request,'/curate/'+loggedInUserInfo);
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
      if (isApiDbRoute) return unauthorizedJson();
      redirectToLandingPage(request,'/error');
    }
  }
  else
  {
    if (isApiDbRoute) return unauthorizedJson();
    const loginUrl = new URL('/login', request.url)
    // redirect to the new URL
    return NextResponse.redirect(loginUrl)

  }
  return res;
  } catch (error) {
    console.error("[MIDDLEWARE]", error);
    if (request.nextUrl.pathname.startsWith('/api/db')) return unauthorizedJson();
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