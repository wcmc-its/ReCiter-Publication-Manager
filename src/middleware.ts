import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { allowedPermissions } from './utils/constants';

export const config = {
  matcher: [
    '/manageusers/:path*',
    '/curate/:path*',
    '/report',
    '/search',
    '/configuration',
    '/notifications/:path*',
    '/manageprofile/:path*'
    
  ]
};

export async function middleware(request) {

  //const { pathname } = request.nextUrl;
  const pathName = request.nextUrl.pathname;
  // 1. SKIP LOGIC: Define paths that should never be blocked or checked for roles
  const isAuthRoute = pathName.startsWith('/api/auth') || 
                     pathName.startsWith('/api/saml') || 
                     pathName.startsWith('/auth/finalize');
                     
  if (isAuthRoute) {
    return NextResponse.next();
  }
  console.log("in middleware****************");
  const token:any = await getToken({ req: request, secret: process.env.JWT_TOKEN_SECRET });
  
 console.log("pathName and token****************",pathName,token);
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userRoles = token.userRoles ? JSON.parse(token.userRoles) : [];
  console.log("userRoles*********************",userRoles);

  const loggedInUserInfo = userRoles[0]?.personIdentifier;
  console.log("loggedInUserInfo________", loggedInUserInfo)

  const isCuratorSelf = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_Self);
  console.log("isCuratorSelf*****************",isCuratorSelf);
  const isSuperUser = userRoles.some(role => role.roleLabel === allowedPermissions.Superuser);
  console.log("isSuperUser*****************",isSuperUser);
  const isCuratorAll = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_All);
  console.log("isCuratorAll*****************",isCuratorAll);
  const isReporterAll = userRoles.some(role => role.roleLabel === allowedPermissions.Reporter_All);
  console.log("isReporterAll*****************",isReporterAll);

  const redirectToLandingPage = (path) => {
    const redirectedUrl = new URL(path, request.url);
    return NextResponse.redirect(redirectedUrl);
  };

  if (pathName.startsWith('/curate') && !isCuratorAll && !isSuperUser) {
    if (userRoles.length === 1 && isReporterAll && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    } else if (userRoles.length === 1 && pathName !== `/curate/${loggedInUserInfo}` && isCuratorSelf) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }
  
  if (pathName.startsWith('/search') && !isReporterAll && !isSuperUser && !isCuratorAll) {
    if (userRoles.length === 1 && isCuratorSelf) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }
  
  if (pathName.startsWith('/report') && !isReporterAll && !isSuperUser) {
    if (userRoles.length === 1 && isCuratorSelf && !isCuratorAll) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }

  if (pathName.startsWith('/notifications')) {
    if (userRoles.length === 1 && isReporterAll) {
      return redirectToLandingPage('/search');
    }
  }
  
  if (pathName.startsWith('/manageprofile')) {
    if (userRoles.length === 1 && isReporterAll) {
      return redirectToLandingPage('/search');
    }
  }

  if (pathName.startsWith('/manageusers') && !isSuperUser) {
    if (userRoles.length === 1 && (isReporterAll || isCuratorAll) && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    }
  }

  if (pathName.startsWith('/configuration') && !isSuperUser) {
    if (userRoles.length === 1 && (isReporterAll || isCuratorAll) && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    }
  }

  return NextResponse.next();
}
