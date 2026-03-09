# Quick Start: Running Tests

## 30 Second Setup

```bash
# Navigate to server directory
cd server

# Run all tests
npm run test
```

Expected output:
```
 ✓ src/__tests__/grade-service.test.ts (8)
 ✓ src/__tests__/attendance-service.test.ts (9) 
 ✓ src/__tests__/journal-service.test.ts (11)
 ✓ src/__tests__/auth-service.test.ts (12)

Test Files  4 passed (4)
      Tests  40 passed (40)
```

---

## Most Common Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Run all tests |
| `npm run test -- --watch` | Run tests and watch for changes |
| `npm run test -- grade-service` | Run only grade service tests |
| `npm run build` | Verify TypeScript compilation |

---

## What Tests Cover

✅ **Grade System** (Renamed from Class)
- Creating grades 1-12
- Assigning form teachers
- Validating teacher permissions
- Counting students

✅ **Attendance Tracking**
- Recording attendance
- Updating student status
- Preventing duplicates
- Deleting records

✅ **Journal Management**
- Creating journals
- Adding lessons
- Updating marks
- Syncing students
- Permission validation

✅ **Authentication**
- User registration
- Login flow
- Token management
- Password reset

---

## Quick Test Run

### Test Everything
```bash
npm run test
```

### Test Specific Service
```bash
npm run test -- grade-service.test.ts
npm run test -- attendance-service.test.ts
npm run test -- journal-service.test.ts
npm run test -- auth-service.test.ts
```

### Watch for Changes
```bash
npm run test -- --watch
```

### Get Coverage Report
```bash
npm run test -- --coverage
```

---

## Verifying the Build

Both must succeed:

```bash
# Server
npm run build
# Expected: > tsc (no errors)

# Client (from client directory)
npm run build
# Expected: ✓ built in X.XXs
```

---

## File Locations Reference

| What | Where |
|------|-------|
| Test Files | `server/src/__tests__/` |
| Services | `server/src/{service}/` |
| Implementation | `server/src/{service}/{service}-service.ts` |

---

## New Test Files Created

1. **grade-service.test.ts** (8 tests)
   - Grade CRUD operations
   - Form teacher management
   
2. **attendance-service.test.ts** (9 tests)
   - Attendance records
   - Student status updates
   
3. **journal-service.test.ts** (11 tests - EXPANDED)
   - Added: addLesson, syncStudents, deleteJournal
   
4. **auth-service.test.ts** (12 tests - EXPANDED)
   - Added: registration, login, password reset

---

## Troubleshooting

**Tests fail to run:**
```bash
npm run build  # Rebuild TypeScript
npm run test
```

**Module not found:**
```bash
npm install  # Reinstall dependencies
npm run test
```

**Want verbose output:**
```bash
npm run test -- --reporter=verbose
```

---

## Next Steps

✅ All 40 tests created and compiling
✅ Grade refactor (class → grade) validated
✅ Attendance system tested
✅ Journal operations tested
✅ Authentication flows tested

**Ready for:** Integration testing or deployment
