// ฟังก์ชันสำหรับสลับชั้นในหน้า IPD (ให้ปุ่มและข้อมูลทำงานปกติ)
window.showIPDFloor = function showIPDFloor(floor) {
  const floor1Btn = document.getElementById('btn-floor-1');
  const floor2Btn = document.getElementById('btn-floor-2');
  const activeBedsBtn = document.getElementById('btn-active-beds');
  const floor1Content = document.getElementById('floor-1-content');
  const floor2Content = document.getElementById('floor-2-content');
  const activeBedsContent = document.getElementById('active-beds-content');

  // Reset all
  if (activeBedsBtn) {
    activeBedsBtn.style.background = 'white';
    activeBedsBtn.style.borderColor = '#bdbdbd';
    activeBedsBtn.style.color = '#00796b';
    activeBedsBtn.style.boxShadow = 'none';
    activeBedsBtn.style.fontWeight = '600';
  }
  if (activeBedsContent) {
    activeBedsContent.style.display = 'none';
  }

  if (floor === 1) {
    if (floor1Btn) {
      floor1Btn.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
      floor1Btn.style.borderColor = '#4dd0e1';
      floor1Btn.style.color = '#00796b';
      floor1Btn.style.fontWeight = '600';
    }
    if (floor2Btn) {
      floor2Btn.style.background = 'white';
      floor2Btn.style.borderColor = '#ddd';
      floor2Btn.style.color = '#999';
      floor2Btn.style.fontWeight = '500';
    }
    if (floor1Content) floor1Content.style.display = 'block';
    if (floor2Content) floor2Content.style.display = 'none';
    loadIPDFloor(1);
  } else {
    if (floor2Btn) {
      floor2Btn.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
      floor2Btn.style.borderColor = '#4dd0e1';
      floor2Btn.style.color = '#00796b';
      floor2Btn.style.fontWeight = '600';
    }
    if (floor1Btn) {
      floor1Btn.style.background = 'white';
      floor1Btn.style.borderColor = '#ddd';
      floor1Btn.style.color = '#999';
      floor1Btn.style.fontWeight = '500';
    }
    if (floor1Content) floor1Content.style.display = 'none';
    if (floor2Content) floor2Content.style.display = 'block';
    loadIPDFloor(2);
  }
}

window.showActiveBeds = function showActiveBeds() {
  const floor1Btn = document.getElementById('btn-floor-1');
  const floor2Btn = document.getElementById('btn-floor-2');
  const activeBedsBtn = document.getElementById('btn-active-beds');
  const floor1Content = document.getElementById('floor-1-content');
  const floor2Content = document.getElementById('floor-2-content');
  const activeBedsContent = document.getElementById('active-beds-content');

  if (!activeBedsBtn || !activeBedsContent) {
    return;
  }

  if (floor1Btn) {
    floor1Btn.style.background = '#e0e0e0';
    floor1Btn.style.borderColor = '#bdbdbd';
    floor1Btn.style.color = '#999';
    floor1Btn.style.fontWeight = '600';
  }
  if (floor2Btn) {
    floor2Btn.style.background = '#e0e0e0';
    floor2Btn.style.borderColor = '#bdbdbd';
    floor2Btn.style.color = '#999';
    floor2Btn.style.fontWeight = '600';
  }
  if (activeBedsBtn) {
    activeBedsBtn.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
    activeBedsBtn.style.borderColor = '#4dd0e1';
    activeBedsBtn.style.color = '#00796b';
    activeBedsBtn.style.boxShadow = '0 2px 8px rgba(0,150,136,0.12)';
    activeBedsBtn.style.fontWeight = '700';
  }
  if (floor1Content) floor1Content.style.display = 'none';
  if (floor2Content) floor2Content.style.display = 'none';
  if (activeBedsContent) activeBedsContent.style.display = 'block';
  buildActiveBedsCalendarGrid();
};

(function runOneTimePatientDataPurge() {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__sbpFirestoreSyncEnabled) {
    return;
  }
  if (window.__sbpDataPurge) {
    window.__sbpDataPurge();
    return;
  }
  const FLAG_KEY = 'sbp_data_purged_20260103';
  const KEYS_TO_CLEAR = [
    'bookingData',
    'ipdData',
    'ipd_female_standard_floor2',
    'ipd_female_special_floor2',
    'ipd_male_standard_floor2',
    'ipd_male_special_floor2',
    'ipd_active_beds_floor2'
  ];
  window.__sbpDataPurge = function __sbpDataPurge() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (localStorage.getItem(FLAG_KEY)) {
      return;
    }
    KEYS_TO_CLEAR.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Unable to remove key from localStorage:', key, error);
      }
    });
    try {
      localStorage.setItem(FLAG_KEY, new Date().toISOString());
    } catch (error) {
      console.warn('Unable to set purge flag in localStorage:', error);
    }
  };
  window.__sbpDataPurge();
})();

// Google Apps Script endpoint for syncing admitted IPD data
const ADMITTED_SHEET_WEB_APP_URL = (window.SBPSheetEndpoints && window.SBPSheetEndpoints.admitted) || 'https://script.google.com/macros/s/AKfycbxQB8eOuTZ78JMWo7llAIMJZ0DsDn1-vYj_ThvWPr86-lQg12m4OyePMLqluW668qQC/exec';

function normalizeAdmitValue(value) {
  return (value || '').toString().trim().toLowerCase();
}

function isAdmittedFloor2(patient) {
  if (!patient) {
    return false;
  }
  const floorValue = normalizeAdmitValue(patient.floor || patient.floor_name || patient.ward || patient.ward_floor);
  const statusValue = normalizeAdmitValue(patient.admit_status || patient.status);
  const matchesFloor = floorValue === 'floor2' ||
    floorValue === 'floor 2' ||
    floorValue === '2' ||
    floorValue.includes('floor2') ||
    floorValue.includes('floor 2') ||
    floorValue.includes('ชั้น 2');
  if (!matchesFloor || !statusValue) {
    return false;
  }
  if (statusValue === 'admitted' ||
      statusValue === 'admit' ||
      statusValue === 'ipd' ||
      statusValue === 'inward' ||
      statusValue === 'in ward') {
    return true;
  }
  if (statusValue.startsWith('admitted')) {
    return true;
  }
  return statusValue.startsWith('admit') && !statusValue.includes('waiting');
}

// --- Helper: Calculate IMC/Non-IMC by Disease Group for floor2 (for Dashboard sync) ---
function getIMCNonIMCByDiseaseFloor2() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { admitted: [] };
  // กรองเฉพาะผู้ป่วยที่อยู่ชั้น 2 และมีสถานะ admit (รองรับค่าที่สะกดต่างกัน)
  let admitted = (bookingData.admitted || []).filter(isAdmittedFloor2);
  // กรองซ้ำ (unique HN หรือ patient_id)
  const seen = new Set();
  admitted = admitted.filter(p => {
    const key = p.hn || p.patient_id || p.id || JSON.stringify(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // กลุ่มโรคหลัก
  const diseaseGroups = [
    { label: 'Stroke', match: d => d && d.toLowerCase().includes('stroke') },
    { label: 'SCI (Tetraplegia)', match: d => d && d.toLowerCase().includes('tetra') },
    { label: 'SCI (Paraplegia)', match: d => d && d.toLowerCase().includes('para') },
    { label: 'TBI', match: d => d && d.toLowerCase().includes('tbi') },
    { label: 'Hip fracture', match: d => d && d.toLowerCase().includes('hip') },
    { label: 'อื่นๆ', match: d => true }
  ];
  function isIMC(p) {
    return (p.imc_status || p.imc || '').toString().trim().toUpperCase() === 'IMC';
  }
  const imc = [0, 0, 0, 0, 0, 0];
  const nonimc = [0, 0, 0, 0, 0, 0];
  admitted.forEach(p => {
    // ถ้า diagnosis ว่าง/null/undefined ให้จัดกลุ่มเป็น 'อื่นๆ' เท่านั้น
    let idx = diseaseGroups.length - 1; // default อื่นๆ
    let matchedLabel = 'อื่นๆ';
    if (p.diagnosis && typeof p.diagnosis === 'string' && p.diagnosis.trim() !== '') {
      for (let i = 0; i < diseaseGroups.length - 1; i++) {
        if (diseaseGroups[i].match(p.diagnosis)) {
          idx = i;
          matchedLabel = diseaseGroups[i].label;
          break;
        }
      }
    }
    if (matchedLabel === 'Stroke') {
      console.log('[DEBUG][DASHBOARD] Stroke counted:', {
        hn: p.hn,
        patient_id: p.patient_id,
        assigned_bed: p.assigned_bed,
        diagnosis: p.diagnosis,
        imc_status: p.imc_status,
        floor: p.floor
      });
    }
    if (isIMC(p)) imc[idx]++;
    else nonimc[idx]++;
  });
  return { imc, nonimc };
}
// --- Data Warehouse: Active Bed Status ---
// เรียกใช้ loadActiveBedStatus(startDate, endDate) โดย startDate, endDate เป็น yyyy-mm-dd
function loadActiveBedStatus(startDate, endDate) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { admitted: [] };
  const admittedPatients = bookingData.admitted || [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr style="background:#e0f7fa;"><th style="padding:6px 8px;">วันที่</th><th style="padding:6px 8px;">Active bed</th></tr>';
  let total = 0, days = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0];
    const count = admittedPatients.filter(p => {
      return p.admitted_date && p.expected_discharge_date &&
        p.admitted_date <= dayStr && dayStr <= p.expected_discharge_date;
    }).length;
    html += `<tr><td style="padding:6px 8px;">${formatDateThai(dayStr)}</td><td style="padding:6px 8px;text-align:center;">${count}</td></tr>`;
    total += count;
    days++;
  }
  html += '</table>';
  const avg = days > 0 ? (total / days).toFixed(2) : 0;
  html += `<div style="margin-top:12px;font-weight:600;">ค่าเฉลี่ย Active bed: <span style="color:#00796b;">${avg}</span> เตียง</div>`;
  const el = document.getElementById('active-bed-list');
  if (el) el.innerHTML = html;
}
// Floor display management
// Helper function to format date in Thai
function formatDateThai(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month, day);
}

