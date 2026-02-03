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

// ฟังก์ชันสำหรับ Dashboard: แสดงจำนวนผู้ป่วย Admit แยกประเภทเตียง
function updateDashboardAdmittedCards() {
  let standard = 0;
  let vip = 0;
  if (window.allBookings && Array.isArray(window.allBookings)) {
    window.allBookings.forEach(b => {
      if (b.status === 'occupied' && b.admitted === true) {
        if (b.bed_type === 'standard') standard++;
        else if (b.bed_type === 'vip') vip++;
      }
    });
  }
  const stdEl = document.getElementById('dashboard-standard-admitted');
  const vipEl = document.getElementById('dashboard-vip-admitted');
  if (stdEl) stdEl.textContent = standard;
  if (vipEl) vipEl.textContent = vip;
}

// เรียกใช้เมื่อโหลดหน้า Dashboard และเมื่อข้อมูลเปลี่ยน
document.addEventListener('DOMContentLoaded', updateDashboardAdmittedCards);
if (window.dataHandler && typeof window.dataHandler.onDataChanged === 'function') {
  const orig = window.dataHandler.onDataChanged;
  window.dataHandler.onDataChanged = function(data) {
    orig.call(this, data);
    updateDashboardAdmittedCards();
  };
}
const defaultConfig = {
  hospital_name: "โรงพยาบาลเวชชารักษ์ ลำปาง",
  department_name: "เวชศาสตร์ฟื้นฟู - งานการพยาบาลผู้ป่วยนอก",
  system_title: "ระบบจองเตียงผู้ป่วย",
  primary_color: "#4dd0e1",
  secondary_color: "#66bb6a",
  text_color: "#00796b",
  background_color: "#e0f2f7",
  accent_color: "#80deea"
};

let currentRecordCount = 0;
let allBookings = [];
let patientDataCache = {};

const BEDS = {
  standard: ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'],
  vip: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']
};

let bedStatusChart = null;
let diagnosisChart = null;
let imcChart = null;

const dataHandler = {
  onDataChanged(data) {
    allBookings = data;
    currentRecordCount = data.length;
    updateBedDisplay(data);
    updateStatusView(data);
    updateRegistryView(data);
    updateArchiveView(data);
    updatePredictView(data);
  }
};

async function onConfigChange(config) {
  const hospitalName = config.hospital_name || defaultConfig.hospital_name;
  const departmentName = config.department_name || defaultConfig.department_name;
  const systemTitle = config.system_title || defaultConfig.system_title;

  document.getElementById('hospital-name').textContent = hospitalName;
  document.getElementById('department-name').textContent = departmentName;
  document.getElementById('system-title').textContent = systemTitle;
}

async function initApp() {
  // dataSdk is expected to be provided by the hosting environment; if not present, we'll still allow local testing.
  const initResult = (window.dataSdk && window.dataSdk.init) ? await window.dataSdk.init(dataHandler) : { isOk: true };
  if (!initResult.isOk) {
    showToast('เกิดข้อผิดพลาดในการเริ่มต้นระบบ', 'error');
    return;
  }

  if (window.elementSdk && window.elementSdk.init) {
    window.elementSdk.init({
      defaultConfig,
      onConfigChange,
      mapToCapabilities: (config) => ({
        recolorables: [],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) => new Map([
        ['hospital_name', config.hospital_name || defaultConfig.hospital_name],
        ['department_name', config.department_name || defaultConfig.department_name],
        ['system_title', config.system_title || defaultConfig.system_title]
      ])
    });
  }

    // Show user management menu only for role full
    const userRole = (window.sbpAccessControl && window.sbpAccessControl.getUserRole()) || sessionStorage.getItem('app_user_role');
    const userMenu = document.getElementById('user-management-menu');
    if (userMenu) {
      if (userRole === 'admin') {
        userMenu.style.display = 'inline-block';
        userMenu.addEventListener('click', function(e) {
          e.preventDefault();
          showUserManagementModal();
        });
      } else {
        userMenu.style.display = 'none';
      }
    }

  const today = new Date().toISOString().split('T')[0];
  const admitDateEl = document.getElementById('admit-date');
  // Simple modal for user management (placeholder)
  function showUserManagementModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    modalTitle.textContent = 'จัดการผู้ใช้งาน';
    modalBody.innerHTML = '<p>ฟีเจอร์จัดการผู้ใช้งาน (สำหรับ admin เท่านั้น)</p>';
    modal.classList.add('active');
  }
  if (admitDateEl) admitDateEl.value = today;

  // Event listeners for form fields
  const patientHnEl = document.getElementById('patient-hn');
  if (patientHnEl) patientHnEl.addEventListener('blur', handleHNChange);
  const diagnosisEl = document.getElementById('diagnosis');
  if (diagnosisEl) diagnosisEl.addEventListener('change', handleDiagnosisChange);
  const attendingDoctorEl = document.getElementById('attending-doctor');
  if (attendingDoctorEl) attendingDoctorEl.addEventListener('change', handleDoctorChange);
  const labPackageEl = document.getElementById('lab-package');
  if (labPackageEl) labPackageEl.addEventListener('change', handleLabChange);
  const appointmentChannelEl = document.getElementById('appointment-channel');
  if (appointmentChannelEl) appointmentChannelEl.addEventListener('change', handleChannelChange);
  const diseaseOnsetEl = document.getElementById('disease-onset-date');
  if (diseaseOnsetEl) diseaseOnsetEl.addEventListener('change', calculateIMCStatus);
  const bedTypeEl = document.getElementById('bed-type');
  if (bedTypeEl) bedTypeEl.addEventListener('change', handleBedTypeChange);
  if (admitDateEl) admitDateEl.addEventListener('change', calculateWaitingTime);

  // Button listeners
  const btnBooking = document.getElementById('btn-booking');
  if (btnBooking) btnBooking.addEventListener('click', handleBookingSubmit);
  const btnAdmit = document.getElementById('btn-admit');
  if (btnAdmit) btnAdmit.addEventListener('click', handleAdmitSubmit);


  // If there is a dataSdk.query or fetch capability, we could load initial data here. For local demo, keep allBookings empty.
}

