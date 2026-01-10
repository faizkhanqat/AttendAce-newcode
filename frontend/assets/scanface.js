// frontend/assets/scanface.js

let video;
let status;
let detectionInterval = null;

console.log('✅ scanface.js loaded');

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOMContentLoaded');

  video = document.getElementById('video');
  status = document.getElementById('status');

  console.log('🎥 video element:', video);
  console.log('📝 status element:', status);

  if (!video || !status) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  await init();
});

// ---------- LOAD MODELS ----------
async function init() {
  try {
    console.log('⏳ Checking faceapi:', window.faceapi);

    if (!window.faceapi) {
      status.innerText = 'FaceAPI not loaded';
      console.error('❌ faceapi is undefined');
      return;
    }

    status.innerText = 'Loading models...';
    console.log('⏳ Loading models...');

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);

    console.log('✅ Models loaded');
    status.innerText = 'Models loaded. Starting camera...';

    await startVideo();
  } catch (err) {
    console.error('❌ Init failed:', err);
    status.innerText = 'Failed to initialize face detection.';
  }
}

// ---------- CAMERA ----------
async function startVideo() {
  console.log('🎥 Requesting camera access...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      console.log('▶️ Video playing');
      console.log('📐 Video resolution:', video.videoWidth, video.videoHeight);
      status.innerText = 'Align your face in front of the camera';
      startDetection();
    };
  } catch (err) {
    console.error('❌ Camera access denied:', err);
    status.innerText = 'Cannot access camera. Please allow permissions.';
  }
}

// ---------- FACE DETECTION ----------
function startDetection() {
  console.log('🔍 Starting face detection loop');

  const container = document.getElementById('video-container');
  const canvas = faceapi.createCanvasFromMedia(video);
  container.appendChild(canvas);

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.2
  });

  detectionInterval = setInterval(async () => {
    try {
      const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
      console.log('🔁 Loop running, detections:', detections.length);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections.length > 0) {
        const resized = faceapi.resizeResults(detections, displaySize);

        // --- Draw rectangle around each detected face ---
        resized.forEach(det => {
          const box = det.detection.box;

          // --- Rectangle tweak ---
          const offsetX = 0;      // move left/right
          const offsetY = -15;    // move rectangle up (negative = up)
          const scaleW = 1.05;    // widen rectangle a bit
          const scaleH = 1.25;    // heighten rectangle to cover forehead to chin

          ctx.strokeStyle = 'blue';  // color of rectangle
          ctx.lineWidth = 2;
          ctx.strokeRect(
            box.x + offsetX,
            box.y + offsetY,
            box.width * scaleW,
            box.height * scaleH
          );
        });

        // --- Draw landmarks for reference ---
        faceapi.draw.drawFaceLandmarks(canvas, resized);

        console.log('🎯 Face detected!');
        status.innerText = '✅ Face detected!';
      } else {
        status.innerText = 'No face detected...';
      }
    } catch (err) {
      console.error('❌ Detection error:', err);
    }
  }, 1000);
}