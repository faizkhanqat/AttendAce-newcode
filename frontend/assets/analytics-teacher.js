const token = localStorage.getItem('token');
const API_URL = 'https://attendace-zjzu.onrender.com';

const classSelect = document.getElementById('classSelect');
const viewBtn = document.getElementById('viewRecordsBtn');
const table = document.getElementById('recordsTable');
const container = document.getElementById('recordsContainer');
const exportBtns = document.getElementById('exportButtons');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

let currentClass = null;
let currentData = null;

/* ===============================
   LOAD TEACHER CLASSES
=================================*/
async function loadClasses() {
  const res = await fetch(`${API_URL}/api/teacher/classes`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const classes = await res.json();

  classes.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls.id;
    opt.textContent = `${cls.name} - ${cls.subject}`;
    opt.dataset.teacher = cls.teacher_name;
    classSelect.appendChild(opt);
  });
}

/* ===============================
   VIEW RECORDS
=================================*/
viewBtn.addEventListener('click', async () => {
  const classId = classSelect.value;
  if (!classId) return alert('Select a class first');

  const res = await fetch(`${API_URL}/api/attendance/class/${classId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Backend error:", errText);
    alert("Server error while loading attendance");
    return;
  }
  const data = await res.json();
  currentData = data;
  currentClass = classSelect.options[classSelect.selectedIndex];

  renderTable(data);
});

/* ===============================
   RENDER TABLE (CSV STYLE)
=================================*/
function renderTable(data) {
  table.innerHTML = '';

  if (!data || !data.students || !data.students.length) {
    table.innerHTML = `<tr><td class="p-4">No records found</td></tr>`;
    return;
  }

  // Header
  let header = `<tr class="bg-gray-100">
      <th class="border px-3 py-2">Student Name</th>`;

  for (let i = 1; i <= data.totalClasses; i++) {
    header += `<th class="border px-3 py-2">${i}</th>`;
  }

  header += `</tr>`;
  table.innerHTML += header;

  // Rows
  data.students.forEach(stu => {
    let row = `<tr>
      <td class="border px-3 py-2 font-medium">${stu.name}</td>`;

    stu.records.forEach(r => {
      row += `<td class="border px-3 py-2 text-center">
        ${r === 'present' ? 'P' : '-'}
      </td>`;
    });

    row += `</tr>`;
    table.innerHTML += row;
  });

  container.classList.remove('hidden');
  exportBtns.classList.remove('hidden');
}

/* ===============================
   EXPORT CSV
=================================*/
exportCsvBtn.addEventListener('click', () => {
  const classId = classSelect.value;

  fetch(`${API_URL}/api/attendance/class/${classId}/csv`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentClass.textContent}_attendance.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
});

/* ===============================
   EXPORT PDF
=================================*/
exportPdfBtn.addEventListener('click', async () => {
  const classId = classSelect.value;

  const res = await fetch(`${API_URL}/api/attendance/class/${classId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentClass.textContent}_attendance.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

/* INIT */
loadClasses();