function handleHNChange() {
  const hn = document.getElementById('patient-hn').value.trim();
  if (hn && patientDataCache[hn]) {
    const patient = patientDataCache[hn];
    document.getElementById('patient-name').value = patient.patient_name;
    document.getElementById('patient-age').value = patient.patient_age;
    document.getElementById('patient-phone').value = patient.patient_phone;

    // โหลดวันที่เกิดโรค
    if (patient.disease_onset_date) {
      document.getElementById('disease-onset-date').value = patient.disease_onset_date;
      calculateIMCStatus(); // คำนวณสถานะ IMC ทันที
    }

    if (patient.diagnosis !== 'etc') {
      document.getElementById('diagnosis').value = patient.diagnosis;
    } else {
      document.getElementById('diagnosis').value = 'etc';
      document.getElementById('diagnosis-other-container').style.display = 'block';
      document.getElementById('diagnosis-other').value = patient.diagnosis_other || '';
    }
    if (patient.attending_doctor !== 'other') {
      document.getElementById('attending-doctor').value = patient.attending_doctor;
    } else {
      document.getElementById('attending-doctor').value = 'other';
      document.getElementById('doctor-other-container').style.display = 'block';
      document.getElementById('doctor-other').value = patient.doctor_other || '';
    }
    showToast('โหลดข้อมูลผู้ป่วยจาก HN เดิม');
  }
}

function handleDiagnosisChange() {
  const value = document.getElementById('diagnosis').value;
  const container = document.getElementById('diagnosis-other-container');
  container.style.display = value === 'etc' ? 'block' : 'none';
}

function handleDoctorChange() {
  const value = document.getElementById('attending-doctor').value;
  const container = document.getElementById('doctor-other-container');
  container.style.display = value === 'other' ? 'block' : 'none';
}

function handleLabChange() {
  const value = document.getElementById('lab-package').value;
  const container = document.getElementById('lab-other-container');
  container.style.display = value === 'other' ? 'block' : 'none';
}

function handleChannelChange() {
  const value = document.getElementById('appointment-channel').value;
  const container = document.getElementById('refer-hospital-container');
  container.style.display = value === 'Seamless Refer' ? 'block' : 'none';
}

function calculateIMCStatus() {
  const diseaseDate = document.getElementById('disease-onset-date').value;
  if (!diseaseDate) {
    document.getElementById('imc-status').value = '';
    return;
  }

  const onset = new Date(diseaseDate);
  const today = new Date();
  const monthsDiff = (today - onset) / (1000 * 60 * 60 * 24 * 30.44);

  if (monthsDiff <= 6) {
    document.getElementById('imc-status').value = 'IMC';
  } else {
    document.getElementById('imc-status').value = 'non-IMC';
  }
}

function handleBedTypeChange() {
  const bedType = document.getElementById('bed-type').value;
  const admitDate = document.getElementById('admit-date').value;

  if (!bedType || !admitDate) {
    document.getElementById('assigned-bed').value = '';
    return;
  }

  // จัดสรรเตียงโดย AI (หาเตียงว่างเร็วที่สุด)
  const availableBeds = getAvailableBedsForDate(admitDate, bedType);
  if (availableBeds.length > 0) {
    document.getElementById('assigned-bed').value = availableBeds[0];
  } else {
    document.getElementById('assigned-bed').value = 'ไม่มีเตียงว่าง';
  }

  calculateWaitingTime();
}

function getAvailableBedsForDate(admitDate, bedType) {
  const bedsToCheck = bedType === 'standard' ? BEDS.standard : BEDS.vip;
  const bookedBeds = allBookings
    .filter(b => b.admit_date === admitDate && b.booking_status === 'booked')
    .map(b => b.bed_id);

  return bedsToCheck.filter(bed => !bookedBeds.includes(bed));
}

