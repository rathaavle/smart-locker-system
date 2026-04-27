#ifndef FIREBASE_CLIENT_H
#define FIREBASE_CLIENT_H

#include <Arduino.h>

enum class DoorStatus { OPEN, CLOSED };

class FirebaseClient {
public:
  void begin();
  void writeHeartbeat();
  void writeDoorStatus(DoorStatus status);
  void clearCommand();
  long readCommandAt();
  bool hasPendingUnlock();
};

#endif // FIREBASE_CLIENT_H
