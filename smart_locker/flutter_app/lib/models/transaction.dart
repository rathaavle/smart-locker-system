import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:equatable/equatable.dart';

enum TransactionStatus { active, completed, manualReview }

class LockerTransaction extends Equatable {
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
    final data = doc.data() as Map<String, dynamic>;
    
    return LockerTransaction(
      transactionId: data['transactionId'] as String,
      lockerId: data['lockerId'] as String,
      userEmail: data['userEmail'] as String,
      otpHash: data['otpHash'] as String?,
      otpExpiresAt: (data['otpExpiresAt'] as Timestamp).toDate(),
      checkInAt: (data['checkInAt'] as Timestamp).toDate(),
      checkOutAt: (data['checkOutAt'] as Timestamp?)?.toDate(),
      status: _parseTransactionStatus(data['status'] as String),
      openAlertSentAt: (data['openAlertSentAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'transactionId': transactionId,
      'lockerId': lockerId,
      'userEmail': userEmail,
      'otpHash': otpHash,
      'otpExpiresAt': Timestamp.fromDate(otpExpiresAt),
      'checkInAt': Timestamp.fromDate(checkInAt),
      'checkOutAt': checkOutAt != null 
          ? Timestamp.fromDate(checkOutAt!) 
          : null,
      'status': _transactionStatusToString(status),
      'openAlertSentAt': openAlertSentAt != null 
          ? Timestamp.fromDate(openAlertSentAt!) 
          : null,
    };
  }

  static TransactionStatus _parseTransactionStatus(String value) {
    switch (value.toUpperCase()) {
      case 'ACTIVE':
        return TransactionStatus.active;
      case 'COMPLETED':
        return TransactionStatus.completed;
      case 'MANUAL_REVIEW':
        return TransactionStatus.manualReview;
      default:
        throw ArgumentError('Invalid transaction status: $value');
    }
  }

  static String _transactionStatusToString(TransactionStatus status) {
    switch (status) {
      case TransactionStatus.active:
        return 'ACTIVE';
      case TransactionStatus.completed:
        return 'COMPLETED';
      case TransactionStatus.manualReview:
        return 'MANUAL_REVIEW';
    }
  }

  @override
  List<Object?> get props => [
        transactionId,
        lockerId,
        userEmail,
        otpHash,
        otpExpiresAt,
        checkInAt,
        checkOutAt,
        status,
        openAlertSentAt,
      ];
}
