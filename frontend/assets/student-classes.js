const token = localStorage.getItem('token');

const myClassesContainer = document.getElementById('myClassesContainer');
const errorMsg = document.getElementById('errorMsg');

const addClassBtn = document.getElementById('addClassBtn');
const availableClassesModal = document.getElementById('availableClassesModal');
const availableClassesContainer = document.getElementById('availableClassesContainer');
const closeModalBtn = document.getElementById('closeModalBtn');
const classSearchInput = document.getElementById('classSearchInput');

let allAvailableClasses = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  await fetchMyClasses();

  addClassBtn.addEventListener('click', async () => {
    availableClassesModal.style.display = 'flex';
    await fetchAvailableClasses();
  });

  closeModalBtn.addEventListener('click', () => {
    availableClassesModal.style.display = 'none';
    classSearchInput.value = '';
  });

  classSearchInput.addEventListener('input', filterAvailableClasses);
});

async function fetchMyClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes/my', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('Failed to fetch classes');

    const classes = await res.json();


// Clear container first
myClassesContainer.innerHTML = '';

// If no classes
if (!classes.length) {
  myClassesContainer.innerHTML =
    '<p class="text-center text-sm text-gray-500">No classes enrolled yet.</p>';
  return;
}

classes.forEach(cls => {
  const card = document.createElement('div');
  card.className =
    'bg-[var(--card)] border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2';

  card.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <div class="text-lg font-bold">${cls.name}</div>
        <div class="text-sm text-gray-500">${cls.subject || ''}</div>
        <div class="text-sm text-gray-500">
          Teacher: ${cls.teacher_name || cls.teacher_id}
        </div>
      </div>
      <div class="flex justify-center">
  <button
    onclick="unenroll(${cls.id})"
    class="px-4 py-2 rounded-lg bg-gray-500 text-white text-sm font-medium
           hover:bg-gray-400 hover:shadow-md transition
           min-w-[95px]">
    Unenroll
  </button>
</div>
    </div>
  `;

  myClassesContainer.appendChild(card);
});
  } catch (err) {
    errorMsg.textContent = err.message;
  }
}

async function fetchAvailableClasses() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/student/classes', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('Failed to fetch classes');

    allAvailableClasses = await res.json();
    renderAvailableClasses(allAvailableClasses);
  } catch (err) {
    availableClassesContainer.innerHTML =
      `<p class="text-red-500 text-sm">${err.message}</p>`;
  }
}

function filterAvailableClasses() {
  const query = classSearchInput.value.toLowerCase();
  const filtered = allAvailableClasses.filter(cls =>
    cls.name.toLowerCase().includes(query) ||
    (cls.teacher_name || cls.teacher_id).toLowerCase().includes(query)
  );
  renderAvailableClasses(filtered);
}

function renderAvailableClasses(classes) {
  availableClassesContainer.innerHTML = '';

  if (!classes.length) {
    availableClassesContainer.innerHTML =
      '<p class="text-sm text-gray-500 text-center">No matching classes.</p>';
    return;
  }

  classes.forEach(cls => {
  const card = document.createElement('div');
  card.className =
    'class-card bg-[var(--card)] border border-gray-200 rounded-2xl p-4 shadow-sm flex justify-between items-center';

  card.innerHTML = `
    <div>
      <div class="font-semibold">${cls.name}</div>
      <div class="text-sm text-gray-500">${cls.subject || ''}</div>
      <div class="text-sm text-gray-500">
        Teacher: ${cls.teacher_name || cls.teacher_id}
      </div>
    </div>

    <button
      class="px-4 py-2 rounded-lg bg-[#5FC26B] text-white text-sm font-medium
       hover:opacity-90 hover:shadow-md transition
       min-w-[95px]"
      onclick="enroll(${cls.id})">
      Enroll
    </button>
  `;

  availableClassesContainer.appendChild(card);
});
}

async function enroll(classId, className, teacherName) {
  try {
    const res = await fetch(
      'https://attendace-zjzu.onrender.com/api/student/classes/enroll',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ class_id: classId })
      }
    );

    if (!res.ok) throw new Error('Enroll failed');

    availableClassesModal.style.display = 'none';
    await fetchMyClasses();
  } catch (err) {
    alert(err.message);
  }
}

async function unenroll(classId, btn) {
  try {
    const res = await fetch(
      'https://attendace-zjzu.onrender.com/api/student/classes/unenroll',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ class_id: classId })
      }
    );

    if (!res.ok) throw new Error('Unenroll failed');

    await fetchMyClasses();

    if (!myClassesContainer.children.length) {
      myClassesContainer.innerHTML =
        '<p class="text-center text-sm text-gray-500">No classes enrolled yet.</p>';
    }
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(text) {
  return text?.replace(/'/g, "\\'") || '';
}