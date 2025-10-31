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
    const res = await fetch('https://attendace-zjzu.onrender.com/api/teacher/classes', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const classes = await res.json();
    classSelect.innerHTML = '<option value="">Select class</option>';
    classes.forEach((c) => {
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

function startCountdown(seconds) {
  clearInterval(countdownInterval);
  let remaining = seconds;
  countdownEl.textContent = `Next QR in: ${remaining}s`;
  countdownInterval = setInterval(() => {
    remaining--;
    countdownEl.textContent = `Next QR in: ${remaining}s`;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

async function generateDynamicQRCode(classId) {
  try {
    const res = await fetch(`https://attendace-zjzu.onrender.com/api/qr/dynamic?class_id=${classId}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Failed to generate QR');
    const data = await res.json();

    const qrData = JSON.stringify({ class_id: classId, token: data.token });
    const qrUrl = await QRCode.toDataURL(qrData, { width: 220 });
    qrResult.innerHTML = `<img src="${qrUrl}" alt="Dynamic QR">`;

    startCountdown(10);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Error generating QR: ' + err.message;
  }
}

function startQRRotation(classId) {
  if (qrInterval) clearInterval(qrInterval);
  generateDynamicQRCode(classId);
  qrInterval = setInterval(() => generateDynamicQRCode(classId), 10000);
}

qrForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const classId = classSelect.value;
  if (!classId) return alert('Select a class first');
  startQRRotation(classId);
});

fetchClasses();