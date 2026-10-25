/*
  ==============================================================================
   FLOOD PREDICTION & EARLY WARNING SYSTEM (ESP32)
   Hardware Implementation Firmware with Web Dashboard Telemetry Bridge
  ==============================================================================
   ESP32 Pinout:
    - GPIO 5 : Ultrasonic TRIG (Trigger Pulse)
    - GPIO 18: Ultrasonic ECHO (via 1kΩ / 2kΩ voltage divider from 5V sensor)
    - GPIO 34: Raindrop Sensor AO (Analog Rain Intensity, 0-4095)
    - GPIO 25: Raindrop Sensor DO (Digital Rain: LOW = Rain, HIGH = Dry)
    - GPIO 35: Water Sensor Signal / S (Analog Water Level / Immersion, 0-4095)
    - GPIO 26: Buzzer Module Signal / IN (Acoustic Siren Alarm)
    - GPIO 19: Green LED (Safe / Normal)
    - GPIO 21: Yellow LED (Watch / Warning)
    - GPIO 22: Red LED (Flood Danger / Critical)
    - GPIO 23: Relay Module IN (Active LOW - Controls 12V DC Rainmaker Pump)
  ==============================================================================
   Relay & Water Pump Connection:
    - COM                    : Positive (+) power supply for pump
    - NO                     : Pump positive (+) terminal
    - Pump Negative Terminal : Negative (-) terminal of pump power supply
    - NC                     : Leave unconnected
  ==============================================================================
   Serial Commands (115200 baud):
    - PUMP_ON / RAIN_ON      : Turn Rainmaker Pump ON (Manual demonstration)
    - PUMP_OFF / RAIN_OFF    : Turn Rainmaker Pump OFF (Standby)
    - PUMP_TOGGLE            : Toggle pump state
    - BUZZER_TEST            : Quick acoustic beep test
    - LED_TEST               : Indicator sequence test
  ==============================================================================
*/

// --- GPIO Pin Definitions ---
const int PIN_TRIG         = 5;   // Ultrasonic TRIG
const int PIN_ECHO         = 18;  // Ultrasonic ECHO (via voltage divider)
const int PIN_RAIN_AO      = 34;  // Raindrop Sensor AO (Analog)
const int PIN_RAIN_DO      = 25;  // Raindrop Sensor DO (Digital)
const int PIN_WATER_SENSOR = 35;  // Water Sensor Signal/S (Analog Contact/Depth)
const int PIN_BUZZER       = 26;  // Buzzer Module Signal/IN
const int PIN_LED_GREEN    = 19;  // Green LED (Safe / Low Risk)
const int PIN_LED_YELLOW   = 21;  // Yellow LED (Watch / Medium Risk)
const int PIN_LED_RED      = 22;  // Red LED (Flood Danger / High Risk)
const int PIN_RELAY_PUMP   = 23;  // Relay Module IN (Controls Rainmaker Pump)

// --- Physical Tank / River Calibration (Centimeters) ---
const float SENSOR_TOTAL_HEIGHT_CM = 26.0;  // Bucket height = 26 cm
const float SENSOR_MIN_DISTANCE_CM = 2.5;   // HC-SR04 minimum sensing distance
const float MAX_WATER_DEPTH_CM     = SENSOR_TOTAL_HEIGHT_CM - SENSOR_MIN_DISTANCE_CM; // 23.5 cm

// --- Warning Thresholds (Depth in Centimeters) ---
const float THRESHOLD_WARN_DEPTH_CM    = 15.0; // Water depth >= 15 cm AND water sensor wet = WARNING (Yellow)
const float THRESHOLD_DANGER_DEPTH_CM  = 20.0; // Water depth >= 20 cm = CRITICAL FLOOD (Red)
const int   WATER_SENSOR_WET_THRESHOLD = 1800; // ADC threshold on GPIO 35 to confirm physical water contact (0-4095)

// Relay active logic (Supports runtime inversion if module is Active HIGH or wired to NC)
int RELAY_ON  = LOW;   // 0V energizes relay coil -> NO contact closes (Pump ON)
int RELAY_OFF = HIGH;  // 3.3V de-energizes relay coil -> NO contact opens (Pump OFF)

// --- Measurement & Timing ---
unsigned long lastMeasureTime = 0;
const unsigned long MEASURE_INTERVAL_MS = 1000; // Measure every 1 second

