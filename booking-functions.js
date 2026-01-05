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

// Google Apps Script endpoint for syncing booked bookings to Google Sheets
const BOOKED_SHEET_WEB_APP_URL = (window.SBPSheetEndpoints && window.SBPSheetEndpoints.booked) || 'https://script.google.com/macros/s/AKfycbw2CG9_2tZaM_Ommt3Z2HPmPoFH_2_FNtr1oLlXMaA9CyAs3qiTBtODQ2YB74NQ_ujo5w/exec';

// Google Apps Script endpoint for confirmed bookings
const CONFIRMED_SHEET_WEB_APP_URL = (window.SBPSheetEndpoints && window.SBPSheetEndpoints.confirmed) || 'https://script.google.com/macros/s/AKfycbx06ftWZO2wiPzDTFhMv7Vmnxh_PPqCcClx5d8gRoav9dvkikdX6ay1szCsD3bexx32eg/exec';

// Reschedule a confirmed booking: move from confirmed to booked if bed is available
function rescheduleConfirmedBooking(bookingId, newFormData) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  // Find the confirmed booking
  const idx = bookingData.confirmed.findIndex(b => b.id === bookingId);
  if (idx === -1) {
    alert('ไม่พบข้อมูลการจองที่ต้องการเลื่อนนัด');
    return false;
  }
  // Check bed availability for new date
  const bedAvailable = isBedAvailable(newFormData.assigned_bed, newFormData.admit_date, (() => {
    const d = new Date(newFormData.admit_date); d.setDate(d.getDate() + 21); return d;
  })());
  if (!bedAvailable) {
    // Show red draft or error
    showRescheduleError('ไม่สามารถเลื่อนนัดได้: เตียงไม่ว่างในวันที่เลือก');
    return false;
  }
  // Remove from confirmed
  const [booking] = bookingData.confirmed.splice(idx, 1);
  // Add to booked with updated info
  const newBooking = {
    ...booking,
    ...newFormData,
    status: 'booked',
    rescheduled_from: booking.id,
    booking_date: new Date().toISOString(),
    action_note: `เลื่อนนัดจาก Booking Confirmed โดย ${sessionStorage.getItem('app_user_name') || 'Unknown'}`
  };
  bookingData.booked.push(newBooking);
  // Save
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  // Trigger storage event manually for same-tab update
  window.dispatchEvent(new Event('storage'));
  updateBookedListDisplay && updateBookedListDisplay();
  return true;
}

// Show reschedule error (red draft)
function showRescheduleError(msg) {
  // You can customize this to show a red banner or modal in your UI
  const errorDiv = document.getElementById('reschedule-error');
  if (errorDiv) {
    errorDiv.innerText = msg;
    errorDiv.style.display = 'block';
    errorDiv.style.color = 'white';
    errorDiv.style.background = 'red';
    errorDiv.style.padding = '8px';
    errorDiv.style.margin = '8px 0';
    errorDiv.style.borderRadius = '4px';
  } else {
    alert(msg);
  }
}
// Booking Functions

// Mock patient database for autocomplete
const patientDatabase = {};

// Mock bed allocation data
const bedAllocationData = {
  'standard': ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'],
  'vip': ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']
};

// Check if bed is available for given date range
function isBedAvailable(bedId, startDate, endDate) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check booked patients (estimated 3 weeks stay)
  for (const booking of bookingData.booked) {
    if (booking.assigned_bed === bedId) {
      const bookingStart = new Date(booking.admit_date);
      const bookingEnd = new Date(bookingStart);
      bookingEnd.setDate(bookingEnd.getDate() + 21); // 3 weeks
      
      // Check for overlap
      if (!(end < bookingStart || start > bookingEnd)) {
        return false; // Overlaps
      }
    }
  }
  
  // Check admitted patients (use actual discharge date)
  for (const patient of bookingData.admitted) {
    if (patient.assigned_bed === bedId && patient.expected_discharge_date) {
      const admitStart = new Date(patient.admitted_date || patient.admit_date);
      const admitEnd = new Date(patient.expected_discharge_date);
      
      // Check for overlap
      if (!(end < admitStart || start > admitEnd)) {
        return false; // Overlaps
      }
    }
  }
  
  return true; // Available
}

