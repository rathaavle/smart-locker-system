import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/check_in_provider.dart';

/// Check-In Screen
/// Validates: Requirements 2.2, 2.5, 9.2
class CheckInScreen extends ConsumerStatefulWidget {
  final String lockerId;

  const CheckInScreen({
    super.key,
    required this.lockerId,
  });

  @override
  ConsumerState<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends ConsumerState<CheckInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  /// Email validation
  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter your email';
    }
    
    // Basic email format validation
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );
    
    if (!emailRegex.hasMatch(value)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  }

  /// Handle form submission
  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final checkInNotifier = ref.read(checkInProvider.notifier);
      final result = await checkInNotifier.initiateCheckIn(
        lockerId: widget.lockerId,
        email: _emailController.text.trim(),
      );

      if (!mounted) return;

      if (result.success) {
        // Success → navigate to /otp-sent
        context.go('/otp-sent');
      } else {
        // Error handling based on error codes
        final errorCode = result.error ?? 'UNKNOWN_ERROR';
        String errorMessage;

        switch (errorCode) {
          case 'LOCKER_NOT_AVAILABLE':
            errorMessage = 'This locker is not available. Please select another locker.';
            break;
          case 'LOCKER_OFFLINE':
            errorMessage = 'This locker is currently offline. Please try another locker.';
            break;
          case 'EMAIL_DELIVERY_FAILED':
            errorMessage = 'Failed to send OTP email. Please check your email address and try again.';
            break;
          case 'LOCKER_CONFLICT':
            errorMessage = 'This locker was just taken by another user. Please select another locker.';
            break;
          default:
            errorMessage = result.message.isNotEmpty 
                ? result.message 
                : 'An unexpected error occurred. Please try again.';
        }

        // Navigate to error screen with message
        context.go('/error?message=${Uri.encodeComponent(errorMessage)}');
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Check In'),
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
                'Enter your email address to receive an OTP for check-out',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  hintText: 'your.email@example.com',
                  prefixIcon: Icon(Icons.email),
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: _validateEmail,
                enabled: !_isSubmitting,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _handleSubmit,
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
