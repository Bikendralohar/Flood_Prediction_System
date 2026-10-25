# 🌊 ESP32 Flood Early Warning & Prediction System

An interactive digital twin and complete hardware implementation for an IoT-based flood prediction and early warning system, matching the exact schematic and connection table.

---

## 📌 Complete GPIO Pinout & Connection Table

The pin assignments below match the actual hardware implementation using an ESP32 DevKit V1, ultrasonic sensor, contact water sensor, raindrop sensor, buzzer, LEDs, and relay-controlled pump:

| No. | Component | Component Pin | ESP32 Pin / Power | Additional Components | Purpose |
|:---:|:---|:---:|:---:|:---|:---|
| **1** | **Raindrop Sensor** | `AO` | `GPIO 34` | — | Analog rain intensity (0–4095 ADC1) |
| **2** | | `DO` *(optional)* | `GPIO 25` | — | Digital rain threshold detection (active LOW) |
| **3** | | `VCC` | `3.3 V` | — | Sensor logic power |
| **4** | | `GND` | `GND` | — | Common ground |
| **5** | **Water Sensor** | `Signal / S` | `GPIO 35` | — | Analog water depth / immersion level (0–4095 ADC1) |
| **6** | | `VCC` | `3.3 V*` | — | Sensor power (*ensure safe for 3.3V GPIO) |
| **7** | | `GND` | `GND` | — | Common ground |
| **8** | **Ultrasonic Sensor (JSN-SR04T / HC-SR04)** | `TRIG` | `GPIO 5` | — | Ultrasonic trigger pulse |
| **9** | | `ECHO` | `GPIO 18` | 1kΩ + 2kΩ Voltage Divider | Level shifts 5V Echo down to ~3.3V |
| **10** | | `VCC` | Sensor Spec (5V / VIN) | — | Ultrasonic module power |
| **11** | | `GND` | `GND` | — | Common ground |
| **12** | **Buzzer Module** | `Signal / IN` | `GPIO 26` | — | Acoustic warning alarm / siren |
| **13** | | `VCC` | Module Spec (3.3V / 5V) | — | Buzzer module power |
| **14** | | `GND` | `GND` | — | Common ground |
| **15** | **Green LED** | Anode (+) | `GPIO 19` | 220–330 Ω Resistor | **Low Risk Indicator** (Safe / Normal) |
| **16** | **Yellow LED** | Anode (+) | `GPIO 21` | 220–330 Ω Resistor | **Medium Risk Indicator** (Watch / Warning) |
| **17** | **Red LED** | Anode (+) | `GPIO 22` | 220–330 Ω Resistor | **High Risk Indicator** (Critical Flood Alert) |
| **18** | **All Three LEDs** | Cathode (−) | `GND` | Through respective resistors | LED common return |
| **19** | **Relay Module (1-Channel 5V)** | `IN` | `GPIO 23` | — | Pump control signal (Active LOW) |
| **20** | | `VCC` | Module Spec (5V / VIN) | — | Relay coil power |
| **21** | | `GND` | `ESP32 GND` | — | Common ground |

*\*Check the water sensor's operating voltage and output voltage. Some sensor modules require 5 V; their signal output must still be safe for the ESP32's 3.3 V GPIOs.*

---

## 🔌 Relay and Water Pump Connection

For a typical relay module with COM, NO, and NC terminals:

| Relay Terminal | Connection |
|:---|:---|
| **COM** | **Positive (+) supply for the pump** (e.g. 12V DC power adapter +) |
| **NO** *(Normally Open)* | **Pump positive (+) terminal** (Red wire) |
| **Pump Negative Terminal** | **Negative (−) terminal of the pump's rated power supply** (Black wire) |
| **NC** *(Normally Closed)* | *Leave unconnected* |

---

## ⚡ How the System Works

### 1. Dual Water Level Sensing (Ultrasonic + Contact Sensor)
* **Ultrasonic Distance (GPIO 5 TRIG, GPIO 18 ECHO)**: Pointed downward towards the water channel to measure surface distance and compute water depth:
  $$\text{Water Depth } H = H_{total} - D_{air}$$
  A 5-sample filter rejects turbulence and surface wave ripples.
* **Voltage Divider Protection**: The Echo pin logic outputs 5V. A **1kΩ** (series) and **2kΩ** (to GND) divider steps this voltage down safely to $5\text{V} \times \frac{2}{3} \approx 3.33\text{V}$, protecting ESP32's 3.3V GPIO 18.
* **Contact Water Sensor (GPIO 35)**: Measures analog submersion / contact at the channel bed or high-water marker for instant redundancy verification.

