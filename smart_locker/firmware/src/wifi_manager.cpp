#include "wifi_manager.h"
#include "config.h"
#include <Arduino.h>

void WiFiManager::connect() {
  // Requirements 5.1: Connect to WiFi within 10 seconds
  // Requirements 5.5: Retry every 5 seconds if connection fails
  
  if (isConnected()) {
    Serial.println("WiFi already connected");
    return;
  }
  
  Serial.print("Connecting to WiFi SSID: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Wait up to 10 seconds for initial connection
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
  }
  
  if (isConnected()) {
    Serial.println();
    Serial.print("WiFi connected! IP address: ");
    Serial.println(WiFi.localIP());
    _lastRetryMs = 0; // Reset retry timer on successful connection
  } else {
    Serial.println();
    Serial.println("WiFi connection failed, will retry");
    _lastRetryMs = millis(); // Start retry timer
  }
}

bool WiFiManager::isConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void WiFiManager::reconnectIfNeeded() {
  // Requirements 5.5: Attempt reconnection every 5 seconds if disconnected
  
  if (isConnected()) {
    return; // Already connected, nothing to do
  }
  
  // Check if enough time has passed since last retry attempt
  unsigned long currentMs = millis();
  if (_lastRetryMs == 0 || currentMs - _lastRetryMs >= WIFI_RETRY_INTERVAL_MS) {
    Serial.println("WiFi disconnected, attempting reconnection...");
    _lastRetryMs = currentMs;
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    // Brief wait to check if connection succeeds quickly
    delay(100);
    
    if (isConnected()) {
      Serial.print("WiFi reconnected! IP address: ");
      Serial.println(WiFi.localIP());
      _lastRetryMs = 0; // Reset retry timer
    }
  }
}
