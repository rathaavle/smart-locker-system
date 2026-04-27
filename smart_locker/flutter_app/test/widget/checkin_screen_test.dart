import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_locker_app/screens/check_in_screen.dart';
import 'package:smart_locker_app/providers/check_in_provider.dart';

// Requirements: 2.2, 2.5

void main() {
  group('CheckInScreen Widget Tests', () {
    testWidgets('renders check-in form with email input', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      expect(find.text('Locker locker-01'), findsOneWidget);
      expect(find.text('Enter your email address to receive an OTP for check-out'), findsOneWidget);
      expect(find.byType(TextFormField), findsOneWidget);
      expect(find.text('Email Address'), findsOneWidget);
      expect(find.text('Submit'), findsOneWidget);
    });

    testWidgets('validates empty email input', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Tap submit without entering email
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter your email'), findsOneWidget);
    });

    testWidgets('validates invalid email format', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter invalid email
      await tester.enterText(find.byType(TextFormField), 'invalid-email');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a valid email address'), findsOneWidget);
    });

    testWidgets('shows loading state during submission', (tester) async {
      // Create a test notifier that delays
      final testNotifier = TestCheckInNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
                ),
                GoRoute(
                  path: '/otp-sent',
                  builder: (context, state) => const Scaffold(body: Text('OTP Sent')),
                ),
              ],
            ),
          ),
        ),
      );

      // Enter valid email
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump(); // Start the async operation

      // Should show loading indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      
      // Wait for completion
      await tester.pumpAndSettle();
    });

    testWidgets('navigates to OTP sent screen on success', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
          ),
          GoRoute(
            path: '/otp-sent',
            builder: (context, state) => const Scaffold(body: Text('OTP Sent')),
          ),
        ],
      );

      final testNotifier = TestCheckInNotifier(
        mockResult: CheckInResult(success: true, message: 'Success'),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid email and submit
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should navigate to OTP sent screen
      expect(find.text('OTP Sent'), findsOneWidget);
    });

    testWidgets('shows error message for LOCKER_NOT_AVAILABLE', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              final errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final testNotifier = TestCheckInNotifier(
        mockResult: CheckInResult(
          success: false,
          message: 'Locker not available',
          error: 'LOCKER_NOT_AVAILABLE',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid email and submit
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should navigate to error screen with proper message
      expect(find.text('This locker is not available. Please select another locker.'), findsOneWidget);
    });

    testWidgets('shows error message for LOCKER_OFFLINE', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              final errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final testNotifier = TestCheckInNotifier(
        mockResult: CheckInResult(
          success: false,
          message: 'Locker offline',
          error: 'LOCKER_OFFLINE',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid email and submit
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should navigate to error screen with proper message
      expect(find.text('This locker is currently offline. Please try another locker.'), findsOneWidget);
    });

    testWidgets('shows error message for EMAIL_DELIVERY_FAILED', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              final errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final testNotifier = TestCheckInNotifier(
        mockResult: CheckInResult(
          success: false,
          message: 'Email delivery failed',
          error: 'EMAIL_DELIVERY_FAILED',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid email and submit
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should navigate to error screen with proper message
      expect(find.text('Failed to send OTP email. Please check your email address and try again.'), findsOneWidget);
    });

    testWidgets('disables form during submission', (tester) async {
      final testNotifier = TestCheckInNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => testNotifier),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) => const CheckInScreen(lockerId: 'locker-01'),
                ),
                GoRoute(
                  path: '/otp-sent',
                  builder: (context, state) => const Scaffold(body: Text('OTP Sent')),
                ),
              ],
            ),
          ),
        ),
      );

      // Enter valid email
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump(); // Start the async operation

      // Form should be disabled during submission
      final submitButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(submitButton.onPressed, isNull);
      
      // Wait for completion
      await tester.pumpAndSettle();
    });
  });
}

/// Test CheckInNotifier for mocking
class TestCheckInNotifier extends CheckInNotifier {
  final CheckInResult? mockResult;
  final Duration delay;

  TestCheckInNotifier({
    this.mockResult,
    this.delay = const Duration(milliseconds: 100),
  });

  @override
  Future<CheckInResult> initiateCheckIn({
    required String lockerId,
    required String email,
  }) async {
    state = AsyncValue.data(CheckInState(isLoading: true));
    
    await Future.delayed(delay);
    
    final checkInResult = mockResult ?? 
        CheckInResult(success: true, message: 'Success');
    
    state = AsyncValue.data(
      CheckInState(isLoading: false, result: checkInResult),
    );
    
    return checkInResult;
  }
}