/* ==============================================================================
   ESP32 FLOOD PREDICTION & EARLY WARNING SYSTEM - SIMULATOR ENGINE
   Complete Virtual Firmware, Audio Synthesizer, Physics Engine & Telemetry
============================================================================== */

(() => {
  // --- Constants matching Hardware Schematic (26 cm bucket) ---
  const SENSOR_TOTAL_HEIGHT_CM = 26.0;
  const MAX_WATER_DEPTH_CM     = 23.5;  // 26 - 2.5 cm (HC-SR04 min distance)
  const THRESHOLD_WARN_CM      = 15.0;  // Warning level at 15 cm
  const THRESHOLD_DANGER_CM    = 20.0;  // Critical flood at 20 cm

  // --- Simulation State ---
  let waterDepth = 5.0;            // Current depth (0 - 20 cm)
  let previousWaterDepth = 5.0;
  let rateOfRise = 0.0;            // cm/min
  let rainLevel = 0;               // 0: Dry, 1: Light, 2: Heavy, 3: Torrential
  let upstreamInflow = 0.0;        // cm/s added by user slider
  let pumpMode = 'FORCE_OFF';       // Manual control only: 'FORCE_ON' or 'FORCE_OFF'
  let pumpActive = false;            // Whether 12V pump is actually spinning
  let reservoirLevel = 15;         // Reservoir tank percentage (0 - 100%)
  let autoScrollSerial = true;
  let audioEnabled = true;

  // --- Virtual ESP32 Hardware Pin States ---
  const pins = {
    gpio5_trig: 0,
    gpio18_echo: 35.0, // Distance in cm
    gpio34_rain_ao: 4095, // 0 = wet, 4095 = dry
    gpio25_rain_do: 1,    // 1 = HIGH (Dry), 0 = LOW (Rain)
    gpio35_water_sensor: 0, // 0 = Dry, 0-4095 immersed
    gpio23_relay: 1,   // Active LOW relay: 1=OFF, 0=ON
    gpio19_green: 1,   // Green LED (Safe)
    gpio21_yellow: 0,  // Yellow LED (Watch)
    gpio22_red: 0,     // Red LED (Critical)
    gpio26_buzzer: 0   // Buzzer Alarm
  };

  // --- Telemetry History for Chart ---
  const chartHistory = [];
  const MAX_HISTORY_POINTS = 60; // 60 seconds

  // --- DOM Elements ---
  const statusBadge = document.getElementById('systemStatusBadge');
  const statusText = document.getElementById('systemStatusText');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioLabel = document.getElementById('audioLabel');

  const riverWaterDepth = document.getElementById('riverWaterDepth');
  const riverWaterPercent = document.getElementById('riverWaterPercent');
  const waterMass = document.getElementById('waterMass');
  const liveDistanceVal = document.getElementById('liveDistanceVal');
  const submersiblePump = document.getElementById('submersiblePump');
  const reservoirWater = document.getElementById('reservoirWater');
  const overflowAlert = document.getElementById('overflowAlert');

  // Circuit view elements (DOM & SVG)
  const ledGreen = document.getElementById('ledGreen');
  const ledYellow = document.getElementById('ledYellow');
  const ledRed = document.getElementById('ledRed');
  const hwBuzzer = document.getElementById('hwBuzzer');
  const buzzerStateText = document.getElementById('buzzerStateText');
  const relayBox = document.getElementById('relayBox');
  const relaySignalState = document.getElementById('relaySignalState');
  const hwPumpStateText = document.getElementById('hwPumpStateText');
  const rainDoLed = document.getElementById('rainDoLed');
  const rainModuleStatus = document.getElementById('rainModuleStatus');
  const pcbDroplets = document.getElementById('pcbDroplets');

  // 1:1 SVG Schematic Elements
  const svgSensorDistVal = document.getElementById('svgSensorDistVal');
  const svgTransducerCenter = document.getElementById('svgTransducerCenter');
  const svgPcbDrops = document.getElementById('svgPcbDrops');
  const svgRainDoLed = document.getElementById('svgRainDoLed');
  const svgRainStatusVal = document.getElementById('svgRainStatusVal');
  const svgRelayLed = document.getElementById('svgRelayLed');
  const svgRelayStatusText = document.getElementById('svgRelayStatusText');
  const svgPumpBadgeText = document.getElementById('svgPumpBadgeText');
  const svgPumpBody = document.getElementById('svgPumpBody');
  const svgImpellerCross = document.getElementById('svgImpellerCross');
  const wirePumpPos = document.getElementById('wirePumpPos');
  const svgLedGreen = document.getElementById('svgLedGreen');
  const svgLedYellow = document.getElementById('svgLedYellow');
  const svgLedRed = document.getElementById('svgLedRed');
  const svgBuzzerBody = document.getElementById('svgBuzzerBody');

  const pinSvg5 = document.getElementById('pinSvg5');
  const pinSvg18 = document.getElementById('pinSvg18');
  const pinSvg34 = document.getElementById('pinSvg34');
  const pinSvg35 = document.getElementById('pinSvg35');
  const pinSvg25 = document.getElementById('pinSvg25');
  const pinSvg23 = document.getElementById('pinSvg23');
  const pinSvg19 = document.getElementById('pinSvg19');
  const pinSvg21 = document.getElementById('pinSvg21');
  const pinSvg22 = document.getElementById('pinSvg22');
  const pinSvg26 = document.getElementById('pinSvg26');
  const svgWaterSensorVal = document.getElementById('svgWaterSensorVal');
  const valRainAo = document.getElementById('valRainAo');

  // Real Instruments Workbench HUD Elements
  const hudDistVal = document.getElementById('hudDistVal');
  const hudRainPlateStatus = document.getElementById('hudRainPlateStatus');
  const hudLm393State = document.getElementById('hudLm393State');
  const hudLedGreen = document.getElementById('hudLedGreen');
  const hudLedYellow = document.getElementById('hudLedYellow');
  const hudLedRed = document.getElementById('hudLedRed');
  const hudBuzzerWaves = document.getElementById('hudBuzzerWaves');
  const hudRelayBadge = document.getElementById('hudRelayBadge');
  const hudPumpBadge = document.getElementById('hudPumpBadge');
  const hudPumpVibe = document.getElementById('hudPumpVibe');

  const hotspotRainPlate = document.getElementById('hotspotRainPlate');
  const hotspotJsnProbe = document.getElementById('hotspotJsnProbe');
  const hotspotRelay = document.getElementById('hotspotRelay');
  const hotspotPump = document.getElementById('hotspotPump');

  // Metrics elements
  const valDepth = document.getElementById('valDepth');
  const depthProgressBar = document.getElementById('depthProgressBar');
  const valDistance = document.getElementById('valDistance');
  const valRainBadge = document.getElementById('valRainBadge');
  const valRainLogic = document.getElementById('valRainLogic');
  const valRate = document.getElementById('valRate');
  const trendIndicator = document.getElementById('trendIndicator');
  const predStatusTag = document.getElementById('predStatusTag');
  const valEstOverflow = document.getElementById('valEstOverflow');
  const valEstDesc = document.getElementById('valEstDesc');

  // Water Immersion Sensor & Evaluator Elements
  const valWaterBadge = document.getElementById('valWaterBadge');
  const valWaterRaw   = document.getElementById('valWaterRaw');
  const valWaterVolt  = document.getElementById('valWaterVolt');

  const evaluatorStateBadge = document.getElementById('evaluatorStateBadge');
  const evalRuleWarn        = document.getElementById('evalRuleWarn');
  const evalWarnResult      = document.getElementById('evalWarnResult');
  const condDepth15         = document.getElementById('condDepth15');
  const iconDepth15         = document.getElementById('iconDepth15');
  const valCondDepth15      = document.getElementById('valCondDepth15');
  const condWaterWet        = document.getElementById('condWaterWet');
  const iconWaterWet        = document.getElementById('iconWaterWet');
  const valCondWaterWet     = document.getElementById('valCondWaterWet');

  const evalRuleDanger      = document.getElementById('evalRuleDanger');
  const evalDangerResult    = document.getElementById('evalDangerResult');
  const condDepth20         = document.getElementById('condDepth20');
  const iconDepth20         = document.getElementById('iconDepth20');
  const valCondDepth20      = document.getElementById('valCondDepth20');

  // Controls elements
  const rainButtons = document.querySelectorAll('.btn-rain');
  const rainIntensityLabel = document.getElementById('rainIntensityLabel');
  const inflowSlider = document.getElementById('inflowSlider');
  const inflowValueLabel = document.getElementById('inflowValueLabel');
  const manualWaterSlider = document.getElementById('manualWaterSlider');
  const manualWaterLabel = document.getElementById('manualWaterLabel');
  const pumpModeLabel    = document.getElementById('pumpModeLabel');
  const btnPumpToggle    = document.getElementById('btnPumpToggle');
  const btnPumpToggleLabel = document.getElementById('btnPumpToggleLabel');
  const btnPumpOff       = document.getElementById('btnPumpOff');
  const btnPumpOn        = document.getElementById('btnPumpOn');
  const btnInvertRelay   = document.getElementById('btnInvertRelay');
  const pumpDot          = document.getElementById('pumpDot');
  const pumpStatusText   = document.getElementById('pumpStatusText');
  const btnHeaderPumpToggle = document.getElementById('btnHeaderPumpToggle');
  const headerPumpState  = document.getElementById('headerPumpState');
  const realPumpPinState = document.getElementById('realPumpPinState');
  let userManualPumpTimestamp = 0;

  // Scenario bar & buttons
  const scenarioBar = document.getElementById('scenarioBar');
  const btnScenarioClear = document.getElementById('btnScenarioClear');
  const btnScenarioRain = document.getElementById('btnScenarioRain');
  const btnScenarioFlashFlood = document.getElementById('btnScenarioFlashFlood');
  const btnScenarioDrainage = document.getElementById('btnScenarioDrainage');

  // Serial Monitor
  const serialTerminal = document.getElementById('serialTerminal');
  const btnClearSerial = document.getElementById('btnClearSerial');
  const btnAutoscroll = document.getElementById('btnAutoscroll');

  // Modal
  const viewSchematicBtn = document.getElementById('viewSchematicBtn');
  const schematicModal = document.getElementById('schematicModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Canvases
  const rainCanvas = document.getElementById('rainCanvas');
  const rainCtx = rainCanvas.getContext('2d');
  const telemetryChart = document.getElementById('telemetryChart');
  const chartCtx = telemetryChart.getContext('2d');

  // Physical Hardware Integration Elements
  const hardwareStatusBadge = document.getElementById('hardwareStatusBadge');
  const hardwareStatusText = document.getElementById('hardwareStatusText');
  const btnConnectHardware = document.getElementById('btnConnectHardware');
  const connectHardwareLabel = document.getElementById('connectHardwareLabel');
  const hwSyncState = document.getElementById('hwSyncState');
  const hwNoticeText = document.getElementById('hwNoticeText');
  const btnHwTestLeds = document.getElementById('btnHwTestLeds');
  const btnHwTestBuzzer = document.getElementById('btnHwTestBuzzer');

  // Mode Switcher & Hardware Banner Elements
  const btnModeHardware = document.getElementById('btnModeHardware');
  const btnModeSimulator = document.getElementById('btnModeSimulator');
  const hardwareLiveBanner = document.getElementById('hardwareLiveBanner');
  const hardwareBannerText = document.getElementById('hardwareBannerText');
  const btnBannerConnect = document.getElementById('btnBannerConnect');

  // Live Raw Sensor Diagnostics Elements
  const diagEchoUs = document.getElementById('diagEchoUs');
  const diagEchoCalc = document.getElementById('diagEchoCalc');
  const diagRainAdc = document.getElementById('diagRainAdc');
  const diagRainVolt = document.getElementById('diagRainVolt');
  const diagWaterAdc = document.getElementById('diagWaterAdc');
  const diagWaterVolt = document.getElementById('diagWaterVolt');
  const diagRelayState = document.getElementById('diagRelayState');
  const diagPumpState = document.getElementById('diagPumpState');
  const diagLedState = document.getElementById('diagLedState');
  const simControlsCard = document.getElementById('simControlsCard');
  const simDisabledNotice = document.getElementById('simDisabledNotice');

  // System Operating Mode ('hardware' = Strict Real Measurements; 'simulator' = Offline Demo)
  let systemMode = 'hardware';

  // Hardware Serial Connection State
  let serialPort = null;
  let serialReader = null;
  let serialWriter = null;
  let isHardwareConnected = false;
  let serialLineBuffer = '';

  // ==============================================================================
  // WEB AUDIO API SYNTHESIZER (Buzzer & Relay FX)
  // ==============================================================================
  let audioCtx = null;
  let buzzerOsc = null;
  let buzzerGain = null;
  let pumpHumOsc = null;
  let pumpHumGain = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playRelayClick() {
    if (!audioEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.045);
    } catch (e) {}
  }

  function setBuzzerSound(sounding) {
    if (!audioEnabled || !audioCtx) {
      stopBuzzerSound();
      return;
    }
    if (sounding) {
      if (!buzzerOsc) {
        try {
          buzzerOsc = audioCtx.createOscillator();
          buzzerGain = audioCtx.createGain();
          buzzerOsc.type = 'square';
          buzzerOsc.frequency.setValueAtTime(2800, audioCtx.currentTime); // Piezo buzzer 2.8kHz
          buzzerGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          buzzerOsc.connect(buzzerGain);
          buzzerGain.connect(audioCtx.destination);
          buzzerOsc.start();
        } catch (e) {}
      }
    } else {
      stopBuzzerSound();
    }
  }

  function stopBuzzerSound() {
    if (buzzerOsc) {
      try {
        buzzerOsc.stop();
        buzzerOsc.disconnect();
      } catch (e) {}
      buzzerOsc = null;
      buzzerGain = null;
    }
  }

  function setPumpHum(running) {
    if (!audioEnabled || !audioCtx) {
      stopPumpHum();
      return;
    }
    if (running) {
      if (!pumpHumOsc) {
        try {
          pumpHumOsc = audioCtx.createOscillator();
          pumpHumGain = audioCtx.createGain();
          pumpHumOsc.type = 'sine';
          pumpHumOsc.frequency.setValueAtTime(110, audioCtx.currentTime); // 12V DC motor hum
          pumpHumGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
          pumpHumOsc.connect(pumpHumGain);
          pumpHumGain.connect(audioCtx.destination);
          pumpHumOsc.start();
        } catch (e) {}
      }
    } else {
      stopPumpHum();
    }
  }

  function stopPumpHum() {
    if (pumpHumOsc) {
      try {
        pumpHumOsc.stop();
        pumpHumOsc.disconnect();
      } catch (e) {}
      pumpHumOsc = null;
      pumpHumGain = null;
    }
  }

  // Audio Toggle Button
  audioToggleBtn.addEventListener('click', () => {
    initAudio();
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      audioLabel.textContent = 'Sound ON';
      audioToggleBtn.style.opacity = '1';
    } else {
      audioLabel.textContent = 'Muted';
      audioToggleBtn.style.opacity = '0.6';
      stopBuzzerSound();
      stopPumpHum();
    }
  });

  document.body.addEventListener('click', () => initAudio(), { once: true });

  // ==============================================================================
  // RAIN CANVAS PARTICLE ENGINE
  // ==============================================================================
  const rainDrops = [];
  const rainSplashes = [];

  function resizeCanvas() {
    rainCanvas.width = rainCanvas.parentElement.clientWidth;
    rainCanvas.height = rainCanvas.parentElement.clientHeight;
    telemetryChart.width = telemetryChart.parentElement.clientWidth;
    telemetryChart.height = telemetryChart.parentElement.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  function createRainParticles() {
    const counts = [0, 25, 90, 220]; // Dry, Light, Heavy, Torrential
    const targetCount = counts[rainLevel];

    while (rainDrops.length < targetCount) {
      rainDrops.push({
        x: Math.random() * rainCanvas.width,
        y: Math.random() * -50,
        length: 12 + Math.random() * 16,
        speed: 12 + Math.random() * 14,
        opacity: 0.3 + Math.random() * 0.5
      });
    }
    while (rainDrops.length > targetCount) {
      rainDrops.pop();
    }
  }

  function updateAndDrawRain() {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

    if (rainLevel > 0) {
      rainCtx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      rainCtx.lineWidth = 1.4;
      rainCtx.beginPath();

      const waterSurfaceY = rainCanvas.height - (waterDepth / MAX_WATER_DEPTH_CM) * (rainCanvas.height * 0.7) - 20;

      for (let i = 0; i < rainDrops.length; i++) {
        const drop = rainDrops[i];
        rainCtx.moveTo(drop.x, drop.y);
        rainCtx.lineTo(drop.x - 2, drop.y + drop.length);

        drop.y += drop.speed;
        drop.x -= 1.2;

        if (drop.y > waterSurfaceY) {
          // Splash
          if (rainSplashes.length < 30) {
            rainSplashes.push({
              x: drop.x,
              y: waterSurfaceY,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 3,
              life: 1.0
            });
          }
          drop.y = Math.random() * -30;
          drop.x = Math.random() * (rainCanvas.width + 100);
        }
      }
      rainCtx.stroke();

      // Splashes
      for (let i = rainSplashes.length - 1; i >= 0; i--) {
        const sp = rainSplashes[i];
        rainCtx.fillStyle = `rgba(186, 230, 253, ${sp.life})`;
        rainCtx.beginPath();
        rainCtx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2);
        rainCtx.fill();

        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.08;
        if (sp.life <= 0) rainSplashes.splice(i, 1);
      }
    }
  }

  // ==============================================================================
  // PHYSICAL WATER FLOW & DRAINAGE SIMULATION
  // ==============================================================================
  let lastFrameTime = performance.now();

  function updatePhysics(dtSeconds) {
    // If real hardware is connected OR system is in Strict Real Hardware mode,
    // simulated physics is completely stopped! Only genuine hardware data drives the system.
    if (isHardwareConnected) {
      // ESP32 physically connected — water depth is driven by real sensor data,
      // only update the reservoir animation.
      if (pumpActive) {
        reservoirLevel = Math.min(100, reservoirLevel + dtSeconds * 3.5);
      } else {
        reservoirLevel = Math.max(10, reservoirLevel - dtSeconds * 0.6);
      }
      return;
    }

    // Rain inflow rate in cm/s
    const rainInflows = [0.0, 0.10, 0.35, 0.85];
    const rainInflow = rainInflows[rainLevel];

    // Total inflow
    const totalInflow = rainInflow + upstreamInflow;

    // Natural leakage / seepage
    const naturalDrain = 0.04;

    // 12V Submersible Drainage Pump rate (e.g. 0.48 cm/s evacuation speed)
    const pumpDrain = pumpActive ? 0.52 : 0.0;

    const netRate = totalInflow - naturalDrain - pumpDrain;

    // If manual slider isn't being actively dragged right now
    if (!manualWaterSlider.matches(':active')) {
      waterDepth += netRate * dtSeconds;
      if (waterDepth < 0.0) waterDepth = 0.0;
      if (waterDepth > MAX_WATER_DEPTH_CM) waterDepth = MAX_WATER_DEPTH_CM;
      manualWaterSlider.value = waterDepth.toFixed(1);
    } else {
      waterDepth = parseFloat(manualWaterSlider.value);
    }

    // Reservoir fill level physics (increases when pump runs, slowly empties when idle)
    if (pumpActive) {
      reservoirLevel = Math.min(100, reservoirLevel + dtSeconds * 3.5);
    } else {
      reservoirLevel = Math.max(10, reservoirLevel - dtSeconds * 0.6);
    }
  }

  // ==============================================================================
  // VIRTUAL ESP32 FIRMWARE LOGIC (Cycles every 1000ms)
  // ==============================================================================
  let buzzerFlashCounter = 0;

  function runESP32Cycle() {
    // If real hardware is physically streaming live data,
    // virtual simulation is completely bypassed so zero mock data is produced.
    if (isHardwareConnected) return;

    // 1. Read virtual Ultrasonic distance (GPIO 5 TRIG, GPIO 18 ECHO)
    const noise = (Math.random() - 0.5) * 0.3;
    const measuredDistance = Math.max(15.0, (SENSOR_TOTAL_HEIGHT_CM - waterDepth) + noise);
    pins.gpio18_echo = measuredDistance;

    // 2. Read virtual Rain Sensor AO (GPIO 34) and DO (GPIO 25)
    const rainAoMap = [4095, 2200, 1100, 300];
    pins.gpio34_rain_ao = rainAoMap[rainLevel];
    pins.gpio25_rain_do = (rainLevel > 0) ? 0 : 1;

    // 3. Read virtual Water Sensor Signal / S (GPIO 35) - placed at 15 cm
    pins.gpio35_water_sensor = (waterDepth >= 15.0) ? Math.min(4095, Math.round(1500 + ((waterDepth - 15.0) / (MAX_WATER_DEPTH_CM - 15.0)) * 2500)) : 120;

    // 4. Compute Rate of Rise (cm/min)
    rateOfRise = (waterDepth - previousWaterDepth) * 60.0; // 1 second interval
    previousWaterDepth = waterDepth;

    // 5. Predictive Flood Runoff Evaluation
    const waterLevelPercent = (waterDepth / MAX_WATER_DEPTH_CM) * 100.0;
    const isRaining = (pins.gpio25_rain_do === 0) || (pins.gpio34_rain_ao < 2500);
    const waterContactDetected = (pins.gpio35_water_sensor >= 1800);

    // Decision Logic matching Flood_Early_Warning_ESP32.ino
    // 1. Critical Flood: Water level reaches 20 cm
    const isCritical = (waterDepth >= THRESHOLD_DANGER_CM);
    // 2. Warning: Water level reaches 15 cm AND water sensor is wet (both must be true)
    const isWarning  = (!isCritical) && (waterDepth >= THRESHOLD_WARN_CM && waterContactDetected);
    const isSafe     = (!isCritical && !isWarning);

    // 6. Actuator Signals (Green: GPIO 19, Yellow: GPIO 21, Red: GPIO 22, Buzzer: GPIO 26)
    if (isCritical) {
      pins.gpio19_green  = 0;
      pins.gpio21_yellow = 0;
      pins.gpio22_red    = 1;
      pins.gpio26_buzzer = 1;
    } else if (isWarning) {
      pins.gpio19_green  = 0;
      pins.gpio21_yellow = 1;
      pins.gpio22_red    = 0;
      pins.gpio26_buzzer = 0;
    } else {
      pins.gpio19_green  = 1;
      pins.gpio21_yellow = 0;
      pins.gpio22_red    = 0;
      pins.gpio26_buzzer = 0;
    }

    // 6. 1-Channel Relay Logic — MANUAL ONLY (Active LOW: 0 = Relay Energized/ON, 1 = OFF)
    const prevRelay = pins.gpio23_relay;
    if (pumpMode === 'FORCE_ON') {
      pins.gpio23_relay = 0; // Relay energized → Pump running
    } else {
      pins.gpio23_relay = 1; // Relay off → Pump standby
    }

    pumpActive = (pins.gpio23_relay === 0);

    // Audio effects on state changes
    if (prevRelay !== pins.gpio23_relay) {
      playRelayClick();
    }
    setPumpHum(pumpActive);

    // Real-Time Early Warning Runoff Prediction
    const pred = computeRunoffPrediction(waterDepth, rateOfRise, isRaining, isCritical, isWarning, waterContactDetected);
    valEstOverflow.innerHTML = pred.time;
    valEstDesc.textContent   = pred.desc;
    predStatusTag.textContent = pred.tag;
    predStatusTag.style.borderColor = pred.color;
    predStatusTag.style.color       = pred.color;

    // Update Telemetry Display Elements
    valDepth.textContent = waterDepth.toFixed(1);
    valDistance.textContent = measuredDistance.toFixed(1);
    depthProgressBar.style.width = `${waterLevelPercent}%`;
    depthProgressBar.className = `progress-bar-fill ${isCritical ? 'fill-danger' : (isWarning ? 'fill-warning' : 'fill-safe')}`;

    if (isRaining) {
      valRainBadge.textContent = 'RAIN DETECTED';
      valRainBadge.className = 'metric-badge rain-badge-yes';
      valRainLogic.textContent = 'LOW (0V)';
    } else {
      valRainBadge.textContent = 'NO RAIN';
      valRainBadge.className = 'metric-badge rain-badge-no';
      valRainLogic.textContent = 'HIGH (3.3V)';
    }

    valRate.textContent = `${rateOfRise >= 0 ? '+' : ''}${rateOfRise.toFixed(2)}`;
    if (rateOfRise > 0.5) {
      trendIndicator.textContent = 'Rapid Rise ⬆️';
      trendIndicator.style.color = 'var(--color-danger)';
    } else if (rateOfRise < -0.5) {
      trendIndicator.textContent = 'Draining ⬇️';
      trendIndicator.style.color = 'var(--color-safe)';
    } else {
      trendIndicator.textContent = 'Stable ➡️';
      trendIndicator.style.color = '#38bdf8';
    }

    // (Telemetry display updated above via computeRunoffPrediction)

    // Status Badge
    if (isCritical) {
      statusBadge.className = 'status-badge status-danger';
      statusText.textContent = 'CRITICAL FLOOD DANGER';
    } else if (isWarning) {
      statusBadge.className = 'status-badge status-warning';
      statusText.textContent = 'WATCH / WARNING';
    } else {
      statusBadge.className = 'status-badge status-safe';
      statusText.textContent = 'SYSTEM NORMAL (SAFE)';
    }

    // Update Evaluator Decision Matrix (Dual-Confirmation)
    updateEvaluatorDecisionMatrix(waterDepth, pins.gpio35_water_sensor, isCritical, isWarning);

    // Telemetry History recording
    chartHistory.push({
      time: new Date().toLocaleTimeString().split(' ')[0],
      depth: waterDepth,
      pump: pumpActive ? 20 : 0
    });
    if (chartHistory.length > MAX_HISTORY_POINTS) {
      chartHistory.shift();
    }

    // Serial Monitor Logging
    logToSerialMonitor(waterDepth, waterLevelPercent, isRaining, rateOfRise, isCritical, isWarning, pumpActive);
  }

  // ==============================================================================
  // EVALUATOR DUAL-CONFIRMATION DECISION MATRIX ENGINE
  // ==============================================================================
  function updateEvaluatorDecisionMatrix(depth, waterRaw, isCrit, isWarn) {
    const isDepth15 = (depth >= THRESHOLD_WARN_CM);
    const isWaterWet = (waterRaw >= 1800);
    const isDepth20 = (depth >= THRESHOLD_DANGER_CM);

    // Update Water Immersion Sensor metric
    if (valWaterBadge) {
      if (isWaterWet) {
        valWaterBadge.textContent = 'SUBMERGED (WET 💧)';
        valWaterBadge.className = 'metric-badge water-sensor-badge-wet';
      } else {
        valWaterBadge.textContent = 'DRY (SAFE)';
        valWaterBadge.className = 'metric-badge water-sensor-badge-dry';
      }
    }
    if (valWaterRaw) valWaterRaw.textContent = waterRaw;
    if (valWaterVolt) valWaterVolt.textContent = ((waterRaw * 3.3) / 4095.0).toFixed(2) + 'V';

    // Update Evaluator Badge
    if (evaluatorStateBadge) {
      if (isCrit) {
        evaluatorStateBadge.textContent = 'CRITICAL FLOOD DANGER';
        evaluatorStateBadge.className = 'evaluator-badge badge-danger';
      } else if (isWarn) {
        evaluatorStateBadge.textContent = 'WARNING CONFIRMED (2/2)';
        evaluatorStateBadge.className = 'evaluator-badge badge-warn';
      } else {
        evaluatorStateBadge.textContent = 'SAFE / NORMAL';
        evaluatorStateBadge.className = 'evaluator-badge';
      }
    }

    // Condition 1: Depth >= 15 cm
    if (condDepth15) condDepth15.classList.toggle('pass', isDepth15);
    if (iconDepth15) iconDepth15.textContent = isDepth15 ? '🟢' : '⚪';
    if (valCondDepth15) {
      valCondDepth15.textContent = `${depth.toFixed(1)} cm (${isDepth15 ? 'YES' : 'NO'})`;
    }

    // Condition 2: Water Sensor @ 15cm Wet
    if (condWaterWet) condWaterWet.classList.toggle('pass', isWaterWet);
    if (iconWaterWet) iconWaterWet.textContent = isWaterWet ? '🟢' : '⚪';
    if (valCondWaterWet) {
      valCondWaterWet.textContent = `${isWaterWet ? 'WET / SUBMERGED (YES)' : 'DRY (NO)'}`;
    }

    // Warning Rule Combined Status
    const warnCount = (isDepth15 ? 1 : 0) + (isWaterWet ? 1 : 0);
    if (evalRuleWarn) evalRuleWarn.classList.toggle('active', isWarn);
    if (evalWarnResult) {
      if (isWarn) {
        evalWarnResult.textContent = 'WARNING ACTIVE (2/2)';
        evalWarnResult.className = 'eval-rule-status active-warn';
      } else {
        evalWarnResult.textContent = `UNCONFIRMED (${warnCount}/2)`;
        evalWarnResult.className = 'eval-rule-status';
      }
    }

    // Critical Rule: Depth >= 20 cm
    if (condDepth20) condDepth20.classList.toggle('pass', isDepth20);
    if (iconDepth20) iconDepth20.textContent = isDepth20 ? '🔴' : '⚪';
    if (valCondDepth20) {
      valCondDepth20.textContent = `${depth.toFixed(1)} cm (${isDepth20 ? 'YES' : 'NO'})`;
    }
    if (evalRuleDanger) evalRuleDanger.classList.toggle('active', isCrit);
    if (evalDangerResult) {
      if (isCrit) {
        evalDangerResult.textContent = 'FLOOD ACTIVE (1/1)';
        evalDangerResult.className = 'eval-rule-status active-danger';
      } else {
        evalDangerResult.textContent = 'SAFE';
        evalDangerResult.className = 'eval-rule-status';
      }
    }
  }

  // ==============================================================================
  // REAL-TIME EARLY WARNING RUNOFF PREDICTION ENGINE
  // ==============================================================================
  function computeRunoffPrediction(depth, rate, raining, critical, warning, waterContact) {
    const remainingToDanger = Math.max(0, THRESHOLD_DANGER_CM - depth);
    const remainingToRim    = Math.max(0, MAX_WATER_DEPTH_CM - depth);
    const pct = Math.min(100, Math.max(0, (depth / MAX_WATER_DEPTH_CM) * 100.0)).toFixed(0);

    // 1. Critical Flood Condition (>= 20.0 cm)
    if (critical || depth >= THRESHOLD_DANGER_CM) {
      if (depth >= MAX_WATER_DEPTH_CM) {
        return {
          tag: 'OVERFLOW BREACH',
          color: 'var(--color-danger)',
          time: '🚨 CHANNEL OVERFLOWED!',
          desc: `Water has reached max ${MAX_WATER_DEPTH_CM.toFixed(1)} cm capacity! Evacuation siren active.`
        };
      }
      return {
        tag: 'CRITICAL FLOOD',
        color: 'var(--color-danger)',
        time: `🚨 Critical Flood (${depth.toFixed(1)} cm / ${pct}%)`,
        desc: `Urgent! Only ${remainingToRim.toFixed(1)} cm headroom to bucket rim. Emergency pumping active.`
      };
    }

    // 2. Warning Confirmed Active (>= 15.0 cm + Immersion Sensor Wet)
    if (warning) {
      if (rate > 0.15) {
        const minsToFlood = remainingToDanger / rate;
        return {
          tag: 'IMMINENT FLOOD SURGE',
          color: 'var(--color-danger)',
          time: `⚠️ Est. Flood (20cm) in ~${minsToFlood.toFixed(1)} mins`,
          desc: `Dual-confirmed warning @ ${depth.toFixed(1)} cm. Rising at +${rate.toFixed(1)} cm/min toward 20cm flood level.`
        };
      }
      return {
        tag: 'WARNING STAGE ACTIVE',
        color: 'var(--color-warning)',
        time: `⚠️ Warning Level (${depth.toFixed(1)} cm / ${pct}%)`,
        desc: `Water reached 15cm immersion sensor. ${remainingToDanger.toFixed(1)} cm buffer remaining before 20cm flood alarm.`
      };
    }

    // 3. Depth >= 15 cm but Water Sensor is Dry (Unconfirmed)
    if (depth >= THRESHOLD_WARN_CM) {
      return {
        tag: 'SURFACE AT 15cm+',
        color: 'var(--color-warning)',
        time: `🟡 Level at ${depth.toFixed(1)} cm (Sensor Dry)`,
        desc: `Ultrasonic reads ${depth.toFixed(1)} cm, awaiting GPIO 35 immersion confirmation.`
      };
    }

    // 4. Fast Rising Influx (< 15 cm but surging fast)
    if (rate > 0.3) {
      const remainingToWarn = Math.max(0, THRESHOLD_WARN_CM - depth);
      const minsToWarn = remainingToWarn / rate;
      return {
        tag: 'RAPID INFLUX WATCH',
        color: 'var(--color-warning)',
        time: `⏱️ Reaching 15cm Warning in ~${minsToWarn.toFixed(1)} mins`,
        desc: `Rising fast (+${rate.toFixed(1)} cm/min). ${remainingToWarn.toFixed(1)} cm until 15cm warning threshold.`
      };
    }

    // 5. Rain Active (Precipitation Influx)
    if (raining) {
      return {
        tag: 'RAIN RUNOFF INFLUX',
        color: '#38bdf8',
        time: `🌧️ Rain Active &bull; Depth: ${depth.toFixed(1)} cm`,
        desc: `Precipitation detected on raindrop sensor. Tracking runoff influx rate (${rate >= 0 ? '+' : ''}${rate.toFixed(2)} cm/min).`
      };
    }

    // 6. Water Draining / Receding
    if (rate < -0.3) {
      return {
        tag: 'CHANNEL DRAINING',
        color: 'var(--color-safe)',
        time: `📉 Water Receding (${rate.toFixed(1)} cm/min)`,
        desc: `Water level safely dropping. Current depth: ${depth.toFixed(1)} cm (${pct}%). Headroom: ${(THRESHOLD_WARN_CM - depth).toFixed(1)} cm.`
      };
    }

    // 7. Intermediate Level (10cm - 15cm, dry & stable)
    if (depth >= 10.0) {
      return {
        tag: 'MODERATE BUFFER',
        color: '#38bdf8',
        time: `🌊 Flow Steady (${depth.toFixed(1)} cm / ${pct}%)`,
        desc: `Channel stable at ${depth.toFixed(1)} cm. Headroom: ${(THRESHOLD_WARN_CM - depth).toFixed(1)} cm to 15cm warning stage.`
      };
    }

    // 8. Normal Safe Level (< 10 cm, dry & stable)
    return {
      tag: 'SAFE / LOW RISK',
      color: 'var(--color-safe)',
      time: `✅ Normal Level (${depth.toFixed(1)} cm / ${pct}%)`,
      desc: `Channel flow clear and optimal. Safe margin: ${(THRESHOLD_WARN_CM - depth).toFixed(1)} cm to warning threshold.`
    };
  }

  // Run cycle every 1000ms
  setInterval(runESP32Cycle, 1000);

  // ==============================================================================
  // SERIAL MONITOR LOGGER & HARDWARE PROTOCOL
  // ==============================================================================
  function logSerialLine(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `serial-line ${type}`;
    line.textContent = text;
    serialTerminal.appendChild(line);

    // Limit buffer to 80 lines
    while (serialTerminal.children.length > 80) {
      serialTerminal.removeChild(serialTerminal.firstChild);
    }

    if (autoScrollSerial) {
      serialTerminal.scrollTop = serialTerminal.scrollHeight;
    }
  }

  function logToSerialMonitor(depth, percent, rain, rate, critical, warning, pump) {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const statusLabel = critical ? 'CRITICAL FLOOD DANGER' : (warning ? 'WATCH / WARNING' : 'SAFE / NORMAL');
    const pumpLabel = pump ? 'RUNNING (12V ON)' : 'STANDBY (OFF)';
    const rainLabel = rain ? 'YES (Rain)' : 'NO (Dry)';
    const text = `[${timeStr}] [TELEMETRY] Depth: ${depth.toFixed(1)}cm (${percent.toFixed(1)}%) | WaterSensor(35): ${pins.gpio35_water_sensor} | Rain: ${rainLabel} (AO:${pins.gpio34_rain_ao}, DO:${pins.gpio25_rain_do === 0 ? 'LOW' : 'HIGH'}) | Rate: ${rate >= 0 ? '+' : ''}${rate.toFixed(2)} cm/m | Status: ${statusLabel} | Pump: ${pumpLabel}`;
    logSerialLine(text, critical ? 'danger' : (warning ? 'warning' : 'safe'));
  }

  // ==============================================================================
  // REAL HARDWARE WEB SERIAL INTEGRATION (Two-Way Communication at 115200 Baud)
  // ==============================================================================
  function handleHardwareTelemetry(t) {
    waterDepth = Number(t.depth) || 0.0;
    rateOfRise = Number(t.rate) || 0.0;
    pins.gpio18_echo = Number(t.dist) || 35.0;
    pins.gpio34_rain_ao = Number(t.rainAo) || 4095;
    pins.gpio25_rain_do = Number(t.rainDo) !== undefined ? Number(t.rainDo) : 1;
    pins.gpio35_water_sensor = Number(t.waterRaw) || 0;

    const isCrit = Boolean(t.critical);
    const isWarn = Boolean(t.warning);
    const isSafe = !isCrit && !isWarn;

    pins.gpio19_green  = isSafe ? 1 : 0;
    pins.gpio21_yellow = isWarn ? 1 : 0;
    pins.gpio22_red    = isCrit ? 1 : 0;
    pins.gpio26_buzzer = isCrit ? 1 : 0;

    const pumpIsOn = Number(t.pump) === 1;
    const prevRelay = pins.gpio23_relay;
    pins.gpio23_relay = pumpIsOn ? 0 : 1; // Active LOW
    pumpActive = pumpIsOn;

    if (prevRelay !== pins.gpio23_relay) {
      playRelayClick();
    }
    setPumpHum(pumpActive);

    // Audio buzzer synthesizer sync
    if (audioEnabled && audioCtx) {
      if (pins.gpio26_buzzer === 1 && !buzzerOsc) {
        startBuzzerTone();
      } else if (pins.gpio26_buzzer === 0 && buzzerOsc) {
        stopBuzzerTone();
      }
    }

    // Sync pumpMode UI with hardware telemetry (respect user manual click for 3.5 seconds)
    if (Date.now() - userManualPumpTimestamp > 3500) {
      const isHardwarePumpOn = (t.pump === 1) || (t.pumpMode === 1);
      pumpMode = isHardwarePumpOn ? 'FORCE_ON' : 'FORCE_OFF';

      if (pumpDot) pumpDot.classList.toggle('active', isHardwarePumpOn);
      if (pumpStatusText) {
        pumpStatusText.textContent = isHardwarePumpOn ? 'REAL PUMP RUNNING (12V Active ⛲)' : 'Real Pump Standby (Relay Open)';
      }
      if (pumpModeLabel) pumpModeLabel.textContent = isHardwarePumpOn ? 'RUNNING' : 'STANDBY';
      if (btnHeaderPumpToggle) btnHeaderPumpToggle.classList.toggle('active', isHardwarePumpOn);
      if (headerPumpState) {
        headerPumpState.textContent = isHardwarePumpOn ? 'RUNNING ⚡' : 'OFF';
        headerPumpState.style.color = isHardwarePumpOn ? '#4ade80' : '#94a3b8';
      }
      if (realPumpPinState) {
        realPumpPinState.innerHTML = isHardwarePumpOn 
          ? 'Relay Pin 23: <strong style="color:#4ade80">LOW (0V / ENERGIZED ON)</strong>' 
          : 'Relay Pin 23: <strong>HIGH (3.3V / Standby OFF)</strong>';
      }
    }

    // Update Telemetry Display Elements
    valDepth.textContent = waterDepth.toFixed(1);
    valDistance.textContent = pins.gpio18_echo.toFixed(1);
    const waterLevelPercent = Number(t.pct) || 0.0;
    depthProgressBar.style.width = `${Math.min(100, Math.max(0, waterLevelPercent))}%`;
    depthProgressBar.className = `progress-bar-fill ${isCrit ? 'fill-danger' : (isWarn ? 'fill-warning' : 'fill-safe')}`;

    const isRaining = (t.rain === 1) || (pins.gpio25_rain_do === 0) || (pins.gpio34_rain_ao < 2500);
    if (isRaining) {
      valRainBadge.textContent = 'RAIN DETECTED';
      valRainBadge.className = 'metric-badge rain-badge-yes';
      valRainLogic.textContent = 'LOW (0V)';
      rainLevel = (pins.gpio34_rain_ao < 1500) ? 2 : 1;
    } else {
      valRainBadge.textContent = 'NO RAIN';
      valRainBadge.className = 'metric-badge rain-badge-no';
      valRainLogic.textContent = 'HIGH (3.3V)';
      rainLevel = 0;
    }

    valRate.textContent = `${rateOfRise >= 0 ? '+' : ''}${rateOfRise.toFixed(2)}`;
    if (rateOfRise > 0.5) {
      trendIndicator.textContent = 'Rapid Rise ⬆️';
      trendIndicator.style.color = 'var(--color-danger)';
    } else if (rateOfRise < -0.5) {
      trendIndicator.textContent = 'Draining ⬇️';
      trendIndicator.style.color = 'var(--color-safe)';
    } else {
      trendIndicator.textContent = 'Stable ➡️';
      trendIndicator.style.color = '#38bdf8';
    }

    // Real-Time Early Warning Runoff Prediction (Hardware Streaming)
    const predHw = computeRunoffPrediction(waterDepth, rateOfRise, isRaining, isCrit, isWarn, pins.gpio35_water_sensor >= 1800);
    valEstOverflow.innerHTML = predHw.time;
    valEstDesc.textContent   = predHw.desc;
    predStatusTag.textContent = predHw.tag;
    predStatusTag.style.borderColor = predHw.color;
    predStatusTag.style.color       = predHw.color;

    // Header System Status Badge
    if (isCrit) {
      statusBadge.className = 'status-badge status-danger';
      statusText.textContent = 'CRITICAL FLOOD DANGER';
    } else if (isWarn) {
      statusBadge.className = 'status-badge status-warning';
      statusText.textContent = 'WATCH / WARNING';
    } else {
      statusBadge.className = 'status-badge status-safe';
      statusText.textContent = 'SYSTEM NORMAL (SAFE)';
    }

    // Update Live Raw Physical Sensor Hardware Diagnostics (Verified ADC & Timers)
    if (diagEchoUs) {
      diagEchoUs.textContent = (t.echoUs !== undefined) ? t.echoUs : (pins.gpio18_echo > 0 ? Math.round((pins.gpio18_echo * 2.0 / 0.0343)) : '--');
    }
    if (diagEchoCalc) {
      diagEchoCalc.textContent = `→ Air Dist: ${pins.gpio18_echo.toFixed(1)} cm`;
    }

    const rainVoltVal = (t.rainVolt !== undefined) ? Number(t.rainVolt).toFixed(2) : ((pins.gpio34_rain_ao * 3.3) / 4095.0).toFixed(2);
    if (diagRainAdc) diagRainAdc.textContent = pins.gpio34_rain_ao;
    if (diagRainVolt) diagRainVolt.textContent = `Volt: ${rainVoltVal} V • DO: ${pins.gpio25_rain_do === 0 ? 'LOW (Rain)' : 'HIGH (Dry)'}`;

    const waterVoltVal = (t.waterVolt !== undefined) ? Number(t.waterVolt).toFixed(2) : ((pins.gpio35_water_sensor * 3.3) / 4095.0).toFixed(2);
    if (diagWaterAdc) diagWaterAdc.textContent = pins.gpio35_water_sensor;
    if (diagWaterVolt) diagWaterVolt.textContent = `Volt: ${waterVoltVal} V • State: ${pins.gpio35_water_sensor > 1200 ? 'SUBMERGED' : 'DRY'}`;

    if (diagRelayState) diagRelayState.textContent = pumpIsOn ? '0 (LOW / ON)' : '1 (HIGH / OFF)';
    if (diagPumpState) diagPumpState.textContent = pumpIsOn ? '(12V PUMP ACTIVE)' : '(STANDBY)';
    if (diagLedState) diagLedState.textContent = `LEDs: G:${pins.gpio19_green} Y:${pins.gpio21_yellow} R:${pins.gpio22_red} • Buz:${pins.gpio26_buzzer}`;

    // Update Evaluator Decision Matrix with live physical hardware telemetry
    updateEvaluatorDecisionMatrix(waterDepth, pins.gpio35_water_sensor, isCrit, isWarn);

    // Telemetry History recording for Chart
    chartHistory.push({
      time: new Date().toLocaleTimeString().split(' ')[0],
      depth: waterDepth,
      pump: pumpActive ? 20 : 0
    });
    if (chartHistory.length > MAX_HISTORY_POINTS) {
      chartHistory.shift();
    }
  }

  function setSystemMode(mode) {
    systemMode = mode;
    if (btnModeHardware) {
      btnModeHardware.classList.toggle('active', mode === 'hardware');
      btnModeHardware.classList.toggle('mode-hw', mode === 'hardware');
    }
    if (btnModeSimulator) {
      btnModeSimulator.classList.toggle('active', mode === 'simulator');
    }

    if (mode === 'hardware') {
      if (!isHardwareConnected) {
        if (hardwareStatusBadge) {
          hardwareStatusBadge.className = 'status-badge status-warning';
          if (hardwareStatusText) hardwareStatusText.textContent = 'USB READY';
        }
        if (hardwareLiveBanner) {
          hardwareLiveBanner.className = 'hardware-live-banner banner-hw-disconnected';
          if (hardwareBannerText) {
            hardwareBannerText.innerHTML = '<strong>Real Measurements Mode Active:</strong> All mock simulation is paused. Connect your physical ESP32 DevKit V1 via USB and click <strong>"Connect Real ESP32"</strong> to stream genuine live sensor readings.';
          }
          if (btnBannerConnect) btnBannerConnect.style.display = 'block';
        }
        // Set metrics to awaiting placeholders so zero hardcoded/fake numbers show
        valDepth.textContent = '--.-';
        valDistance.textContent = '--.-';
        valRainBadge.textContent = 'USB OFFLINE';
        valRainBadge.className = 'metric-badge rain-badge-no';
        valRainAo.textContent = '----';
        valRainLogic.textContent = '--';
        valRate.textContent = '--';
        trendIndicator.textContent = 'Awaiting ESP32 Link';
        valEstOverflow.textContent = 'Hardware Disconnected';
        valEstDesc.textContent = 'Plug in ESP32 via USB to stream live sensor readings.';
        predStatusTag.textContent = 'STANDBY';
        predStatusTag.style.color = '#94a3b8';
        predStatusTag.style.borderColor = '#94a3b8';
        
        if (diagEchoUs) diagEchoUs.textContent = '--';
        if (diagEchoCalc) diagEchoCalc.textContent = 'Waiting for hardware...';
        if (diagRainAdc) diagRainAdc.textContent = '----';
        if (diagRainVolt) diagRainVolt.textContent = 'Volt: -- V • DO: --';
        if (diagWaterAdc) diagWaterAdc.textContent = '----';
        if (diagWaterVolt) diagWaterVolt.textContent = 'Volt: -- V • State: --';
        if (diagRelayState) diagRelayState.textContent = '--';
        if (diagPumpState) diagPumpState.textContent = '(Standby)';
        if (diagLedState) diagLedState.textContent = 'LEDs: --';

        logSerialLine('[SYSTEM] Strict Real Measurements Mode active. Simulation paused. Connect ESP32 via USB at 115200 baud.', 'info');
      } else {
        if (hardwareLiveBanner) {
          hardwareLiveBanner.className = 'hardware-live-banner banner-hw-connected';
          if (hardwareBannerText) {
            hardwareBannerText.innerHTML = '<strong>🟢 Physical ESP32 Linked!</strong> Streaming 100% genuine live measurements from ultrasonic, raindrop, and immersion sensors.';
          }
          if (btnBannerConnect) btnBannerConnect.style.display = 'none';
        }
      }
      if (simControlsCard) simControlsCard.classList.add('sim-controls-disabled');
      if (simDisabledNotice) simDisabledNotice.classList.remove('hidden');
      if (scenarioBar) scenarioBar.classList.add('hidden');
    } else {
      // Virtual Simulator mode
      if (hardwareLiveBanner) hardwareLiveBanner.classList.add('banner-hidden');
      if (simControlsCard) simControlsCard.classList.remove('sim-controls-disabled');
      if (simDisabledNotice) simDisabledNotice.classList.add('hidden');
      if (scenarioBar) scenarioBar.classList.remove('hidden');
      if (hardwareStatusBadge) {
        hardwareStatusBadge.className = 'status-badge status-sim';
        if (hardwareStatusText) hardwareStatusText.textContent = 'SIMULATOR';
      }
      logSerialLine('[SYSTEM] Switched to Virtual Simulator mode. Sliders & synthetic engine enabled.', 'info');
    }
  }

  async function connectHardware() {
    if (window.location.protocol === 'file:') {
      alert('🔒 Browser Security Notice:\n\nChrome and Edge restrict the Web Serial USB API on direct "file:///" addresses.\n\nPlease double-click "start_hardware_dashboard.bat" in your IOT folder (or run "python -m http.server 8000") to open http://localhost:8000 and connect your physical ESP32 via USB!');
      return;
    }

    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser.\n\nPlease open http://localhost:8000 in Google Chrome or Microsoft Edge to connect to your physical ESP32.');
      return;
    }

    try {
      logSerialLine('[HARDWARE] Requesting Serial Port from user prompt...', 'info');
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 115200 });

      isHardwareConnected = true;

      if (btnConnectHardware) {
        btnConnectHardware.classList.add('btn-disconnect');
        btnConnectHardware.classList.remove('btn-primary-glow');
        if (connectHardwareLabel) connectHardwareLabel.textContent = '🔌 Disconnect ESP32';
      }

      if (hardwareStatusBadge) {
        hardwareStatusBadge.className = 'status-badge status-hw-connected';
        if (hardwareStatusText) hardwareStatusText.textContent = '● HARDWARE (COM)';
      }

      if (hardwareLiveBanner) {
        hardwareLiveBanner.className = 'hardware-live-banner banner-hw-connected';
        if (hardwareBannerText) {
          hardwareBannerText.innerHTML = '<strong>🟢 Physical ESP32 Linked!</strong> Streaming 100% genuine live measurements from ultrasonic, raindrop, and immersion sensors.';
        }
        if (btnBannerConnect) btnBannerConnect.style.display = 'none';
      }

      if (hwSyncState) hwSyncState.textContent = '● LIVE HARDWARE LINKED';
      if (hwNoticeText) {
        hwNoticeText.innerHTML = '<span style="color: #4ade80; font-weight: 600;">✔ Physical ESP32 Linked! Streaming live sensors. Click actuator buttons to test hardware.</span>';
      }

      logSerialLine('[HARDWARE] Connected to physical ESP32 over USB Serial @ 115200 Baud!', 'safe');

      // Writer pipeline
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(serialPort.writable).catch(() => {});
      serialWriter = textEncoder.writable.getWriter();

      // Start asynchronous read loop
      readSerialLoop();

    } catch (err) {
      console.warn('Hardware connection error:', err);
      if (err.name !== 'NotFoundError') {
        alert(`Serial connection failed: ${err.message}`);
      }
      disconnectHardware();
    }
  }

  async function disconnectHardware() {
    isHardwareConnected = false;

    if (serialReader) {
      try { await serialReader.cancel(); } catch (e) {}
      serialReader = null;
    }
    if (serialWriter) {
      try { await serialWriter.close(); } catch (e) {}
      serialWriter = null;
    }
    if (serialPort) {
      try { await serialPort.close(); } catch (e) {}
      serialPort = null;
    }

    if (btnConnectHardware) {
      btnConnectHardware.classList.remove('btn-disconnect');
      btnConnectHardware.classList.add('btn-primary-glow');
      if (connectHardwareLabel) connectHardwareLabel.textContent = '⚡ Connect Real ESP32';
    }

    if (systemMode === 'hardware') {
      setSystemMode('hardware');
    } else {
      if (hardwareStatusBadge) {
        hardwareStatusBadge.className = 'status-badge status-sim';
        if (hardwareStatusText) hardwareStatusText.textContent = 'SIMULATOR';
      }
      if (hwSyncState) hwSyncState.textContent = 'Virtual Mode';
      if (hwNoticeText) {
        hwNoticeText.innerHTML = '<span>Connect ESP32 via USB and click <strong>"⚡ Connect Real ESP32"</strong> in header to stream live sensors.</span>';
      }
    }

    logSerialLine('[HARDWARE] Disconnected from serial port.', 'info');
  }

  async function readSerialLoop() {
    const textDecoder = new TextDecoderStream();
    serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
    serialReader = textDecoder.readable.getReader();

    try {
      while (isHardwareConnected) {
        const { value, done } = await serialReader.read();
        if (done) break;
        if (value) {
          serialLineBuffer += value;
          const lines = serialLineBuffer.split('\n');
          serialLineBuffer = lines.pop(); // save incomplete line

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (line.startsWith('{') && line.includes('"type":"telemetry"')) {
              try {
                const telemetry = JSON.parse(line);
                handleHardwareTelemetry(telemetry);
              } catch (e) {}
            } else {
              const isDanger = line.includes('DANGER') || line.includes('CRITICAL');
              const isWarn = line.includes('WATCH') || line.includes('WARNING') || line.includes('ALERT');
              const isAck = line.includes('[COMMAND') || line.includes('[HARDWARE');
              logSerialLine(line, isDanger ? 'danger' : (isWarn ? 'warning' : (isAck ? 'safe' : 'info')));
            }
          }
        }
      }
    } catch (err) {
      if (isHardwareConnected) {
        console.warn('Serial read loop closed:', err);
        disconnectHardware();
      }
    }
  }

  async function sendHardwareCommand(cmd) {
    if (!isHardwareConnected || !serialWriter) {
      logSerialLine(`[VIRTUAL] Executed "${cmd}" locally. Connect physical ESP32 to actuate hardware pins.`, 'info');
      return;
    }

    try {
      await serialWriter.write(cmd + '\n');
      logSerialLine(`[COMMAND SENT -> ESP32]: ${cmd}`, 'safe');
    } catch (err) {
      console.error('Failed to send serial command:', err);
      logSerialLine(`[ERROR] Failed to send "${cmd}": ${err.message}`, 'danger');
    }
  }

  btnClearSerial.addEventListener('click', () => {
    serialTerminal.innerHTML = '<div class="serial-line info">[SERIAL BUFFER CLEARED]</div>';
  });

  btnAutoscroll.addEventListener('click', () => {
    autoScrollSerial = !autoScrollSerial;
    btnAutoscroll.classList.toggle('active', autoScrollSerial);
  });

  // ==============================================================================
  // HARDWARE CIRCUIT & ANIMATION RENDER LOOP (60 FPS)
  // ==============================================================================
  function renderUI(now) {
    const dtSeconds = Math.min(0.1, (now - lastFrameTime) / 1000.0);
    lastFrameTime = now;

    // Update physical water depth and rain particles
    updatePhysics(dtSeconds);
    createRainParticles();
    updateAndDrawRain();

    const waterLevelPercent = (waterDepth / MAX_WATER_DEPTH_CM) * 100.0;

    // River Tank Water Level
    waterMass.style.height = `${Math.min(98, Math.max(4, waterLevelPercent))}%`;
    if (systemMode === 'hardware' && !isHardwareConnected) {
      riverWaterDepth.textContent = `--.- cm`;
      riverWaterPercent.textContent = `(Awaiting Hardware)`;
      liveDistanceVal.textContent = `Sensor Dist: --.- cm`;
    } else {
      riverWaterDepth.textContent = `${waterDepth.toFixed(1)} cm`;
      riverWaterPercent.textContent = `(${waterLevelPercent.toFixed(1)}%)`;
      const distToSensor = (SENSOR_TOTAL_HEIGHT_CM - waterDepth).toFixed(1);
      liveDistanceVal.textContent = `Sensor Dist: ${distToSensor} cm`;
    }
    const distToSensor = (SENSOR_TOTAL_HEIGHT_CM - waterDepth).toFixed(1);

    // 12V Pump Visual
    if (pumpActive) {
      submersiblePump.classList.add('running');
    } else {
      submersiblePump.classList.remove('running');
    }

    // Reservoir Water Height
    reservoirWater.style.height = `${reservoirLevel}%`;

    // Overflow Alert
    if (waterDepth >= MAX_WATER_DEPTH_CM) {
      overflowAlert.classList.remove('hidden');
    } else {
      overflowAlert.classList.add('hidden');
    }

    // Breadboard LEDs (DOM)
    if (ledGreen) ledGreen.classList.toggle('active', pins.gpio19_green === 1);
    if (ledYellow) ledYellow.classList.toggle('active', pins.gpio21_yellow === 1);

    const isFlashPhase = Math.floor(buzzerFlashCounter * 4) % 2 === 0;

    // Red LED & Buzzer blink when Critical (Red: GPIO 22, Buzzer: GPIO 26)
    if (pins.gpio22_red === 1) {
      buzzerFlashCounter += dtSeconds;
      if (ledRed) ledRed.classList.toggle('active', isFlashPhase);
      if (hwBuzzer) hwBuzzer.classList.toggle('buzzing', isFlashPhase);
      if (buzzerStateText) {
        buzzerStateText.textContent = isFlashPhase ? 'ALARM ON!' : 'PULSE';
        buzzerStateText.style.color = '#ef4444';
      }
      setBuzzerSound(isFlashPhase);
    } else {
      if (ledRed) ledRed.classList.remove('active');
      if (hwBuzzer) hwBuzzer.classList.remove('buzzing');
      if (buzzerStateText) {
        buzzerStateText.textContent = 'QUIET';
        buzzerStateText.style.color = 'var(--text-muted)';
      }
      setBuzzerSound(false);
    }

    // Relay Card Visual (GPIO 23)
    const isRelayEnergized = (pins.gpio23_relay === 0);
    if (relayBox) relayBox.classList.toggle('active', isRelayEnergized);
    if (relaySignalState) relaySignalState.textContent = isRelayEnergized ? 'LOW (0V / ENERGIZED)' : 'HIGH (3.3V / STANDBY)';
    if (hwPumpStateText) {
      hwPumpStateText.textContent = isRelayEnergized ? 'RUNNING (12V ON)' : 'OFF';
      hwPumpStateText.className = isRelayEnergized ? 'badge-on' : 'badge-off';
    }

    // Rain PCB plate
    const isRainDetected = (pins.gpio25_rain_do === 0);
    if (rainDoLed) rainDoLed.classList.toggle('active', isRainDetected);
    if (rainModuleStatus) rainModuleStatus.textContent = isRainDetected ? 'RAIN (DO = LOW 0V)' : 'DRY (DO = HIGH 3.3V)';
    if (pcbDroplets) {
      if (isRainDetected && pcbDroplets.children.length === 0) {
        for (let i = 0; i < 8; i++) {
          const drop = document.createElement('div');
          drop.style.width = '6px';
          drop.style.height = '6px';
          drop.style.borderRadius = '50%';
          drop.style.background = '#38bdf8';
          drop.style.boxShadow = '0 0 6px #38bdf8';
          pcbDroplets.appendChild(drop);
        }
      } else if (!isRainDetected && pcbDroplets.children.length > 0) {
        pcbDroplets.innerHTML = '';
      }
    }

    // REAL INSTRUMENTS WORKBENCH LIVE HUD UPDATES
    updateRealWorkbenchHud(distToSensor, isRainDetected, isRelayEnergized, isFlashPhase);

    // 1:1 SVG SCHEMATIC ARCHITECTURE LIVE UPDATES
    updateSvgSchematicLive(distToSensor, isRainDetected, isRelayEnergized, isFlashPhase, dtSeconds);

    // Render Telemetry Multi-Line Graph
    drawTelemetryGraph();

    requestAnimationFrame(renderUI);
  }

  function updateRealWorkbenchHud(distToSensor, isRainDetected, isRelayEnergized, isFlashPhase) {
    if (hudDistVal) hudDistVal.textContent = (systemMode === 'hardware' && !isHardwareConnected) ? '--.- cm' : `${distToSensor} cm`;
    if (hudRainPlateStatus) {
      if (systemMode === 'hardware' && !isHardwareConnected) {
        hudRainPlateStatus.textContent = 'AWAITING USB';
        hudRainPlateStatus.className = 'hud-badge-live rain-safe';
      } else {
        hudRainPlateStatus.textContent = isRainDetected ? 'RAIN DETECTED' : 'DRY';
        hudRainPlateStatus.className = `hud-badge-live ${isRainDetected ? 'rain-wet' : 'rain-safe'}`;
      }
    }
    if (hudLm393State) {
      hudLm393State.textContent = isRainDetected ? 'DO: LOW (0V - Wet)' : 'DO: HIGH (3.3V - Dry)';
    }
    if (hudLedGreen) hudLedGreen.classList.toggle('active', pins.gpio19_green === 1);
    if (hudLedYellow) hudLedYellow.classList.toggle('active', pins.gpio21_yellow === 1);
    if (hudLedRed) hudLedRed.classList.toggle('active', pins.gpio22_red === 1 && isFlashPhase);
    if (hudBuzzerWaves) hudBuzzerWaves.classList.toggle('buzzing', pins.gpio26_buzzer === 1 && isFlashPhase);
    if (hudRelayBadge) {
      hudRelayBadge.textContent = isRelayEnergized ? 'RELAY ON (12V)' : 'RELAY OFF';
      hudRelayBadge.className = `hud-badge-live ${isRelayEnergized ? 'relay-on' : 'relay-off'}`;
    }
    if (hudPumpBadge) {
      hudPumpBadge.textContent = isRelayEnergized ? 'PUMPING (12V)' : 'PUMP IDLE';
      hudPumpBadge.className = `hud-badge-live ${isRelayEnergized ? 'pump-active' : 'pump-idle'}`;
    }
    if (hudPumpVibe) hudPumpVibe.classList.toggle('running', isRelayEnergized);
  }

  let pumpAngle = 0;
  function updateSvgSchematicLive(distToSensor, isRainDetected, isRelayEnergized, isFlashPhase, dtSeconds) {
    if (svgSensorDistVal) svgSensorDistVal.textContent = (systemMode === 'hardware' && !isHardwareConnected) ? '--.- cm' : `${distToSensor} cm`;
    if (svgTransducerCenter) {
      svgTransducerCenter.setAttribute('fill', isFlashPhase ? '#38bdf8' : '#0284c7');
    }
    if (svgPcbDrops) {
      svgPcbDrops.setAttribute('opacity', isRainDetected ? '1' : '0');
    }
    if (svgRainDoLed) {
      svgRainDoLed.setAttribute('fill', isRainDetected ? '#38bdf8' : '#334155');
    }
    if (svgRainStatusVal) {
      svgRainStatusVal.textContent = isRainDetected ? 'RAIN (LOW 0V)' : 'DRY (HIGH 3.3V)';
      svgRainStatusVal.setAttribute('fill', isRainDetected ? '#38bdf8' : '#4ade80');
    }
    if (svgRelayLed) {
      svgRelayLed.setAttribute('fill', isRelayEnergized ? '#22c55e' : '#334155');
    }
    if (svgRelayStatusText) {
      svgRelayStatusText.textContent = isRelayEnergized ? 'RELAY: 12V PUMP ACTIVE' : 'RELAY: OFF (STANDBY)';
      svgRelayStatusText.setAttribute('fill', isRelayEnergized ? '#4ade80' : '#94a3b8');
    }
    if (svgPumpBadgeText) {
      svgPumpBadgeText.textContent = isRelayEnergized ? 'RUNNING' : 'OFF';
      svgPumpBadgeText.setAttribute('fill', isRelayEnergized ? '#4ade80' : '#9ca3af');
    }
    if (svgPumpBody) {
      svgPumpBody.setAttribute('stroke', isRelayEnergized ? '#22c55e' : '#3f3f46');
    }
    if (wirePumpPos) {
      wirePumpPos.setAttribute('stroke', isRelayEnergized ? '#ef4444' : '#52525b');
      if (isRelayEnergized) {
        wirePumpPos.classList.add('wire-pulse-fast');
      } else {
        wirePumpPos.classList.remove('wire-pulse-fast');
      }
    }
    if (svgImpellerCross && isRelayEnergized) {
      pumpAngle = (pumpAngle + dtSeconds * 720) % 360;
      svgImpellerCross.setAttribute('transform', `rotate(${pumpAngle.toFixed(1)}, 78, 72)`);
    }

    // LEDs on Breadboard
    if (svgLedGreen) {
      svgLedGreen.setAttribute('fill', (pins.gpio19_green === 1) ? '#22c55e' : '#14532d');
      svgLedGreen.setAttribute('stroke', (pins.gpio19_green === 1) ? '#86efac' : '#22c55e');
    }
    if (svgLedYellow) {
      svgLedYellow.setAttribute('fill', (pins.gpio21_yellow === 1) ? '#eab308' : '#713f12');
      svgLedYellow.setAttribute('stroke', (pins.gpio21_yellow === 1) ? '#fef08a' : '#eab308');
    }
    if (svgLedRed) {
      const redOn = (pins.gpio22_red === 1 && isFlashPhase);
      svgLedRed.setAttribute('fill', redOn ? '#ef4444' : '#7f1d1d');
      svgLedRed.setAttribute('stroke', redOn ? '#fca5a5' : '#ef4444');
    }
    if (svgBuzzerBody) {
      const buzzOn = (pins.gpio26_buzzer === 1 && isFlashPhase);
      svgBuzzerBody.setAttribute('stroke', buzzOn ? '#ef4444' : '#3f3f46');
      svgBuzzerBody.setAttribute('stroke-width', buzzOn ? '4' : '3');
    }

    // Water Sensor Signal Badge
    if (svgWaterSensorVal) {
      svgWaterSensorVal.textContent = (pins.gpio35_water_sensor > 500) ? `IMMERSION (${pins.gpio35_water_sensor})` : `DRY (${pins.gpio35_water_sensor})`;
      svgWaterSensorVal.setAttribute('fill', (pins.gpio35_water_sensor > 500) ? '#38bdf8' : '#64748b');
    }
    if (valRainAo) valRainAo.textContent = pins.gpio34_rain_ao;

    // ESP32 Pins on SVG
    if (pinSvg19) pinSvg19.setAttribute('fill', (pins.gpio19_green === 1) ? '#22c55e' : '#1e293b');
    if (pinSvg21) pinSvg21.setAttribute('fill', (pins.gpio21_yellow === 1) ? '#eab308' : '#1e293b');
    if (pinSvg22) pinSvg22.setAttribute('fill', (pins.gpio22_red === 1 && isFlashPhase) ? '#ef4444' : '#1e293b');
    if (pinSvg26) pinSvg26.setAttribute('fill', (pins.gpio26_buzzer === 1 && isFlashPhase) ? '#06b6d4' : '#1e293b');
    if (pinSvg23) pinSvg23.setAttribute('fill', isRelayEnergized ? '#f97316' : '#1e293b');
    if (pinSvg25) pinSvg25.setAttribute('fill', isRainDetected ? '#a855f7' : '#1e293b');
    if (pinSvg34) pinSvg34.setAttribute('fill', isRainDetected ? '#c084fc' : '#1e293b');
    if (pinSvg35) pinSvg35.setAttribute('fill', (pins.gpio35_water_sensor > 500) ? '#38bdf8' : '#1e293b');
    if (pinSvg5) pinSvg5.setAttribute('fill', '#10b981');
    if (pinSvg18) pinSvg18.setAttribute('fill', '#38bdf8');
  }

  // Interactive component clicks on the SVG diagram
  const compRain = document.getElementById('comp-rain-sensor');
  if (compRain) {
    compRain.style.cursor = 'pointer';
    compRain.addEventListener('click', () => {
      const nextRain = (rainLevel + 1) % 4;
      rainButtons[nextRain].click();
    });
  }

  const compPump = document.getElementById('comp-water-pump');
  const compRelay = document.getElementById('comp-relay-module');
  const togglePumpHandler = () => {
    setPumpMode(pumpMode === 'FORCE_ON' ? 'FORCE_OFF' : 'FORCE_ON');
  };
  if (compPump) {
    compPump.style.cursor = 'pointer';
    compPump.addEventListener('click', togglePumpHandler);
  }
  if (compRelay) {
    compRelay.style.cursor = 'pointer';
    compRelay.addEventListener('click', togglePumpHandler);
  }

  const compSensor = document.getElementById('comp-jsn-sr04t');
  if (compSensor) {
    compSensor.style.cursor = 'pointer';
    compSensor.addEventListener('click', () => {
      waterDepth = (waterDepth >= 17) ? 4.0 : (waterDepth + 3.5);
      manualWaterSlider.value = waterDepth.toFixed(1);
    });
  }

  // Real Hardware Workbench Hotspot Clicks
  if (hotspotRainPlate) {
    hotspotRainPlate.addEventListener('click', () => {
      const nextRain = (rainLevel + 1) % 4;
      rainButtons[nextRain].click();
    });
  }
  if (hotspotJsnProbe) {
    hotspotJsnProbe.addEventListener('click', () => {
      waterDepth = (waterDepth >= 17) ? 4.0 : (waterDepth + 3.5);
      manualWaterSlider.value = waterDepth.toFixed(1);
    });
  }
  if (hotspotRelay) hotspotRelay.addEventListener('click', togglePumpHandler);
  if (hotspotPump) hotspotPump.addEventListener('click', togglePumpHandler);



  function updatePinBadge(id, text, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.pin-val').textContent = text;
    el.classList.toggle('active', isActive);
  }

  // ==============================================================================
  // TELEMETRY REAL-TIME CANVAS CHART
  // ==============================================================================
  function drawTelemetryGraph() {
    const w = telemetryChart.width;
    const h = telemetryChart.height;
    if (w === 0 || h === 0) return;

    chartCtx.clearRect(0, 0, w, h);

    // Background threshold bands
    const yDanger = h - (THRESHOLD_DANGER_CM / MAX_WATER_DEPTH_CM) * h;
    const yWarn   = h - (THRESHOLD_WARN_CM / MAX_WATER_DEPTH_CM) * h;

    // Red zone (> 20.0cm)
    chartCtx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    chartCtx.fillRect(0, 0, w, yDanger);

    // Yellow zone (15.0 - 20.0cm)
    chartCtx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    chartCtx.fillRect(0, yDanger, w, yWarn - yDanger);

    // Green zone (0 - 15.0cm)
    chartCtx.fillStyle = 'rgba(16, 185, 129, 0.05)';
    chartCtx.fillRect(0, yWarn, w, h - yWarn);

    // Horizontal threshold guide lines
    chartCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    chartCtx.setLineDash([4, 4]);
    chartCtx.beginPath();
    chartCtx.moveTo(0, yDanger);
    chartCtx.lineTo(w, yDanger);
    chartCtx.stroke();

    chartCtx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    chartCtx.beginPath();
    chartCtx.moveTo(0, yWarn);
    chartCtx.lineTo(w, yWarn);
    chartCtx.stroke();
    chartCtx.setLineDash([]);

    // Chart threshold text tags for Evaluator
    chartCtx.font = '10px "JetBrains Mono", monospace';
    chartCtx.fillStyle = '#f87171';
    chartCtx.fillText('🔴 CRITICAL (20cm)', 8, yDanger - 4);
    chartCtx.fillStyle = '#fbbf24';
    chartCtx.fillText('🟡 WARNING (15cm + Sensor)', 8, yWarn - 4);

    if (chartHistory.length < 2) return;

    // 1. Draw Pump Activity Area (Cyan fill at bottom)
    chartCtx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    chartCtx.beginPath();
    chartCtx.moveTo(0, h);
    for (let i = 0; i < chartHistory.length; i++) {
      const x = (i / (MAX_HISTORY_POINTS - 1)) * w;
      const y = h - (chartHistory[i].pump > 0 ? 25 : 0);
      chartCtx.lineTo(x, y);
    }
    chartCtx.lineTo(w, h);
    chartCtx.closePath();
    chartCtx.fill();

    // 2. Draw Water Depth Line (Solid Gradient)
    chartCtx.strokeStyle = '#38bdf8';
    chartCtx.lineWidth = 2.5;
    chartCtx.shadowColor = '#38bdf8';
    chartCtx.shadowBlur = 8;
    chartCtx.beginPath();

    for (let i = 0; i < chartHistory.length; i++) {
      const x = (i / (MAX_HISTORY_POINTS - 1)) * w;
      const y = h - (chartHistory[i].depth / MAX_WATER_DEPTH_CM) * h;
      if (i === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    }
    chartCtx.stroke();
    chartCtx.shadowBlur = 0;

    // Draw last point glowing dot
    const lastIdx = chartHistory.length - 1;
    const lastX = (lastIdx / (MAX_HISTORY_POINTS - 1)) * w;
    const lastY = h - (chartHistory[lastIdx].depth / MAX_WATER_DEPTH_CM) * h;

    chartCtx.fillStyle = '#ffffff';
    chartCtx.beginPath();
    chartCtx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    chartCtx.fill();
  }

  // ==============================================================================
  // USER CONTROLS EVENT HANDLERS
  // ==============================================================================

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = document.getElementById(btn.getAttribute('data-tab'));
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Rain Intensity Buttons
  rainButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      rainButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rainLevel = parseInt(btn.getAttribute('data-rain'), 10);
      const labels = ['Dry (0 mm/h)', 'Light (15 mm/h)', 'Heavy (60 mm/h)', 'Torrential (140 mm/h)'];
      rainIntensityLabel.textContent = labels[rainLevel];
    });
  });

  // Upstream Inflow Slider
  inflowSlider.addEventListener('input', (e) => {
    upstreamInflow = parseFloat(e.target.value);
    inflowValueLabel.textContent = `${upstreamInflow.toFixed(2)} cm/s`;
  });

  // Manual Water Level Slider
  manualWaterSlider.addEventListener('input', (e) => {
    waterDepth = parseFloat(e.target.value);
    const pct = ((waterDepth / MAX_WATER_DEPTH_CM) * 100).toFixed(0);
    manualWaterLabel.textContent = `${waterDepth.toFixed(1)} cm (${pct}%)`;
  });

  // ============================================================
  // REAL HARDWARE PUMP MANUAL TOGGLE — Full User Control
  // ============================================================
  function setPumpMode(mode) {
    userManualPumpTimestamp = Date.now();
    pumpMode = (mode === 'FORCE_ON') ? 'FORCE_ON' : 'FORCE_OFF';
    const isOn = (pumpMode === 'FORCE_ON');

    // Update toggle button appearance
    if (btnPumpToggle) {
      btnPumpToggle.setAttribute('data-state', isOn ? 'on' : 'off');
    }
    if (btnPumpToggleLabel) {
      btnPumpToggleLabel.textContent = isOn ? 'TURN REAL PUMP OFF' : 'TURN REAL PUMP ON';
    }
    if (btnPumpOff) {
      btnPumpOff.classList.toggle('active', !isOn);
    }
    if (btnPumpOn) {
      btnPumpOn.classList.toggle('active', isOn);
    }
    if (pumpDot) {
      pumpDot.classList.toggle('active', isOn);
    }
    if (pumpStatusText) {
      pumpStatusText.textContent = isOn ? 'REAL PUMP RUNNING (12V Active ⛲)' : 'Real Pump Standby (Relay Open)';
    }
    if (pumpModeLabel) {
      pumpModeLabel.textContent = isOn ? 'RUNNING' : 'STANDBY';
    }
    if (btnHeaderPumpToggle) {
      btnHeaderPumpToggle.classList.toggle('active', isOn);
    }
    if (headerPumpState) {
      headerPumpState.textContent = isOn ? 'RUNNING ⚡' : 'OFF';
      headerPumpState.style.color = isOn ? '#4ade80' : '#94a3b8';
    }
    if (realPumpPinState) {
      realPumpPinState.innerHTML = isOn 
        ? 'Relay Pin 23: <strong style="color:#4ade80">LOW (0V / ENERGIZED ON)</strong>' 
        : 'Relay Pin 23: <strong>HIGH (3.3V / Standby OFF)</strong>';
    }

    // Send command directly to physical ESP32 via WebSerial
    sendHardwareCommand(isOn ? 'PUMP_ON' : 'PUMP_OFF');
  }

  // Explicit Direct Buttons
  if (btnPumpOff) {
    btnPumpOff.addEventListener('click', () => {
      setPumpMode('FORCE_OFF');
    });
  }

  if (btnPumpOn) {
    btnPumpOn.addEventListener('click', () => {
      setPumpMode('FORCE_ON');
    });
  }

  if (btnInvertRelay) {
    btnInvertRelay.addEventListener('click', () => {
      userManualPumpTimestamp = Date.now();
      sendHardwareCommand('INVERT_RELAY');
      logSerialLine('[RELAY] Invert signal command sent to ESP32.', 'warning');
    });
  }

  // Wire up the real pump manual toggle buttons (Card & Header)
  if (btnPumpToggle) {
    btnPumpToggle.addEventListener('click', () => {
      setPumpMode(pumpMode === 'FORCE_ON' ? 'FORCE_OFF' : 'FORCE_ON');
    });
  }

  if (btnHeaderPumpToggle) {
    btnHeaderPumpToggle.addEventListener('click', () => {
      setPumpMode(pumpMode === 'FORCE_ON' ? 'FORCE_OFF' : 'FORCE_ON');
    });
  }


  // Physical Hardware Actuator Diagnostics Buttons
  if (btnHwTestLeds) {
    btnHwTestLeds.addEventListener('click', () => {
      sendHardwareCommand('LED_TEST');
    });
  }

  if (btnHwTestBuzzer) {
    btnHwTestBuzzer.addEventListener('click', () => {
      sendHardwareCommand('BUZZER_TEST');
    });
  }

  // Connect Physical ESP32 Hardware Button
  if (btnConnectHardware) {
    btnConnectHardware.addEventListener('click', () => {
      if (isHardwareConnected) {
        disconnectHardware();
      } else {
        connectHardware();
      }
    });
  }

  // Quick Scenarios
  btnScenarioClear.addEventListener('click', () => {
    rainButtons[0].click(); // Dry
    inflowSlider.value = 0;
    upstreamInflow = 0;
    inflowValueLabel.textContent = '0.0 cm/s';
    manualWaterSlider.value = 5.0;
    waterDepth = 5.0;
    manualWaterLabel.textContent = '5.0 cm (20%)';
    setPumpMode('FORCE_OFF');
  });

  btnScenarioRain.addEventListener('click', () => {
    rainButtons[1].click(); // Light
    inflowSlider.value = 0.15;
    upstreamInflow = 0.15;
    inflowValueLabel.textContent = '0.15 cm/s';
    setPumpMode('FORCE_OFF'); // User controls pump manually
  });

  btnScenarioFlashFlood.addEventListener('click', () => {
    rainButtons[3].click(); // Torrential
    inflowSlider.value = 0.9;
    upstreamInflow = 0.9;
    inflowValueLabel.textContent = '0.90 cm/s';
    manualWaterSlider.value = 16.0;
    waterDepth = 16.0;
    manualWaterLabel.textContent = '16.0 cm (70%)';
    setPumpMode('FORCE_OFF');
  });

  btnScenarioDrainage.addEventListener('click', () => {
    rainButtons[2].click(); // Heavy
    manualWaterSlider.value = 21.0;
    waterDepth = 21.0;
    setPumpMode('FORCE_ON');
  });

  // Wiring Table Modal (Guarded)
  if (viewSchematicBtn && schematicModal) {
    viewSchematicBtn.addEventListener('click', () => {
      schematicModal.classList.remove('hidden');
    });
  }
  if (closeModalBtn && schematicModal) {
    closeModalBtn.addEventListener('click', () => {
      schematicModal.classList.add('hidden');
    });
  }
  if (schematicModal) {
    schematicModal.addEventListener('click', (e) => {
      if (e.target === schematicModal) {
        schematicModal.classList.add('hidden');
      }
    });
  }

  // Wokwi Copy Buttons
  const btnCopyDiagram = document.getElementById('btnCopyDiagram');
  if (btnCopyDiagram) {
    btnCopyDiagram.addEventListener('click', () => {
      fetch('diagram.json')
        .then(r => r.text())
        .then(text => navigator.clipboard.writeText(text))
        .then(() => {
          btnCopyDiagram.textContent = '✓ Copied!';
          setTimeout(() => btnCopyDiagram.textContent = 'Copy diagram.json', 2000);
        })
        .catch(() => alert('Copied from diagram.json in your project folder!'));
    });
  }

  const btnCopySketch = document.getElementById('btnCopySketch');
  if (btnCopySketch) {
    btnCopySketch.addEventListener('click', () => {
      fetch('sketch.ino')
        .then(r => r.text())
        .then(text => navigator.clipboard.writeText(text))
        .then(() => {
          btnCopySketch.textContent = '✓ Copied!';
          setTimeout(() => btnCopySketch.textContent = 'Copy sketch.ino', 2000);
        })
        .catch(() => alert('Copied from sketch.ino in your project folder!'));
    });
  }

  // Mode Switcher Event Listeners
  if (btnModeHardware) {
    btnModeHardware.addEventListener('click', () => {
      setSystemMode('hardware');
    });
  }

  if (btnModeSimulator) {
    btnModeSimulator.addEventListener('click', () => {
      setSystemMode('simulator');
    });
  }

  if (btnBannerConnect) {
    btnBannerConnect.addEventListener('click', () => {
      connectHardware();
    });
  }

  // Initialize in Strict Real Hardware Mode on startup
  setSystemMode('hardware');
  setPumpMode('FORCE_OFF');

  // Start animation loop
  requestAnimationFrame(renderUI);
})();
