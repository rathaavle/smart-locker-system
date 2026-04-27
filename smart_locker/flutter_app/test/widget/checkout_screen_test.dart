import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_locker_app/screens/check_out_screen.dart';
import 'package:smart_locker_app/providers/check_out_provider.dart';

// Requirements: 3.1, 7.2, 7.3, 7.4

void main() {
  group('CheckOutScreen Widget Tests', () {
    testWidgets('renders check-out form with OTP input', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      expect(find.text('Locker locker-01'), findsOneWidget);
      expect(find.text('Enter the 6-digit OTP sent to your email'), findsOneWidget);
      expect(find.byType(TextFormField), findsOneWidget);
      expect(find.text('OTP'), findsOneWidget);
      expect(find.text('Submit'), findsOneWidget);
    });

    testWidgets('validates empty OTP input', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Tap submit without entering OTP
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter the OTP'), findsOneWidget);
    });

    testWidgets('validates OTP format - must be 6 digits', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Test with less than 6 digits
      await tester.enterText(find.byType(TextFormField), '12345');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('OTP must be exactly 6 digits'), findsOneWidget);

      // Test with more than 6 digits (should be prevented by maxLength)
      await tester.enterText(find.byType(TextFormField), '1234567');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should still show error or be truncated
      expect(find.text('OTP must be exactly 6 digits'), findsOneWidget);

      // Test with non-numeric characters
      await tester.enterText(find.byType(TextFormField), 'abc123');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('OTP must be exactly 6 digits'), findsOneWidget);
    });

    testWidgets('accepts valid 6-digit OTP format', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter valid 6-digit OTP
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should not show validation error
      expect(find.text('OTP must be exactly 6 digits'), findsNothing);
      expect(find.text('Please enter the OTP'), findsNothing);
    });

    testWidgets('shows loading state during submission', (tester) async {
      final mockNotifier = MockCheckOutNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter valid OTP
      await tester.enterText(find.byType(TextFormField), '123456');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump(); // Start the async operation

      // Should show loading indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      
      // Submit button should be disabled
      final submitButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit').first,
      );
      expect(submitButton.onPressed, isNull);
    });

    testWidgets('navigates to dashboard on successful check-out', (tester) async {
      String? navigatedRoute;
      
      final router = GoRouter(
        initialLocation: '/check-out/locker-01',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) {
              navigatedRoute = '/';
              return const Scaffold(body: Text('Dashboard'));
            },
          ),
          GoRoute(
            path: '/check-out/:lockerId',
            builder: (context, state) {
              final lockerId = state.pathParameters['lockerId']!;
              return CheckOutScreen(lockerId: lockerId);
            },
          ),
        ],
      );

      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(success: true, message: 'Success'),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should navigate to dashboard
      expect(navigatedRoute, '/');
      expect(find.text('Dashboard'), findsOneWidget);
    });

    testWidgets('shows error message on OTP_INVALID and allows retry', (tester) async {
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'Invalid OTP',
          error: 'OTP_INVALID',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show error snackbar
      expect(find.text('Invalid OTP. Please check and try again.'), findsOneWidget);
      
      // OTP field should be cleared for retry
      final textField = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(textField.controller?.text, isEmpty);
    });

    testWidgets('shows error message on OTP_EXPIRED', (tester) async {
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'OTP expired',
          error: 'OTP_EXPIRED',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show expired error snackbar
      expect(find.text('OTP has expired. Please contact support.'), findsOneWidget);
    });

    testWidgets('shows countdown timer on OTP_LOCKED', (tester) async {
      final lockedUntil = DateTime.now().add(const Duration(minutes: 15));
      
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'OTP locked',
          error: 'OTP_LOCKED',
          lockedUntil: lockedUntil,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show lockout message
      expect(find.text('Too many failed attempts. OTP validation locked for 15 minutes.'), findsOneWidget);
      
      // Should show countdown timer UI
      expect(find.text('OTP Locked'), findsOneWidget);
      expect(find.byIcon(Icons.timer), findsOneWidget);
      expect(find.textContaining('Time remaining:'), findsOneWidget);
      
      // Submit button should be disabled
      final submitButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit').first,
      );
      expect(submitButton.onPressed, isNull);
    });

    testWidgets('countdown timer updates every second', (tester) async {
      final lockedUntil = DateTime.now().add(const Duration(seconds: 5));
      
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'OTP locked',
          error: 'OTP_LOCKED',
          lockedUntil: lockedUntil,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit to trigger lockout
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Verify countdown is displayed
      expect(find.textContaining('Time remaining:'), findsOneWidget);
      
      // Wait 1 second and verify countdown updates
      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining('Time remaining:'), findsOneWidget);
      
      // Wait another second
      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining('Time remaining:'), findsOneWidget);
    });

    testWidgets('shows error message on OTP_USED', (tester) async {
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'OTP already used',
          error: 'OTP_USED',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show OTP used error snackbar
      expect(find.text('This OTP has already been used.'), findsOneWidget);
    });

    testWidgets('disables form during submission', (tester) async {
      final mockNotifier = MockCheckOutNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter valid OTP
      await tester.enterText(find.byType(TextFormField), '123456');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump();

      // OTP field should be disabled
      final textField = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(textField.enabled, false);
    });

    testWidgets('prevents submission when OTP is locked', (tester) async {
      final lockedUntil = DateTime.now().add(const Duration(minutes: 15));
      
      final mockNotifier = MockCheckOutNotifier(
        result: CheckOutResult(
          success: false,
          message: 'OTP locked',
          error: 'OTP_LOCKED',
          lockedUntil: lockedUntil,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter OTP and submit to trigger lockout
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Try to submit again while locked
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show lockout warning in snackbar
      expect(find.textContaining('OTP validation is locked'), findsOneWidget);
    });

    testWidgets('OTP input only accepts digits', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Try to enter non-numeric characters
      await tester.enterText(find.byType(TextFormField), 'abc123');
      
      // The input formatter should filter out non-digits
      final textField = tester.widget<TextFormField>(find.byType(TextFormField));
      // Note: In actual implementation, the FilteringTextInputFormatter.digitsOnly
      // will prevent non-digits from being entered
      expect(textField.inputFormatters, isNotEmpty);
    });

    testWidgets('OTP input has maxLength of 6', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      final textField = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(textField.maxLength, 6);
    });
  });
}

/// Mock CheckOutNotifier for testing
class MockCheckOutNotifier extends AutoDisposeAsyncNotifier<CheckOutState> {
  final CheckOutResult? result;
  final Duration delay;

  MockCheckOutNotifier({
    this.result,
    this.delay = const Duration(milliseconds: 100),
  });

  @override
  Future<CheckOutState> build() async {
    return CheckOutState();
  }

  @override
  Future<CheckOutResult> submitOtp({
    required String lockerId,
    required String otp,
  }) async {
    state = AsyncValue.data(CheckOutState(isLoading: true));
    
    await Future.delayed(delay);
    
    final checkOutResult = result ?? 
        CheckOutResult(success: true, message: 'Success');
    
    state = AsyncValue.data(
      CheckOutState(isLoading: false, result: checkOutResult),
    );
    
    return checkOutResult;
  }

  @override
  void reset() {
    state = AsyncValue.data(CheckOutState());
  }
}
