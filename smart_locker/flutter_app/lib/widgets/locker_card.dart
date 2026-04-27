import 'package:flutter/material.dart';
import '../models/locker.dart';

/// Locker card widget with visual state distinction
/// Requirements: 10.3
/// 
/// Visual states:
/// - EMPTY: green / available icon
/// - FILLED: red / filled icon
/// - OPEN: yellow / open icon
/// - UNLOCKING: blue / loading animation
/// - Offline: grey / offline icon
class LockerCard extends StatelessWidget {
  final Locker locker;
  final VoidCallback? onTap;

  const LockerCard({
    super.key,
    required this.locker,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final visualState = _getVisualState();
    final isSelectable = _isSelectable();

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: isSelectable ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            color: visualState.color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: visualState.color,
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon or loading indicator
              if (locker.state == LockerState.unlocking)
                SizedBox(
                  width: 48,
                  height: 48,
                  child: CircularProgressIndicator(
                    color: visualState.color,
                    strokeWidth: 3,
                  ),
                )
              else
                Icon(
                  visualState.icon,
                  size: 48,
                  color: visualState.color,
                ),
              const SizedBox(height: 12),
              
              // Locker ID
              Text(
                locker.lockerId,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: visualState.color,
                ),
              ),
              const SizedBox(height: 4),
              
              // State label
              Text(
                visualState.label,
                style: TextStyle(
                  fontSize: 14,
                  color: visualState.color.withOpacity(0.8),
                ),
              ),
              
              // Offline indicator
              if (!locker.isOnline)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'OFFLINE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Determine if the locker is selectable
  /// Only EMPTY+online and FILLED+online are selectable
  bool _isSelectable() {
    if (!locker.isOnline) return false;
    return locker.state == LockerState.empty || 
           locker.state == LockerState.filled;
  }

  /// Get visual state (color, icon, label) based on locker state and online status
  VisualState _getVisualState() {
    // Offline takes precedence
    if (!locker.isOnline) {
      return VisualState(
        color: Colors.grey,
        icon: Icons.cloud_off,
        label: 'Offline',
      );
    }

    // State-based visual mapping
    switch (locker.state) {
      case LockerState.empty:
        return VisualState(
          color: Colors.green,
          icon: Icons.check_circle_outline,
          label: 'Available',
        );
      case LockerState.filled:
        return VisualState(
          color: Colors.red,
          icon: Icons.inventory_2,
          label: 'Occupied',
        );
      case LockerState.open:
        return VisualState(
          color: Colors.orange,
          icon: Icons.lock_open,
          label: 'Open',
        );
      case LockerState.unlocking:
        return VisualState(
          color: Colors.blue,
          icon: Icons.hourglass_empty,
          label: 'Unlocking',
        );
    }
  }
}

/// Visual state data class
class VisualState {
  final Color color;
  final IconData icon;
  final String label;

  VisualState({
    required this.color,
    required this.icon,
    required this.label,
  });
}
