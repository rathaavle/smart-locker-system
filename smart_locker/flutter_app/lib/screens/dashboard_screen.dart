import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/locker.dart';
import '../providers/lockers_provider.dart';
import '../widgets/locker_card.dart';

/// Dashboard screen displaying all lockers with real-time state updates
/// Requirements: 2.1, 9.1, 9.2, 10.1, 10.4
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lockersAsync = ref.watch(lockersStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Locker Dashboard'),
        elevation: 2,
      ),
      body: lockersAsync.when(
        data: (lockers) {
          if (lockers.isEmpty) {
            return const Center(
              child: Text(
                'No lockers available',
                style: TextStyle(fontSize: 18, color: Colors.grey),
              ),
            );
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.0,
            ),
            itemCount: lockers.length,
            itemBuilder: (context, index) {
              final locker = lockers[index];
              return LockerCard(
                locker: locker,
                onTap: () => _handleLockerTap(context, locker),
              );
            },
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(),
        ),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'Error loading lockers',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                style: const TextStyle(color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Handle locker tap based on state and online status
  /// - EMPTY + online → navigate to check-in
  /// - FILLED + online → navigate to check-out
  /// - OPEN, UNLOCKING, or offline → non-selectable (no action)
  void _handleLockerTap(BuildContext context, Locker locker) {
    // Non-selectable states: OPEN, UNLOCKING, or offline
    if (locker.state == LockerState.open ||
        locker.state == LockerState.unlocking ||
        !locker.isOnline) {
      return;
    }

    // Navigate based on state
    if (locker.state == LockerState.empty) {
      context.push('/check-in/${locker.lockerId}');
    } else if (locker.state == LockerState.filled) {
      context.push('/check-out/${locker.lockerId}');
    }
  }
}
