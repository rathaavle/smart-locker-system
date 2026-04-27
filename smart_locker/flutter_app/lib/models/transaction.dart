import 'package:cloud_firestore/cloud_firestore.dart';

enum TransactionStatus { active, completed, manualReview }

// TODO: implement full model in Task 13.1
class LockerTransaction {
  final String transactionId;
  final String lockerId;
  final String userEmail;
  final String? otpHash;
  final DateTime otpExpiresAt;
  final DateTime checkInAt;
  final DateTime? checkOutAt;
  final TransactionStatus status;
  final DateTime? openAlertSentAt;

  const LockerTransaction({
    required this.transactionId,
    required this.lockerId,
    required this.userEmail,
    this.otpHash,
    required this.otpExpiresAt,
    required this.checkInAt,
    this.checkOutAt,
    required this.status,
    this.openAlertSentAt,
  });

  factory LockerTransaction.fromFirestore(DocumentSnapshot doc) {
    // TODO: implement in Task 13.1
    throw UnimplementedError();
  }

  Map<String, dynamic> toMap() {
    // TODO: implement in Task 13.1
    throw UnimplementedError();
  }
}
