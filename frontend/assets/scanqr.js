// frontend/assets/scanqr.js
const token = localStorage.getItem('token'); // student JWT
const errorMsg = document.getElementById('errorMsg');

if (!token) {
  alert('Not logged in. Please log in as student.');
  if (errorMsg) errorMsg.textContent = 'No auth token. Login first.';
  throw new Error('No JWT token in localStorage');
}

async function markAttendance(class_id, qrToken) {
  try {
    const res = await fetch('https://attendace-demo.onrender.com/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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

function onScanSuccess(decodedText, decodedResult) {
  try {
    // QR should contain JSON: { class_id, token }
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
  // ignore frequently; optionally show a small message
  // console.warn('scan failure', err);
}

// init scanner
const html5QrcodeScanner = new Html5Qrcode("reader");
Html5Qrcode.getCameras()
  .then(cameras => {
    if (!cameras || cameras.length === 0) {
      if (errorMsg) errorMsg.textContent = 'No camera found on this device.';
      return;
    }
    html5QrcodeScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScanSuccess,
      onScanFailure
    ).catch(err => {
      console.error('Unable to start camera:', err);
      if (errorMsg) errorMsg.textContent = 'Cannot access camera. Allow permissions.';
    });
  })
  .catch(err => {
    console.error('Camera error:', err);
    if (errorMsg) errorMsg.textContent = 'Camera access denied or unavailable: ' + err;
  });