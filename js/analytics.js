requireAuth();

let analyticsLeads = [];
let analyticsCalls = [];
let activeCharts = [];

// Loads leads and calls for analytics.
async function loadAnalyticsPage() {
  try {
    const [leads, calls] = await Promise.all([getSheetData(CONFIG.SHEETS.leads), getSheetData(CONFIG.SHEETS.calls)]);
    analyticsLeads = leads;
    analyticsCalls = calls;
    renderAnalytics();
    updateLastUpdated();
  } catch (error) {
    showToast('Could not load analytics.', 'error');
  }
}

// Renders all analytics metrics and charts.
function renderAnalytics() {
  const filteredCalls = callsInRange();
  const totalSpend = filteredCalls.reduce((sum, call) => sum + Number.parseFloat(call['cost(total)'] || 0), 0);
  const answered = filteredCalls.filter((call) => !String(call['ended reason'] || '').toLowerCase().includes('no-answer')).length;
  const booked = analyticsLeads.filter((lead) => String(lead.Status || '').toLowerCase() === 'booked').length;

  document.getElementById('metricLeads').textContent = analyticsLeads.length;
  document.getElementById('metricCalls').textContent = filteredCalls.length;
  document.getElementById('metricAnswerRate').textContent = `${filteredCalls.length ? Math.round((answered / filteredCalls.length) * 100) : 0}%`;
  document.getElementById('metricBookingRate').textContent = `${analyticsLeads.length ? Math.round((booked / analyticsLeads.length) * 100) : 0}%`;
  document.getElementById('metricSpend').textContent = formatCost(totalSpend);
  document.getElementById('metricAvgCost').textContent = formatCost(filteredCalls.length ? totalSpend / filteredCalls.length : 0);

  renderCharts(filteredCalls);
}

// Returns calls inside the selected analytics date range.
function callsInRange() {
  const days = Number(document.getElementById('analyticsRange').value);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return analyticsCalls.filter((call) => {
    const started = new Date(call.started);
    return Number.isNaN(started.getTime()) || started >= cutoff;
  });
}

// Renders and replaces all Chart.js charts.
function renderCharts(filteredCalls) {
  activeCharts.forEach((chart) => chart.destroy());
  activeCharts = [];
  const callsByDay = groupCallsByDay(filteredCalls, 'count');
  const spendByDay = groupCallsByDay(filteredCalls, 'spend');
  const outcomes = countBy(filteredCalls, (call) => call['ended reason'] || 'unknown');
  const statuses = countBy(analyticsLeads, (lead) => lead.Status || 'pending');
  const chartText = '#f1f5f9';
  const grid = '#2d3148';

  Chart.defaults.color = chartText;
  Chart.defaults.borderColor = grid;

  activeCharts.push(new Chart(document.getElementById('callsPerDayChart'), {
    type: 'line',
    data: { labels: Object.keys(callsByDay), datasets: [{ label: 'Calls', data: Object.values(callsByDay), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', tension: 0.35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false }
  }));
  activeCharts.push(new Chart(document.getElementById('outcomesChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(outcomes), datasets: [{ data: Object.values(outcomes), backgroundColor: ['#10b981', '#f97316', '#ef4444', '#f59e0b', '#3b82f6', '#6b7280'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  }));
  activeCharts.push(new Chart(document.getElementById('leadsStatusChart'), {
    type: 'bar',
    data: { labels: Object.keys(statuses), datasets: [{ label: 'Leads', data: Object.values(statuses), backgroundColor: '#f59e0b' }] },
    options: { responsive: true, maintainAspectRatio: false }
  }));
  activeCharts.push(new Chart(document.getElementById('dailySpendChart'), {
    type: 'line',
    data: { labels: Object.keys(spendByDay), datasets: [{ label: 'Spend', data: Object.values(spendByDay), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.18)', tension: 0.35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false }
  }));
}

// Groups calls by calendar date for counts or spend totals.
function groupCallsByDay(calls, mode) {
  const days = Number(document.getElementById('analyticsRange').value);
  const result = {};
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    result[date.toISOString().slice(0, 10)] = 0;
  }
  calls.forEach((call) => {
    const date = new Date(call.started);
    const key = Number.isNaN(date.getTime()) ? 'Unknown' : date.toISOString().slice(0, 10);
    result[key] = (result[key] || 0) + (mode === 'spend' ? Number.parseFloat(call['cost(total)'] || 0) : 1);
  });
  return result;
}

// Counts rows by a supplied key function.
function countBy(rows, getKey) {
  return rows.reduce((result, row) => {
    const key = String(getKey(row)).trim() || 'unknown';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

// Exports a compact analytics summary as CSV.
function exportAnalytics() {
  const filteredCalls = callsInRange();
  const rows = [
    { metric: 'Total Leads', value: analyticsLeads.length },
    { metric: 'Total Calls Made', value: filteredCalls.length },
    { metric: 'Total Spend', value: filteredCalls.reduce((sum, call) => sum + Number.parseFloat(call['cost(total)'] || 0), 0).toFixed(2) },
    ...Object.entries(countBy(filteredCalls, (call) => call['ended reason'] || 'unknown')).map(([metric, value]) => ({ metric: `Outcome: ${metric}`, value })),
    ...Object.entries(countBy(analyticsLeads, (lead) => lead.Status || 'pending')).map(([metric, value]) => ({ metric: `Lead Status: ${metric}`, value }))
  ];
  exportToCSV(rows, 'solarbooked-analytics.csv');
}

initLogout();
updateLastUpdated();
document.getElementById('refreshBtn').addEventListener('click', loadAnalyticsPage);
document.getElementById('analyticsRange').addEventListener('change', renderAnalytics);
document.getElementById('exportAnalyticsBtn').addEventListener('click', exportAnalytics);
loadAnalyticsPage();
