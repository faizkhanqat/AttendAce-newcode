// frontend/assets/scanqr.js

const token = localStorage.getItem('token'); // student JWT
const errorMsg = document.getElementById('errorMsg');
const html5QrcodeScanner = new Html5Qrcode("reader");

if (!token) {
  alert('Not logged in. Please log in as student.');
  if (errorMsg) errorMsg.textContent = 'No auth token. Login first.';
  throw new Error('No JWT token in localStorage');
}

// Fetch active class from backend
async function getActiveClass() {
  try {
    const res = await fetch('/api/student/classes/active', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data; // { class_id, expires_at } or null if none
  } catch (err) {
    console.error('Error fetching active class:', err);
    return null;
  }
}

// --- Mark attendance via QR ---
async function markAttendance(class_id, qrToken) {
  try {
    const res = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token 
      },
      body: JSON.stringify({ class_id, token: qrToken })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error(data.message || 'Forbidden');
      if (res.status === 400) throw new Error(data.message || 'Bad request');
      if (res.status === 409) throw new Error(data.message || 'Already marked');
      throw new Error(data.message || 'Failed to mark attendance');
    }

    const json = await res.json().catch(() => ({}));
    alert('Attendance marked successfully');
    console.log('markAttendance response:', json);
  } catch (err) {
    console.error('Error marking attendance:', err);
    alert('Attendance failed: ' + err.message);
  }
}

// QR scan callbacks
function onScanSuccess(decodedText, decodedResult) {
  try {
    const parsed = JSON.parse(decodedText);
    if (!parsed.class_id || !parsed.token) throw new Error('QR missing fields');
    markAttendance(parsed.class_id, parsed.token);
    html5QrcodeScanner.stop().catch(e => console.error('Failed to stop scanner:', e));
  } catch (err) {
    console.error('Invalid QR format:', err);
    alert('Invalid QR: scan a valid class QR');
  }
}

function onScanFailure(err) {
  // optionally ignore or log
}

// --- Main initialization ---
(async () => {
  const activeClass = await getActiveClass();

  if (activeClass) {
    // Active class exists → check face verification
    const urlParams = new URLSearchParams(window.location.search);
    const faceVerified = urlParams.get('faceVerified');

    if (faceVerified !== 'true') {
      // Redirect to scanface with active class_id
      window.location.href = `scanface.html?class_id=${activeClass.class_id}`;
      return;
    }

    // Face verified → start QR scanner
    startScanner(activeClass.class_id);

  } else {
    // No active class → skip face verification, open QR scanner directly
    console.log('No active class → starting QR scanner directly');
    startScanner(null);
  }
})();

// --- Start QR scanner ---
function startScanner(class_id) {
  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras || cameras.length === 0) {
      if (errorMsg) errorMsg.textContent = 'No camera found on this device.';
      return;
    }

    const videoWidth = document.getElementById('reader').clientWidth;
    const videoHeight = document.getElementById('reader').clientHeight;

    html5QrcodeScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: videoWidth, height: videoHeight } },
      onScanSuccess,
      onScanFailure
    ).catch(err => {
      console.error('Unable to start camera:', err);
      if (errorMsg) errorMsg.textContent = 'Cannot access camera. Allow permissions.';
    });
  });
}