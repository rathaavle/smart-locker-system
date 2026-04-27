# Requirements Document

## Introduction

The Smart Locker System is an IoT-enabled, OTP-secured locker management platform. It allows end users to store and retrieve items from physical lockers without any admin involvement. The system integrates a Flutter mobile app, Firebase backend (Firestore + Cloud Functions), and ESP8266 microcontrollers connected to solenoid door locks and magnetic door sensors. Users check in by selecting an available locker and receiving a one-time password via email; they check out by entering that OTP to unlock the locker and retrieve their items. All locker state transitions are driven by real-time sensor feedback and Firebase synchronization.

---

## Glossary

- **App**: The Flutter mobile application used by end users.
- **Backend**: Firebase services including Firestore, Realtime Database, and Cloud Functions.
- **Device**: The ESP8266 microcontroller unit installed in each locker.
- **Locker**: A physical storage compartment equipped with a solenoid lock, relay, and magnetic door sensor.
- **OTP**: A 6-digit one-time password generated per check-in transaction and delivered to the user via email.
- **OTP_Service**: The Cloud Functions module responsible for generating, storing, validating, and expiring OTPs.
- **Email_Service**: The Cloud Functions module responsible for sending OTP emails to users.
- **State_Manager**: The Cloud Functions module responsible for computing and updating locker state transitions.
- **Sensor**: The magnetic door sensor attached to each locker that reports OPEN or CLOSED status.
- **Relay**: The hardware relay connected to the solenoid lock that physically opens the locker door when triggered.
- **Transaction**: A record in Firebase representing an active check-in session for a specific locker and user.
- **Dashboard**: The main screen of the App displaying all lockers and their current statuses.
- **EMPTY**: Locker state indicating the locker is available with no active transaction.
- **OPEN**: Locker state indicating the locker door is physically open.
- **FILLED**: Locker state indicating the locker contains items and the door is closed.
- **UNLOCKING**: Locker state indicating the system has sent an unlock command and is awaiting door open confirmation.

---

## Requirements

### Requirement 1: Locker State Management

**User Story:** As a user, I want the locker to accurately reflect its physical state, so that I can trust the displayed status when selecting or using a locker.

#### Acceptance Criteria

1. THE Locker SHALL maintain one of exactly four states at any time: EMPTY, OPEN, FILLED, or UNLOCKING.
2. WHEN the Sensor reports CLOSED and an active Transaction exists for the Locker, THE State_Manager SHALL set the Locker state to FILLED.
3. WHEN the Sensor reports CLOSED and no active Transaction exists for the Locker, THE State_Manager SHALL set the Locker state to EMPTY.
4. WHEN the Backend sends an unlock command to the Device, THE State_Manager SHALL set the Locker state to UNLOCKING.
5. WHEN the Sensor reports OPEN, THE State_Manager SHALL set the Locker state to OPEN.
6. THE App SHALL display the current Locker state in real time by subscribing to the Backend data stream.

---

### Requirement 2: Check-In Flow (Store Item)

**User Story:** As a user, I want to store an item in an available locker by providing my email, so that I receive an OTP to retrieve my item later.

#### Acceptance Criteria

1. THE App SHALL display only Lockers with state EMPTY as selectable on the Dashboard.
2. WHEN a user selects an EMPTY Locker, THE App SHALL prompt the user to enter a valid email address.
3. WHEN a valid email address is submitted, THE OTP_Service SHALL generate a cryptographically random 6-digit OTP.
4. WHEN an OTP is generated, THE OTP_Service SHALL store the OTP in the Backend associated with the Locker and user email, with a creation timestamp.
5. WHEN an OTP is stored, THE Email_Service SHALL send the OTP to the provided email address within 30 seconds.
6. WHEN an OTP is sent, THE Backend SHALL create a Transaction record linking the Locker, user email, and OTP.
7. WHEN a Transaction is created, THE Backend SHALL send an UNLOCK command to the Device for the selected Locker.
8. WHEN the Device receives an UNLOCK command, THE Device SHALL activate the Relay for 3 to 5 seconds to release the solenoid lock.
9. WHEN the Sensor reports OPEN after an UNLOCK command, THE State_Manager SHALL set the Locker state to OPEN.
10. WHEN the Sensor reports CLOSED while the Locker state is OPEN and an active Transaction exists, THE State_Manager SHALL set the Locker state to FILLED.

