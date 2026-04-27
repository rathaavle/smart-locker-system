import 'package:cloud_firestore/cloud_firestore.dart';

enum LockerState { empty, open, filled, unlocking }
enum DoorStatus { open, closed }

// TODO: implement full model in Task 13.1
class Locker {
  final String lockerId;
  final LockerState state;
  final DoorStatus doorStatus;
  final bool isOnline;
  final DateTime? lastHeartbeat;
  final String? activeTransactionId;
  final int failedOtpAttempts;
  final DateTime? otpLockedUntil;

  const Locker({
    required this.lockerId,
    required this.state,
    required this.doorStatus,
    required this.isOnline,
    this.lastHeartbeat,
    this.activeTransactionId,
    this.failedOtpAttempts = 0,
    this.otpLockedUntil,
  });

  factory Locker.fromFirestore(DocumentSnapshot doc) {
    // TODO: implement in Task 13.1
    throw UnimplementedError();
  }

  Map<String, dynamic> toMap() {
    // TODO: implement in Task 13.1
    throw UnimplementedError();
  }
}
