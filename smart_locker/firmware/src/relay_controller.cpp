#include "relay_controller.h"

RelayController::RelayController(uint8_t pin) 
  : _pin(pin), _deactivateAt(0), _isActive(false) {
  pinMode(_pin, OUTPUT);
  digitalWrite(_pin, LOW);
}

void RelayController::activate(unsigned long durationMs) {
  // Validate duration is within acceptable range (3000-5000 ms)
  // Requirements: 2.8, 3.4
  if (durationMs < 3000) {
    durationMs = 3000;
  } else if (durationMs > 5000) {
    durationMs = 5000;
  }
  
  // Activate relay
  digitalWrite(_pin, HIGH);
  _isActive = true;
  _deactivateAt = millis() + durationMs;
  
  Serial.print("[RelayController] Relay activated for ");
  Serial.print(durationMs);
  Serial.println(" ms");
}

void RelayController::update() {
  // Check if relay should be deactivated
  if (_isActive && millis() >= _deactivateAt) {
    digitalWrite(_pin, LOW);
    _isActive = false;
    Serial.println("[RelayController] Relay deactivated");
  }
}
