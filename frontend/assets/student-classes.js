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
    myClassesContainer.innerHTML = '';

    if (!classes.length) {
      myClassesContainer.innerHTML =
        '<p class="text-center text-sm text-gray-500">No classes enrolled yet.</p>';
      return;
    }

    classes.forEach(cls => {
      const row = document.createElement('div');
      row.className =
        'grid grid-cols-3 gap-3 items-center bg-white border border-gray-100 rounded-xl px-3 py-2';

      row.innerHTML = `
        <span class="font-medium">${cls.name}</span>
        <span class="text-sm text-gray-500">${cls.teacher_name || cls.teacher_id}</span>
        <div class="text-right">
          <button
            class="px-3 py-1 rounded-lg bg-red-500 text-white text-sm
                   hover:bg-red-600 hover:shadow-md transition"
            onclick="unenroll(${cls.id}, this)">
            Unenroll
          </button>
        </div>
      `;
      myClassesContainer.appendChild(row);
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
    const row = document.createElement('div');
    row.className =
      'grid grid-cols-3 gap-3 items-center bg-white border border-gray-100 rounded-xl px-3 py-2';

    row.innerHTML = `
      <span class="font-medium">${cls.name}</span>
      <span class="text-sm text-gray-500">${cls.teacher_name || cls.teacher_id}</span>
      <div class="text-right">
        <button
          class="px-3 py-1 rounded-lg bg-[#4b4ddb] text-white text-sm
                 hover:opacity-90 hover:shadow-md transition"
          onclick="enroll(${cls.id}, '${escapeHtml(cls.name)}',
          '${escapeHtml(cls.teacher_name || cls.teacher_id)}')">
          Enroll
        </button>
      </div>
    `;
    availableClassesContainer.appendChild(row);
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

    btn.closest('div.grid').remove();

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