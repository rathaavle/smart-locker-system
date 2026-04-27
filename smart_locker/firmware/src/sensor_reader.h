#ifndef SENSOR_READER_H
#define SENSOR_READER_H

#include <Arduino.h>
#include "firebase_client.h"

class SensorReader {
public:
  explicit SensorReader(uint8_t pin);
  DoorStatus read();
  bool hasChanged();
private:
  uint8_t _pin;
  DoorStatus _lastStatus;
};

#endif // SENSOR_READER_H
