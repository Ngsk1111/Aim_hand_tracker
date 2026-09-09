import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

const { HandLandmarker, FilesetResolver } = vision;

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

const els = {
  input: document.querySelector("#videoInput"),
  video: document.querySelector("#video"),
  canvas: document.querySelector("#overlay"),
  stage: document.querySelector("#stage"),
  viewerCard: document.querySelector("#viewerCard"),
  modelStatus: document.querySelector("#modelStatus"),
  handCount: document.querySelector("#handCount"),
  handedness: document.querySelector("#handedness"),
  inferenceTime: document.querySelector("#inferenceTime"),
  showConnections: document.querySelector("#showConnections"),
  showPoints: document.querySelector("#showPoints")
};

const ctx = els.canvas.getContext("2d");
let handLandmarker = null;
let videoUrl = null;
let renderToken = 0;
let busy = false;

function setStatus(text, className = "") {
  els.modelStatus.textContent = text;
  els.modelStatus.className = `status ${className}`.trim();
}

async function init() {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    handLandmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45
    });
    setStatus("準備完了", "ready");
  } catch (error) {
    console.error(error);
    setStatus("モデル読込失敗", "error");
  }
}

function resizeCanvas() {
  const rect = els.video.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearOverlay() {
  const rect = els.video.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

function drawResult(result) {
  resizeCanvas();
  clearOverlay();

  const rect = els.video.getBoundingClientRect();
  const hands = result?.landmarks || [];
  const handedness = result?.handedness || [];

  els.handCount.textContent = `${hands.length} hand${hands.length === 1 ? "" : "s"}`;
  els.handedness.textContent = handedness
    .map(group => group?.[0]?.categoryName)
    .filter(Boolean)
    .join(" / ") || "—";

  for (const landmarks of hands) {
    const points = landmarks.map(p => ({ x: p.x * rect.width, y: p.y * rect.height }));

    if (els.showConnections.checked) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.90)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (els.showPoints.checked) {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === 0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#72e19b" : "#ff5b6e";
        ctx.fill();
      }
    }
  }
}

function runDetection() {
  if (!handLandmarker || busy || els.video.readyState < 2 || els.video.paused || els.video.ended) return;
  busy = true;
  try {
    const start = performance.now();
    const result = handLandmarker.detectForVideo(els.video, performance.now());
    const elapsed = performance.now() - start;
    els.inferenceTime.textContent = `${elapsed.toFixed(0)} ms`;
    drawResult(result);
  } catch (error) {
    console.error(error);
  } finally {
    busy = false;
  }
}

function scheduleLoop() {
  const token = ++renderToken;
  const step = () => {
    if (token !== renderToken) return;
    runDetection();
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      if (!els.video.paused && !els.video.ended) els.video.requestVideoFrameCallback(step);
    } else {
      if (!els.video.paused && !els.video.ended) requestAnimationFrame(step);
    }
  };

  if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
    els.video.requestVideoFrameCallback(step);
  } else {
    requestAnimationFrame(step);
  }
}

els.input.addEventListener("change", () => {
  const file = els.input.files?.[0];
  if (!file) return;

  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  els.video.src = videoUrl;
  els.viewerCard.classList.remove("isHidden");
  els.handCount.textContent = "0 hand";
  els.handedness.textContent = "—";
  els.inferenceTime.textContent = "— ms";
});

els.video.addEventListener("loadedmetadata", () => {
  resizeCanvas();
});

els.video.addEventListener("play", () => {
  scheduleLoop();
});

els.video.addEventListener("pause", () => {
  renderToken++;
  runDetection();
});

els.video.addEventListener("ended", () => {
  renderToken++;
});

els.video.addEventListener("seeked", () => {
  if (handLandmarker && els.video.readyState >= 2) {
    try {
      const start = performance.now();
      const result = handLandmarker.detectForVideo(els.video, performance.now());
      els.inferenceTime.textContent = `${(performance.now() - start).toFixed(0)} ms`;
      drawResult(result);
    } catch (error) {
      console.error(error);
    }
  }
});

window.addEventListener("resize", resizeCanvas);
els.showConnections.addEventListener("change", () => {
  if (els.video.paused) els.video.dispatchEvent(new Event("seeked"));
});
els.showPoints.addEventListener("change", () => {
  if (els.video.paused) els.video.dispatchEvent(new Event("seeked"));
});

init();
