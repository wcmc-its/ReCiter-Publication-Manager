import { NextRequest, NextResponse } from 'next/server'
import jwt_decode from "jwt-decode"
import { getPermissionsFromRaw, hasPermission, getLandingPageFromPermissions } from './utils/permissionUtils'

// MW-02: Route-to-permission lookup map
// Every route in config.matcher must have a corresponding entry here.
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/manageusers': 'canManageUsers',
  '/configuration': 'canConfigure',
  '/curate': 'canCurate',
  '/report': 'canReport',
  '/search': 'canSearch',
  '/notifications': 'canManageNotifications',
  '/manageprofile': 'canManageProfile',
}

// Middleware matcher — UNCHANGED from original
export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search', '/configuration', '/notifications/:path*', '/manageprofile/:path*'],
}

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname

  // Block .git access (existing behavior)
  if (pathName && pathName.includes('.git')) {
    return new NextResponse(null, { status: 403 })
  }

  // Check for session cookie (existing behavior)
  if (request && request.cookies && (request.cookies.has('next-auth.session-token') || request.cookies.has('__Secure-next-auth.session-token'))) {
    const decoded: any = jwt_decode(
      request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token')
    )

    // Parse roles from JWT (still needed for self-only detection and error check)
    let userRoles: any[] = []
    try {
      const tokenStr = JSON.stringify(decoded)
      const tokenObj = JSON.parse(tokenStr)
      userRoles = tokenObj.userRoles ? JSON.parse(tokenObj.userRoles) : []
    } catch {
      userRoles = []
    }

    if (!userRoles || userRoles.length === 0) {
      // No roles found — redirect to /error (existing behavior)
      return redirectToLandingPage(request, '/error')
    }

    // MW-01: Parse permissions from JWT
    let permissions = getPermissionsFromRaw(decoded.permissions)

    // MW-03: Baseline fallback — every authenticated user can search and report
    if (permissions.length === 0) {
      permissions = ['canSearch', 'canReport']
    }

    const personIdentifier = userRoles[0]?.personIdentifier || null

    // MW-04: Self-only curator detection (uses ROLES, not permissions)
    // A Curator_Self who does not also have a broader curate role is restricted
    // to their own curate page. This MUST use role labels because both
    // Curator_Self and Curator_Scoped resolve to canCurate.
    const isSelfOnly = userRoles.some((r: any) => r.roleLabel === 'Curator_Self')
      && !userRoles.some((r: any) => ['Superuser', 'Curator_All', 'Curator_Scoped', 'Curator_Department', 'Curator_Department_Delegate'].includes(r.roleLabel))

    // MW-02 + MW-01: Check route permission
    const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
      route => pathName.startsWith(route)
    )

    if (matchedRoute) {
      const requiredPermission = ROUTE_PERMISSIONS[matchedRoute]

      if (!hasPermission(permissions, requiredPermission)) {
        // User lacks permission for this route — redirect to their landing page (MW-05)
        const landing = getLandingPageFromPermissions(permissions, userRoles)
        return redirectToLandingPage(request, landing)
      }
    }

    // MW-04: Self-only curate page enforcement
    // After confirming canCurate, check if self-only curator is on someone else's page
    if (isSelfOnly && pathName.startsWith('/curate') && personIdentifier) {
      if (pathName !== '/curate/' + personIdentifier) {
        return redirectToLandingPage(request, '/curate/' + personIdentifier)
      }
    }

    // MW-04: Self-only redirect for notification/manageprofile routes
    if (isSelfOnly && personIdentifier) {
      if (pathName.startsWith('/notifications') && pathName !== '/notifications/' + personIdentifier) {
        return redirectToLandingPage(request, '/curate/' + personIdentifier)
      }
      if (pathName.startsWith('/manageprofile') && pathName !== '/manageprofile/' + personIdentifier) {
        return redirectToLandingPage(request, '/curate/' + personIdentifier)
      }
    }

    return NextResponse.next()
  } else {
    // No session cookie — redirect to login (existing behavior)
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

function redirectToLandingPage(request: NextRequest, pathName: any) {
  const redirectedUrl = request.nextUrl.clone()
  redirectedUrl.pathname = pathName
  return NextResponse.redirect(redirectedUrl)
}
