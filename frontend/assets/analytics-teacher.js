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

// Fetch teacher analytics
async function fetchAnalytics() {
  const res = await fetch(`${API_URL}/api/attendance/analytics/teacher`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

function renderKPIs(data) {
  overallPercent.innerText = data.overall?.percent ?? '--';
  presentCount.innerText = data.overall?.total_attended ?? '--';
  missedCount.innerText = data.overall?.total_students ?? '--';
}

function renderSubjectChart(data) {
  const ctx = document.getElementById('subjectChart');
  if (!data.byClass || !data.byClass.length) {
    ctx.replaceWith(Object.assign(document.createElement('p'), {
      className: 'text-slate-400 text-sm',
      innerText: 'No class data available'
    }));
    return;
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.byClass.map(c => c.name),
      datasets: [
        { label: 'Present', data: data.byClass.map(c => c.attended), backgroundColor: '#10b981' },
        { label: 'Total Students', data: data.byClass.map(c => c.total_students), backgroundColor: '#cbd5e1' }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderRisk(data) {
  if (!data.risk || !data.risk.length) {
    riskList.innerHTML = `<p class="text-emerald-600">✅ No classes at risk</p>`;
    return;
  }
  riskList.innerHTML = '';
  data.risk.forEach(r => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-rose-50 border border-rose-200 rounded-lg px-4 py-2';
    div.innerHTML = `<span class="font-medium">${r.name}</span><span class="text-rose-600 font-semibold">${r.percentage}%</span>`;
    riskList.appendChild(div);
  });
}

// Init
(async function init() {
  try {
    const data = await fetchAnalytics();
    console.log('📊 Teacher Analytics:', data);
    renderKPIs(data);
    renderSubjectChart(data);
    renderRisk(data);
  } catch (err) {
    console.error(err);
    alert('Failed to load analytics');
  }
})();