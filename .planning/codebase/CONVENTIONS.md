# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `Publication.tsx`, `SideNavbar.tsx`)
- Utility functions: camelCase with `.js` extension (e.g., `fetchWithTimeout.js`, `filterPublications.js`)
- Controllers: `{domain}.controller.ts` (e.g., `authentication.controller.ts`, `featuregenerator.controller.ts`)
- API routes: kebab-case with folder structure matching endpoints (e.g., `/api/reciter/search/pubmed.ts`)
- Redux files: named by function (e.g., `actions.js`, `reducers.js`, `methods.js`)
- CSS modules: `{ComponentName}.module.css` (e.g., `Publication.module.css`, `Navbar.module.css`)

**Functions:**
- Action creators and thunks: camelCase (e.g., `identityFetchData`, `reciterLogin`, `addError`)
- React component functions: PascalCase as exported default (e.g., `const Publication: FunctionComponent<FuncProps> = (props) => {...}`)
- Event handlers: onEventName pattern (e.g., `onAccept`, `onReject`, `onUndo`, `onClickNext`, `onCloseModal`)
- Internal helper functions: camelCase (e.g., `toogleEvidence`, `acceptPublication`, `formatPublications`)
- Redux reducer actions dispatched: camelCase with verb (e.g., `dispatch({ type: methods.IDENTITY_FETCH_DATA })`)

**Variables:**
- State variables: camelCase (e.g., `showEvidence`, `expandedAuthors`, `expandedPubIndex`)
- Redux selectors: camelCase (e.g., `const feedbacklog = useSelector(...)`)
- Component props objects: camelCase (e.g., `reciterArticle`, `personIdentifier`, `paginatedPubsCount`)
- Constants: UPPER_SNAKE_CASE for redux action types (e.g., `IDENTITY_FETCH_DATA`, `ACCEPT_PUBLICATION`)
- Object freeze constants: camelCase keys (e.g., `allowedPermissions.Superuser`, `allowedPermissions.Curator_All`)

**Types:**
- TypeScript interfaces: PascalCase (e.g., `FuncProps`, `PaginationProps`, `SideNavBarProps`, `Credential`)
- Types/enums: PascalCase (e.g., `FilterType`, `MenuItem`, `Author`)
- Type definitions: Include in `.d.ts` files (e.g., `filter.d.ts`, `publication.report.filter.d.ts`)

## Code Style

**Formatting:**
- No explicit formatter configured (.prettierrc not present)
- ESLint enabled with Next.js core-web-vitals config (`eslint-config-next` v11.1.2)
- TypeScript target: ES6
- Indent: 4 spaces apparent from code samples

**Linting:**
- ESLint config: `.eslintrc.json` extends `next/core-web-vitals`
- Next.js v12.2.5 enforces strict prop typing for components
- TypeScript strict mode disabled (`"strict": false`)
- ESLint version: 7.32.0
- Run with: `npm run lint`

## Import Organization

**Order:**
1. External library imports (React, Next.js, third-party packages)
2. Relative path imports from local project structure
3. Style imports (CSS modules)

**Examples:**
```typescript
// controllers/authentication.controller.ts
import httpBuildQuery from 'http-build-query'
import jwt from 'jsonwebtoken'
import { reciterConfig } from '../config/local'
import { Request, Response } from 'express'

// src/components/elements/Publication/Publication.tsx
import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import { Popover, OverlayTrigger } from "react-bootstrap";
import CheckIcon from '@mui/icons-material/Check';
import type { Author } from '../../../../types/Author';
import { useSelector, RootStateOrAny, useDispatch } from "react-redux";
import HistoryModal from "./HistoryModal";
```

**Path Aliases:**
- No path aliases configured in tsconfig.json (imports use relative paths with `../`)

## Error Handling

**Patterns:**

**Try-Catch Blocks:**
- Used in API routes for database operations
- Pattern: `try { /* operation */ } catch(err) { console.log('Error message'); res.status(500).send(...) }`
- Location: Primarily in `src/pages/api/db/reports/` routes

**Fetch Error Handling:**
- Controllers use `.then().catch()` chaining
- Returns standardized response object: `{ statusCode: number, statusText: any }`
- Success check on HTTP status: `if(res.status !== 200) { throw error }`
- Example from `controllers/featuregenerator.controller.ts`:
```typescript
.catch((error) => {
    console.log('ReCiter Update Goldstandard api is not reachable: ' + error)
    return {
        statusCode: error.status,
        statusText: error
    }
});
```