---

### Requirement 3: Check-Out Flow (Retrieve Item)

**User Story:** As a user, I want to retrieve my stored item by entering my OTP, so that the locker unlocks and I can collect my belongings.

#### Acceptance Criteria

1. WHEN a user selects a Locker with state FILLED, THE App SHALL prompt the user to enter a 6-digit OTP.
2. WHEN an OTP is submitted for check-out, THE OTP_Service SHALL validate the OTP against the stored value for that Locker.
3. WHEN the OTP is valid and not expired, THE Backend SHALL send an UNLOCK command to the Device for that Locker.
4. WHEN the Device receives an UNLOCK command during check-out, THE Device SHALL activate the Relay for 3 to 5 seconds.
5. WHEN the Sensor reports OPEN after a check-out UNLOCK command, THE State_Manager SHALL set the Locker state to OPEN.
6. WHEN the Sensor reports CLOSED while the Locker state is OPEN and no active Transaction exists, THE State_Manager SHALL set the Locker state to EMPTY.
7. WHEN the Locker state transitions to EMPTY after check-out, THE Backend SHALL mark the Transaction as completed and remove the associated OTP.

---

### Requirement 4: OTP Lifecycle Management

**User Story:** As a user, I want my OTP to expire after a reasonable time, so that unused OTPs cannot be used to access my locker indefinitely.

#### Acceptance Criteria

1. THE OTP_Service SHALL assign an expiration time of 24 hours from generation to every OTP.
2. WHEN an OTP validation request is received and the OTP creation timestamp is more than 24 hours in the past, THE OTP_Service SHALL reject the OTP as expired and return an expiration error to the App.
3. WHEN an OTP is rejected as expired, THE App SHALL display a message informing the user that the OTP has expired.
4. WHEN an OTP is used successfully for check-out, THE OTP_Service SHALL invalidate the OTP immediately so it cannot be reused.
5. THE OTP_Service SHALL store OTPs in a hashed form in the Backend; plain-text OTPs SHALL NOT be persisted after transmission.

---

### Requirement 5: Device Communication and Synchronization

**User Story:** As a system operator, I want the ESP8266 device to stay synchronized with Firebase in real time, so that locker commands and sensor updates are processed without manual intervention.

#### Acceptance Criteria

1. WHEN the Device powers on, THE Device SHALL connect to the configured WiFi network and establish a connection to the Backend within 10 seconds.
2. WHILE connected to the Backend, THE Device SHALL listen for UNLOCK commands on its designated Firebase path in real time.
3. WHEN the Device receives an UNLOCK command, THE Device SHALL activate the Relay and then clear the command flag in the Backend within 1 second of activation.
4. WHEN the Sensor state changes, THE Device SHALL update the door status field in the Backend within 1 second of the physical change.
5. IF the Device loses WiFi connectivity, THEN THE Device SHALL attempt reconnection every 5 seconds until connectivity is restored.
6. WHILE the Device is offline, THE Device SHALL not activate the Relay in response to stale commands received upon reconnection.

---

### Requirement 6: Edge Case — Door Not Closed After Unlock

**User Story:** As a user, I want the system to handle the case where I forget to close the locker door, so that the locker does not remain in an inconsistent state indefinitely.

#### Acceptance Criteria

1. WHEN the Locker state is OPEN for more than 5 minutes without the Sensor reporting CLOSED, THE State_Manager SHALL send a push notification to the user's registered email alerting them that the locker door is still open.
2. WHEN the Locker state is OPEN for more than 30 minutes without the Sensor reporting CLOSED, THE State_Manager SHALL flag the Transaction as requiring manual review and set the Locker state to FILLED to prevent other users from selecting it.

---

### Requirement 7: Edge Case — Invalid or Expired OTP

