import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/check_out_provider.dart';
import 'dart:async';

/// Check-Out Screen
/// Validates: Requirements 3.1, 7.2, 7.3, 7.4
class CheckOutScreen extends ConsumerStatefulWidget {
  final String lockerId;

  const CheckOutScreen({
    super.key,
    required this.lockerId,
  });

  @override
  ConsumerState<CheckOutScreen> createState() => _CheckOutScreenState();
}

class _CheckOutScreenState extends ConsumerState<CheckOutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  bool _isSubmitting = false;
  DateTime? _lockedUntil;
  Timer? _countdownTimer;
  Duration? _remainingTime;

  @override
  void dispose() {
    _otpController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  /// OTP validation - must be exactly 6 digits
  String? _validateOtp(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter the OTP';
    }
    
    // Must be exactly 6 digits
    final otpRegex = RegExp(r'^\d{6}$');
    if (!otpRegex.hasMatch(value)) {
      return 'OTP must be exactly 6 digits';
    }
    
    return null;
  }

  /// Start countdown timer for OTP lockout
  void _startCountdownTimer(DateTime lockedUntil) {
    setState(() {
      _lockedUntil = lockedUntil;
    });

    _countdownTimer?.cancel();
    _updateRemainingTime();

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _updateRemainingTime();
      
      if (_remainingTime != null && _remainingTime!.inSeconds <= 0) {
        timer.cancel();
        setState(() {
          _lockedUntil = null;
          _remainingTime = null;
        });
      }
    });
  }

  /// Update remaining time until unlock
  void _updateRemainingTime() {
    if (_lockedUntil == null) {
      setState(() {
        _remainingTime = null;
      });
      return;
    }

    final now = DateTime.now();
    final difference = _lockedUntil!.difference(now);

    setState(() {
      _remainingTime = difference.isNegative ? Duration.zero : difference;
    });
  }

  /// Format duration as MM:SS
  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  /// Handle form submission
  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Check if OTP is locked
    if (_lockedUntil != null && DateTime.now().isBefore(_lockedUntil!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'OTP validation is locked. Please wait ${_formatDuration(_remainingTime!)}',
          ),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final checkOutNotifier = ref.read(checkOutProvider.notifier);
      final result = await checkOutNotifier.submitOtp(
        lockerId: widget.lockerId,
        otp: _otpController.text.trim(),
      );

      if (!mounted) return;

      if (result.success) {
        // Success → navigate back to Dashboard
        context.go('/');
        
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Check-out successful! Locker unlocked.'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        // Error handling based on error codes
        final errorCode = result.error ?? 'UNKNOWN_ERROR';

        switch (errorCode) {
          case 'OTP_INVALID':
            // Show error message and allow retry
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Invalid OTP. Please check and try again.'),
                backgroundColor: Colors.red,
              ),
            );
            // Clear the OTP field for retry
            _otpController.clear();
            break;

          case 'OTP_EXPIRED':
            // Show expired message
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('OTP has expired. Please contact support.'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 5),
              ),
            );
            break;

          case 'OTP_LOCKED':
            // Show countdown timer
            if (result.lockedUntil != null) {
              _startCountdownTimer(result.lockedUntil!);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Too many failed attempts. OTP validation locked for 15 minutes.',
                  ),
                  backgroundColor: Colors.red,
                  duration: const Duration(seconds: 5),
                ),
              );
            }
            break;

          case 'OTP_USED':
            // OTP already used
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('This OTP has already been used.'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 5),
              ),
            );
            break;

          default:
            // Generic error
            final errorMessage = result.message.isNotEmpty 
                ? result.message 
                : 'An unexpected error occurred. Please try again.';
            
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(errorMessage),
                backgroundColor: Colors.red,
              ),
            );
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLocked = _lockedUntil != null && 
                     DateTime.now().isBefore(_lockedUntil!);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Check Out'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Text(
                'Locker ${widget.lockerId}',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'Enter the 6-digit OTP sent to your email',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              
              // OTP Input Field
              TextFormField(
                controller: _otpController,
                decoration: const InputDecoration(
                  labelText: 'OTP',
                  hintText: '123456',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                ],
                validator: _validateOtp,
                enabled: !_isSubmitting && !isLocked,
              ),
              
              // Lockout countdown display
              if (isLocked && _remainingTime != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.timer, color: Colors.orange),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'OTP Locked',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.orange,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Time remaining: ${_formatDuration(_remainingTime!)}',
                              style: const TextStyle(fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              
              const SizedBox(height: 24),
              
              // Submit Button
              ElevatedButton(
                onPressed: (_isSubmitting || isLocked) ? null : _handleSubmit,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Submit',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
