#ifndef FIREBASE_CLIENT_H
#define FIREBASE_CLIENT_H

#include <Arduino.h>
#include <FirebaseESP8266.h>

enum class DoorStatus { OPEN, CLOSED };

class FirebaseClient {
public:
  void begin();
  void writeHeartbeat();
  void writeDoorStatus(DoorStatus status);
  void clearCommand();
  long readCommandAt();
  bool hasPendingUnlock();
  
private:
  FirebaseData _firebaseData;
  String _devicePath;
  unsigned long _lastHeartbeatMs = 0;
};

#endif // FIREBASE_CLIENT_H