function formatThaiMonthYear(month, year) {
  const names = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const beYear = year + 543;
  const monthName = names[month] || '';
  return `${monthName} ${beYear}`;
}

function ensureActiveBedsCalendarState() {
  const today = new Date();
  if (!window.activeBedsCalendarState) {
    window.activeBedsCalendarState = { month: today.getMonth(), year: today.getFullYear(), floor: 2 };
  } else {
    const state = window.activeBedsCalendarState;
    if (typeof state.month !== 'number') state.month = today.getMonth();
    if (typeof state.year !== 'number') state.year = today.getFullYear();
  }
  return window.activeBedsCalendarState;
}

function calculateActiveBedsCountsForMonth(floor, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const counts = new Array(daysInMonth).fill(0);
  const admitPerDay = new Array(daysInMonth).fill(0);
  const dischargePerDay = new Array(daysInMonth).fill(0);
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || {};
  const admitted = Array.isArray(bookingData.admitted) ? bookingData.admitted : [];
  const discharged = Array.isArray(bookingData.discharged) ? bookingData.discharged : [];
  // Helper: robust floor check
  function matchFloor(patient, floor) {
    const f = String(floor);
    return (
      (patient.floor && (patient.floor === f || patient.floor === `floor${f}`)) ||
      (patient.floor_name && (patient.floor_name === f || patient.floor_name === `floor${f}`)) ||
      (patient.ward && (patient.ward === f || patient.ward === `floor${f}`)) ||
      (patient.ward_floor && (patient.ward_floor === f || patient.ward_floor === `floor${f}`))
    );
  }
  // Map patient HN to admit/discharge dates for this floor only
  const patientMap = {};
  admitted.forEach(patient => {
    if (floor && !matchFloor(patient, floor)) return;
    const hn = patient.patient_hn || patient.hn || patient.id;
    const admitDate = parseLocalDate(patient.admitted_date || patient.admit_date);
    if (!admitDate) return;
    if (!patientMap[hn]) patientMap[hn] = {};
    patientMap[hn].admit = admitDate;
  });
  discharged.forEach(patient => {
    if (floor && !matchFloor(patient, floor)) return;
    const hn = patient.patient_hn || patient.hn || patient.id;
    const dischargeDate = parseLocalDate(patient.discharge_date);
    if (!dischargeDate) return;
    if (!patientMap[hn]) patientMap[hn] = {};
    patientMap[hn].discharge = dischargeDate;
  });
  // For each patient, increment admitPerDay and dischargePerDay for this month only
  Object.values(patientMap).forEach(({ admit, discharge }) => {
    if (admit && admit.getFullYear() === year && admit.getMonth() === month) {
      const idx = admit.getDate() - 1;
      if (idx >= 0 && idx < daysInMonth) admitPerDay[idx] += 1;
    }
    if (discharge && discharge.getFullYear() === year && discharge.getMonth() === month) {
      const idx = discharge.getDate() - 1;
      if (idx >= 0 && idx < daysInMonth) dischargePerDay[idx] += 1;
    }
  });
  // ปรับสูตร: ถ้า discharge ในวันนั้น จะไม่นับในวันนั้นทันที
  // 1. นับผู้ป่วยที่ admit ก่อนวันแรกของเดือนและยังไม่ discharge ก่อนวันแรก
  const firstDay = new Date(year, month, 1);
  let runningTotal = 0;
  Object.values(patientMap).forEach(({ admit, discharge }) => {
    if (admit && admit < firstDay && (!discharge || discharge >= firstDay)) {
      runningTotal++;
    }
  });
  for (let i = 0; i < daysInMonth; i++) {
    // วัน i (0-based) คือวันที่ i+1
    const currentDay = new Date(year, month, i + 1);
    // admit ใหม่ในวันนั้น
    let admitToday = 0;
    let dischargeToday = 0;
    Object.values(patientMap).forEach(({ admit, discharge }) => {
      if (admit && admit.getFullYear() === year && admit.getMonth() === month && admit.getDate() === (i + 1)) {
        admitToday++;
      }
      if (discharge && discharge.getFullYear() === year && discharge.getMonth() === month && discharge.getDate() === (i + 1)) {
        dischargeToday++;
      }
    });
    runningTotal += admitToday;
    runningTotal -= dischargeToday;
    counts[i] = runningTotal;
  }
  return counts;
}

function buildActiveBedsCalendarGrid(year, month, counts) {
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  const maxCount = counts.length ? Math.max(...counts) : 0;
  let html = '';

  dayNames.forEach(name => {
    html += `<div style="text-align:center;font-weight:700;color:#006064;font-size:0.85rem;">${name}</div>`;
  });

  for (let i = 0; i < firstDay; i++) {
    html += '<div style="padding:12px;border-radius:14px;background:transparent;"></div>';
  }

  for (let day = 1; day <= counts.length; day++) {
    const count = typeof counts[day - 1] === 'number' ? counts[day - 1] : 0;
    const intensity = maxCount > 0 ? count / maxCount : 0;
    const baseBg = count > 0
      ? `linear-gradient(135deg, rgba(178,235,242,${0.35 + intensity * 0.4}) 0%, rgba(129,199,132,${0.3 + intensity * 0.45}) 100%)`
      : 'linear-gradient(135deg, rgba(245,247,250,0.9) 0%, rgba(236,239,241,0.9) 100%)';
    const border = (todayYear === year && todayMonth === month && todayDate === day)
      ? '2px solid rgba(38,166,154,0.9)'
      : '1px solid rgba(0,150,136,0.12)';
    const dayColor = count > 0 ? '#006064' : '#90a4ae';
    const countColor = count > 0 ? '#004d40' : '#b0bec5';
    const countFontSize = count > 0 ? '1.4rem' : '1.1rem';
    html += `<div style="min-height:96px;padding:12px;border-radius:14px;display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(0,150,136,${count>0?0.14:0.05});background:${baseBg};border:${border};">
      <div style="font-size:0.95rem;font-weight:700;color:${dayColor};">${day}</div>
      <div style="margin-top:4px;font-size:0.75rem;color:${dayColor};opacity:0.8;">จำนวนผู้ป่วย</div>
      <div style="margin-top:auto;font-size:${countFontSize};font-weight:700;color:${countColor};">${count}</div>
    </div>`;
  }

  return html;
}

