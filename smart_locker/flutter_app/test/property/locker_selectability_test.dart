import 'package:flutter_test/flutter_test.dart';
import 'package:glados/glados.dart';
import 'package:smart_locker_app/models/locker.dart';

// Feature: smart-locker-system, Property 18: Locker selectability
// Validates: Requirements 2.1, 8.2, 9.1, 10.4

void main() {
  group('Property 18: Locker Selectability — Only EMPTY and Online', () {
    Glados<List<Locker>>().test(
      'Only EMPTY+online lockers are selectable',
      (lockers) {
        // Filter to get selectable lockers using the business logic
        final selectableLockers = lockers.where((locker) {
          return locker.state == LockerState.empty && locker.isOnline;
        }).toList();

        // Property: Every selectable locker must be EMPTY and online
        for (final locker in selectableLockers) {
          expect(locker.state, equals(LockerState.empty),
              reason: 'Selectable locker ${locker.lockerId} must be EMPTY');
          expect(locker.isOnline, isTrue,
              reason: 'Selectable locker ${locker.lockerId} must be online');
        }

        // Property: Every EMPTY+online locker must be selectable
        for (final locker in lockers) {
          if (locker.state == LockerState.empty && locker.isOnline) {
            expect(selectableLockers, contains(locker),
                reason: 'EMPTY+online locker ${locker.lockerId} must be selectable');
          }
        }

        // Property: Non-EMPTY or offline lockers must not be selectable
        for (final locker in lockers) {
          if (locker.state != LockerState.empty || !locker.isOnline) {
            expect(selectableLockers, isNot(contains(locker)),
                reason: 'Non-EMPTY or offline locker ${locker.lockerId} must not be selectable');
          }
        }
      },
      maxRuns: 100,
    );
  });
}

/// Generator for arbitrary Locker with mixed states and online/offline status
extension LockerArbitrary on Glados<Locker> {
  Glados<Locker> get mixedLocker {
    return combine3(
      any.letterOrDigits.list(min: 5, max: 10).map((chars) => 'locker-${chars.join()}'),
      any.choose([
        LockerState.empty,
        LockerState.open,
        LockerState.filled,
        LockerState.unlocking,
      ]),
      any.bool,
      (lockerId, state, isOnline) => Locker(
        lockerId: lockerId,
        state: state,
        doorStatus: state == LockerState.open ? DoorStatus.open : DoorStatus.closed,
        isOnline: isOnline,
      ),
    );
  }
}

/// Generator for arbitrary list of Lockers with mixed states
extension LockerListArbitrary on Glados<List<Locker>> {
  Glados<List<Locker>> get mixedLockerList {
    return any.mixedLocker.list(min: 0, max: 20);
  }
}