**User Story:** As a user, I want clear feedback when I enter a wrong or expired OTP, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. WHEN an OTP validation request is received and the submitted OTP does not match the stored OTP for the Locker, THE OTP_Service SHALL return an invalid OTP error to the App.
2. WHEN the App receives an invalid OTP error, THE App SHALL display a message indicating the OTP is incorrect and allow the user to re-enter the OTP.
3. WHEN a user submits an incorrect OTP 5 consecutive times for the same Locker, THE OTP_Service SHALL lock OTP validation for that Locker for 15 minutes and notify the user via the App.
4. WHEN OTP validation is locked for a Locker, THE App SHALL display the remaining lockout duration to the user.

---

### Requirement 8: Edge Case — Device Offline

**User Story:** As a user, I want to be informed when a locker's device is offline, so that I do not attempt to use a locker that cannot respond to commands.

#### Acceptance Criteria

1. WHEN the Device has not sent a heartbeat to the Backend within 60 seconds, THE Backend SHALL mark the Locker as offline.
2. WHEN a Locker is marked offline, THE App SHALL display the Locker as unavailable and prevent the user from initiating a check-in or check-out for that Locker.
3. WHEN the Device reconnects and sends a heartbeat, THE Backend SHALL restore the Locker's availability status.

---

### Requirement 9: Edge Case — Locker Already in Use

**User Story:** As a user, I want the system to prevent me from selecting a locker that is already occupied, so that I do not interfere with another user's stored items.

#### Acceptance Criteria

1. THE App SHALL display Lockers with state FILLED, OPEN, or UNLOCKING as non-selectable for new check-in operations.
2. WHEN a user attempts to initiate a check-in on a Locker that is not in EMPTY state, THE App SHALL display a message indicating the Locker is currently unavailable.
3. WHEN two users attempt to initiate a check-in on the same EMPTY Locker simultaneously, THE Backend SHALL accept only the first Transaction and return a conflict error to the second request.

---

### Requirement 10: Real-Time Dashboard

**User Story:** As a user, I want to see all lockers and their current statuses on a single screen, so that I can quickly identify an available locker.

#### Acceptance Criteria

1. THE Dashboard SHALL display all Lockers registered in the Backend with their current state.
2. WHEN a Locker state changes in the Backend, THE Dashboard SHALL reflect the updated state within 2 seconds without requiring a manual refresh.
3. THE Dashboard SHALL visually distinguish between EMPTY, OPEN, FILLED, UNLOCKING, and offline Locker states using distinct colors or icons.
4. WHEN a Locker is in EMPTY state, THE Dashboard SHALL render the Locker as selectable for check-in.

---

### Requirement 11: Firebase Data Structure

**User Story:** As a developer, I want a well-defined Firebase data structure, so that all system components read and write data consistently.

#### Acceptance Criteria

1. THE Backend SHALL maintain a `lockers` collection where each document contains: locker ID, current state, door sensor status, device online status, last heartbeat timestamp, and active transaction reference.
2. THE Backend SHALL maintain a `transactions` collection where each document contains: transaction ID, locker ID, user email, OTP hash, OTP expiration timestamp, check-in timestamp, check-out timestamp, and transaction status.
3. THE Backend SHALL maintain a `commands` node (Realtime Database) per Device where the Device listens for UNLOCK commands and clears them after execution.
4. THE Backend SHALL enforce Firestore security rules so that only authenticated Cloud Functions can write to the `transactions` and `commands` collections; the App SHALL have read access to the `lockers` collection only.

---

### Requirement 12: OTP Email Delivery

**User Story:** As a user, I want to receive my OTP by email reliably, so that I can complete the check-in process without delays.

#### Acceptance Criteria

1. WHEN the Email_Service is triggered, THE Email_Service SHALL send an email containing the 6-digit OTP and the locker identifier to the user's provided email address.
2. WHEN the email delivery fails, THE Email_Service SHALL retry delivery up to 3 times with a 10-second interval between attempts.
3. IF all 3 email delivery attempts fail, THEN THE Email_Service SHALL return a delivery failure error to the App and cancel the associated Transaction.
4. THE Email_Service SHALL complete the initial delivery attempt within 30 seconds of OTP generation.
