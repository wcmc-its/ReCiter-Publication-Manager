import { NextRequest, NextResponse } from 'next/server';
import { getCapabilities, getLandingPage } from './utils/constants';
import { getToken } from "next-auth/jwt";

// Middleware should run for these router paths
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search',
            '/configuration', '/notifications/:path*', '/manageprofile/:path*'],
}

export async function middleware(request: NextRequest) {
  try {
    const pathName = request.nextUrl.pathname;

    // Block .git access
    if (pathName?.includes('.git')) {
      return new NextResponse(null, { status: 403 });
    }

    // Skip auth routes
    const isAuthRoute = pathName.startsWith('/api/auth') ||
                       pathName.startsWith('/api/saml') ||
                       pathName.startsWith('/auth/finalize');
    if (isAuthRoute) return NextResponse.next();

    // D-09: Use getToken (verified) instead of jose.decodeJwt (unverified)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Parse roles from JWT
    let userRoles = [];
    try {
      if (token.userRoles) {
        userRoles = JSON.parse(token.userRoles as string);
      }
    } catch (e) {
      console.error('[MIDDLEWARE] Failed to parse userRoles:', e);
      return redirectToLandingPage(request, '/error');
    }

    // No roles at all -> error
    if (!userRoles || userRoles.length === 0) {
      return redirectToLandingPage(request, '/error');
    }

    // Derive capabilities (D-08: clean capability model, not role-count checks)
    const caps = getCapabilities(userRoles);
    const personIdentifier = caps.canCurate.personIdentifier;

    // --- Route-level capability checks (D-08: deterministic, no nested if/else) ---

    if (pathName.startsWith('/curate')) {
      if (caps.canCurate.all) return NextResponse.next();
      if (caps.canCurate.scoped) return NextResponse.next(); // D-10: person-level check deferred to API (Phase 10)
      if (caps.canCurate.self) {
        const expectedPath = '/curate/' + personIdentifier;
        if (pathName === expectedPath) return NextResponse.next();
        return redirectToLandingPage(request, expectedPath);
      }
      // No curate capability -> redirect to their landing page
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/search')) {
      if (caps.canSearch) return NextResponse.next();
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/report')) {
      if (caps.canReport) return NextResponse.next();
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/manageusers')) {
      if (caps.canManageUsers) return NextResponse.next();
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/configuration')) {
      if (caps.canConfigure) return NextResponse.next();
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/notifications')) {
      // Notifications accessible to all authenticated users with any curate or report capability
      if (caps.canCurate.all || caps.canCurate.scoped || caps.canCurate.self || caps.canReport) {
        // Self-only curators: enforce /notifications/:personIdentifier
        if (caps.canCurate.self && !caps.canCurate.all && !caps.canCurate.scoped && !caps.canReport) {
          const expectedPath = '/notifications/' + personIdentifier;
          if (pathName === expectedPath) return NextResponse.next();
          return redirectToLandingPage(request, expectedPath);
        }
        return NextResponse.next();
      }
      return redirectToLandingPage(request, getLandingPage(caps));
    }

    if (pathName.startsWith('/manageprofile')) {
      // Manage profile accessible to all authenticated users
      if (caps.canCurate.self && !caps.canCurate.all && !caps.canCurate.scoped && !caps.canReport) {
        const expectedPath = '/manageprofile/' + personIdentifier;
        if (pathName === expectedPath) return NextResponse.next();
        return redirectToLandingPage(request, expectedPath);
      }
      return NextResponse.next();
    }

    // Default: allow (unmatched routes handled by Next.js 404)
    return NextResponse.next();

  } catch (error) {
    console.error("[MIDDLEWARE]", error);
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = '/error';
    return NextResponse.redirect(errorUrl);
  }
}

function redirectToLandingPage(request: NextRequest, pathName: string) {
  const redirectedUrl = request.nextUrl.clone();
  redirectedUrl.pathname = pathName;
  return NextResponse.redirect(redirectedUrl);
}