**Redux Action Error Handling:**
- Dispatch error action: `dispatch(addError(error))`
- Toast notifications for user feedback: `toast.error("message", { position: "top-right", autoClose: 2000 })`
- Cancel fetching state on error: `dispatch({ type: methods.IDENTITY_CANCEL_FETCHING })`
- Error object structure: `{ type, title, status, detail }`

**API Route Validation:**
- Authorization header check: `if(req.headers.authorization !== reciterConfig.backendApiKey)`
- HTTP method check: `if(req.method === "POST")`
- Return standardized error responses with status codes

## Logging

**Framework:** `console.log()` directly (no logger library)

**Patterns:**
- Middleware validation logs: `console.log('validating logged in person authorization roles***...')`
- Error logs: `console.log('ReCiter Authenticate api is not reachable: ' + error)`
- Debug logs: `console.log('user roles****...',userRoles)`
- Log statements use string concatenation
- Heavy use of asterisks for visibility in console output

## Comments

**When to Comment:**
- Minimal comment usage observed
- Inline comments used for non-obvious logic (e.g., pagination calculations)
- Section separators with repeated characters (e.g., `****...****`)
- Commented-out code kept in place (not cleaned up):
  - `// { title: 'Perform Analysis', to: '/perform-analysis' },` in constants.js
  - Unused decodeJwt function commented in middleware.ts

**JSDoc/TSDoc:**
- Not consistently used
- Some components have minimal documentation
- Type definitions relying on TypeScript inference rather than explicit JSDoc blocks

## Function Design

**Size:**
- Ranges from ~30 lines (utility functions) to 200+ lines (complex components and controllers)
- Some large functions in controllers (e.g., `featuregenerator.controller.ts` > 400 lines with nested logic)
- Components split into smaller helper functions within same file (e.g., `Author` component inside `Publication.tsx`)

**Parameters:**
- React components: Single `props` parameter with TypeScript interface definition
- Functions: Multiple individual parameters or spread object
- Optional parameters marked with `?` in interfaces
- Example: `interface FuncProps { onAccept?(pmid: number, id: number): void, ... }`

**Return Values:**
- Components: JSX.Element or null
- Controllers: Promise resolving to object with `{ statusCode: number, statusText: any }`
- Utility functions: Filtered arrays, formatted data, or Promise
- Redux actions: Dispatch function returning Promise or void
- API routes: res.status().send() or res.status().json()

## Module Design

**Exports:**
- Components: Default export as named component
- Controllers: Named exports for functions
- Utilities: Default export for single function, named exports for multiple
- Redux files: Default export for methods/reducers, named exports for actions

**Barrel Files:**
- Not extensively used
- Exceptions: Redux store may use index files but not explicitly defined

**Example:**
```typescript
// controllers/authentication.controller.ts - named exports
export type Credential = { ... }
export async function authenticate(credential: Credential) { ... }
export async function withAuth(req: Request, res: Response) { ... }

// src/utils/filterPublications.js - default export
export default filterPublications;

// src/redux/methods/methods.js - default export
const methods = { ... }
export default methods
```

## Component Structure

**Functional Components:**
- Prefer FunctionComponent with TypeScript interfaces
- Props interface defines all props with optional marker `?`
- useState hooks for local state
- useSelector/useDispatch for Redux integration
- Event handlers defined as const arrow functions within component

**Example Pattern:**
```typescript
interface ComponentProps {
  required: string,
  optional?: number
}

const Component: FunctionComponent<ComponentProps> = (props) => {
  const [state, setState] = useState<boolean>(false)
  const dispatch = useDispatch()

  const handleEvent = () => {
    props.onEvent?.()
  }

  return <JSX />
}

export default Component;
```

## Redux State Management

**Pattern:** Redux with thunk middleware for async actions

**Action Structure:**
```javascript
// Synchronous action
export const addError = (message) => ({
    type: methods.ADD_ERROR,
    payload: message
})

// Async action (thunk)
export const identityFetchData = uid => dispatch => {
    dispatch({ type: methods.IDENTITY_FETCH_DATA })
    fetchWithTimeout('/api/...', options, timeout)
        .then(res => res.json())
        .then(data => dispatch({ type: methods.IDENTITY_CHANGE_DATA, payload: data }))
        .catch(error => dispatch({ type: methods.IDENTITY_CANCEL_FETCHING }))
}
```

**Dispatch Pattern:** Three-phase async state management
1. FETCH/START: Indicate loading state
2. CHANGE/UPDATE: Store successful data or SUCCESS variant
3. CANCEL/ERROR: Complete or handle failure

---

*Convention analysis: 2026-03-15*
