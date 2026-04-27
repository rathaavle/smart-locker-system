#include "sensor_reader.h"

SensorReader::SensorReader(uint8_t pin) 
  : _pin(pin), _lastStatus(DoorStatus::CLOSED) {
  pinMode(_pin, INPUT_PULLUP);
  // Initialize with current reading
  _lastStatus = read();
}

DoorStatus SensorReader::read() {
  // Read sensor pin
  // Assuming magnetic sensor: LOW = door closed (magnet near sensor)
  //                          HIGH = door open (magnet away from sensor)
  // Requirements: 5.4
  int pinState = digitalRead(_pin);
  
  if (pinState == LOW) {
    return DoorStatus::CLOSED;
  } else {
    return DoorStatus::OPEN;
  }
}

bool SensorReader::hasChanged() {
  // Read current status and compare with last known status
  // Requirements: 5.4
  DoorStatus currentStatus = read();
  
  if (currentStatus != _lastStatus) {
    _lastStatus = currentStatus;
    return true;
  }
  
  return false;
}
