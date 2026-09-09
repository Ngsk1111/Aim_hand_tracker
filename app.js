import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

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
  viewerCard: document.querySelector("#viewerCard"),
  modelStatus: document.querySelector("#modelStatus"),
  handCount: document.querySelector("#handCount"),
  handedness: document.querySelector("#handedness"),
  inferenceTime: document.querySelector("#inferenceTime"),
  showConnections: document.querySelector("#showConnections"),
  showPoints: document.querySelector("#showPoints"),
};

const ctx = els.canvas.getContext("2d");

let handLandmarker = null;
let videoUrl = null;
let animationId = null;
let lastVideoTime = -1;
let lastResult = null;

function setStatus(text, state = "") {
  els.modelStatus.textContent = text;
  els.modelStatus.className = `status ${state}`.trim();
}

function showError(error) {
  console.error(error);

  const message =
    error instanceof Error ? error.message : String(error);

  setStatus("モデル読込失敗", "error");

  let box = document.querySelector("#debugError");

  if (!box) {
    box = document.createElement("p");
    box.id = "debugError";
    box.style.marginTop = "12px";
    box.style.fontSize = "12px";
    box.style.lineHeight = "1.5";
    box.style.color = "#ff8a98";

    document.querySelector(".intro")?.appendChild(box);
  }

  if (box) {
    box.textContent = `エラー: ${message}`;
  }
}

async function init() {
  setStatus("モデル読込中");

  try {
    const vision =
      await FilesetResolver.forVisionTasks(WASM_URL);

    handLandmarker =
      await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },

          runningMode: "VIDEO",

          numHands: 1,

          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        }
      );

    setStatus("準備完了", "ready");

  } catch (error) {
    showError(error);
  }
}

function resizeCanvas() {
  const rect =
    els.video.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0)
    return;

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  const width =
    Math.max(
      1,
      Math.round(rect.width * dpr)
    );

  const height =
    Math.max(
      1,
      Math.round(rect.height * dpr)
    );

  els.canvas.width = width;
  els.canvas.height = height;

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );
}

function clearOverlay() {
  const rect =
    els.video.getBoundingClientRect();

  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );
}

function drawResult(result) {

  resizeCanvas();
  clearOverlay();

  const rect =
    els.video.getBoundingClientRect();

  const hands =
    result?.landmarks ?? [];

  const handedness =
    result?.handedness ?? [];

  els.handCount.textContent =
    `${hands.length} hand${
      hands.length === 1 ? "" : "s"
    }`;

  els.handedness.textContent =
    handedness
      .map(
        group =>
          group?.[0]?.categoryName
      )
      .filter(Boolean)
      .join(" / ")
    || "—";

  for (const landmarks of hands) {

    const points =
      landmarks.map(p => ({
        x: p.x * rect.width,
        y: p.y * rect.height
      }));

    if (
      els.showConnections.checked
    ) {

      ctx.save();

      ctx.strokeStyle =
        "rgba(255,255,255,.92)";

      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";

      for (
        const [a,b]
        of CONNECTIONS
      ) {

        ctx.beginPath();

        ctx.moveTo(
          points[a].x,
          points[a].y
        );

        ctx.lineTo(
          points[b].x,
          points[b].y
        );

        ctx.stroke();
      }

      ctx.restore();
    }

    if (els.showPoints.checked) {

      points.forEach(
        (p,index) => {

          ctx.beginPath();

          ctx.arc(
            p.x,
            p.y,
            index === 0
              ? 5
              : 3.5,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            index === 0
              ? "#72e19b"
              : "#ff5b6e";

          ctx.fill();
        }
      );
    }
  }
}

function detectCurrentFrame() {

  if (
    !handLandmarker ||
    els.video.readyState < 2
  ) {
    return;
  }

  try {

    const start =
      performance.now();

    const result =
      handLandmarker.detectForVideo(
        els.video,
        performance.now()
      );

    lastResult = result;

    els.inferenceTime.textContent =
      `${(
        performance.now() - start
      ).toFixed(0)} ms`;

    drawResult(result);

  } catch (error) {

    console.error(
      "Detection error:",
      error
    );
  }
}

function stopLoop() {

  if (animationId !== null) {

    cancelAnimationFrame(
      animationId
    );

    animationId = null;
  }
}

function renderLoop() {

  if (
    els.video.paused ||
    els.video.ended
  ) {

    animationId = null;
    return;
  }

  if (
    handLandmarker &&
    els.video.currentTime !==
      lastVideoTime
  ) {

    lastVideoTime =
      els.video.currentTime;

    detectCurrentFrame();
  }

  animationId =
    requestAnimationFrame(
      renderLoop
    );
}

els.input.addEventListener(
  "change",
  () => {

    const file =
      els.input.files?.[0];

    if (!file)
      return;

    stopLoop();

    lastVideoTime = -1;
    lastResult = null;

    if (videoUrl) {
      URL.revokeObjectURL(
        videoUrl
      );
    }

    videoUrl =
      URL.createObjectURL(file);

    els.video.src =
      videoUrl;

    els.viewerCard
      .classList
      .remove("isHidden");

    els.handCount.textContent =
      "0 hands";

    els.handedness.textContent =
      "—";

    els.inferenceTime.textContent =
      "— ms";
  }
);

els.video.addEventListener(
  "loadedmetadata",
  resizeCanvas
);

els.video.addEventListener(
  "play",
  () => {

    stopLoop();
    renderLoop();
  }
);

els.video.addEventListener(
  "pause",
  () => {

    stopLoop();
    detectCurrentFrame();
  }
);

els.video.addEventListener(
  "ended",
  stopLoop
);

els.video.addEventListener(
  "seeked",
  () => {

    lastVideoTime = -1;
    detectCurrentFrame();
  }
);

els.showConnections
  .addEventListener(
    "change",
    () => {

      if (lastResult)
        drawResult(
          lastResult
        );
    }
  );

els.showPoints
  .addEventListener(
    "change",
    () => {

      if (lastResult)
        drawResult(
          lastResult
        );
    }
  );

window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

    if (lastResult)
      drawResult(lastResult);
  }
);

init();
