import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/locker.dart';
import 'lockers_provider.dart';

/// Provider that returns a specific locker by ID
/// This is a derived provider from lockersStreamProvider
/// Validates: Requirements 1.6, 10.2
final lockerDetailProvider = Provider.family<AsyncValue<Locker?>, String>(
  (ref, lockerId) {
    final lockersAsync = ref.watch(lockersStreamProvider);
    
    return lockersAsync.whenData((lockers) {
      try {
        return lockers.firstWhere(
          (locker) => locker.lockerId == lockerId,
        );
      } catch (e) {
        // Locker not found
        return null;
      }
    });
  },
);
