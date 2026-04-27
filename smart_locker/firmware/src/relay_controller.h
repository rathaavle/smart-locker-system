#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include <Arduino.h>

class RelayController {
public:
  explicit RelayController(uint8_t pin);
  void activate(unsigned long durationMs);
  void update(); // Call in loop to handle deactivation
private:
  uint8_t _pin;
  unsigned long _deactivateAt;
  bool _isActive;
};

#endif // RELAY_CONTROLLER_H