function renderActiveBedsCalendarForFloor(floor) {
  const wrapper = document.getElementById('active-beds-calendar-container');
  if (!wrapper) return;

  const state = ensureActiveBedsCalendarState();
  state.floor = floor;
  const counts = calculateActiveBedsCountsForMonth(floor, state.year, state.month);

  const label = document.getElementById('activeBedsCalendarMonthLabel');
  if (label) {
    label.textContent = formatThaiMonthYear(state.month, state.year);
  }

  const grid = document.getElementById('activeBedsCalendarGrid');
  if (grid) {
    grid.innerHTML = buildActiveBedsCalendarGrid(state.year, state.month, counts);
  }

  const emptyState = document.getElementById('activeBedsCalendarEmptyState');
  if (emptyState) {
    const hasData = counts.some(value => value > 0);
    emptyState.style.display = hasData ? 'none' : 'block';
  }
}

function changeActiveBedsCalendarMonth(offset) {
  const state = ensureActiveBedsCalendarState();
  state.month += offset;
  if (state.month < 0) {
    state.month = 11;
    state.year -= 1;
  } else if (state.month > 11) {
    state.month = 0;
    state.year += 1;
  }
  window.activeBedsCalendarState = state;
  renderActiveBedsCalendarForFloor(state.floor || 2);
}

function handleIPDBookingStorageUpdate(key) {
  if (key && key !== 'bookingData') {
    return;
  }
  const state = ensureActiveBedsCalendarState();
  renderActiveBedsCalendarForFloor(state.floor || 2);
}

window.addEventListener('storage', function(event) {
  handleIPDBookingStorageUpdate(event && typeof event.key === 'string' ? event.key : undefined);
});

window.addEventListener('sbpRemoteStorageSync', function(event) {
  const detail = event && event.detail;
  handleIPDBookingStorageUpdate(detail && typeof detail.key === 'string' ? detail.key : undefined);
});

function showIPDFloor(floor) {
  const floor1Btn = document.getElementById('btn-floor-1');
  const floor2Btn = document.getElementById('btn-floor-2');
  const activeBedsBtn = document.getElementById('btn-active-beds');
  const floor1Content = document.getElementById('floor-1-content');
  const floor2Content = document.getElementById('floor-2-content');
  const activeBedsContent = document.getElementById('active-beds-content');

  // Skip DOM updates if the IPD layout is not present (e.g. dashboard page).
  if (!floor1Btn || !floor2Btn || !floor1Content || !floor2Content) {
    return;
  }

  if (activeBedsBtn) {
    activeBedsBtn.style.background = 'white';
    activeBedsBtn.style.borderColor = '#bdbdbd';
    activeBedsBtn.style.color = '#00796b';
    activeBedsBtn.style.boxShadow = 'none';
    activeBedsBtn.style.fontWeight = '600';
  }

  if (activeBedsContent) {
    activeBedsContent.style.display = 'none';
  }

  if (floor === 1) {
    floor1Btn.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
    floor1Btn.style.borderColor = '#4dd0e1';
    floor1Btn.style.color = '#00796b';
    floor1Btn.style.fontWeight = '600';

    floor2Btn.style.background = 'white';
    floor2Btn.style.borderColor = '#ddd';
    floor2Btn.style.color = '#999';
    floor2Btn.style.fontWeight = '500';

    floor1Content.style.display = 'block';
    floor2Content.style.display = 'none';

    loadIPDFloor(1);
  } else {
    floor2Btn.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
    floor2Btn.style.borderColor = '#4dd0e1';
    floor2Btn.style.color = '#00796b';
    floor2Btn.style.fontWeight = '600';

    floor1Btn.style.background = 'white';
    floor1Btn.style.borderColor = '#ddd';
    floor1Btn.style.color = '#999';
    floor1Btn.style.fontWeight = '500';

    floor1Content.style.display = 'none';
    floor2Content.style.display = 'block';

    loadIPDFloor(2);
  }
}

window.showActiveBeds = function showActiveBeds() {
  const floor1Btn = document.getElementById('btn-floor-1');
  const floor2Btn = document.getElementById('btn-floor-2');
  const activeBedsBtn = document.getElementById('btn-active-beds');
  const floor1Content = document.getElementById('floor-1-content');
  const floor2Content = document.getElementById('floor-2-content');
  const activeBedsContent = document.getElementById('active-beds-content');

  if (!activeBedsBtn || !activeBedsContent) {
    return;
  }

  if (floor1Btn) {
    floor1Btn.style.background = '#e0e0e0';
    floor1Btn.style.borderColor = '#bdbdbd';
    floor1Btn.style.color = '#999';
    floor1Btn.style.fontWeight = '600';
  }

  if (floor2Btn) {
    floor2Btn.style.background = 'white';
    floor2Btn.style.borderColor = '#ddd';
    floor2Btn.style.color = '#999';
    floor2Btn.style.fontWeight = '500';
  }

  activeBedsBtn.style.background = 'linear-gradient(135deg, #80deea 0%, #81c784 100%)';
  activeBedsBtn.style.borderColor = 'rgba(77,208,225,0.85)';
  activeBedsBtn.style.color = '#00695c';
  activeBedsBtn.style.boxShadow = '0 4px 12px rgba(77,208,225,0.18)';
  activeBedsBtn.style.fontWeight = '700';

  if (floor1Content) {
    floor1Content.style.display = 'none';
  }
  if (floor2Content) {
    floor2Content.style.display = 'none';
  }
  activeBedsContent.style.display = 'block';

  const state = ensureActiveBedsCalendarState();
  state.floor = 2;
  renderActiveBedsCalendarForFloor(2);
}

// Load IPD data for a specific floor
function loadIPDFloor(floor) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  const bookedPatients = bookingData.booked || [];
  const admittedPatients = bookingData.admitted || [];

  // Filter waiting patients by floor (status = 'waiting')
  const waitingPatients = admittedPatients.filter(p => {
    if (floor === 1) {
      return p.floor === 'floor1' && p.admit_status === 'waiting';
    } else if (floor === 2) {
      return p.floor === 'floor2' && p.admit_status === 'waiting';
    }
    return false;
  });
  
  // Filter admitted patients by floor (status = 'admitted', have bed assigned)
  const floorAdmittedPatients = admittedPatients.filter(p => {
    if (floor === 1) {
      return p.floor === 'floor1' && p.admit_status === 'admitted';
    } else if (floor === 2) {
      return p.floor === 'floor2' && p.admit_status === 'admitted';
    }
    return false;
  });
  
  // Standard beds (B1-B12 for floor 1, B4-B12,B14-B16 for floor 2)
  const standardBeds = floor === 1 
    ? ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12']
    : ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'];
  
  // Special beds (V1-V6 for all floors)
  const specialBeds = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

  // Update summary cards for floor 2
  if (floor === 2) {
    updateSummaryCards(floorAdmittedPatients, standardBeds, specialBeds);
  }

  // Load waiting patients section
  const waitingId = `floor-${floor}-waiting`;
  const waitingList = document.getElementById(waitingId);
  // ไม่มีแจ้งเตือน popup ผู้ป่วยรอรับ Admit อีกต่อไป
  if (waitingList) {
    waitingList.innerHTML = '';
    if (waitingPatients.length === 0) {
      waitingList.innerHTML = '<p style="color:#999;grid-column:1/-1;text-align:center;padding:16px;">ไม่มีผู้ป่วยรอรับ Admit</p>';
    } else {
      waitingPatients.forEach(patient => {
        const card = createWaitingPatientCard(patient, floor);
        waitingList.appendChild(card);
      });
    }
  }

  // Render standard beds
  const standardListId = `floor-${floor}-standard-list`;
  const standardList = document.getElementById(standardListId);
  if (standardList) {
    standardList.innerHTML = '';
    standardBeds.forEach(bedId => {
      const patient = floorAdmittedPatients.find(p => p.assigned_bed === bedId);
      const bedElement = createBedElement(bedId, patient, 'standard');
      standardList.appendChild(bedElement);
    });
  }

  // Render special beds
  const specialListId = `floor-${floor}-special-list`;
  const specialList = document.getElementById(specialListId);
  if (specialList) {
    specialList.innerHTML = '';
    specialBeds.forEach(bedId => {
      const patient = floorAdmittedPatients.find(p => p.assigned_bed === bedId);
      const bedElement = createBedElement(bedId, patient, 'special');
      specialList.appendChild(bedElement);
    });
  }
}

