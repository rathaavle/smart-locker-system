import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/locker.dart';

/// StreamProvider that provides real-time stream of all lockers from Firestore
/// Validates: Requirements 1.6, 10.2
final lockersStreamProvider = StreamProvider<List<Locker>>((ref) {
  final firestore = FirebaseFirestore.instance;
  
  return firestore
      .collection('lockers')
      .snapshots()
      .map((snapshot) {
    return snapshot.docs
        .map((doc) => Locker.fromFirestore(doc))
        .toList();
  });
});

/// Provider that filters lockers to only show selectable ones (EMPTY and online)
/// Validates: Requirements 2.1, 8.2, 9.1, 10.4
final selectableLockersProvider = Provider<AsyncValue<List<Locker>>>((ref) {
  final lockersAsync = ref.watch(lockersStreamProvider);
  
  return lockersAsync.whenData((lockers) {
    return lockers.where((locker) {
      return locker.state == LockerState.empty && locker.isOnline;
    }).toList();
  });
});
