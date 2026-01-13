let video;
let status;
let detectionInterval = null;
let lastDescriptor = null;
let lastScore = 0;
let faceStatusBox;

console.log('✅ register-face.js loaded');

window.addEventListener('DOMContentLoaded', async () => {
  video = document.getElementById('video');
  status = document.getElementById('status');
  faceStatusBox = document.getElementById('faceStatusBox'); // ✅ New element

  if (!video || !status || !faceStatusBox) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  await loadModels();
  await checkFaceStatus(); // ✅ Check face status on load
});

async function loadModels() {
  try {
    status.innerText = 'Loading models...';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);
    status.innerText = 'Models loaded. Starting camera...';
    await startVideo();
  } catch (err) {
    console.error('❌ Model loading error:', err);
    status.innerText = 'Failed to load face detection models.';
  }
}

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
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

function startDetection() {
  const container = document.getElementById('video-container');
  const canvas = faceapi.createCanvasFromMedia(video);
  container.appendChild(canvas);

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

  detectionInterval = setInterval(async () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const detection = await faceapi.detectSingleFace(video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const resized = faceapi.resizeResults(detection, displaySize);
        const box = resized.detection.box;

        // Draw rectangle and landmarks
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        faceapi.draw.drawFaceLandmarks(canvas, resized);

        lastDescriptor = resized.descriptor;
        lastScore = resized.detection.score;

        status.innerText = `Face detected! Confidence: ${lastScore.toFixed(2)}`;
      } else {
        lastDescriptor = null;
        lastScore = 0;
        status.innerText = 'No face detected...';
      }
    } catch (err) {
      console.error('❌ Detection error:', err);
    }
  }, 500);
}

// ----------------- Face Status Check -----------------
async function checkFaceStatus() {
  const API_URL = 'https://attendace-zjzu.onrender.com';
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/api/student/face`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.registered) {
      faceStatusBox.innerText = '✅ Face already registered';
      faceStatusBox.style.backgroundColor = '#5f8b6e';
    } else {
      faceStatusBox.innerText = '❌ No face registered';
      faceStatusBox.style.backgroundColor = '#d9534f';
    }
  } catch (err) {
    console.error('Error checking face status:', err);
    faceStatusBox.innerText = '⚠️ Unable to check face status';
    faceStatusBox.style.backgroundColor = '#f0ad4e';
  }
}

// ----------------- Register / Update Face -----------------
document.getElementById('registerBtn').addEventListener('click', async () => {
  if (!lastDescriptor) {
    alert('No face detected! Make sure your face is visible.');
    return;
  }

  const scoreThreshold = 0.9;
  if (lastScore < scoreThreshold) {
    alert('Face quality too low. Please adjust your face and try again.');
    return;
  }

  const faceEncoding = JSON.stringify(Array.from(lastDescriptor));
  const API_URL = 'https://attendace-zjzu.onrender.com';
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/api/student/face/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ face_encoding: faceEncoding })
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      await checkFaceStatus(); // ✅ Update face status box after registration
    } else {
      alert(data.message || data.error || 'Failed to register face.');
    }
  } catch (err) {
    console.error('❌ Registration error:', err);
    alert('Server error while registering face.');
  }
});

// ----------------- Back to Dashboard -----------------
const backBtn = document.getElementById('backDashboardBtn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'student-dashboard.html';
  });
}