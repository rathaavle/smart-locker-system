#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <ESP8266WiFi.h>

class WiFiManager {
public:
  void connect();
  bool isConnected();
  void reconnectIfNeeded();
private:
  unsigned long _lastRetryMs = 0;
};

#endif // WIFI_MANAGER_H
