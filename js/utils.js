const SAMPLE_LEADS = [
  { "First Name": "James", "Last Name": "Miller", "Mobile": "+1-555-0101", "Email": "james@sunpowerhomes.com", "Status": "booked", "Attempt": "1", "Date Time": "2026-03-20 14:30" },
  { "First Name": "Sarah", "Last Name": "Chen", "Mobile": "+1-555-0102", "Email": "sarah@solarpeak.com", "Status": "completed", "Attempt": "2", "Date Time": "2026-03-21 10:15" },
  { "First Name": "Mike", "Last Name": "Thompson", "Mobile": "+1-555-0103", "Email": "mike@greenergy.com", "Status": "no-answer", "Attempt": "3", "Date Time": "2026-03-21 16:45" },
  { "First Name": "Lisa", "Last Name": "Rodriguez", "Mobile": "+1-555-0104", "Email": "lisa@solarwise.com", "Status": "pending", "Attempt": "0", "Date Time": "" },
  { "First Name": "David", "Last Name": "Kim", "Mobile": "+1-555-0105", "Email": "david@suntech.com", "Status": "calling", "Attempt": "1", "Date Time": "2026-03-22 09:00" }
];

const SAMPLE_CALLS = [
  { "id": "call_001", "customernumber": "+1-555-0101", "started": "2026-03-22T09:00:00Z", "ended": "2026-03-22T09:05:30Z", "milliseconds": "330000", "cost(total)": "0.45", "ended reason": "appointment-booked", "transcript": "Agent: Hello, am I speaking with James? Customer: Yes this is James...", "recording": "" },
  { "id": "call_002", "customernumber": "+1-555-0102", "started": "2026-03-22T10:15:00Z", "ended": "2026-03-22T10:17:45Z", "milliseconds": "165000", "cost(total)": "0.22", "ended reason": "no-answer", "transcript": "", "recording": "" }
];

const loadingStore = new Map();

// Converts milliseconds into MM:SS format.
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Formats a number-like cost value as USD.
function formatCost(cost) {
  const value = Number.parseFloat(cost || 0);
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

// Formats an ISO or sheet date string into a readable date/time.
function formatDateTime(str) {
  if (!str) return 'Not called';
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Standardizes phone display while preserving international numbers.
function formatPhone(phone) {
  const value = String(phone || '').trim();
  if (!value) return 'N/A';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value;
}

// Shows a bottom-right toast notification.
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    window.setTimeout(() => toast.remove(), 220);
  }, 3000);
}

// Replaces an element's content with a spinner while preserving the original.
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  if (!loadingStore.has(elementId)) loadingStore.set(elementId, element.innerHTML);
  element.disabled = true;
  element.innerHTML = '<span class="spinner"></span> Loading';
}

// Restores an element after showLoading has been used.
function hideLoading(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.disabled = false;
  if (loadingStore.has(elementId)) {
    element.innerHTML = loadingStore.get(elementId);
    loadingStore.delete(elementId);
  }
}

// Downloads an array of objects as a CSV file.
function exportToCSV(data, filename) {
  if (!Array.isArray(data) || data.length === 0) {
    showToast('No data available to export.', 'info');
    return;
  }
  const headers = Array.from(data.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [headers.map(escapeCell).join(',')].concat(data.map((row) => headers.map((header) => escapeCell(row[header])).join(',')));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Debounces repeated calls to a function.
function debounce(func, wait) {
  let timeout;
  return function debounced(...args) {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => func.apply(this, args), wait);
  };
}

// Returns a reusable skeleton row string for loading tables.
function skeletonRows(columns, rows = 5) {
  return Array.from({ length: rows }, () => `<tr class="skeleton-row">${Array.from({ length: columns }, () => '<td>Loading...</td>').join('')}</tr>`).join('');
}

// Returns a status or outcome badge with a safe class name.
function badge(value, fallback = 'pending') {
  const label = String(value || fallback).trim();
  const className = label.toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge ${className}">${label}</span>`;
}

// Updates all last-updated labels on a page.
function updateLastUpdated() {
  document.querySelectorAll('[data-last-updated]').forEach((element) => {
    element.textContent = `Last updated: ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  });
}
