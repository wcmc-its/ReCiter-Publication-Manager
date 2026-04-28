# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Status:** No testing infrastructure present

**Framework:** Not configured
- No `jest.config.js`, `vitest.config.js`, or similar test runner config files detected
- No test scripts in `package.json` (only `lint` is defined)
- No test dependencies in `package.json` (no jest, vitest, mocha, chai, etc.)
- No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files found in repository

**Assertion Library:** Not applicable (no tests present)

**Run Commands:**
```bash
npm run lint              # Only linting available (Next.js ESLint)
```

## Codebase Testing Approach

**Current State:** Manual testing only
- No automated unit tests
- No integration tests
- No E2E tests
- No test fixtures or factories
- Developers rely on browser/manual verification

## Code Coverage

**Requirements:** None enforced
- No coverage thresholds defined
- No coverage reporting configured
- Code coverage metrics: Unknown

## Testing Gaps

The following areas lack automated test coverage:

**Critical API Endpoints:**
- `src/pages/api/reciter/authentication.ts` - User authentication flow untested
- `src/pages/api/reciter/feature-generator/[uid].ts` - Publication scoring untested
- `src/pages/api/reciter/save/userfeedback/[uid].ts` - User feedback persistence untested
- `src/pages/api/db/admin/users/` routes - User management untested
- `src/pages/api/db/reports/` routes - Report generation untested

**Controllers:**
- `controllers/authentication.controller.ts` - JWT token generation and validation
- `controllers/featuregenerator.controller.ts` - Publication feature mapping and feedback merging (400+ lines)
- `controllers/pubmed.controller.ts` - PubMed search result formatting
- `controllers/userfeedback.controller.ts` - Feedback save/delete operations
- `controllers/sendNotifications.controller.ts` - Email notification sending

**Redux State:**
- `src/redux/actions/actions.js` - All async thunk actions (100+ action creators)
- `src/redux/reducers/reducers.js` - State mutations
- No test coverage for state transitions or side effects

**React Components:**
- `src/components/elements/Publication/Publication.tsx` - Complex component with 200+ lines, evidence display logic untested
- `src/components/elements/CurateIndividual/` - Article curation UI untested
- `src/components/elements/Search/` - Identity search interface untested
- `src/components/elements/Report/` - Report generation interface untested
- `src/components/elements/Manage/` - User/admin settings management untested
- `src/components/elements/Pagination/Pagination.tsx` - Pagination logic untested

**Utility Functions:**
- `src/utils/filterPublications.js` - Complex filtering logic with 100 lines untested
- `src/utils/filterPublicationsBySearchText.js` - Search filtering untested
- `src/utils/sortPublications.js` - Publication sorting untested
- `src/utils/fullName.js` - Name formatting untested
- `src/utils/fetchWithTimeout.js` - Timeout mechanism untested

**Middleware:**
- `src/middleware.ts` - Role-based access control logic with 123 lines of untested auth checks

**Database:**
- Sequelize ORM operations in `/controllers/db/` untested
- Model queries against MySQL untested
- Connection pooling behavior untested

## Fragile Areas Without Tests

**High Risk:**
- **featuregenerator.controller.ts (400+ lines):** Complex nested logic for merging publication scores with user feedback. Deeply nested `.then()` chains with multiple conditional branches. Changes to feedback mapping logic could break silently.
- **middleware.ts (123 lines):** 20+ conditional branches for role-based routing. Each role combination path untested. Easy to accidentally redirect users to wrong pages.
- **Publication.tsx (200+ lines):** Complex evidence toggle logic with pagination state management. Multiple interdependent variables (paginatedPubsCount, totalCount, page, expandedPubIndex).

**Medium Risk:**
- **filterPublications.js (100 lines):** Multiple search field checks with boolean accumulation logic. Easy to introduce filtering regressions.
- **API routes (50+ endpoints):** No validation of request bodies, no test coverage for error responses or edge cases.
- **Redux thunk actions (100+ defined):** No test coverage for error handling paths, missing feedback scenarios, or race conditions.

## Testing Recommendations

### Immediate Priorities

1. **Authentication & Authorization:**
   - Test `middleware.ts` role validation logic with all role combinations
   - Test JWT decode and validation in `authentication.controller.ts`
   - Add tests for API authorization header validation

