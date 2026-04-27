# Integration Tests

This directory contains integration tests for the Smart Locker System that use Firebase Local Emulator Suite.

## Test Files

1. **checkin_flow.test.ts** - Full check-in flow integration test
   - Tests: email submit → OTP generated → RTDB command → sensor OPEN → sensor CLOSED → FILLED
   - Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10

2. **checkout_flow.test.ts** - Full check-out flow integration test
   - Tests: OTP submit → validate → RTDB command → sensor OPEN → sensor CLOSED → EMPTY → transaction COMPLETED
   - Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

3. **concurrent_checkin.test.ts** - Concurrent check-in conflict resolution
   - Tests: Two simultaneous requests → one succeeds, one LOCKER_CONFLICT
   - Requirements: 9.3

4. **heartbeat_flow.test.ts** - Heartbeat and online/offline transitions
   - Tests: Device heartbeat monitoring → offline detection → online restoration
   - Requirements: 8.1, 8.2, 8.3

## Prerequisites

Before running integration tests, ensure you have:

1. **Firebase CLI** installed:

   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Local Emulator Suite** installed:

   ```bash
   firebase init emulators
   ```

   Select:
   - Firestore Emulator (port 8080)
   - Realtime Database Emulator (port 9000)
   - Functions Emulator (port 5001)

3. **Dependencies** installed:
   ```bash
   cd functions
   npm install
   ```

## Running Integration Tests

### Option 1: Run with Emulators (Recommended)

Start the Firebase emulators in one terminal:

```bash
cd smart_locker
firebase emulators:start
```

In another terminal, run the integration tests:

```bash
cd smart_locker/functions
npm test -- tests/integration
```

### Option 2: Run Specific Test File

```bash
cd smart_locker/functions
npm test -- tests/integration/checkin_flow.test.ts
npm test -- tests/integration/checkout_flow.test.ts
npm test -- tests/integration/concurrent_checkin.test.ts
npm test -- tests/integration/heartbeat_flow.test.ts
```

### Option 3: Run All Tests (Unit + Property + Integration)

```bash
cd smart_locker/functions
npm test
```

## Environment Variables

The tests automatically configure emulator hosts if not set:

- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000`

You can override these by setting environment variables before running tests.

## Test Timeouts

Integration tests have extended timeouts (30 seconds) to account for:

- Firestore transaction latency
- RTDB trigger propagation
- Manual trigger invocation in test environment

## Troubleshooting

### Emulator Connection Issues

If tests fail with connection errors:

1. Ensure emulators are running: `firebase emulators:start`
2. Check emulator ports are not in use
3. Verify `firebase.json` has correct emulator configuration

### Test Cleanup Issues

If tests fail due to stale data:

1. Stop emulators
2. Clear emulator data: `firebase emulators:start --import=./emulator-data --export-on-exit`
3. Restart emulators

### Trigger Not Firing

The tests manually invoke triggers using `firebase-functions-test` because:

- Emulator triggers may not fire automatically in test environment
- Manual invocation provides deterministic test execution
- Allows precise control over trigger timing

## Coverage

Integration tests validate:

- ✅ End-to-end check-in flow with state transitions
- ✅ End-to-end check-out flow with OTP validation
- ✅ Concurrent request conflict resolution
- ✅ Heartbeat monitoring and online/offline detection
- ✅ RTDB command writing and reading
- ✅ Firestore transaction atomicity
- ✅ State machine correctness across components

## Next Steps

After all integration tests pass:

1. Run the full test suite: `npm test`
2. Verify all 22 property tests pass
3. Check test coverage: `npm test -- --coverage`
4. Proceed to task 19 (Final Checkpoint)
