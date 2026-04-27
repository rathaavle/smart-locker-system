import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Result of a check-out operation
class CheckOutResult {
  final bool success;
  final String message;
  final String? error;
  final DateTime? lockedUntil;

  CheckOutResult({
    required this.success,
    required this.message,
    this.error,
    this.lockedUntil,
  });

  factory CheckOutResult.fromMap(Map<String, dynamic> data) {
    DateTime? lockedUntil;
    if (data['lockedUntil'] != null) {
      // Handle both timestamp and ISO string formats
      final lockedUntilValue = data['lockedUntil'];
      if (lockedUntilValue is int) {
        lockedUntil = DateTime.fromMillisecondsSinceEpoch(lockedUntilValue);
      } else if (lockedUntilValue is String) {
        lockedUntil = DateTime.parse(lockedUntilValue);
      }
    }

    return CheckOutResult(
      success: data['success'] as bool? ?? false,
      message: data['message'] as String? ?? '',
      error: data['error'] as String?,
      lockedUntil: lockedUntil,
    );
  }
}

/// State for check-out operations
class CheckOutState {
  final bool isLoading;
  final CheckOutResult? result;
  final String? error;

  CheckOutState({
    this.isLoading = false,
    this.result,
    this.error,
  });

  CheckOutState copyWith({
    bool? isLoading,
    CheckOutResult? result,
    String? error,
  }) {
    return CheckOutState(
      isLoading: isLoading ?? this.isLoading,
      result: result ?? this.result,
      error: error ?? this.error,
    );
  }
}

/// AsyncNotifierProvider for check-out operations
/// Validates: Requirements 1.6, 10.2
class CheckOutNotifier extends AutoDisposeAsyncNotifier<CheckOutState> {
  @override
  Future<CheckOutState> build() async {
    return CheckOutState();
  }

  /// Submit OTP for check-out
  /// Validates: Requirements 3.1, 3.2, 3.3, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3
  Future<CheckOutResult> submitOtp({
    required String lockerId,
    required String otp,
  }) async {
    state = AsyncValue.data(CheckOutState(isLoading: true));

    try {
      final functions = FirebaseFunctions.instance;
      final callable = functions.httpsCallable('submitOtp');
      
      final result = await callable.call({
        'lockerId': lockerId,
        'otp': otp,
      });

      final checkOutResult = CheckOutResult.fromMap(
        result.data as Map<String, dynamic>,
      );

      state = AsyncValue.data(
        CheckOutState(isLoading: false, result: checkOutResult),
      );

      return checkOutResult;
    } on FirebaseFunctionsException catch (e) {
      final errorMessage = e.message ?? 'Check-out failed';
      state = AsyncValue.data(
        CheckOutState(isLoading: false, error: errorMessage),
      );
      
      return CheckOutResult(
        success: false,
        message: errorMessage,
        error: e.code,
      );
    } catch (e) {
      final errorMessage = 'Unexpected error: $e';
      state = AsyncValue.data(
        CheckOutState(isLoading: false, error: errorMessage),
      );
      
      return CheckOutResult(
        success: false,
        message: errorMessage,
        error: 'UNKNOWN_ERROR',
      );
    }
  }

  /// Reset the check-out state
  void reset() {
    state = AsyncValue.data(CheckOutState());
  }
}

final checkOutProvider = 
    AutoDisposeAsyncNotifierProvider<CheckOutNotifier, CheckOutState>(
  CheckOutNotifier.new,
);
