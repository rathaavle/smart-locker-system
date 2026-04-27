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
  Serial.println("\n[SmartLocker] Booting...");
  
  // Requirements 5.1: Connect WiFi
  Serial.println("[Setup] Connecting to WiFi...");
  wifiManager.connect();
  
  if (wifiManager.isConnected()) {
    Serial.println("[Setup] WiFi connected");
  } else {
    Serial.println("[Setup] WiFi connection failed, will retry in loop");
  }
  
  // Requirements 5.2: Connect Firebase and register listener
  Serial.println("[Setup] Initializing Firebase...");
  firebaseClient.begin();
  
  // Requirements 5.4: Initialize sensor
  Serial.println("[Setup] Initializing door sensor...");
  DoorStatus initialStatus = sensorReader.read();
  Serial.print("[Setup] Initial door status: ");
  Serial.println(initialStatus == DoorStatus::OPEN ? "OPEN" : "CLOSED");
  
  // Write initial door status to Firebase
  firebaseClient.writeDoorStatus(initialStatus);
  
  Serial.println("[Setup] Setup complete");
}

void loop() {
  // Requirements 5.5: Reconnect WiFi if needed
  wifiManager.reconnectIfNeeded();
  
  // Only proceed if WiFi is connected
  if (!wifiManager.isConnected()) {
    delay(100);
    return;
  }
  
  // Requirements 5.3: Write heartbeat every 30 seconds
  firebaseClient.writeHeartbeat();
  
  // Requirements 5.4: Poll sensor and update Firebase if changed
  if (sensorReader.hasChanged()) {
    DoorStatus currentStatus = sensorReader.read();
    Serial.print("[Loop] Door status changed: ");
    Serial.println(currentStatus == DoorStatus::OPEN ? "OPEN" : "CLOSED");
    firebaseClient.writeDoorStatus(currentStatus);
  }
  
  // Requirements 5.2, 5.3, 5.6: Check for UNLOCK command
  if (firebaseClient.hasPendingUnlock()) {
    Serial.println("[Loop] Processing UNLOCK command...");
    
    // Requirements 5.6: Stale command guard
    long commandAt = firebaseClient.readCommandAt();
    long currentTime = millis() / 1000; // Convert to seconds
    long commandAge = currentTime - commandAt;
    
    Serial.print("[Loop] Command age: ");
    Serial.print(commandAge);
    Serial.println(" seconds");
    
    // Check if command is stale (older than 30 seconds)
    if (commandAge > (STALE_COMMAND_THRESHOLD_MS / 1000)) {
      Serial.println("[Loop] Command is stale, discarding");
      firebaseClient.clearCommand();
    } else {
      // Command is fresh, activate relay
      Serial.println("[Loop] Command is fresh, activating relay");
      
      // Requirements 2.8, 3.4: Activate relay for 3-5 seconds
      relayController.activate(RELAY_DURATION_MS);
      
      // Requirements 5.3: Clear command within 1 second of activation
      firebaseClient.clearCommand();
    }
  }
  
  // Update relay controller (handles automatic deactivation)
  relayController.update();
  
  // Small delay to prevent excessive polling
  delay(100);
}
