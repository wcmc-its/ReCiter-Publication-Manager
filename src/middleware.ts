import { NextRequest, NextResponse } from 'next/server'
import { getCapabilities, getLandingPage } from './utils/constants'
import * as jose from "jose";

// Middleware runs for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search', '/configuration', '/notifications/:path*', '/manageprofile/:path*'],
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

    // Parse scopeData from JWT (for Curator_Scoped users)
    let scopeData = null;
    try {
      if (decodedTokenJson && decodedTokenJson.scopeData) {
        const scopeString = typeof decodedTokenJson.scopeData === 'string'
          ? decodedTokenJson.scopeData
          : JSON.stringify(decodedTokenJson.scopeData);
        scopeData = JSON.parse(scopeString);
      }
    } catch (e) {
      console.log('[AUTH] WARN: Failed to parse scopeData from JWT');
    }

    // Derive capabilities from roles (AUTH-02: capability-based checks)
    const caps = getCapabilities(userRoles);
    const personIdentifier = caps.canCurate.personIdentifier;

    // Attach scopeData to capabilities if present
    if (scopeData) {
      caps.canCurate.scopeData = scopeData;
    }

    // Route-level access checks
    if (pathName.startsWith('/curate')) {
      if (caps.canCurate.all) {
        // Curator_All or Superuser -- allow access to any curate page
        return res;
      }
      if (caps.canCurate.scoped) {
        // Scoped curators can access /curate/* routes -- person-level check happens in API/component
        console.log('[AUTH] ALLOW: Curator_Scoped', personIdentifier, 'accessing', pathName, '(person-level scope check deferred to API)');
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

    if (pathName.startsWith('/manageprofile')) {
      if (caps.canCurate.all || caps.canCurate.scoped) {
        // Full curators and scoped curators can access -- person-level check in API
        return res;
      }
      if (caps.canCurate.self) {
        // Self curators can only manage their own profile
        const expectedPath = '/manageprofile/' + personIdentifier;
        if (pathName === expectedPath) {
          return res;
        }
        console.log('[AUTH] REDIRECT: Curator_Self', personIdentifier, 'tried', pathName, '-> redirecting to', expectedPath);
        return redirectToLandingPage(request, expectedPath);
      }
      const landing = getLandingPage(caps);
      console.log('[AUTH] REDIRECT: No curate capability for manageprofile, redirecting to', landing);
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