// Auto-allocate bed based on availability
function autoAllocateBed(bedType, admitDate) {
  if (!admitDate) return null;
  
  const beds = bedAllocationData[bedType] || [];
  const startDate = new Date(admitDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 21); // Estimate 3 weeks for booking
  
  // Try each bed until we find an available one
  for (const bedId of beds) {
    if (isBedAvailable(bedId, startDate, endDate)) {
      return bedId;
    }
  }
  
  return null; // No bed available
}

// Check if bed is available for given date range
function isBedAvailable(bedId, startDate, endDate) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check booked patients (estimated 3 weeks stay)
  for (const booking of bookingData.booked) {
    if (booking.assigned_bed === bedId) {
      const bookingStart = new Date(booking.admit_date);
      const bookingEnd = new Date(bookingStart);
      bookingEnd.setDate(bookingEnd.getDate() + 21); // 3 weeks
      
      // Check for overlap
      if (!(end < bookingStart || start > bookingEnd)) {
        return false; // Overlaps
      }
    }
  }
  
  // Check admitted patients (use actual discharge date)
  for (const patient of bookingData.admitted) {
    if (patient.assigned_bed === bedId && patient.expected_discharge_date) {
      const admitStart = new Date(patient.admitted_date || patient.admit_date);
      const admitEnd = new Date(patient.expected_discharge_date);
      
      // Check for overlap
      if (!(end < admitStart || start > admitEnd)) {
        return false; // Overlaps
      }
    }
  }
  
  return true; // Available
}

// Auto-allocate bed based on availability
function autoAllocateBed(bedType, admitDate) {
  if (!admitDate) return null;
  
  const beds = bedAllocationData[bedType] || [];
  const startDate = new Date(admitDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 21); // Estimate 3 weeks for booking
  
  // Try each bed until we find an available one
  for (const bedId of beds) {
    if (isBedAvailable(bedId, startDate, endDate)) {
      return bedId;
    }
  }
  
  return null; // No bed available
}

// Storage for bookings (in real app, would be backend)
let bookingStorage = {
  booked: [],
  confirmed: [],
  admitted: [],
  cancelled: []
};

function refreshBookingStorageFromLocal() {
  const stored = localStorage.getItem('bookingData');
  if (!stored) {
    bookingStorage = { booked: [], confirmed: [], admitted: [], cancelled: [] };
    return;
  }
  try {
    const parsed = JSON.parse(stored) || {};
    bookingStorage = normalizeBookingDataset(parsed);
  } catch (error) {
    console.warn('Unable to parse bookingData from localStorage', error);
    bookingStorage = { booked: [], confirmed: [], admitted: [], cancelled: [] };
  }
}

function initializeBookingStorageSync() {
  refreshBookingStorageFromLocal();
}

function ensureBookingStorageReady() {
  const ready = window.sbpStorageReadyPromise;
  if (ready && typeof ready.then === 'function') {
    ready.then(initializeBookingStorageSync).catch(function(error) {
      console.warn('Unable to prepare booking storage from Firestore sync', error);
      initializeBookingStorageSync();
    });
  } else {
    initializeBookingStorageSync();
  }
}

function normalizeBookingDataset(data) {
  return {
    booked: Array.isArray(data && data.booked) ? data.booked : [],
    confirmed: Array.isArray(data && data.confirmed) ? data.confirmed : [],
    admitted: Array.isArray(data && data.admitted) ? data.admitted : [],
    cancelled: Array.isArray(data && data.cancelled) ? data.cancelled : []
  };
}

function handleBookingStorageBroadcast(key) {
  if (!key || key === 'bookingData') {
    refreshBookingStorageFromLocal();
  }
}

ensureBookingStorageReady();

window.addEventListener('storage', function(event) {
  handleBookingStorageBroadcast(event && typeof event.key === 'string' ? event.key : undefined);
});

window.addEventListener('sbpRemoteStorageSync', function(event) {
  const detail = event && event.detail;
  handleBookingStorageBroadcast(detail && typeof detail.key === 'string' ? detail.key : undefined);
});

window.addEventListener('sbpBookingDataSynced', function(event) {
  const dataset = normalizeBookingDataset(event && event.detail);
  bookingStorage = dataset;
});

