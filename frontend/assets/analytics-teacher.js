const token = localStorage.getItem('token');
const API_URL = 'https://attendace-zjzu.onrender.com';

const classSelect = document.getElementById('classSelect');
const exportCsvBtn = document.querySelector('.export-csv-btn');

// 1️⃣ Fetch classes and populate dropdown
async function loadTeacherClasses() {
  try {
    const res = await fetch(`${API_URL}/api/teacher/classes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch classes');

    const classes = await res.json();
    classes.forEach(cls => {
      const option = document.createElement('option');
      option.value = cls.id;
      option.textContent = `${cls.name} - ${cls.subject}`;
      classSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading classes:', err);
  }
}


// 2️⃣ Export CSV for selected class
exportCsvBtn.addEventListener('click', () => {
  const classId = classSelect.value;
  if (!classId) return alert('Please select a class');

  fetch(`${API_URL}/api/attendance/analytics/class/${classId}/csv`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_${classId}_attendance.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  })
  .catch(err => console.error('CSV download error:', err));
});

// 3️⃣ Initialize
loadTeacherClasses();