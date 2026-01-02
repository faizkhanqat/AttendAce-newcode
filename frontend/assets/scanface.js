const video = document.getElementById('video');
const status = document.getElementById('status');
const token = localStorage.getItem('token'); // JWT

if (!token) {
  status.innerText = 'You must be logged in to mark attendance.';
  throw new Error('No JWT token found');
}

// Global flags
let attendanceMarked = false;
let selectedClassId = null;

// Fetch enrolled classes for dropdown
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

    // If only 1 class, auto-select
    if (data.classes.length === 1) {
      selectedClassId = data.classes[0].id;
      status.innerText = `Detected face. Class: ${data.classes[0].name}`;
    } else {
      // Prompt user to choose
      const classOptions = data.classes.map(c => `${c.id}: ${c.name}`).join('\n');
      const input = prompt(`Select class ID to mark attendance:\n${classOptions}`);
      if (input && data.classes.some(c => c.id == input)) {
        selectedClassId = input;
      } else {
        status.innerText = 'Invalid class selected.';
      }
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Error fetching enrolled classes.';
  }
}

// Load face-api models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models')
]).then(async () => {
  status.innerText = 'Models loaded. Initializing camera...';
  await fetchClasses();
  startVideo();
}).catch(err => {
  status.innerText = 'Error loading face models';
  console.error(err);
});

// Start webcam
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      status.innerText = 'Align your face in front of the camera';
    })
    .catch(err => {
      status.innerText = 'Cannot access camera';
      console.error(err);
    });
}

// Main loop: detect face
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

    // Draw detections
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resizedDetections);

    // Mark attendance once
    status.innerText = 'Face detected! Marking attendance...';
    await markAttendanceFace(selectedClassId);
  }, 2000); // every 2 seconds
});

// Function to mark attendance via backend
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
      attendanceMarked = true; // prevent duplicates
    } else {
      status.innerText = `❌ ${data.message}`;
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Error marking attendance';
  }
}