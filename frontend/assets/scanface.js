// frontend/assets/scanface.js

const video = document.getElementById('video');
const status = document.getElementById('status');
const token = localStorage.getItem('token'); // JWT

if (!token) {
  status.innerText = 'You must be logged in to mark attendance.';
  throw new Error('No JWT token found');
}

// Flags
let attendanceMarked = false;
let selectedClassId = null;

// Fetch classes for student
async function fetchClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data = await res.json();

    if (!data.classes || data.classes.length === 0) {
      status.innerText = 'No enrolled classes found.';
      return;
    }

    // Auto-select if only 1 class
    if (data.classes.length === 1) {
      selectedClassId = data.classes[0].id;
      status.innerText = `Detected face. Class: ${data.classes[0].name}`;
    } else {
      const options = data.classes.map(c => `${c.id}: ${c.name}`).join('\n');
      const input = prompt(`Select class ID to mark attendance:\n${options}`);
      if (input && data.classes.some(c => c.id == input)) {
        selectedClassId = input;
      } else {
        status.innerText = 'Invalid class selected.';
      }
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Error fetching classes';
  }
}

// Load models and start video
async function init() {
  status.innerText = 'Loading face detection models...';
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);
    status.innerText = 'Models loaded. Fetching classes...';
    await fetchClasses();
    startVideo();
  } catch (err) {
    console.error(err);
    status.innerText = 'Error loading face detection models.';
  }
}

// Start webcam
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      status.innerText = 'Align your face in front of the camera';
    })
    .catch(err => {
      console.error(err);
      status.innerText = 'Cannot access camera. Please allow permissions.';
    });
}

// Detect faces
video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.getElementById('video-container').appendChild(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    if (attendanceMarked || !selectedClassId) return;

    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      status.innerText = 'No face detected...';
      return;
    }

    const resized = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resized);

    // Mark attendance once
    status.innerText = 'Face detected! Marking attendance...';
    await markAttendanceFace(selectedClassId);
  }, 2000);
});

// Backend API call
async function markAttendanceFace(class_id) {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/attendance/face-mark', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ class_id })
    });

    const data = await res.json();
    if (res.ok) {
      status.innerText = `✅ Attendance marked for class ID ${class_id}`;
      attendanceMarked = true;
    } else {
      status.innerText = `❌ ${data.message}`;
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Error marking attendance';
  }
}

// Initialize
init();