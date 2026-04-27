#include "firebase_client.h"
#include "config.h"

void FirebaseClient::begin() {
  // Requirements 5.2: Initialize Firebase RTDB client with credentials
  
  Serial.println("Initializing Firebase client...");
  
  // Configure Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.reconnectWiFi(true);
  
  // Set device path for this locker
  _devicePath = String("devices/") + DEVICE_ID;
  
  Serial.print("Firebase initialized for device: ");
  Serial.println(DEVICE_ID);
  Serial.print("Device path: ");
  Serial.println(_devicePath);
  
  // Initialize heartbeat timestamp
  _lastHeartbeatMs = 0;
}

void FirebaseClient::writeHeartbeat() {
  // Requirements 5.3: Update devices/{deviceId}/heartbeat every 30 seconds
  
  unsigned long currentMs = millis();
  
  // Check if enough time has passed since last heartbeat
  if (_lastHeartbeatMs != 0 && currentMs - _lastHeartbeatMs < HEARTBEAT_INTERVAL_MS) {
    return; // Not time yet
  }
  
  // Get current Unix timestamp (seconds since epoch)
  long timestamp = millis() / 1000; // Simple timestamp for device uptime
  
  String heartbeatPath = _devicePath + "/heartbeat";
  
  if (Firebase.setInt(_firebaseData, heartbeatPath, timestamp)) {
    Serial.print("Heartbeat sent: ");
    Serial.println(timestamp);
    _lastHeartbeatMs = currentMs;
  } else {
    Serial.print("Failed to send heartbeat: ");
    Serial.println(_firebaseData.errorReason());
  }
}

void FirebaseClient::writeDoorStatus(DoorStatus status) {
  // Requirements 5.4: Update devices/{deviceId}/doorStatus within 1 second of physical change
  
  String statusStr = (status == DoorStatus::OPEN) ? "OPEN" : "CLOSED";
  String doorStatusPath = _devicePath + "/doorStatus";
  
  if (Firebase.setString(_firebaseData, doorStatusPath, statusStr)) {
    Serial.print("Door status updated: ");
    Serial.println(statusStr);
  } else {
    Serial.print("Failed to update door status: ");
    Serial.println(_firebaseData.errorReason());
  }
}

void FirebaseClient::clearCommand() {
  // Requirements 5.3: Clear devices/{deviceId}/command within 1 second after activation
  
  String commandPath = _devicePath + "/command";
  
  if (Firebase.setString(_firebaseData, commandPath, "")) {
    Serial.println("Command cleared");
  } else {
    Serial.print("Failed to clear command: ");
    Serial.println(_firebaseData.errorReason());
  }
}

long FirebaseClient::readCommandAt() {
  // Requirements 5.6: Read timestamp command for stale check
  
  String commandAtPath = _devicePath + "/commandAt";
  
  if (Firebase.getInt(_firebaseData, commandAtPath)) {
    long commandAt = _firebaseData.intData();
    Serial.print("Command timestamp: ");
    Serial.println(commandAt);
    return commandAt;
  } else {
    Serial.print("Failed to read commandAt: ");
    Serial.println(_firebaseData.errorReason());
    return 0;
  }
}

bool FirebaseClient::hasPendingUnlock() {
  // Requirements 5.2: Check for UNLOCK command on devices/{deviceId}/command
  
  String commandPath = _devicePath + "/command";
  
  if (Firebase.getString(_firebaseData, commandPath)) {
    String command = _firebaseData.stringData();
    
    if (command == "UNLOCK") {
      Serial.println("UNLOCK command detected");
      return true;
    }
    return false;
  } else {
    Serial.print("Failed to read command: ");
    Serial.println(_firebaseData.errorReason());
    return false;
  }
}
