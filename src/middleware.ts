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
  const token:any = await getToken({ req: request, secret: process.env.JWT_TOKEN_SECRET });
  const pathName = request.nextUrl.pathname;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userRoles = token.userRoles ? JSON.parse(token.userRoles) : [];

  const loggedInUserInfo = userRoles[0]?.personIdentifier;
  console.log("loggedInUserInfo________", loggedInUserInfo)

  const isCuratorSelf = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_Self);
  const isSuperUser = userRoles.some(role => role.roleLabel === allowedPermissions.Superuser);
  const isCuratorAll = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_All);
  const isReporterAll = userRoles.some(role => role.roleLabel === allowedPermissions.Reporter_All);

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
