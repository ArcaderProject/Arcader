#include <Arduino.h>

const int FW_VERSION = 2;

const uint8_t CANDIDATE_PINS[] = {
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  A0, A1, A2, A3, A4, A5,
};
const uint8_t PIN_COUNT = sizeof(CANDIDATE_PINS) / sizeof(CANDIDATE_PINS[0]);

const unsigned long MIN_IMPULSE_INTERVAL_MS = 100;
const unsigned long HEARTBEAT_INTERVAL_MS = 2000;

int coinPin = -1;
uint8_t lastState[PIN_COUNT];
unsigned long lastChange[PIN_COUNT];
unsigned long pendingCoins = 0;
unsigned long lastHeartbeat = 0;

void sendVersion() {
  Serial.print("ARCADER_COIN v");
  Serial.println(FW_VERSION);
}

void initPins() {
  coinPin = -1;
  unsigned long now = millis();
  for (uint8_t i = 0; i < PIN_COUNT; i++) {
    pinMode(CANDIDATE_PINS[i], INPUT_PULLUP);
    lastState[i] = digitalRead(CANDIDATE_PINS[i]);
    lastChange[i] = now;
  }
}

void setup() {
  Serial.begin(9600);
  initPins();
  sendVersion();
  lastHeartbeat = millis();
}

void registerPulse(uint8_t pinIndex) {
  if (coinPin < 0) {
    coinPin = pinIndex;
    Serial.print("CAL ");
    Serial.println(CANDIDATE_PINS[pinIndex]);
  }
  if (pinIndex == coinPin) {
    pendingCoins++;
  }
}

void scanPins() {
  unsigned long now = millis();

  if (coinPin >= 0) {
    uint8_t level = digitalRead(CANDIDATE_PINS[coinPin]);
    if (level != lastState[coinPin]) {
      if (now - lastChange[coinPin] > MIN_IMPULSE_INTERVAL_MS) {
        lastChange[coinPin] = now;
        if (level == LOW) {
          registerPulse(coinPin);
        }
      }
      lastState[coinPin] = level;
    }
    return;
  }

  for (uint8_t i = 0; i < PIN_COUNT; i++) {
    uint8_t level = digitalRead(CANDIDATE_PINS[i]);
    if (level != lastState[i]) {
      if (now - lastChange[i] > MIN_IMPULSE_INTERVAL_MS) {
        lastChange[i] = now;
        if (level == LOW) {
          registerPulse(i);
        }
      }
      lastState[i] = level;
    }
  }
}

void handleSerialCommand() {
  String command = Serial.readStringUntil('\n');
  command.trim();
  if (command == "VERSION?") {
    sendVersion();
  } else if (command == "PING") {
    Serial.println("PONG");
  } else if (command == "RECAL") {
    initPins();
    Serial.println("RECAL OK");
  }
}

void loop() {
  scanPins();

  while (pendingCoins > 0) {
    Serial.println("COIN");
    pendingCoins--;
  }

  if (Serial.available() > 0) {
    handleSerialCommand();
  }

  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    Serial.println("HB");
    lastHeartbeat = now;
  }
}
