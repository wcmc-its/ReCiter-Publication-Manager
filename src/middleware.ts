import { NextRequest, NextResponse } from 'next/server'
import { getCapabilities, getLandingPage } from './utils/constants'
import * as jose from "jose";

// Middleware runs for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search', '/configuration', '/notifications/:path*'],
}

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const pathName = request.nextUrl.pathname;

  if (request && request.cookies && request.cookies.has('next-auth.session-token')) {
    let decodedTokenJson = jose.decodeJwt(request.cookies.get('next-auth.session-token'));
    let userRoles = [];

    try {
      if (decodedTokenJson && decodedTokenJson.userRoles) {
        const rolesString = typeof decodedTokenJson.userRoles === 'string'
          ? decodedTokenJson.userRoles
          : JSON.stringify(decodedTokenJson.userRoles);
        userRoles = JSON.parse(rolesString);
      }
    } catch (e) {
      console.log('[AUTH] ERROR: Failed to parse userRoles from JWT');
      return redirectToLandingPage(request, '/error');
    }

    // Derive capabilities from roles (AUTH-02: capability-based checks)
    const caps = getCapabilities(userRoles);
    const personIdentifier = caps.canCurate.personIdentifier;

    // Route-level access checks
    if (pathName.startsWith('/curate')) {
      if (caps.canCurate.all) {
        // Curator_All or Superuser -- allow access to any curate page
        return res;
      }
      if (caps.canCurate.self) {
        // Curator_Self -- only allow own curate page
        const expectedPath = '/curate/' + personIdentifier;
        if (pathName === expectedPath) {
          return res;
        }
        // Trying to curate someone else or bare /curate -- redirect to own page
        console.log('[AUTH] REDIRECT: Curator_Self', personIdentifier, 'tried', pathName, '-> redirecting to', expectedPath);
        return redirectToLandingPage(request, expectedPath);
      }
      // No curate capability -- redirect to landing page
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No curate capability, redirecting from', pathName, 'to', landing);
      return redirectToLandingPage(request, landing);
    }

    if (pathName.startsWith('/search')) {
      if (caps.canSearch) {
        return res;
      }
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No search capability, redirecting to', landing);
      return redirectToLandingPage(request, landing);
    }

    if (pathName.startsWith('/report')) {
      if (caps.canReport) {
        return res;
      }
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No report capability, redirecting to', landing);
      return redirectToLandingPage(request, landing);
    }

    if (pathName.startsWith('/manageusers')) {
      if (caps.canManageUsers) {
        return res;
      }
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No manageUsers capability, redirecting to', landing);
      return redirectToLandingPage(request, landing);
    }

    if (pathName.startsWith('/configuration')) {
      if (caps.canConfigure) {
        return res;
      }
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No configure capability, redirecting to', landing);
      return redirectToLandingPage(request, landing);
    }

    if (pathName.startsWith('/notifications')) {
      // Notifications: allow for all authenticated users (placeholder -- CONTEXT.md says
      // "correct role restrictions will be implemented once notification functionality is ready")
      return res;
    }

    return res;
  }
  // No session token -- let Next.js handle redirect to login
  return res;
}

function redirectToLandingPage(request: NextRequest, pathName: string) {
  const redirectedUrl = request.nextUrl.clone();
  redirectedUrl.pathname = pathName;
  return NextResponse.redirect(redirectedUrl);
}
