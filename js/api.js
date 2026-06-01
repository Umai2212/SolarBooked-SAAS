// Fetches all rows from a Google Sheets tab and returns an array of objects.
async function getSheetData(tabName) {
  const isPlaceholder = CONFIG.SHEET_ID.includes('PLACEHOLDER') || CONFIG.API_KEY.includes('PLACEHOLDER');
  if (isPlaceholder) {
    return tabName === CONFIG.SHEETS.calls ? SAMPLE_CALLS : SAMPLE_LEADS;
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(CONFIG.SHEET_ID)}/values/${encodeURIComponent(tabName)}?key=${encodeURIComponent(CONFIG.API_KEY)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheets request failed with status ${response.status}`);
    const json = await response.json();
    const rows = parseSheetResponse(json);
    if (rows.length === 0) return tabName === CONFIG.SHEETS.calls ? SAMPLE_CALLS : SAMPLE_LEADS;
    return rows;
  } catch (error) {
    showToast(`Could not load ${tabName}. Showing sample data.`, 'error');
    return tabName === CONFIG.SHEETS.calls ? SAMPLE_CALLS : SAMPLE_LEADS;
  }
}

// Posts a single lead to the manual call webhook.
async function triggerManualCall(firstName, mobile) {
  return postWebhook(CONFIG.WEBHOOKS.manualCall, { "First Name": firstName, "Mobile": mobile }, { result: 'Call Successful' });
}

// Posts a bulk call trigger to the pending-leads webhook.
async function triggerBulkCall() {
  return postWebhook(CONFIG.WEBHOOKS.bulkCall, { trigger: 'bulk' }, { result: 'Bulk calling started' });
}

// Posts a schedule update to the schedule webhook.
async function setSchedule(time, timezone) {
  return postWebhook(CONFIG.WEBHOOKS.scheduleCall, { time, timezone }, { result: 'Schedule saved' });
}

// Converts a raw Sheets API response into row objects using the first row as headers.
function parseSheetResponse(response) {
  const values = response && Array.isArray(response.values) ? response.values : [];
  if (values.length < 2) return [];
  const headers = values[0].map((header) => String(header || '').trim());
  return values.slice(1).filter((row) => row.some((cell) => String(cell || '').trim() !== '')).map((row) => {
    return headers.reduce((object, header, index) => {
      object[header] = row[index] ?? '';
      return object;
    }, {});
  });
}

// Sends JSON to a configured n8n webhook, or returns a mock response while placeholders are configured.
async function postWebhook(path, body, mockResponse) {
  const baseIsPlaceholder = CONFIG.N8N_BASE_URL.includes('PLACEHOLDER');
  const pathIsPlaceholder = path.includes('PLACEHOLDER');
  if (baseIsPlaceholder || pathIsPlaceholder) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return { ...mockResponse, mocked: true };
  }

  try {
    const response = await fetch(`${CONFIG.N8N_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Webhook failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    showToast('Webhook request failed. Please check your n8n configuration.', 'error');
    throw error;
  }
}
