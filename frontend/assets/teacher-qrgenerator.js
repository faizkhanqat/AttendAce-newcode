// frontend/assets/teacher-qrgenerator.js

/* -------------------- CONSTANTS -------------------- */
const token = localStorage.getItem('token');
const classSelect = document.getElementById('classSelect');
const activationBtn = document.getElementById('activationBtn');
const qrForm = document.getElementById('qrForm');
const qrResult = document.getElementById('qrResult');
const errorMsg = document.getElementById('errorMsg');
const countdownEl = document.getElementById('countdown');

// QR/Countdown intervals
let qrInterval = null;
let countdownInterval = null;

// Get preselected class from URL
const urlParams = new URLSearchParams(window.location.search);
const preselectedClassId = urlParams.get('class_id');

/* -------------------- THEME -------------------- */
const cachedUser = JSON.parse(localStorage.getItem('user'));
if (cachedUser?.mode === 'gaming') {
  document.body.classList.add('gaming');
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) themeToggleBtn.innerText = 'GAMING';
}

const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    document.body.classList.toggle('gaming');
    themeToggleBtn.innerText = document.body.classList.contains('gaming')
      ? 'GAMING'
      : 'OFFICIAL';
  };
}

/* -------------------- REVEAL ANIMATION -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.reveal').forEach(el => {
    setTimeout(() => el.classList.add('show'), 100);
  });
});

/* -------------------- ACTIVATE/DEACTIVATE BUTTON -------------------- */
function updateActivationButton(cls) {
  if (cls.is_active) {
    activationBtn.innerText = 'Deactivate';
    activationBtn.classList.remove('bg-green-600');
    activationBtn.classList.add('bg-red-500');
  } else {
    activationBtn.innerText = 'Activate';
    activationBtn.classList.remove('bg-red-500');
    activationBtn.classList.add('bg-green-600');
  }
}

classSelect.addEventListener('change', async () => {
  const classId = classSelect.value;
  if (!classId) return;
  try {
    const res = await fetch(`https://attendace-zjzu.onrender.com/api/teacher/classes`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const classes = await res.json();
    const cls = classes.find(c => c.id === classId);
    if (cls) updateActivationButton(cls);
  } catch (err) {
    console.error(err);
  }
});

activationBtn.onclick = async () => {
  const classId = classSelect.value;
  if (!classId) return alert('Select a class first');

  const isActive = activationBtn.innerText === 'Deactivate';
  const url = isActive
    ? `https://attendace-zjzu.onrender.com/api/teacher/classes/deactivate`
    : `https://attendace-zjzu.onrender.com/api/teacher/classes/activate`;

  const body = isActive ? { class_id: classId } : { class_id: classId, minutes: 15 };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    const updatedClass = await res.json();
    updateActivationButton(updatedClass);
    alert(isActive ? 'Class Deactivated' : 'Class Activated');
  }
};

/* -------------------- FETCH CLASSES -------------------- */
async function fetchClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/teacher/classes', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const classes = await res.json();

    classSelect.innerHTML = '<option value="">Select class</option>';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (preselectedClassId && preselectedClassId == c.id) {
        opt.selected = true;
        updateActivationButton(c);
      }
      classSelect.appendChild(opt);
    });
    // Update button for selected class (preselected or first)
    const initialClass = classes.find(c => c.id == (preselectedClassId || classes[0]?.id));
    if (initialClass) updateActivationButton(initialClass);

  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Error fetching classes: ' + err.message;
  }
}

/* -------------------- QR GENERATION -------------------- */
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

async function initPreselectedClass() {
  if (!preselectedClassId) return;
  const selectedOption = Array.from(classSelect.options).find(opt => opt.value === preselectedClassId);
  if (!selectedOption) return;
  startQRRotation(preselectedClassId);
}

/* -------------------- FORM SUBMIT -------------------- */
qrForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const classId = classSelect.value;
  if (!classId) return alert('Select a class first');
  startQRRotation(classId);
});

/* -------------------- INIT -------------------- */
fetchClasses().then(initPreselectedClass);