// Load patient data when HN is entered
function loadPatientData(hn) {
  if (!hn || hn.trim() === '') return;
  
  // Load from localStorage
  const stored = localStorage.getItem('bookingData');
  if (!stored) return;
  
  const bookingData = JSON.parse(stored);
  const allPatients = [...(bookingData.booked || []), ...(bookingData.admitted || [])];
  
  // Find patient by HN
  const patient = allPatients.find(p => p.patient_hn === hn);
  
  if (patient) {
    // Auto-fill patient data from previous booking
    document.getElementById('patient-name').value = patient.patient_name || '';
    document.getElementById('patient-age').value = patient.patient_age || '';
    document.getElementById('patient-phone').value = patient.patient_phone || '';
    document.getElementById('patient-gender').value = patient.patient_gender || '';
    document.getElementById('diagnosis').value = patient.diagnosis || '';
    
    // Trigger diagnosis change to show/hide etc field
    handleDiagnosisChange();
    
    if (patient.diagnosis === 'etc' && patient.diagnosis_etc) {
      document.getElementById('diagnosis-etc').value = patient.diagnosis_etc;
    }
    
    // Auto-fill disease onset date
    if (patient.disease_onset_date) {
      document.getElementById('disease-onset-date').value = patient.disease_onset_date;
      calculateIMCStatus(); // Auto-calculate IMC status
    }
    
    // Auto-fill IMC status if available
    if (patient.imc_status) {
      document.getElementById('imc-status').value = patient.imc_status;
    }
    
    // Auto-fill doctor
    if (patient.attending_doctor) {
      const doctorSelect = document.getElementById('attending-doctor');
      // Check if doctor exists in dropdown
      let found = false;
      for (let i = 0; i < doctorSelect.options.length; i++) {
        if (doctorSelect.options[i].value === patient.attending_doctor) {
          doctorSelect.value = patient.attending_doctor;
          found = true;
          break;
        }
      }
      
      // If not found in dropdown, select "other" and fill in the name
      if (!found && patient.attending_doctor) {
        doctorSelect.value = 'other';
        handleDoctorChange(); // Show "other" field
        document.getElementById('attending-doctor-other').value = patient.attending_doctor;
      }
    }
    
    // Show notification
    alert(`✅ พบข้อมูลผู้ป่วย HN: ${hn}\nชื่อ: ${patient.patient_name}\n\nข้อมูลถูกกรอกอัตโนมัติแล้ว:\n- ชื่อ-สกุล\n- เพศ\n- เบอร์โทรศัพท์\n- Diagnosis\n- วันที่เกิดโรค\n- สถานะ IMC\n- แพทย์เจ้าของไข้`);
  } else if (patientDatabase[hn]) {
    // Fallback to demo database
    const demoPatient = patientDatabase[hn];
    document.getElementById('patient-name').value = demoPatient.name;
    document.getElementById('patient-age').value = demoPatient.age;
    document.getElementById('patient-phone').value = demoPatient.phone;
    if (demoPatient.gender) {
      document.getElementById('patient-gender').value = demoPatient.gender;
    }
  }
}

// Calculate IMC status based on disease onset date
function calculateIMCStatus() {
  const onsetDateInput = document.getElementById('disease-onset-date').value;
  if (!onsetDateInput) {
    document.getElementById('imc-status').value = '';
    return;
  }

  const onsetDate = new Date(onsetDateInput);
  const today = new Date();
  const diffTime = today - onsetDate;
  const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // approximate months

  if (diffMonths <= 6) {
    document.getElementById('imc-status').value = 'IMC';
  } else {
    document.getElementById('imc-status').value = 'Non-IMC';
  }
}

// Handle diagnosis change (show "other" field if "etc" selected)
function handleDiagnosisChange() {
  const diagnosis = document.getElementById('diagnosis').value;
  const otherContainer = document.getElementById('diagnosis-other-container');
  
  if (diagnosis === 'etc') {
    otherContainer.style.display = 'block';
  } else {
    otherContainer.style.display = 'none';
  }
}

// Handle doctor change (show "other" field if selected)
function handleDoctorChange() {
  const doctor = document.getElementById('attending-doctor').value;
  const otherContainer = document.getElementById('doctor-other-container');
  
  if (doctor === 'other') {
    otherContainer.style.display = 'block';
  } else {
    otherContainer.style.display = 'none';
  }
}