### 2. Rain Detection (Raindrop Sensor)
* **Analog (GPIO 34)**: Delivers granular analog rain intensity (0 = torrential downpour, 4095 = bone dry).
* **Digital (GPIO 25)**: LM393 comparator pulls `DO` to **LOW (0V)** when raindrops bridge the PCB traces.

### 3. Predictive Early Warning Engine
* The system computes the **Rate of Rise**:
  $$\frac{dH}{dt} = \frac{H_{current} - H_{previous}}{\Delta t}$$
* If water is rising rapidly ($\frac{dH}{dt} > 4\text{ cm/min}$) during rain, the system escalates the risk early before the crest reaches the bank.
* Estimated Time to Overflow:
  $$T_{\text{flood}} = \frac{H_{\max} - H_{\text{current}}}{dH/dt}$$

### 4. Alert & Actuation Logic (Dual-Confirmation Architecture)
* **Bucket Calibration**: Total Height = **26.0 cm**, HC-SR04 Blind Spot = **2.5 cm**, Max Water Depth = **23.5 cm**.
* **Dual-Confirmation Warning**: Water immersion sensor is placed at **15.0 cm** on GPIO 35. To prevent false alarms from splashes or wave flutter, Warning requires **BOTH** depth $\ge 15.0\text{ cm}$ **AND** immersion sensor wet.
* **Critical Flood**: Water depth $\ge 20.0\text{ cm}$ immediately triggers Critical Flood.

| Risk Level | Trigger Conditions | Green LED (19) | Yellow LED (21) | Red LED (22) | Buzzer (26) | 12V Pump Relay (23) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **Normal / Safe 🟢** | Depth $< 15.0\text{ cm}$ or immersion sensor dry | **ON** | OFF | OFF | Silent | Standby (OFF) |
| **Watch / Warning 🟡** | Depth $\ge 15.0\text{ cm}$ **AND** Water Sensor Wet | OFF | **ON** | OFF | Intermittent Beep | Standby (OFF) |
| **Critical Flood 🔴** | Depth $\ge 20.0\text{ cm}$ | OFF | OFF | **ON** | **Rapid Siren Alarm** | Manual / Emergency Actuation |

---

## 🖥️ Interactive Web Simulator Features

Run and test the system locally:
* **1:1 Interactive Schematic Architecture Twin**:
  * Visual hardware layout replicating your diagram 1:1.
  * Exact components: JSN-SR04T sensor & transceiver board, Raindrop PCB & LM393 module, ESP32 DevKit V1 (ESP-WROOM-32), 1-Channel 5V Songle Relay, 12V DC Submersible Pump, 12V Power Adapter, Breadboard with 1kΩ/2kΩ voltage divider, 220Ω resistors, Green/Yellow/Red LEDs, and Piezo Buzzer.
  * Color-coded jumper wires with **live animated current/signal pulses** traversing between components.
  * Direct tactile interaction: Click the Rain Sensor to trigger raindrops; click the Ultrasonic Sensor to step water depth; click the Relay or Pump to toggle manual overrides!
* **Physical Basin & Drainage Bench Twin**:
  * Cross-section river channel tank with dynamic water physics and wave ripples (matching the physical setup photo in your diagram).
  * Ultrasonic transducer emitting animated ping waves down to water surface.
  * Rain particle simulator (Dry, Light, Heavy, Torrential Storm).
  * 12V Submersible pump that physically draws and discharges water into the secondary reservoir tank when relay energizes.
* **Live Telemetry & Prediction**:
  * Dual-channel real-time canvas chart showing water level curve and pump actuation history.
  * Dynamic Rate of Rise indicator ($\Delta H / \Delta t$) and Estimated Time-to-Overflow countdown.
  * Virtual ESP32 Serial Monitor running at 115200 baud streaming telemetry logs.

---

## 🚀 Running the Simulator

1. **Option A (Browser directly)**:
   Double-click `index.html` in file explorer or open:
   ```
   file:///c:/Users/ASUS/Desktop/IOT/index.html
   ```
2. **Option B (Local Web Server)**:
   A lightweight server is already active at:
   ```
   http://localhost:3000
   ```

## ⚡ Running in Wokwi Simulator

