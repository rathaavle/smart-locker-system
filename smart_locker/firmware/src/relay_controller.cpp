#include "relay_controller.h"

RelayController::RelayController(uint8_t pin) : _pin(pin) {
  pinMode(_pin, OUTPUT);
  digitalWrite(_pin, LOW);
}

void RelayController::activate(unsigned long durationMs) {
  // TODO: implement in Task 11.1
}
