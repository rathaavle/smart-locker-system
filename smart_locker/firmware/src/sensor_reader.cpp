#include "sensor_reader.h"

SensorReader::SensorReader(uint8_t pin) : _pin(pin), _lastStatus(DoorStatus::CLOSED) {
  pinMode(_pin, INPUT_PULLUP);
}

DoorStatus SensorReader::read() {
  // TODO: implement in Task 11.2
  return DoorStatus::CLOSED;
}

bool SensorReader::hasChanged() {
  // TODO: implement in Task 11.2
  return false;
}
