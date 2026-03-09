# Running Tests Guide

## Prerequisites

Ensure you have installed all dependencies:

```bash
# Server dependencies
cd server
npm install

# Client dependencies  
cd ../client
npm install
```

---

## Running Tests

### Run All Tests

```bash
cd server
npm run test
```

This will run all test files in `src/__tests__/` using vitest.

---

### Run Specific Test Suite

Run individual test files:

```bash
# Grade Service Tests
npm run test -- grade-service.test.ts

# Attendance Service Tests
npm run test -- attendance-service.test.ts

# Journal Service Tests
npm run test -- journal-service.test.ts

# Auth Service Tests
npm run test -- auth-service.test.ts
```

---

### Watch Mode (Continuous Testing)

```bash
npm run test -- --watch
```

This will re-run tests automatically when files change.

---

### Coverage Report

```bash
npm run test -- --coverage
```

Generates a coverage report showing which lines of code are tested.

---

### Debug Mode

```bash
npm run test -- --inspect-brk
```

Allows debugging tests in Node.js debugger.

---

## Test File Locations

All test files are in: `server/src/__tests__/`

```
server/src/__tests__/
├── grade-service.test.ts        (8 tests)
├── attendance-service.test.ts   (9 tests)
├── journal-service.test.ts      (11 tests)
├── auth-service.test.ts         (12 tests)
├── auth-controller.test.ts      (existing)
├── auth-middleware.test.ts      (existing)
└── registration-flow.test.ts    (existing)
```

---

## What Each Test Suite Validates

### GradeService Tests (8 tests)
- Grade CRUD operations
- Form teacher assignment and validation
- Student counting
- Grade initialization (1-12)

**Run:** `npm run test -- grade-service.test.ts`

### AttendanceService Tests (9 tests)
- Attendance record creation
- Student status updates (present/absent)
- Date deduplication
- Record deletion
- Error handling for edge cases

**Run:** `npm run test -- attendance-service.test.ts`

### JournalService Tests (11 tests)
- Journal creation with student prefill
- Lesson management
- Mark updates with permission checks
- Student synchronization
- Archived student filtering

**Run:** `npm run test -- journal-service.test.ts`

### AuthService Tests (12 tests)
- JWT token verification
- User registration flow
- Login with credentials
- Token refresh
- Password reset
- Registration request management

**Run:** `npm run test -- auth-service.test.ts`

---

## Understanding Test Output

### Successful Test Run
```
 ✓ src/__tests__/grade-service.test.ts (8)
 ✓ src/__tests__/attendance-service.test.ts (9)
 ✓ src/__tests__/journal-service.test.ts (11)
 ✓ src/__tests__/auth-service.test.ts (12)

Test Files  4 passed (4)
      Tests  40 passed (40)
```

### Failed Test
```
 ✗ src/__tests__/grade-service.test.ts > fetches all grades with student counts
  Error: expected 25 but received 30
  at test.ts:45:12
```

---

## Test Structure Explanation

Each test file follows this pattern:

```typescript
describe("ServiceName", () => {
  beforeEach(() => {
    // Setup: Clear mocks before each test
    vi.clearAllMocks();
  });

  it("description of what should happen", async () => {
    // Arrange: Set up test data and mocks
    const testData = { /* ... */ };
    mockFunction.mockResolvedValueOnce(testData);

    // Act: Call the service method
    const result = await service.method(testData);

    // Assert: Verify the result
    expect(result).toBe(expectedValue);
    expect(mockFunction).toHaveBeenCalledWith(expectedArg);
  });
});
```

---

## Mocking Strategy

All tests use mocked database models:

```typescript
// Mocks replace actual database calls
const userModelMock = { findById: vi.fn(), find: vi.fn() };
const gradeModelMock = { findOne: vi.fn(), create: vi.fn() };

vi.mock("../user/user-model", () => ({ default: userModelMock }));
vi.mock("../grade/grade-model", () => ({ GradeModel: gradeModelMock }));
```

This allows:
- ✅ Fast test execution (no database needed)
- ✅ Isolated tests (no data interference)
- ✅ Controllable behavior (mock any scenario)
- ✅ Reliable assertions (no flakiness)

---

## Common Test Commands

### Build and Test
```bash
npm run build && npm run test
```

### Test with TypeScript Checking
```bash
npm run build
npm run test
```

### List All Available Tests
```bash
npm run test -- --list
```

### Run Tests Matching Pattern
```bash
npm run test -- --grep "grade"  # Run only grade-related tests
npm run test -- --grep "should throw"  # Run only error tests
```

### Performance Report
```bash
npm run test -- --reporter=verbose
```

---

## Troubleshooting

### Tests Not Found
```bash
# Ensure test files are in correct location
ls src/__tests__/*.test.ts

# Verify file naming (must end with .test.ts)
```

### Module Not Found Errors
```bash
# Rebuild compiled files
npm run build

# Clear cache and retry
npm run test -- --clearCache
```

### Mock Not Working
```typescript
// Ensure mock is set up BEFORE importing service
vi.mock("../module-path", () => ({ default: mockObject }));
const loadService = () => import("../service");

// Then use:
const service = await loadService();
```

### Tests Timeout
```bash
# Increase timeout (default 10000ms)
npm run test -- --testTimeout=20000
```

---

## Integration with CI/CD

These tests can be integrated into automated pipelines:

```bash
# Quick check (suitable for pre-commit)
npm run build && npm run test

# Full validation
npm run build && npm run test -- --coverage && npm run test:coverage
```

---

## Next Test Development

To add more tests:

1. Create new file: `src/__tests__/new-service.test.ts`
2. Follow existing test pattern
3. Set up mocks at top of file
4. Write test cases with clear descriptions
5. Run `npm run test` to verify

---

## Additional Resources

- **Vitest Documentation:** https://vitest.dev
- **Test Naming Convention:** BDD-style ("should...", "throws...")
- **Mocking Pattern:** VI mock strategy for isolation
- **TypeScript Testing:** Full TypeScript support with vitest

---

## Summary

✅ **Total Tests:** 40
✅ **Test Files:** 4 new + 3 existing = 7 total
✅ **Coverage:** Core services (Grade, Attendance, Journal, Auth)
✅ **Framework:** Vitest with mocking
✅ **Build Status:** Both server and client compile without errors
