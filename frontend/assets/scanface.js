// frontend/assets/scanface.js

let video;
let status;
let token;

let attendanceMarked = false;
let selectedClassId = null;
let detectionInterval = null;

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', () => {
  video = document.getElementById('video');
  status = document.getElementById('status');
  token = localStorage.getItem('token');

  if (!token) {
    status.innerText = 'You must be logged in.';
    return;
  }

  init();
});

// ---------- LOAD MODELS + START ----------
async function init() {
  try {
    status.innerText = 'Loading face detection models...';

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);

    status.innerText = 'Models loaded. Fetching classes...';
    await fetchClasses();

    status.innerText = 'Starting camera...';
    await startVideo();
  } catch (err) {
    console.error(err);
    status.innerText = 'Failed to initialize face detection.';
  }
}

// ---------- FETCH CLASSES ----------
async function fetchClasses() {
  const res = await fetch('/api/student/classes', {
    headers: { Authorization: 'Bearer ' + token }
  });

  const data = await res.json();

  if (!data.classes || data.classes.length === 0) {
    status.innerText = 'No enrolled classes found.';
    return;
  }

  if (data.classes.length === 1) {
    selectedClassId = data.classes[0].id;
  } else {
    const list = data.classes.map(c => `${c.id}: ${c.name}`).join('\n');
    const input = prompt(`Select class ID:\n${list}`);
    if (!data.classes.some(c => String(c.id) === input)) {
      status.innerText = 'Invalid class selected.';
      return;
    }
    selectedClassId = input;
  }
}

// ---------- CAMERA ----------
async function startVideo() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    video.play();
    status.innerText = 'Align your face in front of the camera';
    startDetection();
  };
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

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  faceapi.matchDimensions(canvas, displaySize);

  detectionInterval = setInterval(async () => {
    if (attendanceMarked || !selectedClassId) return;

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      status.innerText = 'No face detected...';
      return;
    }

    const resized = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resized);

    status.innerText = 'Face detected! Marking attendance...';
    await markAttendance();
  }, 2000);
}

// ---------- BACKEND CALL ----------
async function markAttendance() {
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

    if (res.ok) {
      attendanceMarked = true;
      clearInterval(detectionInterval);
      status.innerText = '✅ Attendance marked successfully!';
    } else {
      status.innerText = '❌ ' + data.message;
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Server error while marking attendance.';
  }
}