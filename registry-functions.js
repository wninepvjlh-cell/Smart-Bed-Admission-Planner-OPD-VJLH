(function runOneTimePatientDataPurge() {
  if (typeof window === 'undefined') {
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

// Registry Functions

let currentCallPatient = null;
let currentDetailPatient = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Load booking data
function loadBookingData() {
  const stored = localStorage.getItem('bookingData');
  if (!stored) {
    return { booked: [], confirmed: [], admitted: [] };
  }
  return JSON.parse(stored);
}

function normalizeBookingData(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    booked: Array.isArray(source.booked) ? source.booked : [],
    confirmed: Array.isArray(source.confirmed) ? source.confirmed : [],
    admitted: Array.isArray(source.admitted) ? source.admitted : [],
    cancelled: Array.isArray(source.cancelled) ? source.cancelled : []
  };
}

function downloadBookingData() {
  try {
    const data = normalizeBookingData(loadBookingData());
    const timestamp = new Date().toISOString().replace(/[:T\-]/g, '').slice(0, 14);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `booking-data-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Unable to download booking data:', error);
    alert('ไม่สามารถดาวน์โหลดข้อมูลได้');
  }
}

function triggerBookingImport() {
  const input = document.getElementById('booking-import-file');
  if (input) {
    input.click();
  }
}

async function handleBookingImport(event) {
  const file = event && event.target ? event.target.files[0] : null;
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeBookingData(parsed);
    if (!confirm('ต้องการแทนที่ข้อมูลการจองบนเครื่องนี้ด้วยไฟล์ที่เลือกหรือไม่?')) {
      event.target.value = '';
      return;
    }
    localStorage.setItem('bookingData', JSON.stringify(normalized));
    displayBookingList();
    displayConfirmedList();
    alert('นำเข้าข้อมูลเรียบร้อยแล้ว');
  } catch (error) {
    console.error('Unable to import booking data:', error);
    alert('ไฟล์ไม่ถูกต้องหรือไม่สามารถนำเข้าได้');
  } finally {
    event.target.value = '';
  }
}

async function copyBookingDataToClipboard() {
  try {
    const data = normalizeBookingData(loadBookingData());
    const json = JSON.stringify(data, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(json);
    } else {
      const temp = document.createElement('textarea');
      temp.value = json;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    alert('คัดลอกข้อมูลไปยังคลิปบอร์ดแล้ว');
  } catch (error) {
    console.error('Unable to copy booking data:', error);
    alert('ไม่สามารถคัดลอกข้อมูลได้');
  }
}

// Thai month names
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Thai day names
const thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Format date to Thai
function formatDateTH(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

// Format datetime to Thai
function formatDateTimeTH(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear() + 543;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ตรวจสอบว่าถึงวัน Admit แล้วหรือยัง
function canAdmitToday(admitDateString) {
  if (!admitDateString) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const admitDate = new Date(admitDateString);
  admitDate.setHours(0, 0, 0, 0);
  
  // อนุญาตให้ Admit ได้เมื่อถึงวันที่นัดหรือผ่านวันนัดไปแล้ว
  return admitDate <= today;
}

// Display booking list (not confirmed yet)
function displayBookingList() {
  renderCalendar();
}

// Change month
function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  } else if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

// Render calendar
function renderCalendar() {
  const bookingData = loadBookingData();
  const bookedList = bookingData.booked || [];
  
  // Update month/year display
  document.getElementById('current-month-year').textContent = 
    `${thaiMonths[currentMonth]} ${currentYear + 543}`;
  
  // Get first day of month and number of days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Group bookings by date
  const bookingsByDate = {};
  bookedList.forEach(booking => {
    const admitDate = new Date(booking.admit_date);
    if (admitDate.getMonth() === currentMonth && admitDate.getFullYear() === currentYear) {
      const day = admitDate.getDate();
      if (!bookingsByDate[day]) {
        bookingsByDate[day] = [];
      }
      bookingsByDate[day].push(booking);
    }
  });
  
  // Build calendar HTML
  let calendarHTML = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">';
  
  // Day headers
  thaiDays.forEach(day => {
    calendarHTML += `<div style="text-align:center;padding:12px;font-weight:700;color:#00796b;font-size:14px;background:linear-gradient(135deg,#e0f7fa 0%,#e1f5fe 100%);border-radius:8px;">${day}</div>`;
  });
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    calendarHTML += '<div style="min-height:120px;"></div>';
  }
  
  // Calendar days
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && today.getDate() === day;
    const hasBookings = bookingsByDate[day] && bookingsByDate[day].length > 0;
    const bookingCount = hasBookings ? bookingsByDate[day].length : 0;
    
    let cellStyle = 'background:white;border:2px solid #e0e0e0;border-radius:10px;padding:8px;min-height:120px;position:relative;transition:all 0.2s;';
    
    if (isToday) {
      cellStyle = 'background:linear-gradient(135deg,#fff9c4 0%,#fffde7 100%);border:2px solid #fbc02d;border-radius:10px;padding:8px;min-height:120px;position:relative;transition:all 0.2s;';
    }
    
    if (hasBookings) {
      cellStyle += 'cursor:pointer;';
    }
    
    calendarHTML += `<div style="${cellStyle}" ${hasBookings ? `onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,172,193,0.2)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'" onclick="showDayBookings(${day})"` : ''}>`;
    
    // Day number
    calendarHTML += `<div style="font-size:16px;font-weight:700;color:${isToday ? '#f57c00' : '#00796b'};margin-bottom:4px;">${day}</div>`;
    
    // Booking indicators
    if (hasBookings) {
      calendarHTML += `<div style="background:linear-gradient(135deg,#4dd0e1 0%,#26c6da 100%);color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;text-align:center;margin-top:4px;box-shadow:0 2px 4px rgba(77,208,225,0.3);">`;
      calendarHTML += `📋 ${bookingCount} ราย`;
      calendarHTML += `</div>`;
      
      // Show patient names (max 2)
      const displayCount = Math.min(2, bookingCount);
      for (let i = 0; i < displayCount; i++) {
        const booking = bookingsByDate[day][i];
        const postponeIcon = booking.is_postponed ? '🔄 ' : '';
        calendarHTML += `<div style="font-size:10px;color:#666;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${booking.is_postponed ? 'เลื่อนวัน: ' + booking.postpone_reason + ' - ' : ''}${booking.patient_name}">${postponeIcon}• ${booking.patient_name}</div>`;
      }
      
      if (bookingCount > 2) {
        calendarHTML += `<div style="font-size:10px;color:#999;margin-top:2px;">...อีก ${bookingCount - 2} ราย</div>`;
      }
    }
    
    calendarHTML += '</div>';
  }
  
  calendarHTML += '</div>';
  
  document.getElementById('booking-calendar').innerHTML = calendarHTML;
}

// Show bookings for specific day
function showDayBookings(day) {
  const bookingData = loadBookingData();
  const bookedList = bookingData.booked || [];
  
  // Filter bookings for this day
  const dayBookings = bookedList.filter(booking => {
    const admitDate = new Date(booking.admit_date);
    return admitDate.getDate() === day && 
           admitDate.getMonth() === currentMonth && 
           admitDate.getFullYear() === currentYear;
  });
  
  if (dayBookings.length === 0) return;
  
  // If only one booking, open detail modal directly
  if (dayBookings.length === 1) {
    openBookingDetailModal(dayBookings[0].patient_hn);
    return;
  }
  
  // Otherwise, show list modal
  showDayBookingsModal(day, dayBookings);
}

// Show modal with list of bookings for a specific day
function showDayBookingsModal(day, bookings) {
  const dateStr = `${day} ${thaiMonths[currentMonth]} ${currentYear + 543}`;
  
  let modalHTML = `
    <div id="day-bookings-modal" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target.id==='day-bookings-modal') closeDayBookingsModal()">
      <div style="background:white;border-radius:16px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.15);" onclick="event.stopPropagation()">
        <div style="background:linear-gradient(135deg,#4dd0e1 0%,#26c6da 100%);padding:16px 20px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="color:white;font-size:18px;margin:0;font-weight:600;">📅 ผู้ป่วยวันที่ ${dateStr}</h3>
          <button onclick="closeDayBookingsModal()" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:24px;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
        </div>
        <div style="padding:20px;">
          <div style="color:#00796b;font-size:14px;margin-bottom:16px;font-weight:600;">
            ทั้งหมด ${bookings.length} รายการ
          </div>
  `;
  
  bookings.forEach((booking, index) => {
    modalHTML += `
      <div style="background:linear-gradient(135deg,#e0f7fa 0%,#e1f5fe 100%);padding:14px;border-radius:10px;margin-bottom:12px;border-left:4px solid #00acc1;cursor:pointer;transition:all 0.2s;" 
           onmouseover="this.style.transform='translateX(4px)';this.style.boxShadow='0 2px 8px rgba(0,172,193,0.2)'" 
           onmouseout="this.style.transform='translateX(0)';this.style.boxShadow='none'"
           onclick="closeDayBookingsModal();openBookingDetailModal('${booking.patient_hn}')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="background:linear-gradient(135deg,#00acc1 0%,#26c6da 100%);color:white;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">${index + 1}</div>
            <div>
              <div style="color:#666;font-size:11px;">HN</div>
              <div style="color:#00796b;font-size:15px;font-weight:700;">${booking.patient_hn}</div>
            </div>
          </div>
          <div style="color:#00acc1;font-size:12px;">คลิกดูรายละเอียด →</div>
        </div>
        <div style="color:#004d40;font-size:14px;font-weight:600;margin-bottom:4px;">${booking.is_postponed ? '🔄 ' : ''}${booking.patient_name}</div>
        ${booking.is_postponed ? `<div style="color:#fb8c00;font-size:11px;margin-bottom:4px;font-style:italic;">เลื่อนวัน: ${booking.postpone_reason}</div>` : ''}
        <div style="color:#666;font-size:12px;">เตียง: ${booking.assigned_bed || '-'}</div>
      </div>
    `;
  });
  
  modalHTML += `
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('day-bookings-modal');
  if (existingModal) existingModal.remove();
  
  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close day bookings modal
function closeDayBookingsModal() {
  const modal = document.getElementById('day-bookings-modal');
  if (modal) modal.remove();
}

// Open booking detail modal
function openBookingDetailModal(hn) {
  const bookingData = loadBookingData();
  const patient = bookingData.booked.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  console.log('Patient data:', patient); // Debug log
  
  currentDetailPatient = hn;
  
  // Section 1: Patient Info
  document.getElementById('detail-hn').textContent = patient.patient_hn || '-';
  document.getElementById('detail-name').textContent = patient.patient_name || '-';
  document.getElementById('detail-age').textContent = patient.patient_age ? patient.patient_age + ' ปี' : '-';
  document.getElementById('detail-gender').textContent = patient.patient_gender || '-';
  document.getElementById('detail-phone').textContent = patient.patient_phone || '-';
  
  // Section 2: Diagnosis
  document.getElementById('detail-diagnosis').textContent = patient.diagnosis || '-';
  document.getElementById('detail-disease-date').textContent = patient.disease_onset_date ? formatDateTH(patient.disease_onset_date) : '-';
  document.getElementById('detail-imc').textContent = patient.imc_status || '-';
  document.getElementById('detail-doctor').textContent = patient.attending_doctor || '-';
  
  // Section 3: Booking Info
  document.getElementById('detail-admit-date').textContent = formatDateTH(patient.admit_date);
  
  // Bed type display
  let bedTypeText = '-';
  if (patient.bed_type === 'standard') {
    bedTypeText = 'เตียงสามัญ';
  } else if (patient.bed_type === 'special') {
    bedTypeText = 'ห้องพิเศษ';
  }
  document.getElementById('detail-bed-type').textContent = bedTypeText;
  document.getElementById('detail-bed').textContent = patient.assigned_bed || '-';
  document.getElementById('detail-waiting').textContent = patient.waiting_time || '-';
  
  // Section 4: Lab & Appointment
  document.getElementById('detail-lab').textContent = patient.lab_package || '-';
  document.getElementById('detail-channel').textContent = patient.appointment_channel || '-';
  document.getElementById('detail-refer').textContent = patient.refer_hospital || '-';
  
  // Section 5: Notes (show only if exists)
  const notesSection = document.getElementById('detail-notes-section');
  const notesContent = document.getElementById('detail-notes');
  if (patient.notes && patient.notes.trim()) {
    notesContent.textContent = patient.notes;
    notesSection.style.display = 'block';
  } else {
    notesSection.style.display = 'none';
  }
  
  document.getElementById('booking-detail-modal').style.display = 'flex';
}

// Close booking detail modal
function closeBookingDetailModal() {
  document.getElementById('booking-detail-modal').style.display = 'none';
  currentDetailPatient = null;
}

// Open call modal from detail modal
function openCallModalFromDetail() {
  const hn = currentDetailPatient;
  console.log('openCallModalFromDetail - HN:', hn);
  
  if (!hn) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Don't close detail modal yet, just hide it temporarily
  document.getElementById('booking-detail-modal').style.display = 'none';
  openCallModal(hn);
}

// Display confirmed booking list
function displayConfirmedList() {
  const bookingData = loadBookingData();
  const confirmedList = bookingData.confirmed || [];
  
  const container = document.getElementById('confirmed-list');
  const confirmedCount = document.getElementById('confirmed-count');
  
  container.innerHTML = '';
  confirmedCount.textContent = confirmedList.length;
  
  if (confirmedList.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;padding:60px;text-align:center;color:#999;background:white;border-radius:12px;"><div style="font-size:48px;margin-bottom:16px;opacity:0.5;">✅</div><div style="font-size:16px;">ยังไม่มีรายการยืนยัน</div></div>';
    return;
  }
  
  // Sort by admit date (earliest first - patients who need to be admitted soon come first)
  confirmedList.sort((a, b) => new Date(a.admit_date) - new Date(b.admit_date));
  
  confirmedList.forEach((booking, index) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:white;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);cursor:pointer;transition:all 0.2s;border:2px solid transparent;';
    card.onmouseover = () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 6px 20px rgba(102,187,106,0.15)';
      card.style.borderColor = '#66bb6a';
    };
    card.onmouseout = () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      card.style.borderColor = 'transparent';
    };
    card.onclick = () => openConfirmedDetailModal(booking.patient_hn);
    
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;">
        <div style="background:linear-gradient(135deg,#66bb6a 0%,#43a047 100%);color:white;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;box-shadow:0 2px 8px rgba(102,187,106,0.3);">
          ✓
        </div>
        <div style="text-align:right;">
          <div style="color:#66bb6a;font-size:12px;font-weight:500;margin-bottom:4px;">วันที่ Admit</div>
          <div style="color:#2e7d32;font-size:14px;font-weight:600;">${formatDateTH(booking.admit_date)}</div>
        </div>
      </div>
      
      <div style="margin-bottom:12px;display:grid;gap:4px;">
        <div style="color:#999;font-size:11px;font-weight:500;text-transform:uppercase;">HN</div>
        <div style="color:#2e7d32;font-size:18px;font-weight:700;">${booking.patient_hn}</div>
        <div style="color:#999;font-size:11px;font-weight:500;">ชื่อ-สกุล</div>
        <div style="color:#2e7d32;font-size:15px;font-weight:600;">${booking.patient_name || '-'}</div>
      </div>
      
      <div style="height:1px;background:linear-gradient(90deg,#e0e0e0 0%,transparent 100%);margin:16px 0;"></div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button onclick="event.stopPropagation();openConfirmedDetailModal('${booking.patient_hn}')" style="padding:10px;background:#f5f5f5;color:#666;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f5f5f5'">📋 ดูข้อมูล</button>
        ${canAdmitToday(booking.admit_date) 
          ? `<button onclick="event.stopPropagation();admitPatient('${booking.patient_hn}')" style="padding:10px;background:linear-gradient(135deg,#66bb6a 0%,#43a047 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;box-shadow:0 2px 4px rgba(102,187,106,0.2);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 8px rgba(102,187,106,0.3)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(102,187,106,0.2)'">🏥 ส่ง Admit</button>`
          : `<button disabled style="padding:10px;background:#e0e0e0;color:#999;border:none;border-radius:6px;cursor:not-allowed;font-size:12px;font-weight:600;" title="ยังไม่ถึงวัน Admit">🏥 ส่ง Admit</button>`
        }
        <button onclick="event.stopPropagation();openCancelModal('${booking.patient_hn}')" style="grid-column:1/-1;padding:10px;background:linear-gradient(135deg,#ef5350 0%,#e53935 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;box-shadow:0 2px 4px rgba(239,83,80,0.2);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 8px rgba(239,83,80,0.3)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(239,83,80,0.2)'">❌ ยกเลิก</button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Show registry tab
function showRegistryTab(tabName) {
  // Hide all tabs
  document.getElementById('tab-booking-content').style.display = 'none';
  document.getElementById('tab-confirmed-content').style.display = 'none';
  
  // Reset all tab buttons
  document.getElementById('tab-booking').style.borderBottomColor = 'transparent';
  document.getElementById('tab-booking').style.color = '#999';
  document.getElementById('tab-booking').style.fontWeight = '500';
  document.getElementById('tab-confirmed').style.borderBottomColor = 'transparent';
  document.getElementById('tab-confirmed').style.color = '#999';
  document.getElementById('tab-confirmed').style.fontWeight = '500';
  
  // Show selected tab
  if (tabName === 'booking') {
    document.getElementById('tab-booking-content').style.display = 'block';
    document.getElementById('tab-booking').style.borderBottomColor = '#4dd0e1';
    document.getElementById('tab-booking').style.color = '#00796b';
    document.getElementById('tab-booking').style.fontWeight = '600';
    // Always refresh booking list when tab is clicked
    displayBookingList();
  } else if (tabName === 'confirmed') {
    document.getElementById('tab-confirmed-content').style.display = 'block';
    document.getElementById('tab-confirmed').style.borderBottomColor = '#4dd0e1';
    document.getElementById('tab-confirmed').style.color = '#00796b';
    document.getElementById('tab-confirmed').style.fontWeight = '600';
    displayConfirmedList();
  }
}

// Open call confirmation modal
function openCallModal(hn) {
  const bookingData = loadBookingData();
  const patient = bookingData.booked.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  currentCallPatient = hn;
  document.getElementById('call-patient-hn').textContent = hn;
  document.getElementById('call-patient-name').textContent = patient.patient_name;
  document.getElementById('call-note').value = '';
  document.getElementById('call-modal').style.display = 'flex';
}

// Close call modal
function closeCallModal() {
  document.getElementById('call-modal').style.display = 'none';
  currentCallPatient = null;
  
  // If detail modal was open, restore it
  if (currentDetailPatient) {
    document.getElementById('booking-detail-modal').style.display = 'flex';
  }
}

// Save call confirmation
function saveCallConfirmation() {
  console.log('saveCallConfirmation called');
  console.log('currentCallPatient:', currentCallPatient);
  
  if (!currentCallPatient) {
    console.log('No currentCallPatient');
    return;
  }
  
  const note = document.getElementById('call-note').value;
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  console.log('Note:', note);
  console.log('Logged user:', loggedUser);
  
  const bookingData = loadBookingData();
  console.log('bookingData:', bookingData);
  console.log('booked array:', bookingData.booked);
  
  const bookedIndex = bookingData.booked.findIndex(p => p.patient_hn === currentCallPatient);
  console.log('bookedIndex:', bookedIndex);
  
  if (bookedIndex === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  const patient = bookingData.booked[bookedIndex];
  console.log('Patient found:', patient);
  
  // Move to confirmed list
  const confirmedPatient = {
    ...patient,
    call_result: 'confirmed',
    call_note: note,
    confirm_date: new Date().toISOString(),
    confirmed_by: loggedUser,
    action_note: `โทรยืนยันโดย ${loggedUser}`
  };
  
  console.log('Confirmed patient:', confirmedPatient);
  
  if (!bookingData.confirmed) {
    bookingData.confirmed = [];
  }
  
  bookingData.confirmed.push(confirmedPatient);
  bookingData.booked.splice(bookedIndex, 1);
  
  console.log('After move - booked:', bookingData.booked);
  console.log('After move - confirmed:', bookingData.confirmed);
  
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  console.log('Saved to localStorage');
  
  alert(`✅ ยืนยันการโทร ${patient.patient_name}\n\nข้อมูลถูกย้ายไปที่ "Booking Confirmed" แล้ว`);
  
  closeCallModal();
  
  // Close detail modal if open
  if (document.getElementById('booking-detail-modal').style.display === 'flex') {
    closeBookingDetailModal();
  }
  
  displayBookingList();
  displayConfirmedList();
  
  // Auto-switch to Booking Confirmed tab
  showRegistryTab('confirmed');
}

// Open confirmed detail modal
let currentConfirmedPatient = null;

function openConfirmedDetailModal(hn) {
  const bookingData = loadBookingData();
  const patient = bookingData.confirmed.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  currentConfirmedPatient = hn;
  
  // Section 1: Patient Info
  document.getElementById('confirmed-detail-hn').value = patient.patient_hn || '';
  document.getElementById('confirmed-detail-name').value = patient.patient_name || '';
  document.getElementById('confirmed-detail-age').value = patient.patient_age || '';
  document.getElementById('confirmed-detail-gender').value = patient.patient_gender || '';
  document.getElementById('confirmed-detail-phone').value = patient.patient_phone || '';
  
  // Section 2: Diagnosis
  document.getElementById('confirmed-detail-diagnosis').value = patient.diagnosis || '';
  document.getElementById('confirmed-detail-disease-date').value = patient.disease_onset_date ? patient.disease_onset_date : '';
  document.getElementById('confirmed-detail-imc').value = patient.imc_status || '';
  document.getElementById('confirmed-detail-doctor').value = patient.attending_doctor || '';
  
  // Section 3: Booking Info
  document.getElementById('confirmed-detail-admit-date').textContent = patient.admit_date || '-';

  document.getElementById('confirmed-detail-bed-type').textContent = patient.bed_type === 'vip' ? '⭐ ห้องพิเศษ' : (patient.bed_type === 'standard' ? '🛏️ เตียงสามัญ' : '-');
  document.getElementById('confirmed-detail-bed').value = patient.assigned_bed || '';
  document.getElementById('confirmed-detail-waiting').value = patient.waiting_time || '';
  
  // Section 4: Lab & Appointment
  const labSelect = document.getElementById('confirmed-detail-lab');
  const labOtherInput = document.getElementById('confirmed-detail-lab-other');
  if (patient.lab_package === 'อื่นๆ') {
    labSelect.value = 'อื่นๆ';
    labOtherInput.style.display = '';
    labOtherInput.value = patient.lab_package_other || '';
  } else {
    labSelect.value = patient.lab_package || '';
    labOtherInput.style.display = 'none';
    labOtherInput.value = '';
  }
  document.getElementById('confirmed-detail-channel').textContent = patient.appointment_channel || '-';
  document.getElementById('confirmed-detail-refer').textContent = patient.refer_hospital || '-';

    // Section 4.5: Postpone Info (show only if postponed)
    const postponeSection = document.getElementById('confirmed-detail-postpone-section');
    const postponeInfo = document.getElementById('confirmed-detail-postpone-info');
    if (patient.postponed || patient.postpone_original_date) {
      const fromDate = formatDateTH(patient.postpone_original_date);
      const toDate = formatDateTH(patient.admit_date);
      const reason = patient.postpone_reason || '';
      postponeInfo.textContent = `เลื่อนวัน Admit จาก ${fromDate} เป็น ${toDate}\nเหตุผล: ${reason}`;
      postponeSection.style.display = 'block';
    } else {
      postponeSection.style.display = 'none';
      postponeInfo.textContent = '';
    }
  
  // Section 5: Call Info
  const callInfo = `ยืนยันเมื่อ: ${formatDateTimeTH(patient.confirm_date)}\n${patient.call_note ? 'หมายเหตุ: ' + patient.call_note : 'ไม่มีหมายเหตุเพิ่มเติม'}`;
  document.getElementById('confirmed-detail-call-note').textContent = callInfo;
  
  // Section 6: Notes (show only if exists)
  const notesSection = document.getElementById('confirmed-detail-notes-section');
  const notesContent = document.getElementById('confirmed-detail-notes');
  if (patient.notes && patient.notes.trim()) {
    notesContent.textContent = patient.notes;
    notesSection.style.display = 'block';
  } else {
    notesSection.style.display = 'none';
  }
  
  document.getElementById('confirmed-detail-modal').style.display = 'flex';
  // Disable all inputs by default
  setConfirmedDetailInputsDisabled(true);
  document.getElementById('edit-confirmed-detail-btn').style.display = '';
  document.getElementById('save-confirmed-detail-btn').style.display = 'none';

}

function setConfirmedDetailInputsDisabled(disabled) {
  const ids = [
    'confirmed-detail-hn', 'confirmed-detail-name', 'confirmed-detail-age', 'confirmed-detail-gender',
    'confirmed-detail-phone', 'confirmed-detail-diagnosis', 'confirmed-detail-disease-date', 'confirmed-detail-imc',
    'confirmed-detail-doctor', 'confirmed-detail-admit-date', 'confirmed-detail-bed-type', 'confirmed-detail-bed',
    'confirmed-detail-waiting', 'confirmed-detail-lab', 'confirmed-detail-channel', 'confirmed-detail-refer'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

function enableConfirmedDetailEdit() {
  const editableIds = ['confirmed-detail-hn', 'confirmed-detail-name', 'confirmed-detail-age'];
  editableIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.disabled = false;
    if ('readOnly' in el) {
      el.readOnly = false;
    }
  });
  document.getElementById('edit-confirmed-detail-btn').style.display = 'none';
  document.getElementById('save-confirmed-detail-btn').style.display = '';
}

function saveConfirmedDetailEdit() {
  // Get values from inputs
  const hn = document.getElementById('confirmed-detail-hn').value.trim();
  const name = document.getElementById('confirmed-detail-name').value.trim();
  const age = parseInt(document.getElementById('confirmed-detail-age').value, 10) || '';
  const gender = document.getElementById('confirmed-detail-gender').value;
  const phone = document.getElementById('confirmed-detail-phone').value.trim();
  const diagnosis = document.getElementById('confirmed-detail-diagnosis').value.trim();
  const diseaseDate = document.getElementById('confirmed-detail-disease-date').value;
  const doctor = document.getElementById('confirmed-detail-doctor').value.trim();
  const admitDate = document.getElementById('confirmed-detail-admit-date').value;
  const bedType = document.getElementById('confirmed-detail-bed-type').value;
  const bed = document.getElementById('confirmed-detail-bed').value.trim();
  const waiting = document.getElementById('confirmed-detail-waiting').value.trim();
  const lab = document.getElementById('confirmed-detail-lab').value.trim();
  const channel = document.getElementById('confirmed-detail-channel').value.trim();
  const refer = document.getElementById('confirmed-detail-refer').value.trim();

  // IMC status recalc: IMC if disease onset < 14 days, else Non-IMC
  let imc = document.getElementById('confirmed-detail-imc').value.trim();
  if (diseaseDate) {
    const onsetDate = new Date(diseaseDate);
    const today = new Date();
    const diffDays = Math.floor((today - onsetDate) / (1000 * 60 * 60 * 24));
    if (!isNaN(diffDays)) {
      imc = diffDays < 14 ? 'IMC' : 'Non-IMC';
      document.getElementById('confirmed-detail-imc').value = imc;
    }
  }

  // Update localStorage
  const bookingData = loadBookingData();
  const idx = bookingData.confirmed.findIndex(p => p.patient_hn === currentConfirmedPatient);
  if (idx === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  const patient = bookingData.confirmed[idx];
  patient.patient_hn = hn;
  patient.patient_name = name;
  patient.patient_age = age;
  patient.patient_gender = gender;
  patient.patient_phone = phone;
  patient.diagnosis = diagnosis;
  patient.disease_onset_date = diseaseDate;
  patient.imc_status = imc;
  patient.attending_doctor = doctor;
  patient.admit_date = admitDate;
  patient.bed_type = bedType;
  patient.assigned_bed = bed;
  patient.waiting_time = waiting;
  patient.lab_package = lab;
  patient.appointment_channel = channel;
  patient.refer_hospital = refer;

  localStorage.setItem('bookingData', JSON.stringify(bookingData));

  setConfirmedDetailInputsDisabled(true);
  document.getElementById('edit-confirmed-detail-btn').style.display = '';
  document.getElementById('save-confirmed-detail-btn').style.display = 'none';

  alert('บันทึกข้อมูลเรียบร้อยแล้ว');
  displayConfirmedList();
  openConfirmedDetailModal(hn);
}

// Close confirmed detail modal
function closeConfirmedDetailModal() {
  document.getElementById('confirmed-detail-modal').style.display = 'none';
  currentConfirmedPatient = null;
}

// Admit patient from detail modal
function admitPatientFromDetail() {
  const hn = currentConfirmedPatient;
  
  if (!hn) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Check if admit date has arrived
  const bookingData = loadBookingData();
  const patient = bookingData.confirmed.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Compare dates (ignore time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const admitDate = new Date(patient.admit_date);
  admitDate.setHours(0, 0, 0, 0);
  
  if (admitDate > today) {
    const admitDateThai = formatDateTH(patient.admit_date);
    alert(`ยังไม่ถึงวันที่ Admit\n\nวันที่นัด Admit: ${admitDateThai}\nกรุณารอจนถึงวันที่กำหนด`);
    return;
  }
  
  // Hide confirmed detail modal
  document.getElementById('confirmed-detail-modal').style.display = 'none';
  admitPatient(hn);
}

// Cancel booking from detail modal
let currentCancelPatient = null;

function cancelConfirmedFromDetail() {
  const hn = currentConfirmedPatient;
  
  if (!hn) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Hide confirmed detail modal
  document.getElementById('confirmed-detail-modal').style.display = 'none';
  openCancelModal(hn);
}

// Open cancel modal
function openCancelModal(hn) {
  const bookingData = loadBookingData();
  const patient = bookingData.confirmed.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  currentCancelPatient = hn;
  document.getElementById('cancel-patient-hn').textContent = hn;
  document.getElementById('cancel-patient-name').textContent = patient.patient_name;
  document.getElementById('cancel-reason').value = '';
  document.getElementById('cancel-modal').style.display = 'flex';
}

// Close cancel modal
function closeCancelModal() {
  document.getElementById('cancel-modal').style.display = 'none';
  currentCancelPatient = null;
  
  // If confirmed detail modal was open, restore it
  if (currentConfirmedPatient) {
    document.getElementById('confirmed-detail-modal').style.display = 'flex';
  }
}

// Confirm cancel booking
function confirmCancelBooking() {
  if (!currentCancelPatient) {
    return;
  }
  
  const reason = document.getElementById('cancel-reason').value.trim();
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  if (!reason) {
    alert('กรุณาระบุเหตุผลการยกเลิก');
    return;
  }
  
  const bookingData = loadBookingData();
  const confirmedIndex = bookingData.confirmed.findIndex(p => p.patient_hn === currentCancelPatient);
  
  if (confirmedIndex === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  const patient = bookingData.confirmed[confirmedIndex];
  
  // Create cancelled record (optional - for record keeping)
  const cancelledPatient = {
    ...patient,
    cancel_reason: reason,
    cancel_date: new Date().toISOString(),
    status: 'cancelled',
    cancelled_by: loggedUser,
    action_note: `ยกเลิกโดย ${loggedUser} เหตุผล: ${reason}`
  };
  
  // Initialize cancelled array if not exists
  if (!bookingData.cancelled) {
    bookingData.cancelled = [];
  }
  
  // Move to cancelled list
  bookingData.cancelled.push(cancelledPatient);
  bookingData.confirmed.splice(confirmedIndex, 1);
  
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  
  alert(`✅ ยกเลิกการจองสำเร็จ\n\nชื่อ: ${patient.patient_name}\nHN: ${patient.patient_hn}\n\nเหตุผล: ${reason}`);
  
  closeCancelModal();
  
  // Close confirmed detail modal if open
  if (document.getElementById('confirmed-detail-modal').style.display === 'flex') {
    closeConfirmedDetailModal();
  }
  
  displayConfirmedList();
}

// Postpone booking functions
let currentPostponePatient = null;

function openPostponeModal() {
  if (!currentConfirmedPatient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  const bookingData = loadBookingData();
  const patient = bookingData.confirmed.find(p => p.patient_hn === currentConfirmedPatient);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  currentPostponePatient = patient;
  document.getElementById('postpone-patient-name').textContent = patient.patient_name;
  document.getElementById('postpone-patient-hn').textContent = patient.patient_hn;
  document.getElementById('postpone-new-date').value = '';
  document.getElementById('postpone-reason').value = '';
  
  document.getElementById('postpone-modal').style.display = 'flex';
}

function closePostponeModal() {
  document.getElementById('postpone-modal').style.display = 'none';
  document.getElementById('postpone-new-date').value = '';
  document.getElementById('postpone-reason').value = '';
  currentPostponePatient = null;
}

function confirmPostponeBooking() {
  const newDate = document.getElementById('postpone-new-date').value;
  const reason = document.getElementById('postpone-reason').value.trim();
  
  if (!newDate) {
    alert('กรุณาเลือกวันที่จอง Admit ใหม่');
    return;
  }
  
  if (!reason) {
    alert('กรุณาระบุเหตุผลการเลื่อนวัน');
    return;
  }
  
  if (!currentPostponePatient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [], cancelled: [] };
  
  // Find patient in confirmed list
  const confirmedIndex = bookingData.confirmed.findIndex(p => p.patient_hn === currentPostponePatient.patient_hn);
  
  if (confirmedIndex === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Get patient data and update
  const patient = bookingData.confirmed.splice(confirmedIndex, 1)[0];
  
  // Save original date BEFORE changing
  const originalDate = patient.admit_date;
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  patient.postpone_original_date = originalDate;
  patient.admit_date = newDate;
  patient.postpone_reason = reason;
  patient.postpone_date = new Date().toISOString();
  patient.postponed = true; // Set flag for postponed status
  patient.postponed_by = loggedUser;
  
  // Move back to confirmed list (stay in confirmed, not booked)
  bookingData.confirmed.push(patient);
  
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  
  // ส่งข้อมูลไปยัง Google Sheets (ถ้ามีการตั้งค่า)
  if (typeof sendPostponeDataToGoogleSheet === 'function' && isGoogleSheetConfigured()) {
    sendPostponeDataToGoogleSheet({
      patient_hn: patient.patient_hn,
      patient_name: patient.patient_name,
      age: patient.age,
      gender: patient.gender,
      diagnosis: patient.diagnosis,
      doctor: patient.doctor,
      postpone_original_date: patient.postpone_original_date,
      admit_date: patient.admit_date,
      postpone_reason: patient.postpone_reason,
      postponed_by: patient.postponed_by,
      imc_type: patient.imc_status || patient.imc_type,
      payment_status: patient.payment_status,
      bed_number: patient.bed_number,
      postpone_date: patient.postpone_date
    }).catch(error => {
      console.error('เกิดข้อผิดพลาดในการส่งข้อมูลไป Google Sheets:', error);
      // ไม่แสดง error ให้ผู้ใช้เห็น เพื่อไม่ให้รบกวนการทำงาน
    });
  }
  
  alert(`✅ เลื่อนวันจองสำเร็จ\n\nชื่อ: ${patient.patient_name}\nHN: ${patient.patient_hn}\n\nวันที่ใหม่: ${formatDateTH(newDate)}\nเหตุผล: ${reason}`);
  
  closePostponeModal();
  
  // Close confirmed detail modal
  if (document.getElementById('confirmed-detail-modal').style.display === 'flex') {
    closeConfirmedDetailModal();
  }
  
  displayConfirmedList();
  displayBookingList();
}

// Admit patient to IPD
let currentAdmitPatient = null;

function admitPatient(hn) {
  const bookingData = loadBookingData();
  const patient = bookingData.confirmed.find(p => p.patient_hn === hn);
  
  if (!patient) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  // Check if admit date has arrived
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const admitDate = new Date(patient.admit_date);
  admitDate.setHours(0, 0, 0, 0);
  
  if (admitDate > today) {
    const admitDateThai = formatDateTH(patient.admit_date);
    alert(`ยังไม่ถึงวันที่ Admit\n\nวันที่นัด Admit: ${admitDateThai}\nกรุณารอจนถึงวันที่กำหนด`);
    return;
  }
  
  currentAdmitPatient = hn;
  document.getElementById('admit-patient-hn').textContent = hn;
  document.getElementById('admit-patient-name').textContent = patient.patient_name;
  document.getElementById('admit-patient-bed').textContent = patient.assigned_bed;
  document.getElementById('admit-ward').value = '';
  document.getElementById('admit-modal').style.display = 'flex';
}

function closeAdmitModal() {
  document.getElementById('admit-modal').style.display = 'none';
  currentAdmitPatient = null;
  
  // If confirmed detail modal was open, restore it
  if (currentConfirmedPatient) {
    document.getElementById('confirmed-detail-modal').style.display = 'flex';
  }
}

function confirmAdmitPatient() {
  if (!currentAdmitPatient) return;
  
  const ward = document.getElementById('admit-ward').value;
  const loggedUser = sessionStorage.getItem('app_user_name') || 'Unknown';
  
  if (!ward) {
    alert('กรุณาเลือกหอผู้ป่วย');
    return;
  }
  
  const bookingData = loadBookingData();
  const confirmedIndex = bookingData.confirmed.findIndex(p => p.patient_hn === currentAdmitPatient);
  
  if (confirmedIndex === -1) {
    alert('ไม่พบข้อมูลผู้ป่วย');
    return;
  }
  
  const patient = bookingData.confirmed[confirmedIndex];
  
  // Determine floor name for display
  let floorName = '';
  if (ward === 'floor1') {
    floorName = 'หอผู้ป่วยในชั้น 1';
  } else if (ward === 'floor2') {
    floorName = 'หอผู้ป่วยในชั้น 2';
  }
  
  // Move to admitted list with floor and waiting status
  const admittedPatient = {
    ...patient,
    admit_status: 'waiting', // รอรับ Admit
    floor: ward,
    floor_name: floorName,
    actual_admit_date: new Date().toISOString(),
    sent_by: loggedUser,
    action_note: `ส่ง Admit โดย ${loggedUser}`
  };
  
  if (!bookingData.admitted) {
    bookingData.admitted = [];
  }
  
  bookingData.admitted.push(admittedPatient);
  bookingData.confirmed.splice(confirmedIndex, 1);
  
  localStorage.setItem('bookingData', JSON.stringify(bookingData));
  
  alert(`✅ ส่งผู้ป่วย Admit สำเร็จ\n\nชื่อ: ${patient.patient_name}\nหอผู้ป่วย: ${floorName}\nเตียง: ${patient.assigned_bed}\n\nข้อมูลถูกส่งไปยัง "หอผู้ป่วยใน (IPD) → ${floorName} → รอรับ Admit" แล้ว`);
  
  closeAdmitModal();
  
  // Close confirmed detail modal if open
  if (document.getElementById('confirmed-detail-modal').style.display === 'flex') {
    closeConfirmedDetailModal();
  }
  
  displayConfirmedList();
  
  // Redirect to IPD page - Floor 2 - Waiting section
  if (ward === 'floor2') {
    if (confirm('ต้องการไปยังหน้า "หอผู้ป่วยใน (IPD)" เพื่อดูข้อมูลหรือไม่?')) {
      window.location.href = 'ipd.html';
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  displayBookingList();
  displayConfirmedList();
  const importInput = document.getElementById('booking-import-file');
  if (importInput) {
    importInput.addEventListener('change', handleBookingImport);
  }
  
  // Auto-refresh every 10 seconds
  setInterval(() => {
    const currentTab = document.getElementById('tab-booking-content').style.display === 'block' ? 'booking' : 'confirmed';
    if (currentTab === 'booking') {
      displayBookingList();
    } else {
      displayConfirmedList();
    }
  }, 10000);
});

// Listen for storage changes
window.addEventListener('storage', function(e) {
  if (e.key === 'bookingData') {
    const currentTab = document.getElementById('tab-booking-content').style.display === 'block' ? 'booking' : 'confirmed';
    if (currentTab === 'booking') {
      displayBookingList();
    } else {
      displayConfirmedList();
    }
  }
});