function calculateWaitingTime() {
  const admitDate = document.getElementById('admit-date').value;
  if (!admitDate) {
    document.getElementById('waiting-time').value = '';
    return;
  }

  const admit = new Date(admitDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  admit.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((admit - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    document.getElementById('waiting-time').value = 'วันที่ผ่านมาแล้ว';
  } else if (diffDays === 0) {
    document.getElementById('waiting-time').value = 'วันนี้';
  } else {
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    let timeText = '';
    if (weeks > 0) timeText += `${weeks} สัปดาห์`;
    if (days > 0) timeText += ` ${days} วัน`;
    document.getElementById('waiting-time').value = timeText.trim();
  }
}

async function handleBookingSubmit() {
  if (!validateForm()) return;

  if (currentRecordCount >= 999) {
    showToast('ถึงขีดจำกัดการจองแล้ว (999 รายการ)', 'error');
    return;
  }

  const btn = document.getElementById('btn-booking');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const bookingData = collectFormData();
  bookingData.booking_status = 'booked';
  bookingData.status = 'booked';

  // Cache patient data
  patientDataCache[bookingData.patient_hn] = {
    patient_name: bookingData.patient_name,
    patient_age: bookingData.patient_age,
    patient_phone: bookingData.patient_phone,
    diagnosis: bookingData.diagnosis,
    diagnosis_other: bookingData.diagnosis_other,
    attending_doctor: bookingData.attending_doctor,
    doctor_other: bookingData.doctor_other,
    disease_onset_date: bookingData.disease_onset_date
  };

  const result = (window.dataSdk && window.dataSdk.create) ? await window.dataSdk.create(bookingData) : { isOk: true };

  if (result.isOk) {
    showToast('จองเตียงเรียบร้อยแล้ว');
    resetForm();
  } else {
    showToast('เกิดข้อผิดพลาดในการจองเตียง', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'จองเตียง';
}

async function handleAdmitSubmit() {
  if (!validateForm()) return;

  if (currentRecordCount >= 999) {
    showToast('ถึงขีดจำกัดการจองแล้ว (999 รายการ)', 'error');
    return;
  }

  const btn = document.getElementById('btn-admit');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const bookingData = collectFormData();
  bookingData.booking_status = 'waiting';
  bookingData.status = 'occupied';
  bookingData.transfer_status = 'waiting';

  // Cache patient data
  patientDataCache[bookingData.patient_hn] = {
    patient_name: bookingData.patient_name,
    patient_age: bookingData.patient_age,
    patient_phone: bookingData.patient_phone,
    diagnosis: bookingData.diagnosis,
    diagnosis_other: bookingData.diagnosis_other,
    attending_doctor: bookingData.attending_doctor,
    doctor_other: bookingData.doctor_other,
    disease_onset_date: bookingData.disease_onset_date
  };

  const result = (window.dataSdk && window.dataSdk.create) ? await window.dataSdk.create(bookingData) : { isOk: true };

  if (result.isOk) {
    showToast('บันทึกข้อมูล Admit เรียบร้อยแล้ว');
    resetForm();
  } else {
    showToast('เกิดข้อผิดพลาดในการ Admit', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Admit';
}

function validateForm() {
  const requiredFields = [
    'patient-hn', 'patient-name', 'patient-age', 'patient-phone',
    'diagnosis', 'disease-onset-date', 'attending-doctor',
    'admit-date', 'bed-type', 'lab-package', 'appointment-channel'
  ];

  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      if (field) field.focus();
      return false;
    }
  }

  if (document.getElementById('diagnosis').value === 'etc' && !document.getElementById('diagnosis-other').value.trim()) {
    showToast('กรุณาระบุ Diagnosis อื่นๆ', 'error');
    return false;
  }

  if (document.getElementById('attending-doctor').value === 'other' && !document.getElementById('doctor-other').value.trim()) {
    showToast('กรุณาระบุแพทย์เจ้าของไข้อื่นๆ', 'error');
    return false;
  }

  if (document.getElementById('lab-package').value === 'other' && !document.getElementById('lab-other').value.trim()) {
    showToast('กรุณาระบุ Lab อื่นๆ', 'error');
    return false;
  }

  if (document.getElementById('appointment-channel').value === 'Seamless Refer' && !document.getElementById('refer-hospital').value.trim()) {
    showToast('กรุณาระบุชื่อโรงพยาบาล', 'error');
    return false;
  }

  const assignedBed = document.getElementById('assigned-bed').value;
  if (!assignedBed || assignedBed === 'ไม่มีเตียงว่าง') {
    showToast('ไม่สามารถจัดสรรเตียงได้ กรุณาเลือกวันที่หรือประเภทเตียงใหม่', 'error');
    return false;
  }

  return true;
}

function collectFormData() {
  const diagnosis = document.getElementById('diagnosis').value;
  const diagnosisValue = diagnosis === 'etc' ? document.getElementById('diagnosis-other').value : diagnosis;
  
  const doctor = document.getElementById('attending-doctor').value;
  const doctorValue = doctor === 'other' ? document.getElementById('doctor-other').value : doctor;
  
  const lab = document.getElementById('lab-package').value;
  const labValue = lab === 'other' ? document.getElementById('lab-other').value : lab;
  
  const channel = document.getElementById('appointment-channel').value;
  const referHospital = channel === 'Seamless Refer' ? document.getElementById('refer-hospital').value : '';

  return {
    patient_hn: document.getElementById('patient-hn').value.trim(),
    patient_name: document.getElementById('patient-name').value.trim(),
    patient_age: document.getElementById('patient-age').value,
    patient_phone: document.getElementById('patient-phone').value.trim(),
    diagnosis: diagnosis,
    diagnosis_other: diagnosis === 'etc' ? document.getElementById('diagnosis-other').value.trim() : '',
    diagnosis_display: diagnosisValue,
    disease_onset_date: document.getElementById('disease-onset-date').value,
    imc_status: document.getElementById('imc-status').value,
    attending_doctor: doctor,
    doctor_other: doctor === 'other' ? document.getElementById('doctor-other').value.trim() : '',
    doctor_display: doctorValue,
    admit_date: document.getElementById('admit-date').value,
    bed_type: document.getElementById('bed-type').value,
    bed_id: document.getElementById('assigned-bed').value,
    waiting_time: document.getElementById('waiting-time').value,
    lab_package: lab,
    lab_other: lab === 'other' ? document.getElementById('lab-other').value.trim() : '',
    lab_display: labValue,
    appointment_channel: channel,
    refer_hospital: referHospital,
    notes: document.getElementById('notes').value.trim(),
    created_at: new Date().toISOString()
  };
}

function resetForm() {
  const form = document.getElementById('booking-form');
  if (form) form.reset();
  const els = ['diagnosis-other-container','doctor-other-container','lab-other-container','refer-hospital-container'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const imc = document.getElementById('imc-status'); if (imc) imc.value = '';
  const assigned = document.getElementById('assigned-bed'); if (assigned) assigned.value = '';
  const wait = document.getElementById('waiting-time'); if (wait) wait.value = '';
  const today = new Date().toISOString().split('T')[0];
  const admitDateEl = document.getElementById('admit-date'); if (admitDateEl) admitDateEl.value = today;
}



function updateBedStatusChart(available, occupied) {
  const ctx = document.getElementById('bed-status-chart');
  if (!ctx) return;

  // อัปเดท legend
  const legendAvailable = document.getElementById('legend-available'); if (legendAvailable) legendAvailable.textContent = available;
  const legendOccupied = document.getElementById('legend-occupied'); if (legendOccupied) legendOccupied.textContent = occupied;

  if (bedStatusChart) {
    bedStatusChart.data.datasets[0].data = [available, occupied];
    bedStatusChart.update();
    return;
  }

  bedStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['เตียงว่าง', 'เตียงไม่ว่าง'],
      datasets: [{
        data: [available, occupied],
        backgroundColor: ['#66bb6a', '#ff8a65'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) { return context.label + ': ' + context.parsed + ' เตียง'; }
          }
        }
      }
    }
  });
}

function updateDiagnosisChart(data) {
  const ctx = document.getElementById('diagnosis-chart');
  if (!ctx) return;

  const admittedPatients = data.filter(b => b.admitted === true);
  const diagnosisCount = {};
  admittedPatients.forEach(booking => {
    const diagnosis = booking.diagnosis_display || 'ไม่ระบุ';
    diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + 1;
  });

  const labels = Object.keys(diagnosisCount);
  const values = Object.values(diagnosisCount);

  const colors = [
    '#9c27b0', '#f57f17', '#00796b', '#d32f2f', 
    '#1976d2', '#388e3c', '#f57c00', '#c2185b'
  ];

  const legendContainer = document.getElementById('diagnosis-legend');
  if (legendContainer) {
    legendContainer.innerHTML = '';
    if (labels.length === 0) {
      legendContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666; font-size: 13px;">ยังไม่มีข้อมูล</p>';
    } else {
      labels.forEach((label, index) => {
        const legendItem = document.createElement('div');
        legendItem.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        legendItem.innerHTML = `
          <div style="width: 16px; height: 16px; border-radius: 4px; background: ${colors[index % colors.length]}; flex-shrink: 0;"></div>
          <div style="flex: 1; min-width: 0;">
            <p style="font-size: 12px; color: #333; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${label}</p>
            <p style="font-size: 14px; font-weight: 600; color: #333; margin: 0;">${values[index]} คน</p>
          </div>
        `;
        legendContainer.appendChild(legendItem);
      });
    }
  }

  if (diagnosisChart) {
    diagnosisChart.data.labels = labels;
    diagnosisChart.data.datasets[0].data = values;
    diagnosisChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
    diagnosisChart.update();
    return;
  }

  diagnosisChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนผู้ป่วย',
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(context) { return context.parsed.y + ' คน'; } } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, callback: function(value) { return value + ' คน'; } } },
        x: { ticks: { display: false } }
      }
    }
  });
}

