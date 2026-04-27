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

    testWidgets('accepts valid email format', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter valid email
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      await tester.tap(find.text('Submit'));
      await tester.pumpAndSettle();

      // Should not show validation error
      expect(find.text('Please enter a valid email address'), findsNothing);
      expect(find.text('Please enter your email'), findsNothing);
    });

    testWidgets('shows loading state during submission', (tester) async {
      // Create a mock notifier that delays
      final mockNotifier = MockCheckInNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
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
      
      // Submit button should be disabled
      final submitButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit').first,
      );
      expect(submitButton.onPressed, isNull);
    });

    testWidgets('navigates to /otp-sent on successful check-in', (tester) async {
      String? navigatedRoute;
      
      final router = GoRouter(
        initialLocation: '/check-in/locker-01',
        routes: [
          GoRoute(
            path: '/check-in/:lockerId',
            builder: (context, state) {
              final lockerId = state.pathParameters['lockerId']!;
              return CheckInScreen(lockerId: lockerId);
            },
          ),
          GoRoute(
            path: '/otp-sent',
            builder: (context, state) {
              navigatedRoute = '/otp-sent';
              return const Scaffold(body: Text('OTP Sent'));
            },
          ),
        ],
      );

      final mockNotifier = MockCheckInNotifier(
        result: CheckInResult(success: true, message: 'Success'),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
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

      // Should navigate to /otp-sent
      expect(navigatedRoute, '/otp-sent');
      expect(find.text('OTP Sent'), findsOneWidget);
    });

    testWidgets('navigates to /error on LOCKER_NOT_AVAILABLE error', (tester) async {
      String? navigatedRoute;
      String? errorMessage;
      
      final router = GoRouter(
        initialLocation: '/check-in/locker-01',
        routes: [
          GoRoute(
            path: '/check-in/:lockerId',
            builder: (context, state) {
              final lockerId = state.pathParameters['lockerId']!;
              return CheckInScreen(lockerId: lockerId);
            },
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              navigatedRoute = '/error';
              errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final mockNotifier = MockCheckInNotifier(
        result: CheckInResult(
          success: false,
          message: 'Locker not available',
          error: 'LOCKER_NOT_AVAILABLE',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
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

      // Should navigate to /error with appropriate message
      expect(navigatedRoute, '/error');
      expect(errorMessage, contains('not available'));
    });

    testWidgets('navigates to /error on LOCKER_OFFLINE error', (tester) async {
      String? errorMessage;
      
      final router = GoRouter(
        initialLocation: '/check-in/locker-01',
        routes: [
          GoRoute(
            path: '/check-in/:lockerId',
            builder: (context, state) {
              final lockerId = state.pathParameters['lockerId']!;
              return CheckInScreen(lockerId: lockerId);
            },
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final mockNotifier = MockCheckInNotifier(
        result: CheckInResult(
          success: false,
          message: 'Locker offline',
          error: 'LOCKER_OFFLINE',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
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

      // Should show offline error message
      expect(errorMessage, contains('offline'));
    });

    testWidgets('navigates to /error on EMAIL_DELIVERY_FAILED error', (tester) async {
      String? errorMessage;
      
      final router = GoRouter(
        initialLocation: '/check-in/locker-01',
        routes: [
          GoRoute(
            path: '/check-in/:lockerId',
            builder: (context, state) {
              final lockerId = state.pathParameters['lockerId']!;
              return CheckInScreen(lockerId: lockerId);
            },
          ),
          GoRoute(
            path: '/error',
            builder: (context, state) {
              errorMessage = state.uri.queryParameters['message'];
              return Scaffold(body: Text(errorMessage ?? 'Error'));
            },
          ),
        ],
      );

      final mockNotifier = MockCheckInNotifier(
        result: CheckInResult(
          success: false,
          message: 'Email delivery failed',
          error: 'EMAIL_DELIVERY_FAILED',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
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

      // Should show email delivery error message
      expect(errorMessage, contains('Failed to send OTP email'));
    });

    testWidgets('disables form during submission', (tester) async {
      final mockNotifier = MockCheckInNotifier();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            checkInProvider.overrideWith(() => mockNotifier),
          ],
          child: MaterialApp(
            home: const CheckInScreen(lockerId: 'locker-01'),
          ),
        ),
      );

      // Enter valid email
      await tester.enterText(find.byType(TextFormField), 'user@example.com');
      
      // Tap submit
      await tester.tap(find.text('Submit'));
      await tester.pump();

      // Email field should be disabled
      final textField = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(textField.enabled, false);
    });
  });
}

/// Mock CheckInNotifier for testing
class MockCheckInNotifier extends AutoDisposeAsyncNotifier<CheckInState> {
  final CheckInResult? result;
  final Duration delay;

  MockCheckInNotifier({
    this.result,
    this.delay = const Duration(milliseconds: 100),
  });

  @override
  Future<CheckInState> build() async {
    return CheckInState();
  }

  @override
  Future<CheckInResult> initiateCheckIn({
    required String lockerId,
    required String email,
  }) async {
    state = AsyncValue.data(CheckInState(isLoading: true));
    
    await Future.delayed(delay);
    
    final checkInResult = result ?? 
        CheckInResult(success: true, message: 'Success');
    
    state = AsyncValue.data(
      CheckInState(isLoading: false, result: checkInResult),
    );
    
    return checkInResult;
  }

  @override
  void reset() {
    state = AsyncValue.data(CheckInState());
  }
}
