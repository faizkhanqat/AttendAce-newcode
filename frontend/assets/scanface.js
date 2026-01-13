let video;
let status;
let detectionInterval = null;
let hasMarkedAttendance = false;

console.log('✅ scanface.js loaded');

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', async () => {
  video = document.getElementById('video');
  status = document.getElementById('status');

  if (!video || !status) {
    console.error('❌ Required DOM elements missing');
    return;
  }

  // Step 1: Check active class
  const activeClass = await getActiveClass();
  if (!activeClass) {
    status.innerText = '⏳ No active class right now';
    return;
  }

  // Step 2: Check attendance status
  const attendanceStatus = await checkAttendanceStatus(activeClass.class_id);
  if (attendanceStatus.marked) {
    status.innerText = '⚠️ Attendance already marked';
    hasMarkedAttendance = true;
    return; // ✅ Skip camera and detection
  }

  // Step 3: Start camera and face detection
  await init();
});

// ---------- LOAD FACEAPI MODELS ----------
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

// ---------- START CAMERA ----------
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

// ---------- GET ACTIVE CLASS ----------
async function getActiveClass() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const res = await fetch('/api/student/classes/active', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!res.ok) return null;

    const data = await res.json();
    console.log('🔍 Active class_id:', data.class_id);
    return data; // { class_id, expires_at }
  } catch (err) {
    console.error('❌ Error fetching active class:', err);
    return null;
  }
}

// ---------- CHECK ATTENDANCE STATUS ----------
async function checkAttendanceStatus(class_id) {
  const token = localStorage.getItem('token');
  if (!token) return { marked: false };

  try {
    const res = await fetch(`/api/attendance/status?class_id=${class_id}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!res.ok) return { marked: false };

    const data = await res.json();
    return { marked: !!data.marked };
  } catch (err) {
    console.error('❌ Error checking attendance status:', err);
    return { marked: false };
  }
}

// ---------- MARK FACE ATTENDANCE ----------
async function markFaceAttendance(class_id) {
  if (hasMarkedAttendance) return;

  hasMarkedAttendance = true;
  const token = localStorage.getItem('token');

  try {
    const res = await fetch('/api/attendance/face-mark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ class_id })
    });

    const data = await res.json();

    if (res.ok) {
      status.innerText = '✅ Attendance marked successfully!';
    } else if (res.status === 409) {
      status.innerText = '⚠️ Attendance already marked';
      hasMarkedAttendance = true; // prevent further 409 POSTs
    } else {
      status.innerText = data.message || '❌ Attendance failed';
      hasMarkedAttendance = false;
    }

    clearInterval(detectionInterval);

  } catch (err) {
    console.error('❌ Face attendance error:', err);
    status.innerText = '❌ Server error';
    hasMarkedAttendance = false;
  }
}

// ---------- FACE DETECTION ----------
function startDetection() {
  const container = document.getElementById('video-container');
  const canvas = faceapi.createCanvasFromMedia(video);
  container.appendChild(canvas);

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.9 // ✅ 0.9 threshold
  });

  detectionInterval = setInterval(async () => {
    if (hasMarkedAttendance) return;

    const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length > 0) {
      const resized = faceapi.resizeResults(detections, displaySize);
      faceapi.draw.drawDetections(canvas, resized);
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      status.innerText = '✅ Face detected. Marking attendance...';

      const activeClass = await getActiveClass();
      if (!activeClass) {
        status.innerText = '⏳ No active class right now';
        clearInterval(detectionInterval);
        return;
      }

      await markFaceAttendance(activeClass.class_id);
    } else {
      status.innerText = 'No face detected...';
    }
  }, 400);
}