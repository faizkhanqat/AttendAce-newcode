// frontend/assets/analytics.js

const token = localStorage.getItem('token');
const chartsContainer = document.getElementById('charts');

if (!token) {
  chartsContainer.innerHTML = '<p>You must be logged in to view analytics.</p>';
  throw new Error('No JWT token found');
}

async function fetchStudentAnalytics() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/attendance/analytics/student', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return await res.json();
  } catch (err) {
    console.error(err);
    chartsContainer.innerHTML = `<p>Error loading analytics: ${err.message}</p>`;
    return null;
  }
}

async function renderStudentAnalytics() {
  const data = await fetchStudentAnalytics();
  if (!data) return;

  if (data.classes.length === 0) {
    chartsContainer.innerHTML = '<p>No classes enrolled yet.</p>';
    return;
  }

  chartsContainer.innerHTML = '<canvas id="attendanceChart" width="400" height="300"></canvas>';
  const ctx = document.getElementById('attendanceChart').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.classes.map(c => c.name),
      datasets: [
        { label: 'Days Present', data: data.classes.map(c => c.present_days), backgroundColor: '#5f8b6e' },
        { label: 'Total Classes', data: data.classes.map(c => c.total_days), backgroundColor: '#a7c4a0' },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, stepSize: 1 } } },
  });
}

renderStudentAnalytics();