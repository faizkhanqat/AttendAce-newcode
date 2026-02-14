const token = localStorage.getItem('token');
const API_URL = 'https://attendace-zjzu.onrender.com';

if (!token) {
  alert('You must be logged in');
  window.location.href = 'login.html';
}

// Elements
const overallPercent = document.getElementById('overallPercent');
const presentCount = document.getElementById('presentCount');
const missedCount = document.getElementById('missedCount');
const riskList = document.getElementById('riskList');

// Fetch analytics
async function fetchAnalytics() {
  const res = await fetch(`${API_URL}/api/attendance/analytics/student`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

function renderKPIs(data) {
  const total = data.overall?.total || 0;
  const present = data.overall?.present || 0;
  const missed = total - present;
  const percent = total ? Math.round((present / total) * 100) : 0;

  overallPercent.innerText = `${percent}%`;
  presentCount.innerText = present;
  missedCount.innerText = missed;
}

function renderSubjectChart(data) {
  if (!Array.isArray(data.byClass) || data.byClass.length === 0) {
    document.getElementById('subjectChart').replaceWith(
      Object.assign(document.createElement('p'), {
        className: 'text-slate-400 text-sm',
        innerText: 'No subject-wise data available'
      })
    );
    return;
  }

  const ctx = document.getElementById('subjectChart');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.byClass.map(c => c.class_name),
      datasets: [
        {
          label: 'Present',
          data: data.byClass.map(c => c.attended),
          backgroundColor: '#10b981'
        },
        {
          label: 'Total',
          data: data.byClass.map(c => c.total),
          backgroundColor: '#cbd5e1'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderTrendChart(data) {
  if (!Array.isArray(data.trend) || data.trend.length === 0) {
    document.getElementById('trendChart').replaceWith(
      Object.assign(document.createElement('p'), {
        className: 'text-slate-400 text-sm',
        innerText: 'Attendance trend unavailable'
      })
    );
    return;
  }

  const ctx = document.getElementById('trendChart');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.trend.map(d => d.day),
      datasets: [{
        data: data.trend.map(d => d.present),
        borderColor: '#0f766e',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderRisk(data) {
  if (!data.risk || data.risk.length === 0) {
    riskList.innerHTML = `<p class="text-emerald-600">✅ No subjects at risk</p>`;
    return;
  }

  riskList.innerHTML = '';
  data.risk.forEach(r => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-rose-50 border border-rose-200 rounded-lg px-4 py-2';

    div.innerHTML = `
      <span class="font-medium">${r.name}</span>
      <span class="text-rose-600 font-semibold">${r.percentage}%</span>
    `;

    riskList.appendChild(div);
  });
}

// Init
(async function init() {
  try {
    const data = await fetchAnalytics();
    console.log('📊 Analytics response:', data);
    renderKPIs(data);
    renderSubjectChart(data);
    renderTrendChart(data);
    renderRisk(data);
  } catch (err) {
    console.error(err);
    alert('Failed to load analytics');
  }
})();