// frontend/assets/scanface.js

let video;
let status;
let token;

let attendanceMarked = false;
let selectedClassId = null;
let detectionInterval = null;

console.log('✅ scanface.js loaded');

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOMContentLoaded');

  video = document.getElementById('video');
  status = document.getElementById('status');
  token = localStorage.getItem('token');

  console.log('🎥 video element:', video);
  console.log('📝 status element:', status);
  console.log('🔑 token exists:', !!token);

  if (!video || !status) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  if (!token) {
    status.innerText = 'You must be logged in.';
    return;
  }

  init();
});

// ---------- LOAD MODELS + START ----------
async function init() {
  try {
    console.log('⏳ Checking faceapi:', window.faceapi);

    if (!window.faceapi) {
      status.innerText = 'FaceAPI not loaded';
      console.error('❌ faceapi is undefined');
      return;
    }

    status.innerText = 'Loading face detection models...';
    console.log('⏳ Loading models...');

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);

    console.log('✅ Models loaded');

    status.innerText = 'Models loaded. Fetching classes...';
    await fetchClasses();

    status.innerText = 'Starting camera...';
    await startVideo();
  } catch (err) {
    console.error('❌ Init failed:', err);
    status.innerText = 'Failed to initialize face detection.';
  }
}

// ---------- FETCH CLASSES ----------
async function fetchClasses() {
  console.log('📡 Fetching classes...');

  const res = await fetch('/api/student/classes', {
    headers: { Authorization: 'Bearer ' + token }
  });

  const data = await res.json();
  console.log('📦 Classes response:', data);

  if (!data.classes || data.classes.length === 0) {
    status.innerText = 'No enrolled classes found.';
    return;
  }

  if (data.classes.length === 1) {
    selectedClassId = data.classes[0].id;
    console.log('✅ Auto-selected class:', selectedClassId);
  } else {
    const list = data.classes.map(c => `${c.id}: ${c.name}`).join('\n');
    const input = prompt(`Select class ID:\n${list}`);
    if (!data.classes.some(c => String(c.id) === input)) {
      status.innerText = 'Invalid class selected.';
      return;
    }
    selectedClassId = input;
    console.log('✅ Selected class:', selectedClassId);
  }
}

// ---------- CAMERA ----------
async function startVideo() {
  console.log('🎥 Requesting camera access...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480 } // higher resolution
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

  const displaySize = {
    width: video.videoWidth,
    height: video.videoHeight
  };

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,       // bigger = more accurate
    scoreThreshold: 0.3   // lower = detect weaker faces
  });

  detectionInterval = setInterval(async () => {
    console.log('🔁 Detecting face...');

    if (attendanceMarked || !selectedClassId) return;

    const detections = await faceapi
      .detectAllFaces(video, options)
      .withFaceLandmarks();

    console.log('📦 Detections count:', detections.length);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      status.innerText = 'No face detected...';
      return;
    }

    const resized = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resized);

    status.innerText = 'Face detected! Marking attendance...';
    console.log('🎯 Face detected');

    await markAttendance();
  }, 2000);
}

// ---------- BACKEND CALL ----------
async function markAttendance() {
  console.log('📤 Sending attendance request');

  try {
    const res = await fetch('/api/attendance/face-mark', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ class_id: selectedClassId })
    });

    const data = await res.json();
    console.log('📥 Attendance response:', data);

    if (res.ok) {
      attendanceMarked = true;
      clearInterval(detectionInterval);
      status.innerText = '✅ Attendance marked successfully!';
    } else {
      status.innerText = '❌ ' + data.message;
    }
  } catch (err) {
    console.error('❌ Attendance error:', err);
    status.innerText = 'Server error while marking attendance.';
  }
}