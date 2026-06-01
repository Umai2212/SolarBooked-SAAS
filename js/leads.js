requireAuth();

let leads = [];
let calls = [];
let filteredLeads = [];
let currentPage = 1;
let importedRows = [];
const selectedLeadIndexes = new Set();
const rowsPerPage = 25;

// Loads lead and call data for the leads page.
async function loadLeadsPage() {
  document.getElementById('leadsBody').innerHTML = skeletonRows(9, 6);
  try {
    const [leadRows, callRows] = await Promise.all([getSheetData(CONFIG.SHEETS.leads), getSheetData(CONFIG.SHEETS.calls)]);
    leads = leadRows;
    calls = callRows;
    currentPage = 1;
    applyLeadFilters();
    updateLastUpdated();
  } catch (error) {
    showToast('Could not load leads.', 'error');
  }
}

// Applies current search and status filters.
function applyLeadFilters() {
  const query = document.getElementById('leadSearch').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  filteredLeads = leads.filter((lead) => {
    const haystack = `${lead['First Name'] || ''} ${lead['Last Name'] || ''} ${lead.Mobile || ''} ${lead.Email || ''}`.toLowerCase();
    const statusMatches = status === 'all' || String(lead.Status || '').toLowerCase() === status;
    return haystack.includes(query) && statusMatches;
  });
  renderLeads();
}

// Renders the current page of leads.
function renderLeads() {
  const body = document.getElementById('leadsBody');
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filteredLeads.slice(start, start + rowsPerPage);
  if (pageRows.length === 0) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No data found</td></tr>';
  } else {
    body.innerHTML = pageRows.map((lead) => {
      const originalIndex = leads.indexOf(lead);
      return `
        <tr>
          <td><input type="checkbox" class="lead-check" data-index="${originalIndex}" ${selectedLeadIndexes.has(originalIndex) ? 'checked' : ''}></td>
          <td>${lead['First Name'] || ''}</td>
          <td>${lead['Last Name'] || ''}</td>
          <td>${formatPhone(lead.Mobile)}</td>
          <td>${lead.Email || ''}</td>
          <td>${badge(lead.Status, 'pending')}</td>
          <td>${lead.Attempt || '0'}</td>
          <td>${formatDateTime(lead['Date Time'] || lead['Final Call'])}</td>
          <td><div class="action-buttons"><button class="btn btn-primary icon-button" id="callLead${originalIndex}" data-call="${originalIndex}">📞</button><button class="btn btn-secondary icon-button" data-view="${originalIndex}">👁</button></div></td>
        </tr>
      `;
    }).join('');
  }
  bindLeadTableEvents();
  renderBulkBar();
  renderPagination();
}

// Attaches click and checkbox handlers to rendered table rows.
function bindLeadTableEvents() {
  document.querySelectorAll('.lead-check').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const index = Number(checkbox.dataset.index);
      if (checkbox.checked) selectedLeadIndexes.add(index);
      else selectedLeadIndexes.delete(index);
      renderBulkBar();
    });
  });
  document.querySelectorAll('[data-call]').forEach((button) => {
    button.addEventListener('click', () => callLead(Number(button.dataset.call)));
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => showLeadDetails(Number(button.dataset.view)));
  });
}

// Renders the selected-lead action bar.
function renderBulkBar() {
  const count = selectedLeadIndexes.size;
  document.getElementById('bulkBar').classList.toggle('show', count > 0);
  document.getElementById('selectedCount').textContent = `${count} selected`;
  document.getElementById('callSelectedBtn').textContent = `Call Selected (${count})`;
}

// Renders pagination state and disables unavailable controls.
function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / rowsPerPage));
  currentPage = Math.min(currentPage, totalPages);
  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

// Calls one lead through the manual webhook.
async function callLead(index) {
  const lead = leads[index];
  if (!lead) return;
  const buttonId = `callLead${index}`;
  showLoading(buttonId);
  try {
    const response = await triggerManualCall(lead['First Name'], lead.Mobile);
    showToast(response.result || `Call started for ${lead['First Name']}.`, 'success');
  } catch (error) {
    showToast(`Could not call ${lead['First Name'] || 'lead'}.`, 'error');
  } finally {
    hideLoading(buttonId);
  }
}

// Calls all selected leads sequentially.
async function callSelectedLeads() {
  if (selectedLeadIndexes.size === 0) {
    showToast('Select at least one lead first.', 'info');
    return;
  }
  showLoading('callSelectedBtn');
  try {
    for (const index of selectedLeadIndexes) {
      const lead = leads[index];
      await triggerManualCall(lead['First Name'], lead.Mobile);
    }
    showToast(`Started calls for ${selectedLeadIndexes.size} selected leads.`, 'success');
  } catch (error) {
    showToast('One or more selected calls could not be started.', 'error');
  } finally {
    hideLoading('callSelectedBtn');
    renderBulkBar();
  }
}

