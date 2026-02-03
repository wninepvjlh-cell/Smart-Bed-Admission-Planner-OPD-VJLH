(function initSBPDataSync() {
  if (typeof window === 'undefined') {
    return;
  }

  // const DEFAULT_ENDPOINTS = {
  //   booked: 'https://script.google.com/macros/s/AKfycbw2CG9_2tZaM_Ommt3Z2HPmPoFH_2_FNtr1oLlXMaA9CyAs3qiTBtODQ2YB74NQ_ujo5w/exec',
  //   confirmed: 'https://script.google.com/macros/s/AKfycbx06ftWZO2wiPzDTFhMv7Vmnxh_PPqCcClx5d8gRoav9dvkikdX6ay1szCsD3bexx32eg/exec',
  //   admitted: 'https://script.google.com/macros/s/AKfycbyAoKbR8wKXK2EjAI2pWBaSMgHJncB--7BKDmCRaVr_AbiKCkQ7BvhsehwH50gadJ0l/exec',
  //   cancelled: 'https://script.google.com/macros/s/AKfycbzUNE6qd20_gSMMBu7vuoJH-23mmP3FX7SERAK1vze7mhzgh7ry3H2gsJMfZHWWbvl1ZQ/exec'
  // };

  const sheetEndpoints = Object.assign({}, DEFAULT_ENDPOINTS, window.SBPSheetEndpoints || {});
  window.SBPSheetEndpoints = sheetEndpoints;

  function parseSheetResponse(raw) {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    if (typeof raw === 'object') {
      if (Array.isArray(raw.data)) {
        return raw.data;
      }
      if (Array.isArray(raw.records)) {
        return raw.records;
      }
      if (Array.isArray(raw.items)) {
        return raw.items;
      }
      if (Array.isArray(raw.result)) {
        return raw.result;
      }
    }
    return [];
  }

  async function fetchSheetData(url) {
    if (!url) {
      return [];
    }
    const response = await fetch(`${url}?cacheBust=${Date.now()}`, { method: 'GET' });
    if (!response.ok) {
      console.warn('Sheet fetch responded with non-OK status', response.status, url);
      return [];
    }
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return parseSheetResponse(json);
    } catch (error) {
      console.warn('Unable to parse sheet response', error);
      return [];
    }
  }

  function ensureBookingDatasetShape(data) {
    return {
      booked: Array.isArray(data && data.booked) ? data.booked : [],
      confirmed: Array.isArray(data && data.confirmed) ? data.confirmed : [],
      admitted: Array.isArray(data && data.admitted) ? data.admitted : [],
      cancelled: Array.isArray(data && data.cancelled) ? data.cancelled : []
    };
  }

  async function syncBookingDataFromSheets(options) {
    const opts = Object.assign({ updateLocalStorage: true, emitEvent: true }, options || {});
    const dataset = {
      booked: [],
      confirmed: [],
      admitted: [],
      cancelled: []
    };

    try {
      dataset.booked = await fetchSheetData(sheetEndpoints.booked);
    } catch (error) {
      console.warn('Sync booked sheet failed', error);
    }

    try {
      dataset.confirmed = await fetchSheetData(sheetEndpoints.confirmed);
    } catch (error) {
      console.warn('Sync confirmed sheet failed', error);
    }

    try {
      dataset.admitted = await fetchSheetData(sheetEndpoints.admitted);
    } catch (error) {
      console.warn('Sync admitted sheet failed', error);
    }

    try {
      dataset.cancelled = await fetchSheetData(sheetEndpoints.cancelled);
    } catch (error) {
      console.warn('Sync cancelled sheet failed', error);
    }

    const shaped = ensureBookingDatasetShape(dataset);

    if (opts.updateLocalStorage && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('bookingData', JSON.stringify(shaped));
        window.dispatchEvent(new Event('storage'));
      } catch (error) {
        console.warn('Unable to persist bookingData from sheets', error);
      }
    }

    if (opts.emitEvent) {
      window.dispatchEvent(new CustomEvent('sbpBookingDataSynced', { detail: shaped }));
    }

    return shaped;
  }

  function backupBookingDatasetToSheets(dataset) {
    const data = ensureBookingDatasetShape(dataset);
    const nowIso = new Date().toISOString();

    const sendJson = (url, payload) => {
      if (!url) {
        return;
      }
      try {
        fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(error => console.log('Sheet sync (no-cors) error:', error));
      } catch (error) {
        console.log('Sheet sync request error:', error);
      }
    };

    data.booked.forEach(item => {
      const payload = Object.assign({}, item, {
        status: 'booked',
        backup_type: 'booking',
        booking_date: item.booking_date || nowIso
      });
      sendJson(sheetEndpoints.booked, payload);
    });

    data.confirmed.forEach(item => {
      const payload = Object.assign({}, item, {
        status: 'confirmed',
        backup_type: 'confirmed',
        confirm_date: item.confirm_date || nowIso
      });
      sendJson(sheetEndpoints.confirmed, payload);
    });

    data.admitted.forEach(item => {
      const payload = {
        action: 'ipd_admit',
        patient_hn: item.patient_hn,
        patient_name: item.patient_name,
        assigned_bed: item.assigned_bed || item.bed_number || null,
        admitted_date: item.admitted_date || item.admit_date || null,
        expected_discharge_date: item.expected_discharge_date || item.discharge_date || null,
        doctor_name: item.doctor_name || item.attending_doctor || null,
        diagnosis: item.diagnosis || null,
        timestamp: nowIso
      };
      sendJson(sheetEndpoints.admitted, payload);
    });

    data.cancelled.forEach(item => {
      const cancelDate = item.cancel_date || nowIso;
      const payload = {
        action: 'booking_cancelled',
        patient_hn: item.patient_hn,
        patient_name: item.patient_name,
        admit_date: item.admit_date || null,
        assigned_bed: item.assigned_bed || null,
        cancel_reason: item.cancel_reason || item.reason || null,
        cancel_date: cancelDate,
        cancelled_by: item.cancelled_by || item.logged_by || null,
        timestamp: cancelDate
      };
      sendJson(sheetEndpoints.cancelled, payload);
    });
  }

  window.sbpSyncBookingDataFromSheets = syncBookingDataFromSheets;
  window.sbpBackupBookingDatasetToSheets = backupBookingDatasetToSheets;
  window.sbpGetSheetEndpoints = function sbpGetSheetEndpoints() {
    return Object.assign({}, sheetEndpoints);
  };

  document.addEventListener('DOMContentLoaded', function onReady() {
    document.removeEventListener('DOMContentLoaded', onReady);
    syncBookingDataFromSheets({ updateLocalStorage: true, emitEvent: true }).catch(error => {
      console.warn('Initial sheet sync failed', error);
    });
  });
})();
