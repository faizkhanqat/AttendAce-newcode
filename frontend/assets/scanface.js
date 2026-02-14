let video;
let status;
let detectionInterval = null;
let hasMarkedAttendance = false;
let registeredDescriptor = null;

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

  // Step 2.5: Get registered face
registeredDescriptor = await getRegisteredFace();
if (!registeredDescriptor) {
  status.innerText = '❌ No face registered';
  return; // ❌ do not open camera
}

  // Step 3: Start camera and face detection
  await init();
});


async function getRegisteredFace() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/student/face/encoding', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();

  if (!data.face_encoding) return null;
  return new Float32Array(JSON.parse(data.face_encoding));
}



// ---------- LOAD FACEAPI MODELS ----------
async function init() {
  try {
    if (!window.faceapi) {
      status.innerText = 'FaceAPI not loaded';
      return;
    }

    // Skip loading if already loaded
    if (!faceapi.nets.tinyFaceDetector.params) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
      ]);
    }

    // Start camera
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

      // Fix canvas size to match actual video size
  const canvas = document.getElementById('overlay');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;



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
  const canvas = document.getElementById('overlay');

  const displaySize = { width: container.clientWidth, height: container.clientHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.9
  });

  detectionInterval = setInterval(async () => {
    if (hasMarkedAttendance) return;

const detection = await faceapi
  .detectSingleFace(video, options)
  .withFaceLandmarks()
  .withFaceDescriptor();
      const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detection) {
  const resized = faceapi.resizeResults(detection, displaySize);
  faceapi.draw.drawDetections(canvas, resized);

  // 🔐 FACE MATCH CHECK (ADD HERE)
  const distance = faceapi.euclideanDistance(
    detection.descriptor,
    registeredDescriptor
  );

  if (distance > 0.6) {
    status.innerText = '❌ Face does not match registered face';
    clearInterval(detectionInterval);
    return;
  }

  status.innerText = '✅ Face matched. Marking attendance...';

  const activeClass = await getActiveClass();
  if (!activeClass) {
    status.innerText = '⏳ No active class right now';
    clearInterval(detectionInterval);
    return;
  }

  await markFaceAttendance(activeClass.class_id);
  window.location.href = `scanqr.html?faceVerified=true&class_id=${activeClass.class_id}`;
} else {
      status.innerText = 'No face detected...';
    }
  }, 400);
}