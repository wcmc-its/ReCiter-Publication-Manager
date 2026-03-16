
import { toast } from "react-toastify";

export const allowedPermissions = Object.freeze({
	Superuser: "Superuser",
	Curator_All: "Curator_All",
	Reporter_All: "Reporter_All",
	Curator_Self: "Curator_Self"
})

export const toastMessage = (type, message) => {
	if (type === "error") {
		return toast.error(message, {
			position: "top-right",
			autoClose: 2000,
			theme: 'colored'
		})
	}
	else if (type === "success") {
		return toast.success(message, {
			position: "top-right",
			autoClose: 2000,
			theme: 'colored'
		})
	}
	else {

	}
}

export const numberFormation = (number)=> {
	let formatedNumber  = number.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
	return formatedNumber
}

export const setReportFilterLabels = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.labelUserView || ""
}

export const setReportFilterDisplayRank = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.displayRank || ""
}

export const setHelptextInfo = (allFilters, filterLabel) => {
	let filteredLabel = allFilters?.length > 0 && allFilters?.find((allLabels) => allLabels.labelUserKey === filterLabel)
	return filteredLabel?.helpTextUserView || ""
}

export const dropdownItemsSuper = [
	{ title: 'Create Reports', to: ''},
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  export const dropdownItemsReport= [
	// { title: 'Perform Analysis', to: '/perform-analysis' },
  ]
  
export const reciterConstants = {

	nameCWIDSpaceCountThreshold : 3

}

/**
 * Capability model -- maps roles to route-level capabilities.
 * Capabilities are derived on every request from roles in JWT.
 * Single source of truth for Edge middleware, Node API routes, and React components.
 */
export const ROLE_CAPABILITIES = Object.freeze({
  [allowedPermissions.Superuser]: {
    canCurate: { all: true },
    canReport: true,
    canSearch: true,
    canManageUsers: true,
    canConfigure: true,
  },
  [allowedPermissions.Curator_All]: {
    canCurate: { all: true },
    canReport: false,
    canSearch: true,
    canManageUsers: false,
    canConfigure: false,
  },
  [allowedPermissions.Curator_Self]: {
    canCurate: { self: true },
    canReport: false,
    canSearch: false,
    canManageUsers: false,
    canConfigure: false,
  },
  [allowedPermissions.Reporter_All]: {
    canCurate: false,
    canReport: true,
    canSearch: true,
    canManageUsers: false,
    canConfigure: false,
  },
})

/**
 * Derive capabilities from a user's roles array.
 * Isomorphic -- works in Edge middleware, Node.js API routes, and React components.
 *
 * @param {Array} roles - Array of role objects with { roleLabel, personIdentifier }
 * @returns {Object} capabilities - { canCurate, canReport, canSearch, canManageUsers, canConfigure, personIdentifier }
 *
 * canCurate is an object: { all: boolean, self: boolean, personIdentifier: string|null }
 * All other capabilities are booleans.
 *
 * Baseline: any authenticated user gets canReport + canSearch even with no roles.
 * Unknown/future roles: no capabilities granted beyond baseline.
 */
export function getCapabilities(roles) {
  // Baseline: every authenticated user gets canReport + canSearch
  const caps = {
    canCurate: { all: false, self: false, personIdentifier: null },
    canReport: true,
    canSearch: true,
    canManageUsers: false,
    canConfigure: false,
  }

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return caps
  }

  // Extract personIdentifier from first role (all roles for a user share the same personIdentifier)
  const personIdentifier = roles[0]?.personIdentifier || null
  caps.canCurate.personIdentifier = personIdentifier

  for (const role of roles) {
    const roleCaps = ROLE_CAPABILITIES[role.roleLabel]
    if (!roleCaps) continue // Unknown role -- no capabilities beyond baseline

    // Merge capabilities (OR logic -- any role granting a capability enables it)
    if (roleCaps.canCurate) {
      if (roleCaps.canCurate.all) caps.canCurate.all = true
      if (roleCaps.canCurate.self) caps.canCurate.self = true
    }
    if (roleCaps.canReport) caps.canReport = true
    if (roleCaps.canSearch) caps.canSearch = true
    if (roleCaps.canManageUsers) caps.canManageUsers = true
    if (roleCaps.canConfigure) caps.canConfigure = true
  }

  return caps
}

/**
 * Determine the correct landing page for a user based on their capabilities.
 * @param {Object} caps - Output of getCapabilities()
 * @returns {string} path - The landing page path
 */
export function getLandingPage(caps) {
  // Self-only curators (not all curators) land on their own curate page
  if (caps.canCurate.self && !caps.canCurate.all) {
    return '/curate/' + caps.canCurate.personIdentifier
  }
  // Broader roles land on search
  if (caps.canCurate.all || caps.canReport || caps.canSearch) {
    return '/search'
  }
  // Fallback -- should not happen with baseline, but safety net
  return '/noaccess'
}