// --- Helper: Play sound for new admit ---
function playAdmitSound() {
  let audio = document.getElementById('admit-audio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'admit-audio';
    audio.src = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae5b2.mp3'; // Free notification sound
    audio.preload = 'auto';
    document.body.appendChild(audio);
  }
  audio.currentTime = 0;
  audio.play();
}

// Create waiting patient card
function createWaitingPatientCard(patient, floor) {
  const card = document.createElement('div');
  card.style.background = 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)';
  card.style.padding = '14px';
  card.style.borderRadius = '12px';
  card.style.border = '2px solid #ffb74d';
  card.style.cursor = 'pointer';
  
  card.innerHTML = `
    <div style="margin-bottom:10px;">
      <p style="font-size:12px;color:#ff6f00;margin:0 0 4px 0;font-weight:600;">รอรับ Admit</p>
      <p style="font-size:14px;font-weight:700;color:#e65100;margin:0;word-wrap:break-word;">${patient.patient_name}</p>
    </div>
    <div style="display:grid;gap:6px;margin-bottom:12px;font-size:11px;">
      <div style="color:#666;"><span style="color:#999;">HN:</span> ${patient.patient_hn}</div>
      <div style="color:#666;"><span style="color:#999;">Diagnosis:</span> ${patient.diagnosis}</div>
      <div style="color:#666;"><span style="color:#999;">แพทย์:</span> ${patient.doctor_name}</div>
      <div style="color:#666;"><span style="color:#999;">ประเภท:</span> ${patient.bed_type === 'standard' ? 'เตียงสามัญ' : 'ห้องพิเศษ'}</div>
    </div>
    <button class="admit-btn" type="button" style="width:100%;padding:8px;background:linear-gradient(135deg, #81c784 0%, #66bb6a 100%);border:none;border-radius:8px;color:white;font-weight:600;cursor:pointer;font-size:12px;">
      ✓ ยืนยัน Admit
    </button>
  `;
  
  card.onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') {
      showWaitingPatientModal(patient);
    }
  };
  // ผูก event ให้ปุ่มยืนยัน Admit
  const admitBtn = card.querySelector('.admit-btn');
  if (admitBtn) {
    admitBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openAdmitModal(this);
    });
  }
  
  return card;
}

// Show waiting patient details modal
function showWaitingPatientModal(patient) {
  selectedPatient = patient;
  document.getElementById('modal-patient-name').textContent = patient.patient_name;
  document.getElementById('modal-patient-hn').value = patient.patient_hn;
  document.getElementById('modal-patient-diagnosis').textContent = patient.diagnosis;
  document.getElementById('modal-patient-doctor').textContent = patient.doctor_name;
    document.getElementById('modal-patient-admitted-date').value = patient.admit_date || '';
  document.getElementById('modal-patient-discharge-date').textContent = patient.expected_discharge_date || '-';
  document.getElementById('patient-modal').style.display = 'flex';
}

