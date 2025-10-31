// frontend/assets/student-classes.js
const token = localStorage.getItem('token');
const myClassesContainer = document.getElementById('myClassesContainer');
const errorMsg = document.getElementById('errorMsg');
const addClassBtn = document.getElementById('addClassBtn');
const availableClassesModal = document.getElementById('availableClassesModal');
const availableClassesContainer = document.getElementById('availableClassesContainer');
const closeModalBtn = document.getElementById('closeModalBtn');
const logoutBtn = document.getElementById('logoutBtn');

document.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });

  // Load enrolled classes
  await fetchMyClasses();

  // Open modal to add class
  addClassBtn.addEventListener('click', async () => {
    availableClassesModal.style.display = 'flex';
    await fetchAvailableClasses();
  });

  // Close modal
  closeModalBtn.addEventListener('click', () => {
    availableClassesModal.style.display = 'none';
  });
});

async function fetchMyClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes/my', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to fetch my classes');
    }
    const classes = await res.json();
    myClassesContainer.innerHTML = '';
    if (!classes || classes.length === 0) {
      myClassesContainer.innerHTML = '<p style="text-align:center;">No classes enrolled yet.</p>';
      return;
    }
    classes.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = `<span>${cls.name} (Teacher: ${cls.teacher_name || cls.teacher_id})</span>
        <button onclick="unenroll(${cls.id}, this)">Remove</button>`;
      myClassesContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    if (errorMsg) errorMsg.textContent = 'Error: ' + err.message;
  }
}

async function fetchAvailableClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to fetch classes');
    }
    const classes = await res.json();
    availableClassesContainer.innerHTML = '';
    if (!classes || classes.length === 0) {
      availableClassesContainer.innerHTML = '<p>No classes available.</p>';
      return;
    }
    classes.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = `<span>${cls.name} (Teacher: ${cls.teacher_name || cls.teacher_id})</span>
        <button onclick="enroll(${cls.id}, '${escapeHtml(cls.name)}', '${escapeHtml(cls.teacher_name || cls.teacher_id)}')">Enroll</button>`;
      availableClassesContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    availableClassesContainer.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

async function enroll(classId, className, teacherName) {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ class_id: classId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to enroll');
    }
    // add to UI
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `<span>${className} (Teacher: ${teacherName})</span>
      <button onclick="unenroll(${classId}, this)">Remove</button>`;
    myClassesContainer.appendChild(card);
    availableClassesModal.style.display = 'none';
  } catch (err) {
    console.error(err);
    alert('Error enrolling: ' + err.message);
  }
}

async function unenroll(classId, btn) {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes/unenroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ class_id: classId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to unenroll');
    }
    // remove from UI
    if (btn && btn.parentElement) btn.parentElement.remove();
    if (!myClassesContainer.children.length) myClassesContainer.innerHTML = '<p style="text-align:center;">No classes enrolled yet.</p>';
  } catch (err) {
    console.error(err);
    alert('Failed to remove class: ' + err.message);
  }
}

// small helper
function escapeHtml(text) {
  return text?.replace?.(/'/g, "\\'") || '';
}