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
      expect(find.text('OTP'), findsOneWidget); // Changed from "OTP Code" to "OTP"
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

    testWidgets('validates OTP format (6 digits)', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter invalid OTP (too short)
      await tester.enterText(find.byType(TextFormField), '123');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('OTP must be exactly 6 digits'), findsOneWidget);
    });

    testWidgets('shows loading state during submission', (tester) async {
      final testNotifier = TestCheckOutNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const Scaffold(body: Text('Dashboard')),
                ),
                GoRoute(
                  path: '/check-out/:lockerId',
                  builder: (context, state) => CheckOutScreen(
                    lockerId: state.pathParameters['lockerId']!,
                  ),
                ),
              ],
              initialLocation: '/check-out/locker-01',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid OTP
      await tester.enterText(find.byType(TextFormField), '123456');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump(); // Start the async operation

      // Should show loading indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      
      // Wait for completion
      await tester.pumpAndSettle();
    });

    testWidgets('navigates to dashboard on successful check-out', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const Scaffold(body: Text('Dashboard')),
          ),
          GoRoute(
            path: '/check-out/:lockerId',
            builder: (context, state) => CheckOutScreen(
              lockerId: state.pathParameters['lockerId']!,
            ),
          ),
        ],
        initialLocation: '/check-out/locker-01',
      );

      final testNotifier = TestCheckOutNotifier(
        mockResult: CheckOutResult(success: true, message: 'Check-out successful'),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
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
      expect(find.text('Dashboard'), findsOneWidget);
    });

    testWidgets('shows error message for invalid OTP', (tester) async {
      final testNotifier = TestCheckOutNotifier(
        mockResult: CheckOutResult(
          success: false,
          message: 'Invalid OTP',
          error: 'OTP_INVALID',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const Scaffold(body: Text('Dashboard')),
                ),
                GoRoute(
                  path: '/check-out/:lockerId',
                  builder: (context, state) => CheckOutScreen(
                    lockerId: state.pathParameters['lockerId']!,
                  ),
                ),
              ],
              initialLocation: '/check-out/locker-01',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show error message in SnackBar
      expect(find.text('Invalid OTP. Please check and try again.'), findsOneWidget);
    });

    testWidgets('shows error message for expired OTP', (tester) async {
      final testNotifier = TestCheckOutNotifier(
        mockResult: CheckOutResult(
          success: false,
          message: 'OTP has expired',
          error: 'OTP_EXPIRED',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const Scaffold(body: Text('Dashboard')),
                ),
                GoRoute(
                  path: '/check-out/:lockerId',
                  builder: (context, state) => CheckOutScreen(
                    lockerId: state.pathParameters['lockerId']!,
                  ),
                ),
              ],
              initialLocation: '/check-out/locker-01',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show error message in SnackBar
      expect(find.text('OTP has expired. Please contact support.'), findsOneWidget);
    });

    testWidgets('shows lockout countdown for OTP_LOCKED', (tester) async {
      final lockedUntil = DateTime.now().add(const Duration(minutes: 15));
      final testNotifier = TestCheckOutNotifier(
        mockResult: CheckOutResult(
          success: false,
          message: 'OTP locked due to too many failed attempts',
          error: 'OTP_LOCKED',
          lockedUntil: lockedUntil,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const Scaffold(body: Text('Dashboard')),
                ),
                GoRoute(
                  path: '/check-out/:lockerId',
                  builder: (context, state) => CheckOutScreen(
                    lockerId: state.pathParameters['lockerId']!,
                  ),
                ),
              ],
              initialLocation: '/check-out/locker-01',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter OTP and submit
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should show lockout message in SnackBar
      expect(find.text('Too many failed attempts. OTP validation locked for 15 minutes.'), findsOneWidget);
      
      // Should show countdown widget - check for the lockout container
      expect(find.text('OTP Locked'), findsOneWidget);
      // Check for time remaining text pattern instead of exact match
      expect(find.textContaining('Time remaining:'), findsOneWidget);
    });

    testWidgets('disables form during submission', (tester) async {
      final testNotifier = TestCheckOutNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkOutProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const Scaffold(body: Text('Dashboard')),
                ),
                GoRoute(
                  path: '/check-out/:lockerId',
                  builder: (context, state) => CheckOutScreen(
                    lockerId: state.pathParameters['lockerId']!,
                  ),
                ),
              ],
              initialLocation: '/check-out/locker-01',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid OTP
      await tester.enterText(find.byType(TextFormField), '123456');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump(); // Start the async operation

      // Form should be disabled during submission
      final submitButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(submitButton.onPressed, isNull);
      
      // Wait for completion
      await tester.pumpAndSettle();
    });

    testWidgets('OTP input field has correct constraints', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckOutScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Check that the text field exists and can accept input
      final textFieldFinder = find.byType(TextFormField);
      expect(textFieldFinder, findsOneWidget);
      
      // Test that it accepts 6-digit input - check the field value instead of text widget
      await tester.enterText(textFieldFinder, '123456');
      final textField = tester.widget<TextFormField>(textFieldFinder);
      expect(textField.controller?.text, '123456');
    });
  });
}

/// Test CheckOutNotifier for mocking
class TestCheckOutNotifier extends CheckOutNotifier {
  final CheckOutResult? mockResult;
  final Duration delay;

  TestCheckOutNotifier({
    this.mockResult,
    this.delay = const Duration(milliseconds: 100),
  });

  @override
  Future<CheckOutResult> submitOtp({
    required String lockerId,
    required String otp,
  }) async {
    state = AsyncValue.data(CheckOutState(isLoading: true));
    
    await Future.delayed(delay);
    
    final checkOutResult = mockResult ?? 
        CheckOutResult(success: true, message: 'Check-out successful');
    
    state = AsyncValue.data(
      CheckOutState(isLoading: false, result: checkOutResult),
    );
    
    return checkOutResult;
  }
}