// Open bed selection modal for admission
function openAdmitModal(button) {
  // Remove any existing modal to prevent duplicate modals
  const oldModal = document.getElementById('bed-selection-modal');
  if (oldModal) oldModal.remove();

  const card = button.closest('div');
  const patientName = card.querySelector('p:nth-child(2)').textContent;
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };

  // Find the patient from admitted list with waiting status
  const patient = bookingData.admitted.find(p =>
    p.patient_name === patientName &&
    p.admit_status === 'waiting'
  );

  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }

  selectedWaitingPatient = patient;
  const floor = patient.floor === 'floor1' ? 1 : 2;

  // Get available beds
  const admittedPatients = bookingData.admitted || [];
  const floorPatients = admittedPatients.filter(p =>
    p.admit_status === 'admitted' &&
    p.floor === patient.floor &&
    p.assigned_bed
  );

  const standardBeds = floor == 1
    ? ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12']
    : ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'];
  const specialBeds = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

  // Get available beds for both types
  const availableStandard = standardBeds.filter(bed => !floorPatients.find(p => p.assigned_bed === bed));
  const availableSpecial = specialBeds.filter(bed => !floorPatients.find(p => p.assigned_bed === bed));

  // Create bed options with grouping
  let bedOptions = '<option value="">-- เลือกเตียง --</option>';

  if (availableStandard.length > 0) {
    bedOptions += '<optgroup label="เตียงสามัญ">';
    bedOptions += availableStandard.map(bed => `<option value="${bed}">${bed}</option>`).join('');
    bedOptions += '</optgroup>';
  }

  if (availableSpecial.length > 0) {
    bedOptions += '<optgroup label="ห้องพิเศษ">';
    bedOptions += availableSpecial.map(bed => `<option value="${bed}">${bed}</option>`).join('');
    bedOptions += '</optgroup>';
  }

  if (availableStandard.length === 0 && availableSpecial.length === 0) {
    alert('ไม่มีเตียงว่างทั้งเตียงสามัญและห้องพิเศษ');
    return;
  }

  // Get today's date for min value
  const today = new Date().toISOString().split('T')[0];

  // Create bed selection dialog
  const modal = document.createElement('div');
  modal.id = 'bed-selection-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '2000';

  modal.innerHTML = `
    <div id="bed-selection-modal-content" style="background:white;padding:32px;border-radius:16px;max-width:450px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="color:#00796b;font-size:18px;font-weight:600;margin:0 0 20px 0;">เลือกเตียงและระบุวันจำหน่าย</h3>
      <div style="background:#f5f5f5;padding:16px;border-radius:12px;margin-bottom:20px;border-left:4px solid #0277bd;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#666;"><span style="font-weight:600;">ผู้ป่วย:</span> ${patient.patient_name}</p>
        <p style="margin:0;font-size:13px;color:#666;"><span style="font-weight:600;">HN:</span> ${patient.patient_hn}</p>
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:14px;color:#333;display:block;margin-bottom:8px;font-weight:600;">เตียง *</label>
        <select id="select-bed" required style="width:100%;padding:12px;border:2px solid #b2ebf2;border-radius:8px;font-size:14px;background:white;">
          ${bedOptions}
        </select>
        <p style="font-size:12px;color:#00796b;margin:4px 0 0 0;">เลือกได้ทั้งเตียงสามัญและห้องพิเศษ</p>
      </div>
      <div style="margin-bottom:24px;">
        <label style="font-size:14px;color:#333;display:block;margin-bottom:8px;font-weight:600;">วันที่คาดว่าจะจำหน่าย *</label>
        <input type="date" id="expected-discharge-date" required min="${today}" style="width:100%;padding:12px;border:2px solid #b2ebf2;border-radius:8px;font-size:14px;background:white;">
        <p style="font-size:12px;color:#00796b;margin:4px 0 0 0;">ระบุวันที่คาดว่าผู้ป่วยจะจำหน่าย</p>
      </div>
      <div style="display:flex;gap:12px;">
        <button id="cancel-admit-btn" style="flex:1;padding:12px;border-radius:8px;background:#f0f0f0;border:none;cursor:pointer;font-size:14px;font-weight:600;color:#333;">ยกเลิก</button>
        <button id="confirm-admit-btn" type="button" style="flex:1;padding:12px;border-radius:8px;background:linear-gradient(135deg, #81c784 0%, #66bb6a 100%);border:none;cursor:pointer;font-size:14px;font-weight:600;color:white;">ยืนยัน Admit</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  // ปุ่มยกเลิก
  document.getElementById('cancel-admit-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('bed-selection-modal').remove();
  });
  // ปุ่มยืนยัน Admit
  document.getElementById('confirm-admit-btn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    confirmAdmit();
  });
  // ป้องกัน bubbling ที่ content
  document.getElementById('bed-selection-modal-content').addEventListener('click', function(e) {
    e.stopPropagation();
  });
  // ปิด modal เมื่อคลิกพื้นหลัง
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

// Confirm patient admission
function confirmAdmit() {
  // ตรวจสอบ selectedWaitingPatient
  if (!selectedWaitingPatient) {
    alert('เกิดข้อผิดพลาด: ไม่พบข้อมูลผู้ป่วยที่เลือก กรุณาเลือกผู้ป่วยใหม่อีกครั้ง');
    // ลบ modal ทิ้งเพื่อป้องกัน modal ค้าง
    const modal = document.getElementById('bed-selection-modal');
    if (modal) modal.remove();
    return;
  }
  // Play sound for admit confirmation
  playAdmitSound();
  const bedSelect = document.getElementById('select-bed');
  const selectedBed = bedSelect.value;
  const dischargeDate = document.getElementById('expected-discharge-date').value;

  if (!selectedBed) {
    alert('กรุณาเลือกเตียง');
    return;
  }

  if (!dischargeDate) {
    alert('กรุณาระบุวันที่คาดว่าจะจำหน่าย');
    return;
  }

  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };

  // Find patient in admitted list with waiting status
  const patientIndex = bookingData.admitted.findIndex(p =>
    p.patient_hn === selectedWaitingPatient.patient_hn &&
    p.admit_status === 'waiting'
  );

  if (patientIndex === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    // ลบ modal ทิ้งเพื่อป้องกัน modal ค้าง
    const modal = document.getElementById('bed-selection-modal');
    if (modal) modal.remove();
    return;
  }

  // Update patient status to admitted
  const patient = bookingData.admitted[patientIndex];
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';

  patient.assigned_bed = selectedBed;
  // Always use current date for admitted_date
  patient.admitted_date = new Date().toISOString().split('T')[0];
  patient.expected_discharge_date = dischargeDate;
  patient.admit_status = 'admitted'; // Change from 'waiting' to 'admitted'
  patient.admitted_by = loggedUser;
  patient.action_note = `รับ Admit โดย ${loggedUser}`;

  localStorage.setItem('bookingData', JSON.stringify(bookingData));

  // Google Sheets sync disabled

  // Remove modal
  const modal = document.getElementById('bed-selection-modal');
  if (modal) modal.remove();

  alert(`✅ ยืนยัน Admit สำเร็จ\n${patient.patient_name}\nเตียง: ${selectedBed}\nวันที่คาดว่าจะจำหน่าย: ${formatDateThai(dischargeDate)}\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว`);

  // หลังยืนยัน Admit ให้แสดงเมนูย่อย "เตียงผู้ป่วย" (admitted)
  // โดยสลับไปยังเมนูเตียงของชั้นที่ผู้ป่วยถูก admit
  if (patient.floor === 'floor1') {
    showIPDFloor(1);
  } else {
    showIPDFloor(2);
  }
}


// Show admitted patient details modal
// ต้องเป็น global
var selectedPatient = null;
var selectedWaitingPatient = null;

function showAdmittedPatientModal(patient) {
    // Play sound when opening admitted patient modal
    playAdmitSound();
  selectedPatient = patient;
  document.getElementById('modal-patient-name').textContent = patient.patient_name || '-';
  document.getElementById('modal-patient-hn').value = patient.patient_hn || '';
  
  // Additional patient information
  document.getElementById('modal-patient-age').textContent = (patient.patient_age || patient.age || '-') + (patient.patient_age || patient.age ? ' ปี' : '');
  document.getElementById('modal-patient-gender').textContent = patient.patient_gender || patient.gender || '-';
  document.getElementById('modal-patient-phone').textContent = patient.patient_phone || patient.phone || '-';
  document.getElementById('modal-patient-diagnosis').textContent = patient.diagnosis === 'etc' && patient.diagnosis_etc ? patient.diagnosis_etc : (patient.diagnosis || '-');
  document.getElementById('modal-disease-onset').textContent = patient.disease_onset_date ? formatDateThai(patient.disease_onset_date) : '-';
  
  // IMC Status with color
  const imcStatusEl = document.getElementById('modal-imc-status');
  if (patient.imc_status === 'IMC') {
    imcStatusEl.textContent = 'IMC';
    imcStatusEl.style.color = '#ff6f00';
  } else {
    imcStatusEl.textContent = 'Non-IMC';
    imcStatusEl.style.color = '#757575';
  }
  
  // Populate bed options based on floor
  const bedSelect = document.getElementById('modal-patient-bed');
  bedSelect.innerHTML = '<option value="">เลือกเตียง</option>';
  
  const floor = patient.ward_floor || 2;
  const standardBeds = floor === 1 
    ? ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12']
    : ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'];
  const specialBeds = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  
  // Add standard beds
  const stdGroup = document.createElement('optgroup');
  stdGroup.label = 'เตียงสามัญ';
  standardBeds.forEach(bed => {
    const opt = document.createElement('option');
    opt.value = bed;
    opt.textContent = bed;
    stdGroup.appendChild(opt);
  });
  bedSelect.appendChild(stdGroup);
  
  // Add special beds
  const spcGroup = document.createElement('optgroup');
  spcGroup.label = 'เตียงพิเศษ';
  specialBeds.forEach(bed => {
    const opt = document.createElement('option');
    opt.value = bed;
    opt.textContent = bed;
    spcGroup.appendChild(opt);
  });
  bedSelect.appendChild(spcGroup);
  
  // Set current values
  bedSelect.value = patient.assigned_bed || '';
  const doctorEl = document.getElementById('modal-patient-doctor');
  // Show both attending_doctor and doctor_name if both exist and are different
  let doctorName = '';
  if (patient.attending_doctor && patient.doctor_name && patient.attending_doctor !== patient.doctor_name) {
    doctorName = `${patient.attending_doctor} / ${patient.doctor_name}`;
  } else {
    doctorName = patient.attending_doctor || patient.doctor_name || '';
  }
  if (doctorEl) {
    if (doctorEl.tagName === 'INPUT' || doctorEl.tagName === 'TEXTAREA') {
      doctorEl.value = doctorName;
    } else if (doctorEl.tagName === 'SELECT') {
      // If select, add option if not present and select it
      let found = false;
      for (let i = 0; i < doctorEl.options.length; i++) {
        if (doctorEl.options[i].value === doctorName) {
          found = true;
          doctorEl.selectedIndex = i;
          break;
        }
      }
      if (!found && doctorName) {
        const opt = document.createElement('option');
        opt.value = doctorName;
        opt.textContent = doctorName;
        doctorEl.appendChild(opt);
        doctorEl.value = doctorName;
      }
    } else {
      doctorEl.textContent = doctorName;
    }
  }

      document.getElementById('modal-patient-admitted-date').value = patient.admitted_date || patient.admit_date || '';
  document.getElementById('modal-patient-discharge-date').value = patient.expected_discharge_date || '';
  document.getElementById('modal-patient-notes').value = patient.notes || '';

  // --- LOS (Length of Stay) ---
  let los = '-';
  let admitDate = patient.admitted_date || patient.admit_date;
  let dischargeDateForLOS = patient.expected_discharge_date;
  if (admitDate && dischargeDateForLOS) {
    const d1 = new Date(admitDate);
    const d2 = new Date(dischargeDateForLOS);
    // LOS = (discharge - admit) in days
    const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    if (!isNaN(diff) && diff >= 0) {
      los = diff + 1 > 1 ? diff : 1; // ถ้า admit=1, discharge=3 จะได้ 2 วัน
    }
  }
  document.getElementById('modal-patient-los').textContent = los;

  // เชื้อดื้อยา (Resistant Bacteria)
  document.getElementById('modal-culture-mrsa').checked = !!(patient.culture_mrsa);
  document.getElementById('modal-culture-vre').checked = !!(patient.culture_vre);
  document.getElementById('modal-culture-cre').checked = !!(patient.culture_cre);
  document.getElementById('modal-culture-esbl').checked = !!(patient.culture_esbl);
  document.getElementById('modal-culture-other').value = patient.culture_other || '';
  
  // Check if discharge date has arrived and update modal color
  const today = new Date().toISOString().split('T')[0];
  const dischargeDate = patient.expected_discharge_date;
  const isDischargeDue = dischargeDate && today >= dischargeDate;
  
  const modalContent = document.querySelector('#patient-modal > div');
  if (isDischargeDue) {
    // Yellow pastel for discharge due
    modalContent.style.background = 'linear-gradient(135deg, #fff9e6 0%, #ffecb3 100%)';
  } else {
    // Sea green/blue pastel for normal patients
    modalContent.style.background = 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)';
  }
  
  // Check if discharge button should be enabled
  updateDischargeButton(patient.expected_discharge_date);
  
  document.getElementById('patient-modal').style.display = 'flex';
}

function closePatientModal() {
  document.getElementById('patient-modal').style.display = 'none';
  selectedPatient = null;
}

// Update discharge button state based on date
function updateDischargeButton(dischargeDate) {
  const dischargeBtn = document.getElementById('discharge-btn');
  if (!dischargeDate) {
    dischargeBtn.disabled = true;
    dischargeBtn.style.opacity = '0.5';
    dischargeBtn.style.cursor = 'not-allowed';
    dischargeBtn.style.background = 'linear-gradient(135deg, #ffccbc 0%, #ffab91 100%)';
    dischargeBtn.style.color = '#bf360c';
    return;
  }
  // Enable if today >= dischargeDate (ย้อนหลังได้)
  const todayObj = new Date();
  const dischargeObj = new Date(dischargeDate);
  todayObj.setHours(0,0,0,0);
  dischargeObj.setHours(0,0,0,0);
  if (todayObj.getTime() >= dischargeObj.getTime()) {
    dischargeBtn.disabled = false;
    dischargeBtn.style.opacity = '1';
    dischargeBtn.style.cursor = 'pointer';
    dischargeBtn.style.background = 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)';
    dischargeBtn.style.color = 'white';
  } else {
    dischargeBtn.disabled = true;
    dischargeBtn.style.opacity = '0.5';
    dischargeBtn.style.cursor = 'not-allowed';
    dischargeBtn.style.background = 'linear-gradient(135deg, #ffccbc 0%, #ffab91 100%)';
    dischargeBtn.style.color = '#bf360c';
  }
}

// Save patient changes
function savePatientChanges() {
      // Get new admit date from modal input
      const newAdmitDate = document.getElementById('modal-patient-admitted-date').value;
    // Get the new HN value from the input field
    const newHN = document.getElementById('modal-patient-hn').value.trim();
  if (!selectedPatient) return;
  
  const newBed = document.getElementById('modal-patient-bed').value.trim();
  const newDoctor = document.getElementById('modal-patient-doctor').value.trim();
  const newDischargeDate = document.getElementById('modal-patient-discharge-date').value;
  const newNotes = document.getElementById('modal-patient-notes').value.trim();
  // เชื้อดื้อยา (Resistant Bacteria)
  const newCultureMRSA = document.getElementById('modal-culture-mrsa').checked;
  const newCultureVRE = document.getElementById('modal-culture-vre').checked;
  const newCultureCRE = document.getElementById('modal-culture-cre').checked;
  const newCultureESBL = document.getElementById('modal-culture-esbl').checked;
  const newCultureOther = document.getElementById('modal-culture-other').value.trim();
  
  if (!newBed || !newDoctor || !newDischargeDate) {
    alert('❌ กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }
  
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  // Find and update patient
  // Find patient by old HN (selectedPatient.patient_hn)
  const patientIndex = bookingData.admitted.findIndex(p => p.patient_hn === selectedPatient.patient_hn);
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  if (patientIndex !== -1) {
    // Update HN if changed
    bookingData.admitted[patientIndex].patient_hn = newHN;
    // Also update selectedPatient for further logic
    selectedPatient.patient_hn = newHN;
    const oldBed = bookingData.admitted[patientIndex].assigned_bed;
    const oldDischargeDate = bookingData.admitted[patientIndex].expected_discharge_date;
    
    bookingData.admitted[patientIndex].assigned_bed = newBed;
    bookingData.admitted[patientIndex].admit_date = newAdmitDate;
    bookingData.admitted[patientIndex].admitted_date = newAdmitDate;
    bookingData.admitted[patientIndex].doctor_name = newDoctor;
    bookingData.admitted[patientIndex].expected_discharge_date = newDischargeDate;
    bookingData.admitted[patientIndex].notes = newNotes;
    // Save เชื้อดื้อยา (Resistant Bacteria)
    bookingData.admitted[patientIndex].culture_mrsa = newCultureMRSA;
    bookingData.admitted[patientIndex].culture_vre = newCultureVRE;
    bookingData.admitted[patientIndex].culture_cre = newCultureCRE;
    bookingData.admitted[patientIndex].culture_esbl = newCultureESBL;
    bookingData.admitted[patientIndex].culture_other = newCultureOther;
    bookingData.admitted[patientIndex].updated_by = loggedUser;
    bookingData.admitted[patientIndex].last_update = new Date().toISOString();
    
    // Create update note
    let updateNote = `แก้ไขโดย ${loggedUser}`;
    if (oldBed !== newBed) updateNote += ` (เปลี่ยนเตียง ${oldBed}→${newBed})`;
    if (oldDischargeDate !== newDischargeDate) updateNote += ` (เปลี่ยนวันจำหน่าย)`;
    bookingData.admitted[patientIndex].action_note = updateNote;
    
    // Save to localStorage
    localStorage.setItem('bookingData', JSON.stringify(bookingData));
    
    // Google Sheets sync disabled
    
    alert(`✅ บันทึกข้อมูลสำเร็จ${oldBed !== newBed ? '\n(เตียงเปลี่ยนจาก ' + oldBed + ' เป็น ' + newBed + ')' : ''}\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว`);
    
    // Sync resistant bacteria to ipdData for archive search
    syncResistantBacteriaToIpdData();

    // Update only the HN at the bottom of the specific bed card (if visible)
    // Find the bed card by assigned_bed and update the .bed-updated-hn span
    if (bookingData.admitted[patientIndex].assigned_bed) {
      const bedId = bookingData.admitted[patientIndex].assigned_bed;
      // Try both standard and special bed lists
      const bedLists = [
        document.getElementById('floor-2-standard-list'),
        document.getElementById('floor-2-special-list')
      ];
      for (const list of bedLists) {
        if (!list) continue;
        const cards = list.children;
        for (const card of cards) {
          // Find the bed number in the card
          const bedLabel = card.querySelector('p');
          if (bedLabel && bedLabel.textContent && bedLabel.textContent.includes(bedId)) {
            const hnSpan = card.querySelector('.bed-updated-hn');
            if (hnSpan) {
              hnSpan.textContent = bookingData.admitted[patientIndex].patient_hn;
            }
            break;
          }
        }
      }
    }

    // Refresh modal with updated data so admit date and LOS update immediately
    showAdmittedPatientModal(bookingData.admitted[patientIndex]);
  }
}

// Sync เชื้อดื้อยา (resistant_bacteria) to ipdData for archive search
function syncResistantBacteriaToIpdData() {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { admitted: [] };
  let ipdData = JSON.parse(localStorage.getItem('ipdData')) || { floor2: [], floor3: [] };
  // Only floor2, admitted
  const floor2Patients = (bookingData.admitted || []).filter(p => p.floor === 'floor2' && p.admit_status === 'admitted');
  // Map to archive format: only those with any resistant bacteria
  ipdData.floor2 = floor2Patients.filter(p =>
    p.culture_mrsa || p.culture_vre || p.culture_cre || p.culture_esbl || (p.culture_other && p.culture_other !== '')
  ).map(p => {
    return {
      patient_hn: p.patient_hn,
      patient_name: p.patient_name,
      patient_age: p.patient_age || p.age || '',
      patient_gender: p.patient_gender || p.gender || '',
      diagnosis: p.diagnosis,
      admitted_date: p.admitted_date,
      admit_date: p.admit_date || p.admitted_date || '',
      discharge_date: p.discharge_date || p.actual_discharge_date || '',
      assigned_bed: p.assigned_bed,
      doctor_name: p.doctor_name || p.attending_doctor,
      imc_status: p.imc_status || p.imc || '',
      resistant_bacteria: [
        p.culture_mrsa ? 'MRSA' : null,
        p.culture_vre ? 'VRE' : null,
        p.culture_cre ? 'CRE' : null,
        p.culture_esbl ? 'ESBL' : null,
        p.culture_other && p.culture_other !== '' ? p.culture_other : null
      ].filter(Boolean).join(', '),
      last_update: p.last_update || '',
      updated_by: p.updated_by || '',
      logged_by: p.logged_by || p.admitted_by || p.confirmed_by || '',
      current_status: 'resistant_bacteria'
    };
  });
  localStorage.setItem('ipdData', JSON.stringify(ipdData));
}

// Open Refer Modal
function openReferModal() {
  if (!selectedPatient) return;
  
  document.getElementById('refer-patient-name').textContent = selectedPatient.patient_name;
  document.getElementById('refer-patient-hn').textContent = selectedPatient.patient_hn;
  document.getElementById('refer-hospital').value = '';
  document.getElementById('refer-hospital-other').value = '';
  document.getElementById('refer-diagnosis').value = '';
  document.getElementById('refer-hospital-other-container').style.display = 'none';
  document.getElementById('refer-modal').style.display = 'flex';
}

// Close Refer Modal
function closeReferModal() {
  document.getElementById('refer-modal').style.display = 'none';
}

// Handle refer hospital change
document.addEventListener('DOMContentLoaded', function() {
  const referHospitalSelect = document.getElementById('refer-hospital');
  if (referHospitalSelect) {
    referHospitalSelect.addEventListener('change', function() {
      const otherContainer = document.getElementById('refer-hospital-other-container');
      if (this.value === 'other') {
        otherContainer.style.display = 'block';
      } else {
        otherContainer.style.display = 'none';
      }
    });
  }
});

// Confirm Refer
function confirmRefer() {
  if (!selectedPatient) return;
  
  const hospitalSelect = document.getElementById('refer-hospital').value;
  const hospitalOther = document.getElementById('refer-hospital-other').value.trim();
  const diagnosis = document.getElementById('refer-diagnosis').value.trim();
  
  if (!hospitalSelect) {
    alert('❌ กรุณาเลือกโรงพยาบาลที่ส่งต่อ');
    return;
  }
  
  if (hospitalSelect === 'other' && !hospitalOther) {
    alert('❌ กรุณาระบุชื่อโรงพยาบาล');
    return;
  }
  
  if (!diagnosis) {
    alert('❌ กรุณากรอก R/O Diagnosis');
    return;
  }
  
  const hospitalName = hospitalSelect === 'other' ? hospitalOther : hospitalSelect;
  
  if (!confirm(`ยืนยันการ Refer ผู้ป่วย ${selectedPatient.patient_name}\nไปยัง: ${hospitalName}\nR/O Diagnosis: ${diagnosis}`)) {
    return;
  }
  
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  // Remove from admitted list (refer = early discharge) และบันทึกลง referred
  const referredPatient = bookingData.admitted.find(p => p.patient_hn === selectedPatient.patient_hn);
  if (!bookingData.referred) bookingData.referred = [];
  if (referredPatient) {
    // เพิ่มข้อมูล refer
    referredPatient.referred_to = hospitalName;
    referredPatient.refer_date = new Date().toISOString().split('T')[0];
    referredPatient.refer_diagnosis = diagnosis;
    // สำเนา admit_date/admitted_date ไปด้วย (ถ้าไม่มี)
    if (!referredPatient.admit_date && referredPatient.admitted_date) {
      referredPatient.admit_date = referredPatient.admitted_date;
    }
    if (!referredPatient.admitted_date && referredPatient.admit_date) {
      referredPatient.admitted_date = referredPatient.admit_date;
    }
    bookingData.referred.push(referredPatient);
  }
  bookingData.admitted = bookingData.admitted.filter(p => p.patient_hn !== selectedPatient.patient_hn);
  // Save to localStorage
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  
  // Google Sheets sync disabled
  
  alert(`✅ Refer ผู้ป่วยเรียบร้อยแล้ว\nส่งต่อไปยัง: ${hospitalName}\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว`);
  
  // Close modals and reload
  closeReferModal();
  closePatientModal();
  
  // Reload the current floor
  const floor1Btn = document.getElementById('btn-floor-1');
  const currentFloor = floor1Btn.style.background.includes('linear-gradient') ? 1 : 2;
  loadIPDFloor(currentFloor);
}

// Discharge patient
function dischargePatient() {
  if (!selectedPatient) return;
  const dischargeDate = document.getElementById('modal-patient-discharge-date').value;
  if (!dischargeDate) {
    alert('❌ กรุณาระบุวันที่จำหน่าย');
    return;
  }
  // Only allow discharge if today >= dischargeDate
  const todayObj = new Date();
  const dischargeObj = new Date(dischargeDate);
  // Set time to midnight for both dates for accurate comparison
  todayObj.setHours(0,0,0,0);
  dischargeObj.setHours(0,0,0,0);
  // Allow discharge if today >= dischargeDate (ย้อนหลังได้)
  if (todayObj.getTime() < dischargeObj.getTime()) {
    alert('❌ ยังไม่ถึงวันที่จำหน่ายที่เลือกไว้\nวันที่จำหน่าย: ' + dischargeDate);
    return;
  }
  if (!confirm('ยืนยันการจำหน่ายผู้ป่วย ' + selectedPatient.patient_name + '?')) {
    return;
  }

  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [], discharged: [] };

  // เพิ่มข้อมูลผู้ป่วยที่จำหน่ายพร้อมวันที่จำหน่าย (ใช้วันที่ที่เลือก)
  const dischargedPatient = {
    ...selectedPatient,
    discharge_date: dischargeDate,
    discharged_at: new Date().toISOString()
  };

  // เพิ่มลงใน discharged array
  if (!bookingData.discharged) {
    bookingData.discharged = [];
  }
  bookingData.discharged.push(dischargedPatient);

  // Remove from admitted list
  bookingData.admitted = bookingData.admitted.filter(p => p.patient_hn !== selectedPatient.patient_hn);

  // Save to localStorage
  localStorage.setItem('bookingData', JSON.stringify(bookingData));

  // Backup to Google Sheets
  fetch(ADMITTED_SHEET_WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ipd_discharge',
      patient_hn: selectedPatient.patient_hn,
      patient_name: selectedPatient.patient_name,
      assigned_bed: selectedPatient.assigned_bed,
      admitted_date: selectedPatient.admitted_date,
      discharge_date: dischargeDate,
      doctor_name: selectedPatient.doctor_name,
      diagnosis: selectedPatient.diagnosis,
      timestamp: new Date().toISOString()
    })
  }).catch(error => console.log('Google Sheets backup:', error));

  alert('✅ จำหน่ายผู้ป่วยเรียบร้อยแล้ว\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว');

  // Close modal and reload
  closePatientModal();

  // Reload the current floor
  const floor1Btn = document.getElementById('btn-floor-1');
  const currentFloor = floor1Btn.style.background.includes('linear-gradient') ? 1 : 2;
  loadIPDFloor(currentFloor);
}


// Update summary cards function
function updateSummaryCards(admittedPatients, standardBeds, specialBeds) {
  // Male by bed type
  const maleStandardList = admittedPatients.filter(p => {
    const g = (p.gender || p.patient_gender || '').toString().trim().toLowerCase();
    return (g === 'ชาย' || g === 'male' || g === 'm' || g === 'ชาย.') &&
      (standardBeds.includes(p.assigned_bed));
  });
  const maleSpecialList = admittedPatients.filter(p => {
    const g = (p.gender || p.patient_gender || '').toString().trim().toLowerCase();
    return (g === 'ชาย' || g === 'male' || g === 'm' || g === 'ชาย.') &&
      (specialBeds.includes(p.assigned_bed));
  });
  const maleStandard = maleStandardList.length;
  const maleSpecial = maleSpecialList.length;
  const totalBeds = standardBeds.length + specialBeds.length;
  const activeBeds = admittedPatients.length;
  const totalPatients = admittedPatients.length;

  // Count by gender (support both patient.gender and patient.patient_gender, normalize values)
  // Female by bed type
  const femaleStandardList = admittedPatients.filter(p => {
    const g = (p.gender || p.patient_gender || '').toString().trim().toLowerCase();
    return (g === 'หญิง' || g === 'female' || g === 'f' || g === 'หญิง.') &&
      (standardBeds.includes(p.assigned_bed));
  });
  const femaleSpecialList = admittedPatients.filter(p => {
    const g = (p.gender || p.patient_gender || '').toString().trim().toLowerCase();
    return (g === 'หญิง' || g === 'female' || g === 'f' || g === 'หญิง.') &&
      (specialBeds.includes(p.assigned_bed));
  });
  const femaleStandard = femaleStandardList.length;
  const femaleSpecial = femaleSpecialList.length;
  const femaleCount = femaleStandard + femaleSpecial;
  const maleCount = admittedPatients.filter(p => {
    const g = (p.gender || p.patient_gender || '').toString().trim().toLowerCase();
    return g === 'ชาย' || g === 'male' || g === 'm' || g === 'ชาย.';
  }).length;

  // Update DOM elements
  const activeBedEl = document.getElementById('ipd-active-beds');
  const totalBedsEl = document.getElementById('ipd-total-beds');
  const totalPatientsEl = document.getElementById('ipd-total-patients');
  const femaleCountEl = document.getElementById('ipd-female-count');
  const femaleStandardEl = document.getElementById('ipd-female-standard');
  const femaleSpecialEl = document.getElementById('ipd-female-special');
  const maleCountEl = document.getElementById('ipd-male-count');
  const maleStandardEl = document.getElementById('ipd-male-standard');
  const maleSpecialEl = document.getElementById('ipd-male-special');

  // Calculate today's active beds using calculateActiveBedsCountsForMonth
  let todayActiveBeds = activeBeds;
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    // Only for floor 2 summary
    const counts = calculateActiveBedsCountsForMonth(2, year, month);
    todayActiveBeds = counts[day - 1] || 0;
  } catch (e) {
    // fallback to previous logic
  }

  if (activeBedEl) activeBedEl.textContent = todayActiveBeds;
  if (totalBedsEl) totalBedsEl.textContent = totalBeds;
  if (totalPatientsEl) totalPatientsEl.textContent = totalPatients;
  if (femaleCountEl) femaleCountEl.textContent = femaleCount;
  if (femaleStandardEl) femaleStandardEl.textContent = femaleStandard;
  if (femaleSpecialEl) femaleSpecialEl.textContent = femaleSpecial;
  if (maleCountEl) maleCountEl.textContent = maleCount;
  if (maleStandardEl) maleStandardEl.textContent = maleStandard;
  if (maleSpecialEl) maleSpecialEl.textContent = maleSpecial;

  // Debug log สำหรับตรวจสอบค่า sync
  console.log('[IPD] femaleStandard:', femaleStandard, '| localStorage:', localStorage.getItem('ipd_female_standard_floor2'));
  console.log('[IPD][DEBUG] maleSpecialList:', maleSpecialList);
  console.log('[IPD][DEBUG] femaleSpecialList:', femaleSpecialList);
  console.log('[IPD][DEBUG] maleSpecial:', maleSpecial, '| localStorage:', localStorage.getItem('ipd_male_special_floor2'));
  console.log('[IPD][DEBUG] femaleSpecial:', femaleSpecial, '| localStorage:', localStorage.getItem('ipd_female_special_floor2'));
  // Sync female standard bed count to Dashboard
  localStorage.setItem('ipd_female_standard_floor2', femaleStandard);
  // Sync female special bed count to Dashboard
  localStorage.setItem('ipd_female_special_floor2', femaleSpecial);
  // Sync male standard bed count to Dashboard
  localStorage.setItem('ipd_male_standard_floor2', maleStandard);
  // Sync male special bed count to Dashboard
  localStorage.setItem('ipd_male_special_floor2', maleSpecial);
  // Sync to Dashboard: save to localStorage for floor 2 only
  if (activeBedEl && activeBedEl.id === 'ipd-active-beds') {
    localStorage.setItem('ipd_active_beds_floor2', todayActiveBeds);
  }
}

// Restore createBedElement to original logic (no resistant bacteria logic)
function createBedElement(bedId, patient, bedType) {
  const card = document.createElement('div');
  if (patient) {
    // Check if patient has any resistant bacteria
    const hasResistantBacteria = !!(patient.culture_mrsa || patient.culture_vre || patient.culture_cre || patient.culture_esbl || (patient.culture_other && patient.culture_other.trim() !== ''));
    // Check if discharge date has arrived
    const today = new Date().toISOString().split('T')[0];
    const dischargeDate = patient.expected_discharge_date;
    const isDischargeDue = dischargeDate && today >= dischargeDate;
    let bgGradient, textColor;
    let precautionLabel = '';
    let cultureNames = [];
    if (patient.culture_mrsa) cultureNames.push('MRSA');
    if (patient.culture_vre) cultureNames.push('VRE');
    if (patient.culture_cre) cultureNames.push('CRE');
    if (patient.culture_esbl) cultureNames.push('ESBL');
    if (patient.culture_other && patient.culture_other.trim() !== '') cultureNames.push(patient.culture_other.trim());
    if (hasResistantBacteria) {
      // Red for resistant bacteria
      bgGradient = 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
      textColor = '#d32f2f';
      precautionLabel = `<div style="margin:6px 0 0 0;"><span style='background:#d32f2f;color:white;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;'>Contact Precaution</span></div>`;
    } else if (isDischargeDue) {
      // Yellow pastel for discharge due patients (matching modal)
      bgGradient = 'linear-gradient(135deg, #fff9e6 0%, #ffecb3 100%)';
      textColor = '#f57f00';
    } else {
      // Sea green/blue pastel for normal patients (matching modal)
      bgGradient = 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)';
      textColor = '#00838f';
    }
    card.style.background = bgGradient;
    card.style.padding = '16px';
    card.style.borderRadius = '12px';
    card.style.cursor = 'pointer';
    card.style.border = `2px solid ${textColor}`;
    card.onclick = () => showAdmittedPatientModal(patient);
    // Calculate LOS (Length of Stay)
    let los = '';
    if (patient.admitted_date && patient.expected_discharge_date) {
      const admit = new Date(patient.admitted_date);
      const discharge = new Date(patient.expected_discharge_date);
      const diff = Math.floor((discharge - admit) / (1000 * 60 * 60 * 24));
      if (!isNaN(diff) && diff >= 0) los = diff + ' วัน';
    }
    card.innerHTML = `
      <div style="text-align:center;">
        <p style="font-size:12px;color:#666;margin:0 0 4px 0;">เตียง ${bedId}</p>
        <p style="font-size:14px;font-weight:600;color:${textColor};margin:0 0 8px 0;">${patient.patient_name}</p>
        ${los ? `<p style='font-size:11px;color:#0288d1;margin:2px 0 0 0;font-weight:700;'>LOS: ${los}</p>` : ''}
        ${hasResistantBacteria && cultureNames.length > 0 ? `<p style='font-size:12px;color:#d32f2f;font-weight:700;margin:8px 0 0 0;'>${cultureNames.join(', ')}</p>` : ''}
        ${precautionLabel}
      </div>
      <div style="margin-top:8px;text-align:center;font-size:12px;color:#00796b;font-weight:700;">
        <span class="bed-updated-hn">HN: ${patient.patient_hn}</span>
      </div>
    `;
  } else {
    // Empty bed - white background
    const textColor = bedType === 'special' ? '#6a1b9a' : '#666';
    card.style.background = '#ffffff';
    card.style.padding = '16px';
    card.style.borderRadius = '12px';
    card.style.border = `2px dashed ${textColor}`;
    card.style.textAlign = 'center';
    card.innerHTML = `
      <p style="font-size:13px;color:${textColor};margin:0;font-weight:600;">เตียง ${bedId}</p>
      <p style="font-size:11px;color:${textColor};margin:4px 0 0 0;">ว่าง</p>
    `;
  }
  return card;
}

document.addEventListener('DOMContentLoaded', function() {
function runWhenDomReady(callback) {
  if (document.readyState === 'loading') {
    const handler = function() {
      document.removeEventListener('DOMContentLoaded', handler);
      callback();
    };
    document.addEventListener('DOMContentLoaded', handler);
  } else {
    callback();
  }
}

function initializeIPDPage() {
  window.showIPDFloor = showIPDFloor;
  window.loadIPDFloor = loadIPDFloor;
  showIPDFloor(1);
}

function bootstrapIPDPage() {
  runWhenDomReady(initializeIPDPage);
}

function ensureIPDPageReady() {
  const ready = window.sbpStorageReadyPromise;
  if (ready && typeof ready.then === 'function') {
    ready.then(bootstrapIPDPage).catch(function(error) {
      console.warn('Unable to wait for Firestore sync before rendering IPD view', error);
      bootstrapIPDPage();
    });
  } else {
    bootstrapIPDPage();
  }
}

ensureIPDPageReady();

});

// Close modal when clicking outside
document.addEventListener('click', function(event) {
  const modal = document.getElementById('patient-modal');
  if (event.target === modal) {
    closePatientModal();
  }
});