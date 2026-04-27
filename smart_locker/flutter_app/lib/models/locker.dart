import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:equatable/equatable.dart';

enum LockerState { empty, open, filled, unlocking }

enum DoorStatus { open, closed }

class Locker extends Equatable {
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
    final data = doc.data() as Map<String, dynamic>;
    
    return Locker(
      lockerId: data['lockerId'] as String,
      state: _parseLockerState(data['state'] as String),
      doorStatus: _parseDoorStatus(data['doorStatus'] as String),
      isOnline: data['isOnline'] as bool,
      lastHeartbeat: (data['lastHeartbeat'] as Timestamp?)?.toDate(),
      activeTransactionId: data['activeTransactionId'] as String?,
      failedOtpAttempts: data['failedOtpAttempts'] as int? ?? 0,
      otpLockedUntil: (data['otpLockedUntil'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'lockerId': lockerId,
      'state': _lockerStateToString(state),
      'doorStatus': _doorStatusToString(doorStatus),
      'isOnline': isOnline,
      'lastHeartbeat': lastHeartbeat != null 
          ? Timestamp.fromDate(lastHeartbeat!) 
          : null,
      'activeTransactionId': activeTransactionId,
      'failedOtpAttempts': failedOtpAttempts,
      'otpLockedUntil': otpLockedUntil != null 
          ? Timestamp.fromDate(otpLockedUntil!) 
          : null,
    };
  }

  static LockerState _parseLockerState(String value) {
    switch (value.toUpperCase()) {
      case 'EMPTY':
        return LockerState.empty;
      case 'OPEN':
        return LockerState.open;
      case 'FILLED':
        return LockerState.filled;
      case 'UNLOCKING':
        return LockerState.unlocking;
      default:
        throw ArgumentError('Invalid locker state: $value');
    }
  }

  static DoorStatus _parseDoorStatus(String value) {
    switch (value.toUpperCase()) {
      case 'OPEN':
        return DoorStatus.open;
      case 'CLOSED':
        return DoorStatus.closed;
      default:
        throw ArgumentError('Invalid door status: $value');
    }
  }

  static String _lockerStateToString(LockerState state) {
    switch (state) {
      case LockerState.empty:
        return 'EMPTY';
      case LockerState.open:
        return 'OPEN';
      case LockerState.filled:
        return 'FILLED';
      case LockerState.unlocking:
        return 'UNLOCKING';
    }
  }

  static String _doorStatusToString(DoorStatus status) {
    switch (status) {
      case DoorStatus.open:
        return 'OPEN';
      case DoorStatus.closed:
        return 'CLOSED';
    }
  }

  @override
  List<Object?> get props => [
        lockerId,
        state,
        doorStatus,
        isOnline,
        lastHeartbeat,
        activeTransactionId,
        failedOtpAttempts,
        otpLockedUntil,
      ];
}
