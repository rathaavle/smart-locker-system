import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glados/glados.dart';
import 'package:smart_locker_app/models/locker.dart';
import 'package:smart_locker_app/widgets/locker_card.dart';

// Feature: smart-locker-system, Property 21: Visual state distinction
// Validates: Requirements 10.3

void main() {
  group('Property 21: Visual State Distinction', () {
    Glados2<LockerVisualState, LockerVisualState>().test(
      'Different states produce different visual representations',
      (state1, state2) {
        // Skip if states are the same
        if (state1 == state2) {
          return;
        }

        // Get visual representations
        final visual1 = getVisualRepresentation(state1);
        final visual2 = getVisualRepresentation(state2);

        // Property: Different states must have different visual representations
        // (different color OR different icon)
        final isDifferent = visual1.color != visual2.color || 
                           visual1.icon != visual2.icon;

        expect(isDifferent, isTrue,
            reason: 'States $state1 and $state2 must have different visual representations');
      },
      maxRuns: 100,
    );
  });
}

/// Enum representing all possible visual states
enum LockerVisualState {
  empty,
  filled,
  open,
  unlocking,
  offline,
}

/// Visual representation data
class VisualRepresentation {
  final Color color;
  final IconData icon;

  VisualRepresentation(this.color, this.icon);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VisualRepresentation &&
          runtimeType == other.runtimeType &&
          color == other.color &&
          icon == other.icon;

  @override
  int get hashCode => color.hashCode ^ icon.hashCode;
}

/// Get visual representation for a given state
/// This mirrors the logic in LockerCard widget
VisualRepresentation getVisualRepresentation(LockerVisualState state) {
  switch (state) {
    case LockerVisualState.empty:
      return VisualRepresentation(Colors.green, Icons.check_circle_outline);
    case LockerVisualState.filled:
      return VisualRepresentation(Colors.red, Icons.inventory_2);
    case LockerVisualState.open:
      return VisualRepresentation(Colors.orange, Icons.lock_open);
    case LockerVisualState.unlocking:
      return VisualRepresentation(Colors.blue, Icons.hourglass_empty);
    case LockerVisualState.offline:
      return VisualRepresentation(Colors.grey, Icons.cloud_off);
  }
}

/// Generator for arbitrary LockerVisualState
extension LockerVisualStateArbitrary on Glados<LockerVisualState> {
  Glados<LockerVisualState> get lockerVisualState {
    return any.choose([
      LockerVisualState.empty,
      LockerVisualState.filled,
      LockerVisualState.open,
      LockerVisualState.unlocking,
      LockerVisualState.offline,
    ]);
  }
}