float previousWaterDepth = 0.0;
float currentWaterDepth  = 0.0;
float rateOfRiseCmPerMin = 0.0; // Speed of rising water (cm/min)
bool isRaining           = false;
int rainAnalogVal        = 4095; // 4095 = dry, 0 = wet
int waterSensorAnalogVal = 0;    // 0 = dry, 4095 = submerged
bool isFirstMeasurement  = true; // Prevents startup calculation delta spike
unsigned long bootTimeMs = 0;    // Startup timer

// --- 100% MANUAL PUMP CONTROL (User-controlled via Dashboard button) ---
// By design, the pump NEVER turns ON automatically from sensors!
// The user uses the pump solely for raindrop demonstration.
bool pumpActive = false; // Default: OFF (Standby)

// --- Alarm States (Global so Buzzer and LEDs track accurately) ---
bool isCriticalState = false;
bool isWarningState  = false;
bool isSafeState     = true;

// Buzzer cadence
unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;

// Ultrasonic raw timing
long lastEchoDurationUs = 0;

// -----------------------------------------------------------------------------
// Measure Distance using Ultrasonic Sensor
// -----------------------------------------------------------------------------
float measureDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(4);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  lastEchoDurationUs = duration;
  if (duration > 0) {
    float dist = (duration * 0.0343) / 2.0;
    return dist;
  }
  return -1.0;
}

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------
void setup() {
  // 1. CRITICAL: Immediately lock Relay OFF before any delays or serial initialization
  // (Prevents pump jerking ON during USB connection / ESP32 boot)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);

  // Indicators Default to OFF (Buzzer strictly SILENT on boot)
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Sensor Pin Configurations
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_RAIN_AO, INPUT);
  pinMode(PIN_RAIN_DO, INPUT_PULLUP);
  pinMode(PIN_WATER_SENSOR, INPUT);

  Serial.begin(115200);
  bootTimeMs = millis();
  delay(100);

  Serial.println("\n=======================================================");
  Serial.println("  ESP32 FLOOD EARLY WARNING & PREDICTION SYSTEM READY");
  Serial.println("=======================================================");
  Serial.println("  Hardware Pin Configuration:");
  Serial.println("   - Ultrasonic TRIG      : GPIO 5");
  Serial.println("   - Ultrasonic ECHO      : GPIO 18 (via voltage divider)");
  Serial.println("   - Rain Sensor AO       : GPIO 34 (Analog)");
  Serial.println("   - Rain Sensor DO       : GPIO 25 (Digital)");
  Serial.println("   - Water Sensor Sig/S   : GPIO 35 (Analog Contact/Depth)");
  Serial.println("   - Buzzer Module IN     : GPIO 26");
  Serial.println("   - Green LED (Safe)     : GPIO 19");
  Serial.println("   - Yellow LED (Watch)   : GPIO 21");
  Serial.println("   - Red LED (Danger)     : GPIO 22");
  Serial.println("   - Relay Module IN      : GPIO 23 (Pump Manual Control)");
  Serial.println("=======================================================");
  Serial.println("  PUMP MODE: 100% MANUAL CONTROL (Default: OFF / Standby)");
  Serial.println("  BUZZER   : Silent in Safe mode; sounds ONLY on Warning / Danger");
  Serial.println("=======================================================\n");

  // Visual LED sequence self-test (Silent: no buzzer beep on startup!)
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(150);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  delay(150);
  digitalWrite(PIN_LED_RED, HIGH);
  delay(150);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);

  Serial.println("System self-test complete. Telemetry streaming at 115200 baud...\n");
}