// Get available beds and assign one
function getAvailableBeds() {
  const bedType = document.getElementById('bed-type').value;
  const admitDate = document.getElementById('admit-date').value;
  const assignedBedField = document.getElementById('assigned-bed');
  
  if (!bedType || !admitDate) {
    assignedBedField.value = '';
    return;
  }

  // Use AI auto-allocation
  const allocatedBed = autoAllocateBed(bedType, admitDate);
  
  if (allocatedBed) {
    assignedBedField.value = allocatedBed;
  } else {
    assignedBedField.value = 'ไม่มีเตียงว่างในช่วงนี้';
    alert('⚠️ ไม่มีเตียงว่างสำหรับวันที่ ' + admitDate + '\nกรุณาเลือกวันอื่นหรือเปลี่ยนประเภทเตียง');
  }
  
  calculateWaitingTime();
}

// Calculate waiting time
function calculateWaitingTime() {
  const admitDateInput = document.getElementById('admit-date').value;
  if (!admitDateInput) {
    document.getElementById('waiting-time').value = '';
    return;
  }

  const admitDate = new Date(admitDateInput);
  const today = new Date();
  const diffTime = admitDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    document.getElementById('waiting-time').value = 'วันที่ผ่านไปแล้ว';
  } else {
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    document.getElementById('waiting-time').value = `${weeks} สัปดาห์ ${days} วัน`;
  }
}

// Handle lab package change
function handleLabChange() {
  const labPackage = document.getElementById('lab-package').value;
  const otherContainer = document.getElementById('lab-other-container');
  
  if (labPackage === 'other') {
    otherContainer.style.display = 'block';
  } else {
    otherContainer.style.display = 'none';
  }
}

// Handle appointment channel change (show refer hospital if "Seamless Refer" selected)
function handleChannelChange() {
  const channel = document.getElementById('appointment-channel').value;
  const referContainer = document.getElementById('refer-hospital-container');
  
  if (channel === 'Seamless Refer') {
    referContainer.style.display = 'block';
  } else {
    referContainer.style.display = 'none';
  }
}

// Validate form
function validateForm() {
  const hn = document.getElementById('patient-hn').value;
  const name = document.getElementById('patient-name').value;
  const age = document.getElementById('patient-age').value;
  const phone = document.getElementById('patient-phone').value;
  const gender = document.getElementById('patient-gender').value;
  const diagnosis = document.getElementById('diagnosis').value;
  const onsetDate = document.getElementById('disease-onset-date').value;
  const doctor = document.getElementById('attending-doctor').value;
  const admitDate = document.getElementById('admit-date').value;
  const bedType = document.getElementById('bed-type').value;
  const labPackage = document.getElementById('lab-package').value;
  const channel = document.getElementById('appointment-channel').value;

  if (!hn || !name || !age || !phone || !gender || !diagnosis || !onsetDate || !doctor || !admitDate || !bedType || !labPackage || !channel) {
    alert('โปรดกรอกข้อมูลที่จำเป็นทั้งหมด (มีเครื่องหมาย *)');
    return false;
  }

  if (channel === 'Seamless Refer' && !document.getElementById('refer-hospital').value) {
    alert('โปรดระบุโรงพยาบาลสำหรับ Seamless Refer');
    return false;
  }

  if (diagnosis === 'etc' && !document.getElementById('diagnosis-other').value) {
    alert('โปรดระบุ Diagnosis อื่นๆ');
    return false;
  }

  if (doctor === 'other' && !document.getElementById('doctor-other').value) {
    alert('โปรดระบุชื่อแพทย์');
    return false;
  }

  return true;
}

// Collect form data
function collectFormData() {
  const diagnosis = document.getElementById('diagnosis').value === 'etc' 
    ? document.getElementById('diagnosis-other').value 
    : document.getElementById('diagnosis').value;

  const doctor = document.getElementById('attending-doctor').value === 'other'
    ? document.getElementById('doctor-other').value
    : document.getElementById('attending-doctor').value;

  const labPackage = document.getElementById('lab-package').value === 'other'
    ? document.getElementById('lab-other').value
    : document.getElementById('lab-package').value;

  return {
    patient_hn: document.getElementById('patient-hn').value,
    patient_name: document.getElementById('patient-name').value,
    patient_age: document.getElementById('patient-age').value,
    patient_gender: document.getElementById('patient-gender').value,
    patient_phone: document.getElementById('patient-phone').value,
    diagnosis: diagnosis,
    diagnosis_etc: document.getElementById('diagnosis').value === 'etc' ? document.getElementById('diagnosis-other').value : null,
    disease_onset_date: document.getElementById('disease-onset-date').value,
    imc_status: document.getElementById('imc-status').value,
    attending_doctor: doctor,
    admit_date: document.getElementById('admit-date').value,
    bed_type: document.getElementById('bed-type').value,
    assigned_bed: document.getElementById('assigned-bed').value,
    ward_floor: document.getElementById('bed-type').value === 'standard' ? 2 : 2,
    waiting_time: document.getElementById('waiting-time').value,
    lab_package: labPackage,
    appointment_channel: document.getElementById('appointment-channel').value,
    refer_hospital: document.getElementById('refer-hospital').value || null,
    notes: document.getElementById('notes').value
  };
}

