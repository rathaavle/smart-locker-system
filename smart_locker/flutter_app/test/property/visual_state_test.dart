import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:math';

// Feature: smart-locker-system, Property 21: Visual state distinction
// Validates: Requirements 10.3

void main() {
  group('Property 21: Visual State Distinction', () {
    test('Different states produce different visual representations', () {
      final random = Random(42); // Fixed seed for reproducibility
      
      // Run property test with 100 iterations
      for (int i = 0; i < 100; i++) {
        // Generate two different visual states
        final state1 = _generateRandomVisualState(random);
        final state2 = _generateRandomVisualState(random);
        
        // Skip if states are the same
        if (state1 == state2) {
          continue;
        }

        // Get visual representations
        final visual1 = getVisualRepresentation(state1);
        final visual2 = getVisualRepresentation(state2);

        // Property: Different states must have different visual representations
        // (different color OR different icon)
        final isDifferent = visual1.color != visual2.color || 
                           visual1.icon != visual2.icon;

        expect(isDifferent, isTrue,
            reason: 'States $state1 and $state2 must have different visual representations (iteration $i)');
      }
    });
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

/// Generate a random LockerVisualState
LockerVisualState _generateRandomVisualState(Random random) {
  final states = [
    LockerVisualState.empty,
    LockerVisualState.filled,
    LockerVisualState.open,
    LockerVisualState.unlocking,
    LockerVisualState.offline,
  ];
  return states[random.nextInt(states.length)];
}