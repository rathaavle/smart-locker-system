#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include <Arduino.h>

class RelayController {
public:
  explicit RelayController(uint8_t pin);
  void activate(unsigned long durationMs);
private:
  uint8_t _pin;
};

#endif // RELAY_CONTROLLER_H
