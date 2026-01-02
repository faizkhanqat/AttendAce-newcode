// frontend/assets/analytics.js

const token = localStorage.getItem('token'); // JWT for the logged-in student
const chartsContainer = document.getElementById('charts');

if (!token) {
  chartsContainer.innerHTML = '<p>You must be logged in to view analytics.</p>';
  throw new Error('No JWT token found');
}

// Fetch attendance analytics from backend
async function fetchAttendanceAnalytics() {
  try {
    const res = await fetch('https://attendace-zjzu.onrender.com/api/attendance/analytics', {
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

// Render charts using Chart.js
async function renderAnalytics() {
  const data = await fetchAttendanceAnalytics();
  if (!data) return;

  chartsContainer.innerHTML = '<canvas id="attendanceChart" width="400" height="300"></canvas>';
  const ctx = document.getElementById('attendanceChart').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.classes.map(c => c.name),
      datasets: [
        {
          label: 'Days Present',
          data: data.classes.map(c => c.present_days),
          backgroundColor: '#5f8b6e',
        },
        {
          label: 'Total Classes',
          data: data.classes.map(c => c.total_days),
          backgroundColor: '#a7c4a0',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: { beginAtZero: true, stepSize: 1 },
      },
    },
  });
}

// Initialize
renderAnalytics();