// Opens the detail modal for a lead and its call history.
function showLeadDetails(index) {
  const lead = leads[index];
  const phoneDigits = String(lead.Mobile || '').replace(/\D/g, '');
  const history = calls.filter((call) => String(call.customernumber || '').replace(/\D/g, '') === phoneDigits);
  document.getElementById('leadDetails').innerHTML = `
    <div class="detail-grid">
      ${Object.entries(lead).map(([key, value]) => `<div class="detail-label">${key}</div><div class="detail-value">${value || 'N/A'}</div>`).join('')}
    </div>
    <h3>Call History</h3>
    <div class="preview-wrap">
      <table>
        <thead><tr><th>Time</th><th>Duration</th><th>Outcome</th><th>Cost</th></tr></thead>
        <tbody>${history.length ? history.map((call) => `<tr><td>${formatDateTime(call.started)}</td><td>${formatDuration(call.milliseconds)}</td><td>${badge(call['ended reason'], 'outcome')}</td><td>${formatCost(call['cost(total)'])}</td></tr>`).join('') : '<tr><td colspan="4">No data found</td></tr>'}</tbody>
      </table>
    </div>
  `;
  openModal('detailModal');
}

// Opens a modal by id.
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

// Closes a modal by id.
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Parses an imported CSV or spreadsheet and shows a preview.
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      importedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      renderImportPreview();
      openModal('importModal');
    } catch (error) {
      showToast('Could not parse the selected file.', 'error');
    }
  };
  reader.onerror = () => showToast('Could not read the selected file.', 'error');
  reader.readAsArrayBuffer(file);
}

// Renders imported rows before confirmation.
function renderImportPreview() {
  const preview = document.getElementById('importPreview');
  if (importedRows.length === 0) {
    preview.innerHTML = '<div class="empty-state">No data found</div>';
    return;
  }
  const headers = Object.keys(importedRows[0]);
  preview.innerHTML = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${importedRows.slice(0, 10).map((row) => `<tr>${headers.map((header) => `<td>${row[header] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// Confirms imported rows and adds them to the local table.
function confirmImport() {
  leads = leads.concat(importedRows.map((row) => ({ Status: 'pending', Attempt: '0', ...row })));
  importedRows = [];
  closeModal('importModal');
  applyLeadFilters();
  showToast('Imported rows added locally. Save to Sheets manually.', 'success');
}

// Adds a new lead to the local table.
function addLead(event) {
  event.preventDefault();
  leads.unshift({
    'First Name': document.getElementById('newFirstName').value.trim(),
    'Last Name': document.getElementById('newLastName').value.trim(),
    Mobile: document.getElementById('newMobile').value.trim(),
    Email: document.getElementById('newEmail').value.trim(),
    Status: 'pending',
    Attempt: '0',
    Assignee: document.getElementById('newAssignee').value.trim(),
    'Date Time': '',
    Summary: '',
    'Final Call': ''
  });
  event.target.reset();
  closeModal('leadModal');
  applyLeadFilters();
  showToast('Lead added locally. Save to Sheets manually.', 'success');
}

// Exports the currently selected leads as CSV.
function exportSelectedLeads() {
  const rows = Array.from(selectedLeadIndexes).map((index) => leads[index]).filter(Boolean);
  exportToCSV(rows, 'solarbooked-selected-leads.csv');
}

initLogout();
updateLastUpdated();
document.getElementById('refreshBtn').addEventListener('click', loadLeadsPage);
document.getElementById('leadSearch').addEventListener('input', debounce(() => { currentPage = 1; applyLeadFilters(); }, 200));
document.getElementById('statusFilter').addEventListener('change', () => { currentPage = 1; applyLeadFilters(); });
document.getElementById('prevPage').addEventListener('click', () => { currentPage -= 1; renderLeads(); });
document.getElementById('nextPage').addEventListener('click', () => { currentPage += 1; renderLeads(); });
document.getElementById('selectAll').addEventListener('change', (event) => {
  filteredLeads.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).forEach((lead) => {
    const index = leads.indexOf(lead);
    if (event.target.checked) selectedLeadIndexes.add(index);
    else selectedLeadIndexes.delete(index);
  });
  renderLeads();
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('csvFile').click());
document.getElementById('csvFile').addEventListener('change', handleImportFile);
document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);
document.getElementById('addLeadBtn').addEventListener('click', () => openModal('leadModal'));
document.getElementById('addLeadForm').addEventListener('submit', addLead);
document.getElementById('callSelectedBtn').addEventListener('click', callSelectedLeads);
document.getElementById('exportSelectedBtn').addEventListener('click', exportSelectedLeads);
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
loadLeadsPage();