function updateIMCChart(data) {
  const ctx = document.getElementById('imc-chart');
  if (!ctx) return;

  const activePatients = data.filter(b => 
    b.admitted === true || 
    (b.booking_status === 'booked' && !b.admitted)
  );

  const imcCount = activePatients.filter(b => b.imc_status === 'IMC').length;
  const nonImcCount = activePatients.filter(b => b.imc_status === 'non-IMC').length;
  const total = imcCount + nonImcCount;

  const legendImc = document.getElementById('legend-imc'); if (legendImc) legendImc.textContent = imcCount;
  const legendNonImc = document.getElementById('legend-non-imc'); if (legendNonImc) legendNonImc.textContent = nonImcCount;
  const imcTotalEl = document.getElementById('imc-total'); if (imcTotalEl) imcTotalEl.textContent = total;

  if (imcChart) {
    imcChart.data.datasets[0].data = [imcCount, nonImcCount];
    imcChart.update();
    return;
  }

  imcChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['IMC', 'Non-IMC'],
      datasets: [{
        data: [imcCount, nonImcCount],
        backgroundColor: ['#9c27b0', '#f57f17'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(context) { return context.label + ': ' + context.parsed + ' คน'; } } }
      }
    }
  });
}

function updateBedDisplay(data) {
  const standardContainer = document.getElementById('standard-beds');
  const vipContainer = document.getElementById('vip-beds');
  
  if (standardContainer) standardContainer.innerHTML = '';
  if (vipContainer) vipContainer.innerHTML = '';

  BEDS.standard.forEach(bedId => {
    const booking = data.find(b => b.bed_id === bedId && b.status === 'occupied' && b.admitted === true);
    const bedCard = createBedCard(bedId, booking);
    if (standardContainer) standardContainer.appendChild(bedCard);
  });

  BEDS.vip.forEach(bedId => {
    const booking = data.find(b => b.bed_id === bedId && b.status === 'occupied' && b.admitted === true);
    const bedCard = createBedCard(bedId, booking);
    if (vipContainer) vipContainer.appendChild(bedCard);
  });
}

function createBedCard(bedId, booking) {
  const card = document.createElement('div');
  const isOccupied = booking !== undefined;
  
  card.className = `bed-card ${isOccupied ? 'bed-occupied' : 'bed-available'}`;
  card.style.cssText = 'padding: 16px; border-radius: 12px; text-align: center;';
  
  if (isOccupied) {
    card.onclick = () => showBedDetails(booking);
  }

  const icon = isOccupied ? 
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#bf360c" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>' :
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00796b" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
  
  card.innerHTML = `
    <div style="margin-bottom: 8px;">${icon}</div>
    <p style="font-size: 18px; font-weight: 600; color: ${isOccupied ? '#bf360c' : '#00796b'}; margin: 8px 0;">${bedId}</p>
    <p style="font-size: 13px; color: ${isOccupied ? '#bf360c' : '#00796b'}; margin: 0;">${isOccupied ? 'ไม่ว่าง' : 'ว่าง'}</p>
  `;
  
  return card;
}

