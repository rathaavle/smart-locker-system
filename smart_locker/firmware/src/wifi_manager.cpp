#include "wifi_manager.h"
#include "config.h"
#include <Arduino.h>

void WiFiManager::connect() {
  // TODO: implement in Task 10.1
}

bool WiFiManager::isConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void WiFiManager::reconnectIfNeeded() {
  // TODO: implement in Task 10.1
}
