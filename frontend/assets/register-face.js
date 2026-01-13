let video;
let status;
let detectionInterval = null;
let lastDescriptor = null;
let lastScore = 0;
let faceStatusBox;
let matchStatusBox; // ✅ New element for match check
let registeredDescriptor = null; // ✅ Store registered face descriptor

console.log('✅ register-face.js loaded');

window.addEventListener('DOMContentLoaded', async () => {
  video = document.getElementById('video');
  status = document.getElementById('status');
  faceStatusBox = document.getElementById('faceStatusBox'); 
  matchStatusBox = document.getElementById('matchStatusBox');

  if (!video || !status || !faceStatusBox || !matchStatusBox) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  await loadModels();
  await checkFaceStatus();
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

        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        faceapi.draw.drawFaceLandmarks(canvas, resized);

        lastDescriptor = resized.descriptor;
        lastScore = resized.detection.score;
        status.innerText = `Face detected! Confidence: ${lastScore.toFixed(2)}`;

        if (registeredDescriptor && lastScore >= 0.9) {
          const distance = faceapi.euclideanDistance(lastDescriptor, registeredDescriptor);
          if (distance < 0.6) {
            matchStatusBox.innerText = '✅ This is the registered face';
            matchStatusBox.style.backgroundColor = '#5f8b6e';
          } else {
            matchStatusBox.innerText = '❌ This is NOT the registered face';
            matchStatusBox.style.backgroundColor = '#d9534f';
          }
        } else {
          matchStatusBox.innerText = '';
          matchStatusBox.style.backgroundColor = 'transparent';
        }

      } else {
        lastDescriptor = null;
        lastScore = 0;
        status.innerText = 'No face detected...';
        matchStatusBox.innerText = '';
        matchStatusBox.style.backgroundColor = 'transparent';
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

  console.log('Token being sent:', token);

  if (!token) {
    faceStatusBox.innerText = '⚠️ You are not logged in';
    faceStatusBox.style.backgroundColor = '#f0ad4e';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/student/face`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error(`Server returned non-JSON or status ${res.status}`);
    }

    const data = await res.json();

    if (data.registered) {
      faceStatusBox.innerText = '✅ Face already registered';
      faceStatusBox.style.backgroundColor = '#5f8b6e';

      // ✅ Fetch registered encoding and parse JSON string
      const descRes = await fetch(`${API_URL}/api/student/face/encoding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const descType = descRes.headers.get('content-type') || '';
      if (!descRes.ok || !descType.includes('application/json')) {
        throw new Error(`Failed to fetch face encoding: ${descRes.status}`);
      }
      const descData = await descRes.json();
      if (descData.face_encoding) {
        const arr = JSON.parse(descData.face_encoding); // parse JSON
        registeredDescriptor = new Float32Array(arr);    // convert to Float32Array
      }

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
  if (!lastDescriptor) return alert('No face detected! Make sure your face is visible.');
  if (lastScore < 0.9) return alert('Face quality too low. Please adjust and try again.');

  const faceEncoding = JSON.stringify(Array.from(lastDescriptor));
  const API_URL = 'https://attendace-zjzu.onrender.com';
  const token = localStorage.getItem('token');
  console.log('Token being sent:', token);

  try {
    const res = await fetch(`${API_URL}/api/student/face/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ face_encoding: faceEncoding })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error(`Server returned non-JSON or status ${res.status}`);
    }

    const data = await res.json();
    alert(data.message || 'Face registered successfully');
    await checkFaceStatus();

  } catch (err) {
    console.error('❌ Registration error:', err);
    alert('Server error or not authorized while registering face.');
  }
});

// ----------------- Back to Dashboard -----------------
const backBtn = document.getElementById('backDashboardBtn');
if (backBtn) {
  backBtn.addEventListener('click', () => window.location.href = 'student-dashboard.html');
}