// -----------------------------------------------------------------------------
// Main Loop
// -----------------------------------------------------------------------------
void loop() {
  unsigned long now = millis();

  // 1. Process Inbound Commands from Web Dashboard / Serial Monitor
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.equalsIgnoreCase("PUMP_ON") || cmd.equalsIgnoreCase("RAIN_ON")) {
      pumpActive = true;
      digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
      Serial.println("[CMD_ACK] PUMP ON: Rainmaker pump running (spraying raindrops)");
    } else if (cmd.equalsIgnoreCase("PUMP_OFF") || cmd.equalsIgnoreCase("RAIN_OFF")) {
      pumpActive = false;
      digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
      Serial.println("[CMD_ACK] PUMP OFF: Rainmaker pump stopped (standby)");
    } else if (cmd.equalsIgnoreCase("PUMP_TOGGLE") || cmd.equalsIgnoreCase("RAIN_TOGGLE")) {
      pumpActive = !pumpActive;
      digitalWrite(PIN_RELAY_PUMP, pumpActive ? RELAY_ON : RELAY_OFF);
      Serial.printf("[CMD_ACK] PUMP TOGGLED: %s\n", pumpActive ? "RUNNING" : "STANDBY");
    } else if (cmd.equalsIgnoreCase("BUZZER_TEST")) {
      digitalWrite(PIN_BUZZER, HIGH);
      delay(150);
      digitalWrite(PIN_BUZZER, LOW);
      Serial.println("[CMD_ACK] BUZZER_TEST: Quick beep sounded");
    } else if (cmd.equalsIgnoreCase("INVERT_RELAY")) {
      int temp = RELAY_ON;
      RELAY_ON = RELAY_OFF;
      RELAY_OFF = temp;
      digitalWrite(PIN_RELAY_PUMP, pumpActive ? RELAY_ON : RELAY_OFF);
      Serial.printf("[CMD_ACK] RELAY INVERTED: ON is now %s, OFF is now %s\n", RELAY_ON == LOW ? "LOW (0V)" : "HIGH (3.3V)", RELAY_OFF == LOW ? "LOW (0V)" : "HIGH (3.3V)");
    } else if (cmd.equalsIgnoreCase("LED_TEST")) {
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_YELLOW, HIGH);
      digitalWrite(PIN_LED_RED, HIGH);
      delay(300);
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, LOW);
      digitalWrite(PIN_LED_RED, LOW);
      Serial.println("[CMD_ACK] LED_TEST: Tested");
    }
  }

  // 2. Periodic Sensor Acquisition (Every 1000 ms)
  if (now - lastMeasureTime >= MEASURE_INTERVAL_MS) {
    float timeDeltaMinutes = (now - lastMeasureTime) / 60000.0;
    lastMeasureTime = now;

    // Read Raindrop sensor: AO (0=wet, 4095=dry) & DO (LOW=rain detected)
    rainAnalogVal = analogRead(PIN_RAIN_AO);
    bool rainDigital = (digitalRead(PIN_RAIN_DO) == LOW);
    isRaining = rainDigital || (rainAnalogVal < 2500);

    // Read Water Sensor on GPIO 35 (contact depth/immersion)
    waterSensorAnalogVal = analogRead(PIN_WATER_SENSOR);
    bool waterContactDetected = (waterSensorAnalogVal >= WATER_SENSOR_WET_THRESHOLD);

    // Read Ultrasonic Distance
    float measuredDistance = measureDistanceCm();

    if (measuredDistance > 0) {
      float depth = SENSOR_TOTAL_HEIGHT_CM - measuredDistance;
      if (depth < 0) depth = 0;
      if (depth > MAX_WATER_DEPTH_CM) depth = MAX_WATER_DEPTH_CM;

      if (isFirstMeasurement) {
        previousWaterDepth = depth;
        currentWaterDepth  = depth;
        rateOfRiseCmPerMin = 0.0;
        isFirstMeasurement = false;
      } else {
        if (timeDeltaMinutes > 0) {
          rateOfRiseCmPerMin = (depth - previousWaterDepth) / timeDeltaMinutes;
        }
        previousWaterDepth = currentWaterDepth;
        currentWaterDepth  = depth;
      }
    }

    // Calculate percentage capacity
    float waterLevelPercent = (currentWaterDepth / MAX_WATER_DEPTH_CM) * 100.0;
    if (waterLevelPercent < 0) waterLevelPercent = 0;
    if (waterLevelPercent > 100) waterLevelPercent = 100;

    // Predictive Flood Warning (Real-time calculation to 20cm flood threshold)
    float minutesToFlood = -1.0;
    if (rateOfRiseCmPerMin > 0.15 && currentWaterDepth < THRESHOLD_DANGER_DEPTH_CM) {
      minutesToFlood = (THRESHOLD_DANGER_DEPTH_CM - currentWaterDepth) / rateOfRiseCmPerMin;
    }

    // --- State Decision (Ultrasonic Dual-Confirmation + Immersion Sensor) ---
    // 1. Critical Flood: Water level reaches 20 cm
    bool isCritical = (currentWaterDepth >= THRESHOLD_DANGER_DEPTH_CM);

    // 2. Warning: Water reaches 15 cm AND water sensor is wet (BOTH must strictly be true)
    bool isWarning  = (!isCritical) && (currentWaterDepth >= THRESHOLD_WARN_DEPTH_CM) && waterContactDetected;

    // 3. Safe: Below 15 cm or water sensor is dry / unconfirmed
    bool isSafe     = (!isCritical && !isWarning);

    // Startup Stabilization Guard (first 2.5 seconds): Keep quiet during USB boot
    if (millis() - bootTimeMs < 2500) {
      isCritical = false;
      isWarning  = false;
      isSafe     = true;
      rateOfRiseCmPerMin = 0.0;
    }

    // Update global states for LEDs and Buzzer
    isCriticalState = isCritical;
    isWarningState  = isWarning;
    isSafeState     = isSafe;

    // LED Indicators
    if (isCriticalState) {
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, LOW);
      digitalWrite(PIN_LED_RED, HIGH);
    } else if (isWarningState) {
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_YELLOW, HIGH);
      digitalWrite(PIN_LED_RED, LOW);
    } else {
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_YELLOW, LOW);
      digitalWrite(PIN_LED_RED, LOW);
    }

    // Human-readable Serial Output
    Serial.printf("[TELEMETRY] Depth: %.1f cm (>=15cm: %s) | WaterSensor(35): %d (>=1800: %s) | Status: %s | Buzzer: %s",
                  currentWaterDepth,
                  (currentWaterDepth >= THRESHOLD_WARN_DEPTH_CM) ? "YES" : "NO",
                  waterSensorAnalogVal,
                  waterContactDetected ? "WET" : "DRY",
                  isCriticalState ? "CRITICAL FLOOD DANGER" : (isWarningState ? "WATCH / WARNING" : "SAFE / NORMAL"),
                  (isCriticalState || isWarningState) ? "BEEPING" : "SILENT");

    if (minutesToFlood > 0 && minutesToFlood < 60.0) {
      Serial.printf(" | [PREDICTION] Est. Flood (20cm) in: %.1f mins!", minutesToFlood);
    } else if (isCriticalState) {
      Serial.printf(" | [PREDICTION] FLOOD THRESHOLD BREACHED!");
    } else if (isWarningState) {
      Serial.printf(" | [PREDICTION] WARNING STAGE ACTIVE (Buffer to 20cm: %.1f cm)", THRESHOLD_DANGER_DEPTH_CM - currentWaterDepth);
    } else if (currentWaterDepth >= 10.0) {
      Serial.printf(" | [PREDICTION] Buffer to 15cm: %.1f cm", THRESHOLD_WARN_DEPTH_CM - currentWaterDepth);
    }
    Serial.println();

    // Machine-readable JSON output for Web Dashboard Integration
    float calcRainVolt = (rainAnalogVal * 3.3f) / 4095.0f;
    float calcWaterVolt = (waterSensorAnalogVal * 3.3f) / 4095.0f;
    Serial.printf("{\"type\":\"telemetry\",\"depth\":%.1f,\"pct\":%.1f,\"dist\":%.1f,\"echoUs\":%ld,\"waterRaw\":%d,\"waterVolt\":%.2f,\"rain\":%d,\"rainAo\":%d,\"rainVolt\":%.2f,\"rainDo\":%d,\"rate\":%.2f,\"critical\":%d,\"warning\":%d,\"pump\":%d,\"pumpMode\":%d,\"pumpRole\":0}\n",
                  currentWaterDepth,
                  waterLevelPercent,
                  measuredDistance,
                  lastEchoDurationUs,
                  waterSensorAnalogVal,
                  calcWaterVolt,
                  isRaining ? 1 : 0,
                  rainAnalogVal,
                  calcRainVolt,
                  rainDigital ? 0 : 1,
                  rateOfRiseCmPerMin,
                  isCriticalState ? 1 : 0,
                  isWarningState ? 1 : 0,
                  pumpActive ? 1 : 0,
                  pumpActive ? 1 : 2);
  }

  // 3. Buzzer Alarm Logic (GPIO 26)
  // - SAFE / NORMAL: Completely SILENT (Buzzer strictly OFF)
  // - WARNING      : Slow intermittent beep every 800ms
  // - CRITICAL     : Fast urgent siren pulse every 250ms
  if (isCriticalState) {
    // CRITICAL FLOOD DANGER: Fast urgent pulse every 250ms
    if (now - lastBuzzerToggle >= 250) {
      lastBuzzerToggle = now;
      buzzerState = !buzzerState;
      digitalWrite(PIN_BUZZER, buzzerState ? HIGH : LOW);
    }
  } else if (isWarningState) {
    // WATCH / WARNING: Slow warning beep every 800ms
    if (now - lastBuzzerToggle >= 800) {
      lastBuzzerToggle = now;
      buzzerState = !buzzerState;
      digitalWrite(PIN_BUZZER, buzzerState ? HIGH : LOW);
    }
  } else {
    // SAFE: Buzzer is strictly OFF and SILENT
    buzzerState = false;
    digitalWrite(PIN_BUZZER, LOW);
  }

  delay(20);
}
