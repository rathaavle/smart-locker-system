import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smart_locker_app/models/locker.dart';
import 'package:smart_locker_app/providers/lockers_provider.dart';
import 'package:smart_locker_app/screens/dashboard_screen.dart';
import 'package:smart_locker_app/widgets/locker_card.dart';

// Requirements: 10.1, 10.2, 10.3

void main() {
  group('DashboardScreen Widget Tests', () {
    testWidgets('renders loading indicator while loading', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => const Stream.empty()),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders empty state when no lockers available', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value([])),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No lockers available'), findsOneWidget);
    });

    testWidgets('renders locker cards for all lockers', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-01',
          state: LockerState.empty,
          doorStatus: DoorStatus.closed,
          isOnline: true,
        ),
        const Locker(
          lockerId: 'locker-02',
          state: LockerState.filled,
          doorStatus: DoorStatus.closed,
          isOnline: true,
        ),
        const Locker(
          lockerId: 'locker-03',
          state: LockerState.open,
          doorStatus: DoorStatus.open,
          isOnline: true,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify all locker cards are rendered
      expect(find.byType(LockerCard), findsNWidgets(3));
      expect(find.text('locker-01'), findsOneWidget);
      expect(find.text('locker-02'), findsOneWidget);
      expect(find.text('locker-03'), findsOneWidget);
    });

    testWidgets('displays offline indicator for offline lockers', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-offline',
          state: LockerState.empty,
          doorStatus: DoorStatus.closed,
          isOnline: false,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('OFFLINE'), findsOneWidget);
      expect(find.byIcon(Icons.cloud_off), findsOneWidget);
    });

    testWidgets('renders error state when stream fails', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith(
              (ref) => Stream.error(Exception('Test error')),
            ),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Error loading lockers'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
    });

    testWidgets('visual state distinction - EMPTY shows green', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-empty',
          state: LockerState.empty,
          doorStatus: DoorStatus.closed,
          isOnline: true,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Available'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    });

    testWidgets('visual state distinction - FILLED shows red', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-filled',
          state: LockerState.filled,
          doorStatus: DoorStatus.closed,
          isOnline: true,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Occupied'), findsOneWidget);
      expect(find.byIcon(Icons.inventory_2), findsOneWidget);
    });

    testWidgets('visual state distinction - OPEN shows orange', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-open',
          state: LockerState.open,
          doorStatus: DoorStatus.open,
          isOnline: true,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Open'), findsOneWidget);
      expect(find.byIcon(Icons.lock_open), findsOneWidget);
    });

    testWidgets('visual state distinction - UNLOCKING shows loading', (tester) async {
      final testLockers = [
        const Locker(
          lockerId: 'locker-unlocking',
          state: LockerState.unlocking,
          doorStatus: DoorStatus.closed,
          isOnline: true,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            lockersStreamProvider.overrideWith((ref) => Stream.value(testLockers)),
          ],
          child: const MaterialApp(
            home: DashboardScreen(),
          ),
        ),
      );

      await tester.pump(); // Use pump() instead of pumpAndSettle() for animated widgets

      expect(find.text('Unlocking'), findsOneWidget);
      // CircularProgressIndicator is shown for unlocking state
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });
}
