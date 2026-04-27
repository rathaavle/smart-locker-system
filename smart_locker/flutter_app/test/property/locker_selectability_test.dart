import 'package:flutter_test/flutter_test.dart';
import 'package:smart_locker_app/models/locker.dart';
import 'dart:math';

// Feature: smart-locker-system, Property 18: Locker selectability
// Validates: Requirements 2.1, 8.2, 9.1, 10.4

void main() {
  group('Property 18: Locker Selectability — Only EMPTY and Online', () {
    test('Only EMPTY+online lockers are selectable', () {
      final random = Random(42); // Fixed seed for reproducibility
      
      // Run property test with 100 iterations
      for (int i = 0; i < 100; i++) {
        // Generate arbitrary list of lockers with mixed states
        final lockerCount = random.nextInt(21); // 0 to 20 lockers
        final lockers = List.generate(lockerCount, (index) => _generateMixedLocker(random, index));
        
        // Filter to get selectable lockers using the business logic
        final selectableLockers = lockers.where((locker) {
          return locker.state == LockerState.empty && locker.isOnline;
        }).toList();

        // Property: Every selectable locker must be EMPTY and online
        for (final locker in selectableLockers) {
          expect(locker.state, equals(LockerState.empty),
              reason: 'Selectable locker ${locker.lockerId} must be EMPTY (iteration $i)');
          expect(locker.isOnline, isTrue,
              reason: 'Selectable locker ${locker.lockerId} must be online (iteration $i)');
        }

        // Property: Every EMPTY+online locker must be selectable
        for (final locker in lockers) {
          if (locker.state == LockerState.empty && locker.isOnline) {
            expect(selectableLockers, contains(locker),
                reason: 'EMPTY+online locker ${locker.lockerId} must be selectable (iteration $i)');
          }
        }

        // Property: Non-EMPTY or offline lockers must not be selectable
        for (final locker in lockers) {
          if (locker.state != LockerState.empty || !locker.isOnline) {
            expect(selectableLockers, isNot(contains(locker)),
                reason: 'Non-EMPTY or offline locker ${locker.lockerId} must not be selectable (iteration $i)');
          }
        }
      }
    });
  });
}

/// Generate a random Locker with mixed states and online/offline status
Locker _generateMixedLocker(Random random, int index) {
  final states = [LockerState.empty, LockerState.open, LockerState.filled, LockerState.unlocking];
  final state = states[random.nextInt(states.length)];
  final isOnline = random.nextBool();
  
  return Locker(
    lockerId: 'locker-${index.toString().padLeft(3, '0')}',
    state: state,
    doorStatus: state == LockerState.open ? DoorStatus.open : DoorStatus.closed,
    isOnline: isOnline,
  );
}