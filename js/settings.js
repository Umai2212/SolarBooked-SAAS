requireAuth();

const SETTINGS_KEY = 'solarbookedSettings';
const settingFields = ['companyName', 'contactEmail', 'timezone', 'dailyCallTime', 'maxAttempts', 'delayAttempts', 'callStart', 'callEnd', 'bookedAlerts', 'dailySummary'];

// Returns default dashboard settings.
function defaultSettings() {
  return {
    companyName: 'SolarBooked',
    contactEmail: 'demo@solarbooked.com',
    timezone: 'EST',
    dailyCallTime: '09:00',
    maxAttempts: '4',
    delayAttempts: '2hr',
    callStart: '09:00',
    callEnd: '17:00',
    bookedAlerts: true,
    dailySummary: true
  };
}

// Loads settings from localStorage.
function loadSettings() {
  try {
    return { ...defaultSettings(), ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch (error) {
    showToast('Settings storage was reset because saved data was unreadable.', 'error');
    return defaultSettings();
  }
}

// Saves the current settings form to localStorage.
function saveSettings() {
  const settings = {};
  settingFields.forEach((field) => {
    const element = document.getElementById(field);
    settings[field] = element.type === 'checkbox' ? element.checked : element.value;
  });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  renderCurrentSchedule(settings);
  updateLastUpdated();
}

// Populates the settings form from saved values.
function populateSettings() {
  const settings = loadSettings();
  settingFields.forEach((field) => {
    const element = document.getElementById(field);
    if (element.type === 'checkbox') element.checked = Boolean(settings[field]);
    else element.value = settings[field] || '';
  });
  renderCurrentSchedule(settings);
  updateLastUpdated();
}

// Renders the current scheduled call time.
function renderCurrentSchedule(settings) {
  document.getElementById('currentSchedule').innerHTML = `Current scheduled time: <strong>${settings.dailyCallTime || 'Not set'} ${settings.timezone || 'EST'}</strong>`;
}

// Saves settings locally and posts the daily schedule to n8n.
async function saveSchedule() {
  saveSettings();
  const settings = loadSettings();
  showLoading('saveScheduleBtn');
  try {
    const response = await setSchedule(settings.dailyCallTime, settings.timezone);
    showToast(response.result || 'Schedule saved.', 'success');
  } catch (error) {
    showToast('Could not save schedule to n8n.', 'error');
  } finally {
    hideLoading('saveScheduleBtn');
  }
}

// Wires all form fields to localStorage persistence.
function initSettings() {
  populateSettings();
  settingFields.forEach((field) => {
    document.getElementById(field).addEventListener('change', saveSettings);
  });
  document.getElementById('saveScheduleBtn').addEventListener('click', saveSchedule);
  document.getElementById('refreshBtn').addEventListener('click', populateSettings);
}

initLogout();
initSettings();
