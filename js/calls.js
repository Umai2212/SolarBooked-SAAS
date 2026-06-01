requireAuth();

let allCalls = [];
let filteredCalls = [];

// Loads call history data and renders the page.
async function loadCallsPage() {
  document.getElementById('callsBody').innerHTML = skeletonRows(8, 6);
  try {
    allCalls = await getSheetData(CONFIG.SHEETS.calls);
    applyCallFilters();
    updateLastUpdated();
  } catch (error) {
    showToast('Could not load call history.', 'error');
  }
}

// Applies date range and phone search filters.
function applyCallFilters() {
  const range = document.getElementById('rangeFilter').value;
  const query = document.getElementById('phoneSearch').value.replace(/\D/g, '');
  const cutoff = new Date();
  if (range !== 'all') cutoff.setDate(cutoff.getDate() - Number(range));
  filteredCalls = allCalls.filter((call) => {
    const started = new Date(call.started);
    const dateMatches = range === 'all' || (Number.isNaN(started.getTime()) ? true : started >= cutoff);
    const phoneMatches = String(call.customernumber || '').replace(/\D/g, '').includes(query);
    return dateMatches && phoneMatches;
  });
  renderCallSummary();
  renderCallsTable();
}

// Renders summary totals for the filtered calls.
function renderCallSummary() {
  const totalMs = filteredCalls.reduce((sum, call) => sum + Number(call.milliseconds || 0), 0);
  const totalCost = filteredCalls.reduce((sum, call) => sum + Number.parseFloat(call['cost(total)'] || 0), 0);
  document.getElementById('summaryCalls').textContent = filteredCalls.length;
  document.getElementById('summaryDuration').textContent = formatDuration(totalMs);
  document.getElementById('summaryCost').textContent = formatCost(totalCost);
  document.getElementById('summaryAverage').textContent = formatDuration(filteredCalls.length ? totalMs / filteredCalls.length : 0);
}

// Renders the calls table with transcript and audio expansion rows.
function renderCallsTable() {
  const body = document.getElementById('callsBody');
  const rows = filteredCalls.slice().sort((a, b) => new Date(b.started) - new Date(a.started));
  if (rows.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No data found</td></tr>';
    return;
  }
  body.innerHTML = rows.map((call, index) => `
    <tr>
      <td>${formatDateTime(call.started)}</td>
      <td>${formatPhone(call.customernumber)}</td>
      <td>${formatDuration(call.milliseconds)}</td>
      <td>${call.type || 'outbound'}</td>
      <td>${badge(call['ended reason'], 'outcome')}</td>
      <td>${formatCost(call['cost(total)'])}</td>
      <td><button class="btn btn-secondary" data-transcript="${index}">View</button></td>
      <td>${call.recording ? `<button class="btn btn-secondary" data-recording="${index}">▶ Play</button>` : 'No recording'}</td>
    </tr>
    <tr class="transcript-row hidden" id="transcript-${index}"><td colspan="8"><div class="transcript-content">${call.transcript || 'No transcript available.'}</div></td></tr>
    ${call.recording ? `<tr class="audio-row hidden" id="recording-${index}"><td colspan="8"><audio class="inline-player" controls src="${call.recording}"></audio></td></tr>` : ''}
  `).join('');
  body.querySelectorAll('[data-transcript]').forEach((button) => button.addEventListener('click', () => document.getElementById(`transcript-${button.dataset.transcript}`).classList.toggle('hidden')));
  body.querySelectorAll('[data-recording]').forEach((button) => button.addEventListener('click', () => document.getElementById(`recording-${button.dataset.recording}`).classList.toggle('hidden')));
}

// Exports filtered call rows as CSV.
function exportCalls() {
  exportToCSV(filteredCalls, 'solarbooked-calls.csv');
}

initLogout();
updateLastUpdated();
document.getElementById('refreshBtn').addEventListener('click', loadCallsPage);
document.getElementById('rangeFilter').addEventListener('change', applyCallFilters);
document.getElementById('phoneSearch').addEventListener('input', debounce(applyCallFilters, 200));
document.getElementById('exportCallsBtn').addEventListener('click', exportCalls);
loadCallsPage();
