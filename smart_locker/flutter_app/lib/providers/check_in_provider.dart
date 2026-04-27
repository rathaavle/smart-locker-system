import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Result of a check-in operation
class CheckInResult {
  final bool success;
  final String message;
  final String? error;

  CheckInResult({
    required this.success,
    required this.message,
    this.error,
  });

  factory CheckInResult.fromMap(Map<String, dynamic> data) {
    return CheckInResult(
      success: data['success'] as bool? ?? false,
      message: data['message'] as String? ?? '',
      error: data['error'] as String?,
    );
  }
}

/// State for check-in operations
class CheckInState {
  final bool isLoading;
  final CheckInResult? result;
  final String? error;

  CheckInState({
    this.isLoading = false,
    this.result,
    this.error,
  });

  CheckInState copyWith({
    bool? isLoading,
    CheckInResult? result,
    String? error,
  }) {
    return CheckInState(
      isLoading: isLoading ?? this.isLoading,
      result: result ?? this.result,
      error: error ?? this.error,
    );
  }
}

/// AsyncNotifierProvider for check-in operations
/// Validates: Requirements 1.6, 10.2
class CheckInNotifier extends AutoDisposeAsyncNotifier<CheckInState> {
  @override
  Future<CheckInState> build() async {
    return CheckInState();
  }

  /// Initiate check-in for a locker
  /// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 9.3
  Future<CheckInResult> initiateCheckIn({
    required String lockerId,
    required String email,
  }) async {
    state = AsyncValue.data(CheckInState(isLoading: true));

    try {
      final functions = FirebaseFunctions.instance;
      final callable = functions.httpsCallable('initiateCheckIn');
      
      final result = await callable.call({
        'lockerId': lockerId,
        'email': email,
      });

      final checkInResult = CheckInResult.fromMap(
        result.data as Map<String, dynamic>,
      );

      state = AsyncValue.data(
        CheckInState(isLoading: false, result: checkInResult),
      );

      return checkInResult;
    } on FirebaseFunctionsException catch (e) {
      final errorMessage = e.message ?? 'Check-in failed';
      state = AsyncValue.data(
        CheckInState(isLoading: false, error: errorMessage),
      );
      
      return CheckInResult(
        success: false,
        message: errorMessage,
        error: e.code,
      );
    } catch (e) {
      final errorMessage = 'Unexpected error: $e';
      state = AsyncValue.data(
        CheckInState(isLoading: false, error: errorMessage),
      );
      
      return CheckInResult(
        success: false,
        message: errorMessage,
        error: 'UNKNOWN_ERROR',
      );
    }
  }

  /// Reset the check-in state
  void reset() {
    state = AsyncValue.data(CheckInState());
  }
}

final checkInProvider = 
    AutoDisposeAsyncNotifierProvider<CheckInNotifier, CheckInState>(
  CheckInNotifier.new,
);
