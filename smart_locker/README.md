# Smart Locker System

Sistem locker pintar berbasis OTP + IoT menggunakan Flutter, Firebase, dan ESP8266.

## Struktur Proyek

```
smart_locker/
├── functions/      # Firebase Cloud Functions (TypeScript/Node.js 20)
├── flutter_app/    # Flutter mobile app
├── firmware/       # ESP8266 firmware (Arduino/PlatformIO)
├── firebase.json   # Firebase project config
├── firestore.rules # Firestore security rules
└── database.rules.json # Realtime Database rules
```

## Setup Development

### Prerequisites

- Node.js 20+
- Flutter 3.x
- Firebase CLI (`npm install -g firebase-tools`)
- PlatformIO (untuk firmware)

### Cloud Functions

```bash
cd functions
npm install
npm run build
```

### Flutter App

```bash
cd flutter_app
flutter pub get
```

### Firebase Emulator

```bash
firebase emulators:start
```

## Arsitektur

- **Flutter App** ↔ **Firebase** (Firestore + Cloud Functions)
- **ESP8266** ↔ **Firebase** (Realtime Database)
- Firebase sebagai single source of truth dan message bus

## Locker States

- `EMPTY` — Locker tersedia
- `OPEN` — Pintu locker terbuka
- `FILLED` — Locker berisi barang, pintu tertutup
- `UNLOCKING` — Sistem sedang membuka kunci