// Reset form
function resetForm() {
  document.getElementById('booking-form').reset();
  document.getElementById('imc-status').value = '';
  document.getElementById('assigned-bed').value = '';
  document.getElementById('waiting-time').value = '';
  document.getElementById('diagnosis-other-container').style.display = 'none';
  document.getElementById('doctor-other-container').style.display = 'none';
  document.getElementById('lab-other-container').style.display = 'none';
  document.getElementById('refer-hospital-container').style.display = 'none';
}

// Handle booking submission
function handleBookingSubmit() {
  if (!validateForm()) return;

  const formData = collectFormData();
  
  // Load existing data from localStorage
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  // Add to booked list
  const now = new Date();
  const newBooking = {
    ...formData,
    status: 'booked',
    id: 'BOOK_' + Date.now(),
    booking_date: now.toISOString(),
    created_date: now.toISOString(),
    logged_by: loggedUser,
    action_note: `จองเตียงโดย ${loggedUser}`
  };
  
  bookingData.booked.push(newBooking);
  bookingStorage.booked.push(newBooking);
  
  // Save to localStorage
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  window.dispatchEvent(new Event('storage'));

  // Backup to Google Sheets
  fetch(BOOKED_SHEET_WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...formData,
      status: 'booked',
      booking_date: new Date().toISOString(),
      backup_type: 'booking'
    })
  }).catch(error => console.log('Google Sheets backup:', error));

  // Mock: Update Status view (in real app, would call backend and redirect)
  alert(`✓ บันทึกการจองเตียงสำเร็จ\n\nHN: ${formData.patient_hn}\nชื่อ: ${formData.patient_name}\nวันที่ Admit: ${formData.admit_date}\nเตียง: ${formData.assigned_bed}\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว`);
  
  resetForm();
}

// Handle admit submission
function handleAdmitSubmit() {
  if (!validateForm()) return;

  const formData = collectFormData();
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  // Add directly to confirmed list (skip booking step)
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { 
    booked: [], 
    confirmed: [], 
    admitted: [], 
    cancelled: [] 
  };
  
  const confirmTimestamp = new Date().toISOString();
  const confirmedRecord = {
    ...formData,
    booking_date: confirmTimestamp,
    confirm_date: confirmTimestamp,
    call_note: 'จองผ่านระบบ - ไม่ต้องโทรยืนยัน',
    id: 'BOOK_' + Date.now(),
    logged_by: loggedUser,
    action_note: `จองเตียง Admit โดย ${loggedUser}`
  };
  bookingData.confirmed.push(confirmedRecord);
  bookingStorage.confirmed.push(confirmedRecord);
  
  // Save to localStorage
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  window.dispatchEvent(new Event('storage'));

  // Backup to Google Sheets
  fetch(CONFIRMED_SHEET_WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...formData,
      status: 'confirmed',
      booking_date: new Date().toISOString(),
      confirm_date: new Date().toISOString(),
      backup_type: 'confirmed'
    })
  }).catch(error => console.log('Google Sheets backup:', error));

  const admitDateThai = new Date(formData.admit_date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  alert(`✓ บันทึกการจองเตียง Admit สำเร็จ\n\nHN: ${formData.patient_hn}\nชื่อ: ${formData.patient_name}\nเตียง: ${formData.assigned_bed}\nวันที่ Admit: ${admitDateThai}\n\nข้อมูลถูกบันทึกใน "Booking Confirmed" แล้ว\nสามารถส่ง Admit ได้เมื่อถึงวันที่กำหนด\n\n✓ ข้อมูลถูกสำรองลง Google Sheets แล้ว`);
  
  // Just reset form, don't reload or redirect
  resetForm();
}

