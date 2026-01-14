let video;
let status;
let detectionInterval = null;
let lastDescriptor = null;
let lastScore = 0;
let faceStatusBox;
let matchStatusBox;
let registeredDescriptor = null;

let scanCompleted = false; // ✅ NEW: stop scanning after 0.9

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
      status.innerText = 'Bring your face closer to the camera, you monkey!';
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
    if (scanCompleted) return; // ✅ stop further scans

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        status.innerText = 'No face detected...';
        return;
      }

      const resized = faceapi.resizeResults(detection, displaySize);
      const box = resized.detection.box;

      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      lastDescriptor = resized.descriptor;
      lastScore = resized.detection.score;

      status.innerText = `Hey you monkey! Come closer to the camera! Confidence: ${lastScore.toFixed(2)}`;

      // ✅ Stop scanning at 0.9
      if (lastScore >= 0.9) {
        scanCompleted = true;
        clearInterval(detectionInterval);

        status.innerText = 'Alright alright, face scanned, move away now.';

        if (registeredDescriptor) {
          const distance = faceapi.euclideanDistance(
            lastDescriptor,
            registeredDescriptor
          );

          if (distance < 0.6) {
            matchStatusBox.innerText = '✅ Yes! You are that monkey!';
            matchStatusBox.style.backgroundColor = '#5f8b6e';
          } else {
            matchStatusBox.innerText = '❌ You are not the right monkey.';
            matchStatusBox.style.backgroundColor = '#d9534f';
          }
        } else {
          matchStatusBox.innerText = 'ℹ️ No face registered. You can register now.';
          matchStatusBox.style.backgroundColor = '#5bc0de';
        }

        // ✅ Show update button after scan
        document.getElementById('registerBtn').style.display = 'inline-block';
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

  if (!token) {
    faceStatusBox.innerText = '⚠️ You are not logged in';
    faceStatusBox.style.backgroundColor = '#f0ad4e';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/student/face`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.registered) {
      faceStatusBox.innerText = '✅ A monkey is already registered for this ID.';
      faceStatusBox.style.backgroundColor = '#5f8b6e';

      const descRes = await fetch(`${API_URL}/api/student/face/encoding`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const descData = await descRes.json();
      if (descData.face_encoding) {
        registeredDescriptor = new Float32Array(
          JSON.parse(descData.face_encoding)
        );
      }
    } else {
      faceStatusBox.innerText = '❌ No face registered';
      faceStatusBox.style.backgroundColor = '#d9534f';
    }
  } catch (err) {
    console.error(err);
    faceStatusBox.innerText = '⚠️ Unable to check face status';
    faceStatusBox.style.backgroundColor = '#f0ad4e';
  }
}

// ----------------- Register / Update Face -----------------
document.getElementById('registerBtn').addEventListener('click', async () => {
  if (!lastDescriptor || lastScore < 0.9) {
    alert('Face scan not complete');
    return;
  }

  const API_URL = 'https://attendace-zjzu.onrender.com';
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/api/student/face/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        face_encoding: JSON.stringify(Array.from(lastDescriptor))
      })
    });

    const data = await res.json();
    alert(data.message || 'Face updated successfully');
    location.reload();
  } catch (err) {
    alert('Error updating face');
  }
});

// ----------------- Back to Dashboard -----------------
document
  .getElementById('backDashboardBtn')
  .addEventListener('click', () => {
    window.location.href = 'student-dashboard.html';
  });