This project is 100% compatible with the [Wokwi Arduino/ESP32 Simulator](https://wokwi.com):

### Files Provided:
* [`diagram.json`](file:///c:/Users/ASUS/Desktop/IOT/diagram.json): Full Wokwi circuit definition with ESP32 DevKit, HC-SR04/JSN-SR04T ultrasonic sensor, rain slide switch, 1-channel relay, 3 LEDs (Green/Yellow/Red), 220Ω/1kΩ/2kΩ resistors, and buzzer.
* [`sketch.ino`](file:///c:/Users/ASUS/Desktop/IOT/sketch.ino): Clean Arduino sketch for Wokwi simulation.
* [`wokwi.toml`](file:///c:/Users/ASUS/Desktop/IOT/wokwi.toml): Configuration file for Wokwi VS Code extension or CLI.

### Quick Start (Web):
1. Open **[wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)** in your browser.
2. Click the **`diagram.json`** tab and paste the contents of [`diagram.json`](file:///c:/Users/ASUS/Desktop/IOT/diagram.json).
3. Click the **`sketch.ino`** tab and paste the contents of [`sketch.ino`](file:///c:/Users/ASUS/Desktop/IOT/sketch.ino).
4. Click the green **Play (▶)** button!
5. **Interactive Controls in Wokwi:**
   * Click on the ultrasonic sensor to drag the distance slider up and down.
   * Toggle the rain slide switch to simulate rainfall.
   * Watch the LEDs glow, relay activate, buzzer sound, and serial monitor stream telemetry!

---

---

## ⚡ Direct Physical Hardware Integration (Web Serial API)

Your ESP32 hardware is fully connected and integrated with the project!

### What Was Done:
1. **Physical ESP32 Flashed**: The firmware has been compiled and uploaded directly to your ESP32 on **`COM3`** at 115200 baud.
2. **Two-Way Web Serial Bridge**: The interactive web dashboard connects directly to the ESP32 via your browser's native **Web Serial API** (Google Chrome or Microsoft Edge) with zero drivers, zero extra software, and zero cloud delay!
3. **Real Sensor Telemetry**: The web dashboard streams live readings from your physical hardware:
   * **Ultrasonic Distance** (GPIO 5 & 18) & calculated water level
   * **Raindrop Sensor** (GPIO 34 Analog & GPIO 25 Digital)
   * **Contact Water Sensor** (GPIO 35)
   * **Relay State & 12V Submersible Pump Status** (GPIO 23)
   * **LED Alarm States** (Green GPIO 19, Yellow GPIO 21, Red GPIO 22)
   * **Acoustic Warning Buzzer** (GPIO 26)
4. **Remote Hardware Actuation**: From the dashboard, you can trigger:
   * **"Auto (ESP32 Relay)"**: Let the ESP32 autonomously trigger the pump when water breaches flood threshold.
   * **"Force ON"**: Force the 12V pump relay to click ON immediately.
   * **"Force OFF"**: Force the 12V pump relay OFF.
   * **"💡 Test LEDs"**: Remotely flashes the physical Green, Yellow, and Red LEDs on your breadboard.
   * **"🔔 Test Buzzer"**: Remotely sounds the physical buzzer module.

### How to Connect & View Live Hardware:
1. Open Google Chrome or Microsoft Edge and navigate to:
   ```
   http://localhost:8000
   ```
2. Click the glowing **"⚡ Connect Real ESP32"** button in the top navigation bar.
3. In the browser popup, select **`Silicon Labs CP210x USB to UART Bridge (COM3)`** and click **Connect**.
4. The dashboard status badge will instantly turn **green (`● HARDWARE (COM)`)** and stream your live sensor telemetry into the gauges, graph, and serial monitor!

---

## 📁 Repository Files

* [`diagram.json`](file:///c:/Users/ASUS/Desktop/IOT/diagram.json): Complete Wokwi circuit & pin connection definition.
* [`sketch.ino`](file:///c:/Users/ASUS/Desktop/IOT/sketch.ino): Arduino C++ code matching current hardware pinout and serial telemetry protocol.
* [`Flood_Early_Warning_ESP32/Flood_Early_Warning_ESP32.ino`](file:///c:/Users/ASUS/Desktop/IOT/Flood_Early_Warning_ESP32/Flood_Early_Warning_ESP32.ino): Arduino IDE project sketch flashed to the ESP32.
* [`IOT.ino`](file:///c:/Users/ASUS/Desktop/IOT/IOT.ino): Arduino CLI compatible sketch file.
* [`index.html`](file:///c:/Users/ASUS/Desktop/IOT/index.html): Interactive visual testbench, 1:1 schematic twin, and real-time Web Serial telemetry dashboard.
* [`simulator.js`](file:///c:/Users/ASUS/Desktop/IOT/simulator.js): Audio engine, physics engine, and Web Serial API communication layer.
* [`styles.css`](file:///c:/Users/ASUS/Desktop/IOT/styles.css): High-fidelity dark mode styles, animated circuits, and dashboard telemetry cards.
* [`README.md`](file:///c:/Users/ASUS/Desktop/IOT/README.md): System documentation, wiring tables, and hardware guide.