// Update booked list display (would update Status page)
function updateBookedListDisplay() {
  if (typeof window !== 'undefined' && window.parent) {
    // If in iframe or modal, notify parent
    window.parent.postMessage({
      type: 'bookingUpdate',
      data: bookingStorage.booked
    }, '*');
  }
  // Store in localStorage for cross-page communication
  localStorage.setItem('bookingData', JSON.stringify({
    booked: bookingStorage.booked,
    confirmed: bookingStorage.confirmed,
    admitted: bookingStorage.admitted,
    cancelled: bookingStorage.cancelled
  }));
  window.dispatchEvent(new Event('storage'));
}

// Update waiting list display
function updateWaitingListDisplay() {
  if (typeof window !== 'undefined' && window.parent) {
    window.parent.postMessage({
      type: 'admitUpdate',
      data: bookingStorage.admitted
    }, '*');
  }
  // Store in localStorage for cross-page communication
  localStorage.setItem('bookingData', JSON.stringify({
    booked: bookingStorage.booked,
    confirmed: bookingStorage.confirmed,
    admitted: bookingStorage.admitted,
    cancelled: bookingStorage.cancelled
  }));
  window.dispatchEvent(new Event('storage'));
}

function exportBookingDataAsJSON() {
  try {
    const stored = localStorage.getItem('bookingData');
    const data = stored ? JSON.parse(stored) : { booked: [], confirmed: [], admitted: [], cancelled: [] };
    const safeData = {
      booked: Array.isArray(data.booked) ? data.booked : [],
      confirmed: Array.isArray(data.confirmed) ? data.confirmed : [],
      admitted: Array.isArray(data.admitted) ? data.admitted : [],
      cancelled: Array.isArray(data.cancelled) ? data.cancelled : []
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `booking-data-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export booking data error:', error);
    alert('ไม่สามารถส่งออกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  }
}

function triggerBookingJSONImport() {
  const fileInput = document.getElementById('booking-json-input');
  if (fileInput) {
    fileInput.click();
  }
}

function handleBookingJSONImport(event) {
  const { target } = event || {};
  const file = target && target.files ? target.files[0] : undefined;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function onFileLoad(loadEvent) {
    try {
      const result = loadEvent && loadEvent.target ? loadEvent.target.result : '{}';
      const data = JSON.parse(result);
      const merged = normalizeBookingDataset(data);
      localStorage.setItem('bookingData', JSON.stringify(merged));
      window.dispatchEvent(new Event('storage'));
      bookingStorage = merged;
      if (typeof window.sbpBackupBookingDatasetToSheets === 'function') {
        window.sbpBackupBookingDatasetToSheets(merged);
      }
      if (typeof window.sbpSyncBookingDataFromSheets === 'function') {
        setTimeout(function() {
          window.sbpSyncBookingDataFromSheets({ updateLocalStorage: true, emitEvent: true });
        }, 1500);
      }
      alert('นำเข้าข้อมูลสำเร็จแล้ว ข้อมูลจองเตียงถูกอัปเดตเรียบร้อย');
    } catch (error) {
      console.error('Import booking data error:', error);
      alert('ไฟล์ไม่ถูกต้องหรืออ่านไม่ได้ กรุณาตรวจสอบแล้วลองใหม่');
    } finally {
      if (target) {
        target.value = '';
      }
    }
  };
  reader.readAsText(file, 'utf-8');
}

if (typeof window.sbpSyncBookingDataFromSheets === 'function') {
  window.sbpSyncBookingDataFromSheets({ updateLocalStorage: true, emitEvent: true }).catch(function(error) {
    console.warn('Booking page sheet sync error:', error);
  });
}

// Export functions to global scope for HTML inline event handlers
window.loadPatientData = loadPatientData;
window.handleDiagnosisChange = handleDiagnosisChange;
window.calculateIMCStatus = calculateIMCStatus;
window.calculateWaitingTime = calculateWaitingTime;
window.getAvailableBeds = getAvailableBeds;
window.handleLabChange = handleLabChange;
window.handleChannelChange = handleChannelChange;
window.handleBookingSubmit = handleBookingSubmit;
window.exportBookingDataAsJSON = exportBookingDataAsJSON;
window.triggerBookingJSONImport = triggerBookingJSONImport;
window.handleBookingJSONImport = handleBookingJSONImport;