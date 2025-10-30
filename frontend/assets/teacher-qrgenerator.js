// frontend/assets/teacher-qrgenerator.js
const classSelect = document.getElementById('classSelect');
const qrForm = document.getElementById('qrForm');
const qrResult = document.getElementById('qrResult');
const errorMsg = document.getElementById('errorMsg');
const countdownEl = document.getElementById('countdown');
const token = localStorage.getItem('token');

let qrInterval = null;
let countdownInterval = null;

async function fetchClasses() {
  try {
    const res = await fetch('https://localhost:3700/api/teacher/classes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const classes = await res.json();
    classSelect.innerHTML = '<option value="">Select class</option>';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      classSelect.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Error fetching classes: ' + err.message;
  }
}

function generateRandomToken(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < length; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
  return t;
}

function startCountdown(duration) {
  clearInterval(countdownInterval);
  let remaining = duration * 60;
  countdownEl.textContent = `Expires in: ${duration}:00`;
  countdownInterval = setInterval(() => {
    remaining--;
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    countdownEl.textContent = `Expires in: ${min}:${sec < 10 ? '0' : ''}${sec}`;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

async function generateQRCode(classId, duration) {
  if (!classId) {
    alert('Please select a class');
    return;
  }
  const qrToken = generateRandomToken(24);

  try {
    // QR contains class_id + token as JSON
    const qrData = JSON.stringify({ class_id: classId, token: qrToken });
    const dataUrl = await QRCode.toDataURL(qrData, { width: 200 });
    qrResult.innerHTML = `<img src="${dataUrl}" alt="QR Code">`;

    // Register token in backend via /api/qr/generate
    const res = await fetch('https://localhost:3700/api/qr/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ class_id: classId, expires_in_minutes: duration })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to register QR in backend');
    }

    const resp = await res.json();
    // backend returns its token and expiry — but we embedded our QR token too.
    // Start countdown using duration (frontend side)
    startCountdown(duration);
    errorMsg.textContent = `QR generated for ${duration} minutes`;
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Error generating QR: ' + err.message;
  }
}

function startQRRotation(classId, duration) {
  if (qrInterval) clearInterval(qrInterval);
  generateQRCode(classId, duration);
  qrInterval = setInterval(() => generateQRCode(classId, duration), duration * 60 * 1000);
}

qrForm.addEventListener('submit', e => {
  e.preventDefault();
  const classId = classSelect.value;
  const duration = parseInt(document.getElementById('duration').value) || 15;
  startQRRotation(classId, duration);
});

fetchClasses();