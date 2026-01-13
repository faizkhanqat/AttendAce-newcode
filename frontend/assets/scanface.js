// frontend/assets/scanface.js

let video;
let status;
let detectionInterval = null;

console.log('✅ scanface.js loaded');

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', async () => {
  video = document.getElementById('video');
  status = document.getElementById('status');

  if (!video || !status) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  await init();
});

// ---------- LOAD MODELS ----------
async function init() {
  try {
    if (!window.faceapi) {
      status.innerText = 'FaceAPI not loaded';
      return;
    }

    status.innerText = 'Loading models...';

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);

    status.innerText = 'Models loaded. Starting camera...';
    await startVideo();
  } catch (err) {
    console.error('❌ Init failed:', err);
    status.innerText = 'Failed to initialize face detection.';
  }
}

// ---------- CAMERA ----------
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      status.innerText = 'Align your face in front of the camera';
      startDetection();
    };
  } catch (err) {
    console.error('❌ Camera error:', err);
    status.innerText = 'Cannot access camera.';
  }
}

// ---------- FACE DETECTION ----------
function startDetection() {
  const container = document.getElementById('video-container');
  const canvas = faceapi.createCanvasFromMedia(video);
  container.appendChild(canvas);

  const displaySize = {
    width: video.videoWidth,
    height: video.videoHeight
  };

  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.2
  });

  detectionInterval = setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, options)
      .withFaceLandmarks();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length > 0) {
      const resized = faceapi.resizeResults(detections, displaySize);

      // ✅ Correct bounding boxes
      faceapi.draw.drawDetections(canvas, resized);

      // ✅ Correct landmarks
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      status.innerText = '✅ Face detected!';
    } else {
      status.innerText = 'No face detected...';
    }
  }, 300);
}