//frontend/assets/scanface.js
const video = document.getElementById('video');
const status = document.getElementById('status');
const token = localStorage.getItem('token'); // JWT

if (!token) {
  status.innerText = 'You must be logged in to mark attendance.';
  throw new Error('No JWT token found');
}

// Load face-api models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models')
]).then(startVideo).catch(err => {
  status.innerText = 'Error loading face models';
  console.error(err);
});

// Start webcam
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => { video.srcObject = stream; status.innerText = 'Align your face in front of the camera'; })
    .catch(err => { status.innerText = 'Cannot access camera'; console.error(err); });
}

// Main loop: detect face
video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.appendChild(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                                     .withFaceLandmarks()
                                     .withFaceDescriptors();

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (detections.length === 0) return;

    // Draw box
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resizedDetections);

    // Here: for simplicity, we assume single face detection = correct student
    status.innerText = 'Face detected, marking attendance...';

    // Mark attendance
    await markAttendanceFace();
  }, 3000); // check every 3 seconds
});

// Function to call backend
async function markAttendanceFace() {
  const class_id = prompt('Enter Class ID for attendance'); // You can replace with dropdown if you have UI

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
      status.innerText = `Attendance marked ✅ for class ${class_id}`;
    } else {
      status.innerText = `❌ ${data.message}`;
    }
  } catch (err) {
    console.error(err);
    status.innerText = 'Error marking attendance';
  }
}