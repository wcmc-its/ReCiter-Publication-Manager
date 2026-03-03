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
  console.log('Middleware called for path:', request.nextUrl.pathname);

  //const { pathname } = request.nextUrl;
  const pathName = request.nextUrl.pathname;
  console.log('Middleware - processing path:', pathName);
  // 1. SKIP LOGIC: Define paths that should never be blocked or checked for roles
  const isAuthRoute = pathName.startsWith('/api/auth') || 
                     pathName.startsWith('/api/saml') || 
                     pathName.startsWith('/auth/finalize');

  if (isAuthRoute) {
    console.log('Middleware - Auth route detected, skipping checks');
    return NextResponse.next();
  }
  console.log('Middleware - Getting token with JWT_TOKEN_SECRET');
  const token:any = await getToken({ req: request, secret: process.env.JWT_TOKEN_SECRET });
  console.log('Middleware - Token exists:', !!token);
  
  if (!token) {
    console.log('Middleware - No token found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log('Middleware - Token found, processing user roles');
  const userRoles = token.userRoles ? JSON.parse(token.userRoles) : [];
  console.log('Middleware - User roles length:', userRoles.length);

  const loggedInUserInfo = userRoles[0]?.personIdentifier;
  console.log('Middleware - Logged in user info:', loggedInUserInfo);

  const isCuratorSelf = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_Self);
  const isSuperUser = userRoles.some(role => role.roleLabel === allowedPermissions.Superuser);
  const isCuratorAll = userRoles.some(role => role.roleLabel === allowedPermissions.Curator_All);
  const isReporterAll = userRoles.some(role => role.roleLabel === allowedPermissions.Reporter_All);
  console.log('Middleware - User permissions:', { isCuratorSelf, isSuperUser, isCuratorAll, isReporterAll });

  const redirectToLandingPage = (path) => {
    console.log('Middleware - Redirecting to landing page:', path);
    const redirectedUrl = new URL(path, request.url);
    return NextResponse.redirect(redirectedUrl);
  };

  if (pathName.startsWith('/curate') && !isCuratorAll && !isSuperUser) {
    console.log('Middleware - Line 61: Checking curate permissions');
    if (userRoles.length === 1 && isReporterAll && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    } else if (userRoles.length === 1 && pathName !== `/curate/${loggedInUserInfo}` && isCuratorSelf) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }
  
  if (pathName.startsWith('/search') && !isReporterAll && !isSuperUser && !isCuratorAll) {
    console.log('Middleware - Line 69: Checking search permissions - redirecting to curate');
    if (userRoles.length === 1 && isCuratorSelf) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }
  
  if (pathName.startsWith('/report') && !isReporterAll && !isSuperUser) {
    console.log('Middleware - Line 75: Checking report permissions');
    if (userRoles.length === 1 && isCuratorSelf && !isCuratorAll) {
      return redirectToLandingPage(`/curate/${loggedInUserInfo}`);
    }
  }

  if (pathName.startsWith('/notifications')) {
    console.log('Middleware - Line 81: Checking notifications permissions');
    if (userRoles.length === 1 && isReporterAll) {
      return redirectToLandingPage('/search');
    }
  }
  
  if (pathName.startsWith('/manageprofile')) {
    console.log('Middleware - Line 87: Checking manageprofile permissions');
    if (userRoles.length === 1 && isReporterAll) {
      return redirectToLandingPage('/search');
    }
  }

  if (pathName.startsWith('/manageusers') && !isSuperUser) {
    console.log('Middleware - Line 93: Checking manageusers permissions');
    if (userRoles.length === 1 && (isReporterAll || isCuratorAll) && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    }
  }

  if (pathName.startsWith('/configuration') && !isSuperUser) {
    console.log('Middleware - Line 100: Checking configuration permissions');
    if (userRoles.length === 1 && (isReporterAll || isCuratorAll) && !isCuratorSelf) {
      return redirectToLandingPage('/search');
    }
  }

  console.log('Middleware - All checks passed, allowing access');
  return NextResponse.next();
}
