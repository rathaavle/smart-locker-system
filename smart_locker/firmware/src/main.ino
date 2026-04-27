#include <Arduino.h>
#include "config.h"
#include "wifi_manager.h"
#include "firebase_client.h"
#include "relay_controller.h"
#include "sensor_reader.h"

WiFiManager wifiManager;
FirebaseClient firebaseClient;
RelayController relayController(RELAY_PIN);
SensorReader sensorReader(SENSOR_PIN);

void setup() {
  Serial.begin(115200);
  Serial.println("[SmartLocker] Booting...");
  
  // TODO: implement full setup in Task 11.3
  wifiManager.connect();
}

void loop() {
  // TODO: implement full loop in Task 11.3
  wifiManager.reconnectIfNeeded();
  delay(100);
}