2. **Data Integrity:**
   - Test `featuregenerator.controller.ts` feedback merge logic with sample data
   - Verify publications correctly marked ACCEPTED/REJECTED
   - Test edge cases: empty feedback, missing PMIDs, duplicate feedback

3. **User Flows:**
   - Test publication accept/reject flow from UI to database
   - Test search and filter operations
   - Test pagination logic with various result sizes

### Setup Approach

**Recommended Framework:** Jest (aligns with React ecosystem)

**Config to Add:**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/controllers'],
  moduleNameMapper: {
    '\\.module\\.css$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js}',
    'controllers/**/*.{ts,js}',
    '!**/*.d.ts',
  ],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
};
```

**package.json Scripts:**
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### Test File Organization

**Location:** Co-locate with source files
- `src/components/elements/Publication/__tests__/Publication.test.tsx`
- `src/utils/__tests__/filterPublications.test.js`
- `controllers/__tests__/featuregenerator.controller.test.ts`
- `src/pages/api/__tests__/authentication.api.test.ts`

### Mocking Strategy

**External Dependencies to Mock:**
- fetch/API calls: Use `jest.mock()` for axios or native fetch
- Redux dispatch: Mock useSelector/useDispatch
- Next.js router: Mock `next/router`
- Environment variables: jest.setup.js loads test .env

**What NOT to Mock:**
- Utility functions (filterPublications, sortPublications) - test directly
- Redux reducers - test with real reducer logic
- Component rendering - use React Testing Library to verify DOM

**Example Mock Pattern:**
```typescript
// Controller test
jest.mock('node-fetch');
import fetch from 'node-fetch';

test('authentication returns 401 on invalid credentials', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    status: 401,
    json: async () => ({ error: 'Invalid' })
  });

  const result = await authenticate({ username: 'bad', password: 'wrong' });
  expect(result.statusCode).toBe(401);
});
```

### Component Testing Pattern

```typescript
// Publication.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import configureStore from 'redux-mock-store';
import { Provider } from 'react-redux';
import Publication from './Publication';

const mockStore = configureStore([]);

test('accept button triggers onAccept callback', () => {
  const mockOnAccept = jest.fn();
  const store = mockStore({
    feedbacklog: {},
    filteredIdentities: []
  });

  render(
    <Provider store={store}>
      <Publication
        onAccept={mockOnAccept}
        reciterArticle={{ pmid: 12345 }}
        index={0}
        personIdentifier="person123"
        fullName="John Doe"
      />
    </Provider>
  );

  fireEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(mockOnAccept).toHaveBeenCalledWith(12345, 0);
});
```

### API Route Testing Pattern

```typescript
// authentication.api.test.ts
import { createMocks } from 'node-mocks-http';
import handler from './authentication';

test('POST /api/reciter/authentication with valid key succeeds', async () => {
  const { req, res } = createMocks({
    method: 'POST',
    headers: {
      authorization: process.env.NEXT_PUBLIC_RECITER_BACKEND_API_KEY
    },
    body: { username: 'user@example.com', password: 'password' }
  });

  await handler(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(JSON.parse(res._getData())).toHaveProperty('message');
});
```

### Utility Function Testing Pattern

```typescript
// filterPublications.test.js
import filterPublications from './filterPublications';

test('filters publications by ACCEPTED status', () => {
  const data = {
    reCiterArticleFeatures: [
      { pmid: 1, userAssertion: 'ACCEPTED', title: 'Article 1' },
      { pmid: 2, userAssertion: 'SUGGESTED', title: 'Article 2' },
      { pmid: 3, userAssertion: 'ACCEPTED', title: 'Article 3' }
    ]
  };

  const result = filterPublications(data, 'ACCEPTED', '');

  expect(result).toHaveLength(2);
  expect(result[0].pmid).toBe(1);
  expect(result[1].pmid).toBe(3);
});
```

## CI/CD Integration

**Current Status:** No automated testing in CI/CD pipeline
- `k8-buildspec.yml` only builds Docker image
- No test execution stage
- No coverage reporting

**Recommendation:** Add test stage to CodeBuild pipeline before Docker build:
```yaml
pre_build:
  commands:
    - echo "Running tests..."
    - npm test -- --coverage --passWithNoTests
```

---

*Testing analysis: 2026-03-15*