function showBedDetails(booking) {
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = `ข้อมูลเตียง ${booking.bed_id}`;
  modalBody.innerHTML = `
    <div style="margin-bottom: 12px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 4px;">ชื่อผู้ป่วย</p>
      <p style="font-size: 16px; font-weight: 500; color: #333;">${booking.patient_name}</p>
    </div>
    <div style="margin-bottom: 12px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 4px;">HN</p>
      <p style="font-size: 16px; font-weight: 500; color: #333;">${booking.patient_hn}</p>
    </div>
    <div style="margin-bottom: 12px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 4px;">วันที่ Admit</p>
      <p style="font-size: 16px; font-weight: 500; color: #333;">${formatDate(booking.admit_date)}</p>
    </div>
    ${booking.diagnosis_display ? `
    <div style="margin-bottom: 12px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 4px;">Diagnosis</p>
      <p style="font-size: 16px; font-weight: 500; color: #333;">${booking.diagnosis_display}</p>
    </div>` : ''}
    ${booking.notes ? `
    <div style="margin-bottom: 12px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 4px;">หมายเหตุ</p>
      <p style="font-size: 16px; font-weight: 500; color: #333;">${booking.notes}</p>
    </div>` : ''}
  `;
  
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

function updateStatusView(data) {
  updateBookedTab(data);
  updateConfirmedTab(data);
  updateWaitingTab(data);
}

function updateBookedTab(data) {
  const content = document.getElementById('status-booked');
  if (!content) return;
  const booked = data.filter(b => b.booking_status === 'booked' && !b.call_status);
  
  if (booked.length === 0) {
    content.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">ยังไม่มีผู้ป่วยที่จองเตียง</p>';
    return;
  }

  const sorted = [...booked].sort((a, b) => new Date(a.admit_date) - new Date(b.admit_date));

  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="background: linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%);' + "'>";
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">ลำดับ</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">HN</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">ชื่อผู้ป่วย</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">เตียง</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">วันนัด Admit</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">Diagnosis</th>';
  html += '<th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #00796b;">จัดการ</th>';
  html += '</tr></thead><tbody>';

  sorted.forEach((booking, index) => {
    html += `<tr style="border-bottom: 1px solid #e0e0e0; ${index % 2 === 0 ? 'background: #f9f9f9;' : ''}">`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333; font-weight: 600;">${index + 1}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_hn}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_name}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.bed_id}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${formatDate(booking.admit_date)}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.diagnosis_display || '-'}</td>`;
    html += `<td style="padding: 12px; text-align: center;">`;
    html += `<button onclick="showCallConfirm('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #4dd0e1 0%, #66bb6a 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; margin-right: 4px;">โทร Confirm</button>`;
    html += `<button onclick="showCancelBooking('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">ยกเลิก</button>`;
    html += `</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

function updateConfirmedTab(data) {
  const content = document.getElementById('status-confirmed');
  if (!content) return;
  const confirmed = data.filter(b => b.booking_status === 'booked' && b.call_status && b.transfer_status !== 'waiting');
  
  if (confirmed.length === 0) {
    content.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">ยังไม่มีข้อมูลการโทร Confirm</p>';
    return;
  }

  const sorted = [...confirmed].sort((a, b) => new Date(a.admit_date) - new Date(b.admit_date));

  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="background: linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%);' + "'>";
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">HN</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">ชื่อผู้ป่วย</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">เตียง</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">วันที่นัด Admit</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">สถานะโทร</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">หมายเหตุ</th>';
  html += '<th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #00796b;">จัดการ</th>';
  html += '</tr></thead><tbody>';

  sorted.forEach((booking, index) => {
    html += `<tr style="border-bottom: 1px solid #e0e0e0; ${index % 2 === 0 ? 'background: #f9f9f9;' : ''}">`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_hn}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_name}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.bed_id}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${formatDate(booking.admit_date)}</td>`;
    html += `<td style="padding: 12px; font-size: 14px;"><span style="padding: 4px 12px; border-radius: 12px; background: ${booking.call_status === 'รับสาย' ? '#c8e6c9' : '#ffccbc'}; color: ${booking.call_status === 'รับสาย' ? '#2e7d32' : '#bf360c'}; font-size: 13px; font-weight: 500;">${booking.call_status}</span></td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.call_notes || '-'}</td>`;
    html += `<td style="padding: 12px; text-align: center;">`;
    html += `<button onclick="moveToWaiting('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #4dd0e1 0%, #66bb6a 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; margin-right: 4px;">ส่งผู้ป่วย</button>`;
    html += `<button onclick="showCancelBooking('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">ยกเลิก</button>`;
    html += `</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

function updateWaitingTab(data) {
  const content = document.getElementById('status-waiting');
  if (!content) return;
  const waiting = data.filter(b => b.status === 'occupied' && b.transfer_status === 'waiting' && !b.admitted);
  
  if (waiting.length === 0) {
    content.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">ยังไม่มีผู้ป่วยรอส่ง</p>';
    return;
  }

  const sorted = [...waiting].sort((a, b) => new Date(a.admit_date) - new Date(b.admit_date));

  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="background: linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%);' + "'>";
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">HN</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">ชื่อผู้ป่วย</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">เตียง</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">วันที่ Admit</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">Diagnosis</th>';
  html += '<th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #00796b;">จัดการ</th>';
  html += '</tr></thead><tbody>';

  sorted.forEach((booking, index) => {
    html += `<tr style="border-bottom: 1px solid #e0e0e0; ${index % 2 === 0 ? 'background: #f9f9f9;' : ''}">`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_hn}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_name}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.bed_id}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${formatDate(booking.admit_date)}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.diagnosis_display || '-'}</td>`;
    html += `<td style="padding: 12px; text-align: center;">`;
    html += `<button onclick="sendPatientToBed('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #66bb6a 0%, #81c784 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; margin-right: 4px;">ส่งผู้ป่วยพักนอน</button>`;
    html += `<button onclick="showCancelBooking('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">ยกเลิก</button>`;
    html += `</td>`;
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

function showStatusTab(tabName) {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.style.background = 'white';
    tab.style.borderColor = 'transparent';
  });
  
  if (event && event.target) {
    event.target.style.background = 'linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%)';
    event.target.style.borderColor = '#4dd0e1';
  }

  document.querySelectorAll('.status-content-tab').forEach(content => {
    content.style.display = 'none';
  });
  
  const el = document.getElementById(`status-${tabName}`);
  if (el) el.style.display = 'block';
}

function showCallConfirm(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = `โทร Confirm - ${booking.patient_name}`;
  modalBody.innerHTML = `
    <div style="margin-bottom: 16px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">HN: ${booking.patient_hn}</p>
      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">เตียง: ${booking.bed_id}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 500; color: #00796b; margin-bottom: 8px;">สถานะการโทร</label>
      <select id="call-status-select" style="width: 100%; padding: 12px; border: 2px solid #b2ebf2; border-radius: 8px; font-size: 15px;">
        <option value="">-- เลือกสถานะ --</option>
        <option value="รับสาย">รับสาย</option>
        <option value="ไม่รับสาย">ไม่รับสาย</option>
      </select>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 500; color: #00796b; margin-bottom: 8px;">หมายเหตุ (ถ้ามี)</label>
      <textarea id="call-notes-input" rows="3" style="width: 100%; padding: 12px; border: 2px solid #b2ebf2; border-radius: 8px; font-size: 15px;" placeholder="กรอกหมายเหตุ"></textarea>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 20px;">
      <button onclick="closeModal()" style="flex: 1; padding: 12px; background: #e0e0e0; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer;">ยกเลิก</button>
      <button id="save-call-confirm-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #4dd0e1 0%, #66bb6a 100%); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">บันทึก</button>
    </div>
  `;
  
  document.getElementById('modal').classList.add('active');

  const saveBtn = document.getElementById('save-call-confirm-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => saveCallConfirm(backendId));
}

async function saveCallConfirm(backendId) {
  const callStatus = document.getElementById('call-status-select').value;
  const callNotes = document.getElementById('call-notes-input').value;

  if (!callStatus) {
    showToast('กรุณาเลือกสถานะการโทร', 'error');
    return;
  }

  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const saveButton = document.getElementById('save-call-confirm-btn');
  if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'กำลังบันทึก...'; }

  // If this is a rescheduled admit (custom logic: e.g., booking.rescheduled === true or booking.booking_status === 'rescheduled'),
  // and the call is confirmed, update booking_status to 'booked' and clear transfer_status if needed.
  let updatedBooking = { ...booking, call_status: callStatus, call_notes: callNotes };

  // Example logic: if booking_status is 'rescheduled' or has a reschedule flag, treat as rescheduled
  if ((booking.booking_status === 'rescheduled' || booking.rescheduled === true) && callStatus === 'รับสาย') {
    updatedBooking.booking_status = 'booked';
    // Optionally clear transfer_status if it blocks showing in confirmed
    if (updatedBooking.transfer_status === 'waiting') {
      updatedBooking.transfer_status = '';
    }
  }

  const result = (window.dataSdk && window.dataSdk.update) ? await window.dataSdk.update(updatedBooking) : { isOk: true };

  if (result.isOk) {
    showToast('บันทึกสถานะการโทรเรียบร้อยแล้ว');
    closeModal();
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'บันทึก'; }
  }
}

async function moveToWaiting(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const updatedBooking = { ...booking, transfer_status: 'waiting', status: 'occupied' };
  const result = (window.dataSdk && window.dataSdk.update) ? await window.dataSdk.update(updatedBooking) : { isOk: true };

  if (result.isOk) {
    showToast('ย้ายผู้ป่วยไปรอส่งเรียบร้อยแล้ว');
  } else {
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

async function sendPatientToBed(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const sendButton = event && event.target;
  if (sendButton) { sendButton.disabled = true; sendButton.textContent = 'กำลังส่ง...'; }

  const updatedBooking = { ...booking, transfer_status: 'completed', admitted: false };
  const result = (window.dataSdk && window.dataSdk.update) ? await window.dataSdk.update(updatedBooking) : { isOk: true };

  if (result.isOk) {
    showToast('ส่งผู้ป่วยพักนอนเรียบร้อยแล้ว - รอรับ Admit');
  } else {
    showToast('เกิดข้อผิดพลาด', 'error');
    if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'ส่งผู้ป่วยพักนอน'; }
  }
}

function showCancelBooking(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = `ยกเลิกการจอง - ${booking.patient_name}`;
  modalBody.innerHTML = `
    <div style="margin-bottom: 16px;">
      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">HN: ${booking.patient_hn}</p>
      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">เตียง: ${booking.bed_id}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 14px; font-weight: 500; color: #00796b; margin-bottom: 8px;">เหตุผลในการยกเลิก</label>
      <textarea id="cancel-reason-input" rows="3" required style="width: 100%; padding: 12px; border: 2px solid #b2ebf2; border-radius: 8px; font-size: 15px;" placeholder="กรุณาระบุเหตุผล"></textarea>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 20px;">
      <button onclick="closeModal()" style="flex: 1; padding: 12px; background: #e0e0e0; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer;">ยกเลิก</button>
      <button id="confirm-cancel-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">ยืนยันยกเลิก</button>
    </div>
  `;
  
  document.getElementById('modal').classList.add('active');

  const confirmBtn = document.getElementById('confirm-cancel-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => executeCancelBooking(backendId));
}

async function executeCancelBooking(backendId) {
  const cancelReasonEl = document.getElementById('cancel-reason-input');
  if (!cancelReasonEl) return;
  const cancelReason = cancelReasonEl.value.trim();

  if (!cancelReason) {
    showToast('กรุณาระบุเหตุผลในการยกเลิก', 'error');
    return;
  }

  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const cancelButton = event && event.target;
  if (cancelButton) { cancelButton.disabled = true; cancelButton.textContent = 'กำลังยกเลิก...'; }

  const result = (window.dataSdk && window.dataSdk.delete) ? await window.dataSdk.delete(booking) : { isOk: true };

  if (result.isOk) {
    showToast('ยกเลิกการจองเรียบร้อยแล้ว');
    closeModal();
  } else {
    showToast('เกิดข้อผิดพลาด', 'error');
    if (cancelButton) { cancelButton.disabled = false; cancelButton.textContent = 'ยืนยันยกเลิก'; }
  }
}

function updateRegistryView(data) {
  updateCurrentRegistryTab(data);
  updateAdmitRegistryTab(data);
}

function updateCurrentRegistryTab(data) {
  const content = document.getElementById('registry-current');
  if (!content) return;
  const occupied = data.filter(b => b.status === 'occupied' && b.admitted === true);
  
  if (occupied.length === 0) {
    content.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">ยังไม่มีผู้ป่วยในระบบ</p>';
    return;
  }

  let html = '';

  // เตียงสามัญ
  html += '<div style="margin-bottom: 32px;">';
  html += '<h3 style="font-size: 18px; font-weight: 600; color: #00695c; margin-bottom: 16px;">เตียงสามัญ (12 เตียง)</h3>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">';
  
  BEDS.standard.forEach(bedId => {
    const booking = occupied.find(b => b.bed_id === bedId);
    html += createIPDBedCard(bedId, booking);
  });
  
  html += '</div></div>';

  // ห้องพิเศษ
  html += '<div>';
  html += '<h3 style="font-size: 18px; font-weight: 600; color: #00695c; margin-bottom: 16px;">ห้องพิเศษ (6 ห้อง)</h3>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">';
  
  BEDS.vip.forEach(bedId => {
    const booking = occupied.find(b => b.bed_id === bedId);
    html += createIPDBedCard(bedId, booking);
  });
  
  html += '</div></div>';

  content.innerHTML = html;
}

function createIPDBedCard(bedId, booking) {
  const isOccupied = booking !== undefined;
  const today = new Date().toISOString().split('T')[0];
  const canDischarge = isOccupied && booking.discharge_date && booking.discharge_date <= today;

  if (!isOccupied) {
    return `
      <div style="background: linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%); border: 2px solid #80deea; border-radius: 12px; padding: 20px; text-align: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00796b" stroke-width="1.5" style="margin: 0 auto 12px;">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <p style="font-size: 20px; font-weight: 600; color: #00796b; margin: 8px 0;">${bedId}</p>
        <p style="font-size: 14px; color: #00796b; margin: 0;">ว่าง</p>
      </div>
    `;
  }

  return `
    <div style="background: linear-gradient(135deg, #ffccbc 0%, #ffab91 100%); border: 2px solid #ff8a65; border-radius: 12px; padding: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#bf360c" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <p style="font-size: 18px; font-weight: 600; color: #bf360c; margin: 0;">${bedId}</p>
        </div>
        <span style="padding: 4px 12px; border-radius: 12px; background: #fff; color: #bf360c; font-size: 12px; font-weight: 500;">ไม่ว่าง</span>
      </div>

      <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <p style="font-size: 12px; color: #666; margin-bottom: 4px;">ชื่อผู้ป่วย</p>
        <p style="font-size: 15px; font-weight: 600; color: #333; margin: 0 0 8px 0;">${booking.patient_name}</p>
        
        <p style="font-size: 12px; color: #666; margin-bottom: 4px;">HN: ${booking.patient_hn}</p>
        <p style="font-size: 12px; color: #666; margin-bottom: 8px;">อายุ: ${booking.patient_age || '-'} ปี</p>
        
        <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Diagnosis</p>
        <p style="font-size: 13px; color: #333; margin: 0 0 8px 0;">${booking.diagnosis_display || '-'}</p>

        <div style="border-top: 1px solid #e0e0e0; padding-top: 8px; margin-top: 8px;">
          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">เลขเตียง</label>
            <select id="bed-edit-${booking.__backendId}" style="width: 100%; padding: 6px 8px; border: 2px solid #b2ebf2; border-radius: 6px; font-size: 13px;">
              ${[...BEDS.standard, ...BEDS.vip].map(bed => `<option value="${bed}" ${bed === booking.bed_id ? 'selected' : ''}>${bed}</option>`).join('')}
            </select>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">แพทย์เจ้าของไข้</label>
            <select id="doctor-edit-${booking.__backendId}" style="width: 100%; padding: 6px 8px; border: 2px solid #b2ebf2; border-radius: 6px; font-size: 13px;">
              <option value="นพ.ธนภูมิ ลัดดาชยาพร" ${booking.doctor_display === 'นพ.ธนภูมิ ลัดดาชยาพร' ? 'selected' : ''}>นพ.ธนภูมิ ลัดดาชยาพร</option>
              <option value="นพ.ณัชพล ผลกันทา" ${booking.doctor_display === 'นพ.ณัชพล ผลกันทา' ? 'selected' : ''}>นพ.ณัชพล ผลกันทา</option>
              <option value="นพ.ทรัพย์ ตั้งพานิชยานนท์" ${booking.doctor_display === 'นพ.ทรัพย์ ตั้งพานิชยานนท์' ? 'selected' : ''}>นพ.ทรัพย์ ตั้งพานิชยานนท์</option>
            </select>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #666; margin-bottom: 4px;">วันที่จำหน่าย</label>
            <input type="date" id="discharge-edit-${booking.__backendId}" value="${booking.discharge_date || ''}" style="width: 100%; padding: 6px 8px; border: 2px solid #b2ebf2; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <button onclick="saveIPDChanges('${booking.__backendId}')" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #4dd0e1 0%, #66bb6a 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">บันทึก</button>
        <button onclick="dischargePatient('${booking.__backendId}')" ${!canDischarge ? 'disabled' : ''} style="flex: 1; padding: 8px; background: ${canDischarge ? 'linear-gradient(135deg, #ff8a65 0%, #ff7043 100%)' : '#ccc'}; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: ${canDischarge ? 'pointer' : 'not-allowed'};">จำหน่าย</button>
      </div>
      <button onclick="showReferOut('${booking.__backendId}')" style="width: 100%; padding: 8px; background: linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Refer Out</button>
      ${!canDischarge ? '<p style="font-size: 11px; color: #bf360c; margin: 8px 0 0 0; text-align: center;">* สามารถจำหน่ายได้ในวันที่กำหนด</p>' : ''}
    </div>
  `;
}

async function saveIPDChanges(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const newBedIdEl = document.getElementById(`bed-edit-${backendId}`);
  const newDoctorEl = document.getElementById(`doctor-edit-${backendId}`);
  const newDischargeDateEl = document.getElementById(`discharge-edit-${backendId}`);
  if (!newBedIdEl || !newDoctorEl || !newDischargeDateEl) {
    showToast('ไม่พบฟิลด์ที่ต้องการบันทึก', 'error');
    return;
  }

  const newBedId = newBedIdEl.value;
  const newDoctor = newDoctorEl.value;
  const newDischargeDate = newDischargeDateEl.value;

  if (!newDischargeDate) {
    showToast('กรุณาระบุวันที่จำหน่าย', 'error');
    return;
  }

  const saveButton = event && event.target;
  if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'กำลังบันทึก...'; }

  const updatedBooking = { ...booking, bed_id: newBedId, doctor_display: newDoctor, attending_doctor: newDoctor === 'other' ? booking.attending_doctor : newDoctor, discharge_date: newDischargeDate };

  const result = (window.dataSdk && window.dataSdk.update) ? await window.dataSdk.update(updatedBooking) : { isOk: true };

  if (result.isOk) {
    showToast('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว');
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'บันทึก'; }
  }
}

async function dischargePatient(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const today = new Date().toISOString().split('T')[0];
  if (!booking.discharge_date || booking.discharge_date > today) {
    showToast('ยังไม่ถึงวันที่จำหน่าย', 'error');
    return;
  }

  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = `ยืนยันจำหน่ายผู้ป่วย`;
  modalBody.innerHTML = `
    <p style="font-size: 16px; color: #333; margin-bottom: 8px;">ชื่อผู้ป่วย: ${booking.patient_name}</p>
    <p style="font-size: 16px; color: #333; margin-bottom: 8px;">HN: ${booking.patient_hn}</p>
    <p style="font-size: 16px; color: #333; margin-bottom: 8px;">เตียง: ${booking.bed_id}</p>
    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">วันที่จำหน่าย: ${formatDate(booking.discharge_date)}</p>
    <p style="font-size: 15px; color: #666; margin-bottom: 20px;">ยืนยันการจำหน่ายผู้ป่วยรายนี้?</p>
    <div style="display: flex; gap: 12px;">
      <button onclick="closeModal()" style="flex: 1; padding: 12px; background: #e0e0e0; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer;">ยกเลิก</button>
      <button id="confirm-discharge-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">ยืนยัน</button>
    </div>
  `;
  
  document.getElementById('modal').classList.add('active');

  const confirmBtn = document.getElementById('confirm-discharge-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => executeDischargePatient(backendId));
}

async function executeDischargePatient(backendId) {
  const booking = allBookings.find(b => b.__backendId === backendId);
  if (!booking) return;

  const dischargeButton = event && event.target;
  if (dischargeButton) { dischargeButton.disabled = true; dischargeButton.textContent = 'กำลังดำเนินการ...'; }

  const result = (window.dataSdk && window.dataSdk.delete) ? await window.dataSdk.delete(booking) : { isOk: true };
  
  if (result.isOk) {
    showToast('จำหน่ายผู้ป่วยเรียบร้อยแล้ว');
    closeModal();
  } else {
    showToast('เกิดข้อผิดพลาดในการจำหน่าย', 'error');
    if (dischargeButton) { dischargeButton.disabled = false; dischargeButton.textContent = 'ยืนยัน'; }
  }
}

function updateAdmitRegistryTab(data) {
  const content = document.getElementById('registry-admit');
  if (!content) return;
  const waiting = data.filter(b => b.status === 'occupied' && b.transfer_status === 'completed' && !b.admitted);
  
  if (waiting.length === 0) {
    content.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">ยังไม่มีผู้ป่วยรอรับ Admit</p>';
    return;
  }

  const sorted = [...waiting].sort((a, b) => new Date(a.admit_date) - new Date(b.admit_date));

  let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="background: linear-gradient(135deg, #b2ebf2 0%, #c8e6c9 100%);' + "'>";
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">HN</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">ชื่อผู้ป่วย</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">วันที่ Admit</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">Diagnosis</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">เลขเตียง</th>';
  html += '<th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #00796b;">วันที่จำหน่าย</th>';
  html += '<th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #00796b;">รับ Admit</th>';
  html += '</tr></thead><tbody>';

  sorted.forEach((booking, index) => {
    html += `<tr id="admit-row-${booking.__backendId}" style="border-bottom: 1px solid #e0e0e0; ${index % 2 === 0 ? 'background: #f9f9f9;' : ''}">`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_hn}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.patient_name}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${formatDate(booking.admit_date)}</td>`;
    html += `<td style="padding: 12px; font-size: 14px; color: #333;">${booking.diagnosis_display || '-'}</td>`;
    html += `<td style="padding: 12px;">${booking.bed_id || '-'}</td>`;
    html += `<td style="padding: 12px;">${booking.discharge_date ? formatDate(booking.discharge_date) : '-'}</td>`;
    html += `<td style="padding: 12px; text-align: center;">`;
    html += `<button onclick="admitPatient('${booking.__backendId}')" style="padding: 6px 16px; background: linear-gradient(135deg, #66bb6a 0%, #81c784 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">รับ Admit</button>`;
    html += `</td>`;
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  content.innerHTML = html;
}

// Utility function for formatting dates (if not already defined)
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Dummy admitPatient function (to avoid errors if not defined)
function admitPatient(backendId) {
  showToast('รับ Admit: ' + backendId);
}