/*
 * Audio Waveform PWA
 * Native-browser implementation of the supplied Python/Pygame program.
 *
 * Original settings:
 *   SAMPLE_RATE    = 44100
 *   CHUNK_SIZE     = 512
 *   SECONDS_VISIBLE = 3
 *   AMPLITUDE      = 5.0
 *   BAR_WIDTH      = 3
 *   BAR_GAP        = 1
 *   SMOOTHING      = 0.25
 */

"use strict";

// ============================================================
// SETTINGS
// ============================================================

const SETTINGS = {
  secondsVisible: 3,
  amplitude: 5.0,
  barWidth: 3,
  barGap: 1,
  smoothing: 0.25,
  targetFPS: 60,

  orange: "rgb(255, 120, 0)",
  background: "rgb(10, 10, 10)",
  centreLine: "rgb(70, 70, 70)"
};

// ============================================================
// DOM
// ============================================================

const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d", { alpha: false });

const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const message = document.getElementById("message");
const status = document.getElementById("status");

// ============================================================
// AUDIO STATE
// ============================================================

let audioContext = null;
let analyser = null;
let mediaStream = null;
let source = null;

let audioBuffer = new Float32Array(0);
let targetValues = new Float32Array(0);
let displayValues = new Float32Array(0);

let sampleRate = 44100;
let animationFrame = null;
let running = false;

let analyserData = null;

// ============================================================
// CANVAS
// ============================================================

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  setBarCount();
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 100);
});

// ============================================================
// BAR DATA
// ============================================================

function numberOfBars() {
  return Math.max(
    1,
    Math.ceil(
      window.innerWidth /
      (SETTINGS.barWidth + SETTINGS.barGap)
    )
  );
}

function setBarCount() {
  const count = numberOfBars();

  if (targetValues.length !== count) {
    targetValues = new Float32Array(count);
    displayValues = new Float32Array(count);
  }
}

// ============================================================
// MICROPHONE
// ============================================================

async function startAudio() {
  if (running) return;

  if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia) {
    showError(
      "This browser does not support microphone access."
    );
    return;
  }

  try {
    status.textContent = "Requesting microphone…";

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    });

    audioContext = new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    await audioContext.resume();

    sampleRate = audioContext.sampleRate;

    source = audioContext.createMediaStreamSource(mediaStream);

    analyser = audioContext.createAnalyser();

    /*
     * The browser analyser is used as the low-level microphone
     * sampler. A 2048 FFT gives us enough raw time-domain samples
     * for stable peak detection.
     */
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

    analyserData = new Float32Array(
      analyser.fftSize
    );

    source.connect(analyser);

    /*
     * Create the 3-second rolling audio buffer.
     * Unlike the Python program, browsers may expose a hardware
     * sample rate other than 44.1 kHz, so the actual rate is used.
     */
    audioBuffer = new Float32Array(
      Math.round(sampleRate * SETTINGS.secondsVisible)
    );

    setBarCount();

    running = true;

    startScreen.hidden = true;
    stopButton.hidden = false;

    status.textContent = "Listening";

    render();
  } catch (error) {
    console.error(error);

    if (error.name === "NotAllowedError") {
      showError(
        "Microphone access was denied. Allow microphone access in Safari Settings and try again."
      );
    } else {
      showError(
        "The microphone could not be started: " + error.message
      );
    }
  }
}

