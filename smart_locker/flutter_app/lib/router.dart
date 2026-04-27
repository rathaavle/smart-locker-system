import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/dashboard_screen.dart';
import 'screens/check_in_screen.dart';
import 'screens/check_out_screen.dart';
import 'screens/otp_sent_screen.dart';
import 'screens/error_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        name: 'dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/check-in/:lockerId',
        name: 'check-in',
        builder: (context, state) {
          final lockerId = state.pathParameters['lockerId']!;
          return CheckInScreen(lockerId: lockerId);
        },
      ),
      GoRoute(
        path: '/check-out/:lockerId',
        name: 'check-out',
        builder: (context, state) {
          final lockerId = state.pathParameters['lockerId']!;
          return CheckOutScreen(lockerId: lockerId);
        },
      ),
      GoRoute(
        path: '/otp-sent',
        name: 'otp-sent',
        builder: (context, state) => const OtpSentScreen(),
      ),
      GoRoute(
        path: '/error',
        name: 'error',
        builder: (context, state) {
          final message = state.uri.queryParameters['message'] ?? 
              'An error occurred';
          return ErrorScreen(message: message);
        },
      ),
    ],
    errorBuilder: (context, state) => ErrorScreen(
      message: 'Page not found: ${state.uri.path}',
    ),
  );
});
