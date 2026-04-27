import 'package:flutter/material.dart';

// TODO: Full implementation in Task 16
class CheckOutScreen extends StatelessWidget {
  final String lockerId;

  const CheckOutScreen({
    super.key,
    required this.lockerId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Check Out'),
      ),
      body: Center(
        child: Text('Check Out for Locker: $lockerId'),
      ),
    );
  }
}