function stopAudio() {
  running = false;

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (source) {
    try {
      source.disconnect();
    } catch (_) {}
    source = null;
  }

  if (analyser) {
    try {
      analyser.disconnect();
    } catch (_) {}
    analyser = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  startScreen.hidden = false;
  stopButton.hidden = true;

  message.textContent =
    "Tap Start and allow microphone access to display the live waveform.";

  startButton.textContent = "Start";
  status.textContent = "Stopped";

  displayValues.fill(0);
  targetValues.fill(0);

  draw();
}

// ============================================================
// ROLLING AUDIO BUFFER
// ============================================================

function appendAudio(samples) {
  if (!audioBuffer.length) return;

  const incoming = samples.length;

  if (incoming >= audioBuffer.length) {
    audioBuffer.set(
      samples.subarray(
        incoming - audioBuffer.length
      )
    );
    return;
  }

  audioBuffer.copyWithin(
    0,
    incoming
  );

  audioBuffer.set(
    samples,
    audioBuffer.length - incoming
  );
}

// ============================================================
// PEAK ANALYSIS
// ============================================================

function calculateTargetValues() {
  if (!audioBuffer.length) return;

  const bars = targetValues.length;
  const samplesPerBar =
    audioBuffer.length / bars;

  for (let i = 0; i < bars; i++) {
    const start = Math.floor(
      i * samplesPerBar
    );

    const end = Math.min(
      audioBuffer.length,
      Math.floor(
        (i + 1) * samplesPerBar
      )
    );

    let peak = 0;

    for (let j = start; j < end; j++) {
      const value = Math.abs(audioBuffer[j]);

      if (value > peak) {
        peak = value;
      }
    }

    // Same as:
    // target_values *= AMPLITUDE
    // target_values = np.clip(target_values, 0, 1)

    targetValues[i] = Math.min(
      1,
      Math.max(
        0,
        peak * SETTINGS.amplitude
      )
    );
  }
}

// ============================================================
// SMOOTHING
// ============================================================

function smoothValues() {
  for (let i = 0; i < displayValues.length; i++) {
    displayValues[i] +=
      (
        targetValues[i] -
        displayValues[i]
      ) * SETTINGS.smoothing;
  }
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  ctx.fillStyle = SETTINGS.background;
  ctx.fillRect(0, 0, width, height);

  const centre = Math.floor(height / 2);

  // Centre line
  ctx.strokeStyle = SETTINGS.centreLine;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, centre + 0.5);
  ctx.lineTo(width, centre + 0.5);
  ctx.stroke();

  // Orange waveform
  ctx.fillStyle = SETTINGS.orange;

  const stride =
    SETTINGS.barWidth +
    SETTINGS.barGap;

  const maxBarHeight = height * 0.25;

  for (let i = 0; i < displayValues.length; i++) {
    const value = Math.max(
      0,
      Math.min(
        1,
        displayValues[i]
      )
    );

    const barHeight =
      Math.floor(
        value * maxBarHeight
      );

    if (barHeight <= 0) continue;

    const x = i * stride;

    // Upper half
    ctx.fillRect(
      x,
      centre - barHeight,
      SETTINGS.barWidth,
      barHeight
    );

    // Lower half
    ctx.fillRect(
      x,
      centre,
      SETTINGS.barWidth,
      barHeight
    );
  }
}

// ============================================================
// MAIN 60 FPS LOOP
// ============================================================

let lastFrame = 0;

function render(timestamp = 0) {
  if (!running) return;

  const frameInterval =
    1000 / SETTINGS.targetFPS;

  if (
    timestamp - lastFrame >=
    frameInterval
  ) {
    lastFrame = timestamp;

    if (analyser) {
      analyser.getFloatTimeDomainData(
        analyserData
      );

      appendAudio(analyserData);
      calculateTargetValues();
      smoothValues();
      draw();
    }
  }

  animationFrame =
    requestAnimationFrame(render);
}

// ============================================================
// UI
// ============================================================

function showError(text) {
  startScreen.hidden = false;
  stopButton.hidden = true;

  message.textContent = text;
  startButton.textContent = "Try Again";
  status.textContent = "Microphone unavailable";
}

startButton.addEventListener(
  "click",
  startAudio
);

stopButton.addEventListener(
  "click",
  stopAudio
);

// ============================================================
// PWA INSTALL PROMPT
// ============================================================

let deferredInstallPrompt = null;

window.addEventListener(
  "beforeinstallprompt",
  event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  }
);

// ============================================================
// INITIALISE
// ============================================================

resizeCanvas();
draw();

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register(
        "./service-worker.js"
      ).catch(error => {
        console.warn(
          "Service worker registration failed:",
          error
        );
      });
    }
  );
}
