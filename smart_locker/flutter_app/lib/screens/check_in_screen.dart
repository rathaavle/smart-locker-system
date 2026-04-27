import 'package:flutter/material.dart';

// TODO: Full implementation in Task 15
class CheckInScreen extends StatelessWidget {
  final String lockerId;

  const CheckInScreen({
    super.key,
    required this.lockerId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Check In'),
      ),
      body: Center(
        child: Text('Check In for Locker: $lockerId'),
      ),
    );
  }
}
