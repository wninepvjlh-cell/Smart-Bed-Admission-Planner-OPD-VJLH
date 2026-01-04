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

  // อัปเดตเวลาล่าสุด
  const lastUpdateEl = document.getElementById('predict-last-update');
  if (lastUpdateEl) {
    const now = new Date();
    const thDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const thTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastUpdateEl.textContent = `อัปเดตล่าสุด: ${thDate} ${thTime}`;
  }
// Predict Functions - AI Bed Availability Prediction

// Bed lists
const standardBeds = ['B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14', 'B15', 'B16'];
const specialBeds = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

// Format date to Thai
function formatDateThai(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
}

// Get all occupied date ranges for a specific bed
// This function pulls live data from both booking system AND IPD ward updates
function getOccupiedRanges(bedId) {
  // Get latest data from localStorage (updated by both Booking and IPD systems)
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], confirmed: [], admitted: [] };
  const ranges = [];

  // Check booked patients (estimated 3 weeks stay)
  for (const booking of bookingData.booked) {
    if (booking.assigned_bed === bedId) {
      const start = new Date(booking.admit_date);
      const end = new Date(start);
      end.setDate(end.getDate() + 21); // 3 weeks
      ranges.push({ start, end, type: 'booked', patient: booking });
    }
  }
  // Check confirmed patients (estimated 3 weeks stay)
  for (const booking of bookingData.confirmed) {
    if (booking.assigned_bed === bedId) {
      const start = new Date(booking.admit_date);
      const end = new Date(start);
      end.setDate(end.getDate() + 21); // 3 weeks
      ranges.push({ start, end, type: 'confirmed', patient: booking });
    }
  }
  
  // Check admitted patients (use actual discharge date from IPD)
  // This includes any updates made through the IPD ward interface
  for (const patient of bookingData.admitted) {
    if (patient.assigned_bed === bedId && patient.expected_discharge_date) {
      const start = new Date(patient.admitted_date || patient.admit_date);
      // Logic: ถ้าจำหน่ายวันที่ 27 ธ.ค. → เตียงว่างวันที่ 28 ธ.ค.
      // วันที่จำหน่าย (expected_discharge_date) = วันสุดท้ายที่ยังมีผู้ป่วยอยู่
      // เตียงจะว่างตั้งแต่วันถัดไป (วันจำหน่าย + 1 วัน)
      const dischargeDate = new Date(patient.expected_discharge_date);
      const end = new Date(dischargeDate);
      end.setHours(23, 59, 59, 999); // ตั้งเป็นเวลาสิ้นสุดของวันจำหน่าย
      ranges.push({ start, end, type: 'admitted', patient });
    }
  }
  
  // Sort by start date
  ranges.sort((a, b) => a.start - b.start);
  
  return ranges;
}

// Find earliest available date for a bed
function findEarliestAvailableDate(bedId) {
  const occupiedRanges = getOccupiedRanges(bedId);
  
  if (occupiedRanges.length === 0) {
    // Bed is completely free, return today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if today is available
  let currentDate = new Date(today);
  
  for (const range of occupiedRanges) {
    if (currentDate < range.start) {
      // Found a gap before this booking
      return currentDate;
    }
    if (currentDate >= range.start && currentDate <= range.end) {
      // Current date is occupied, move to day after this booking ends
      currentDate = new Date(range.end);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  // All bookings checked, current date is the earliest available
  return currentDate;
}

// Check if any bed is available on a specific date
function isAnyBedAvailableOnDate(beds, targetDate) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  for (const bedId of beds) {
    const occupiedRanges = getOccupiedRanges(bedId);
    let isAvailable = true;
    
    for (const range of occupiedRanges) {
      const rangeStart = new Date(range.start);
      rangeStart.setHours(0, 0, 0, 0);
      // ไม่ reset เวลาของ rangeEnd เพราะเราตั้งไว้เป็น 23:59:59 แล้ว
      const rangeEnd = new Date(range.end);
      
      // เช็คว่าวันที่ต้องการอยู่ในช่วงที่มีผู้ป่วยหรือไม่
      // ตัวอย่าง: ถ้าจำหน่ายวันที่ 27 (rangeEnd = 27 23:59:59)
      // - วันที่ 27 00:00: target < rangeEnd → ยังไม่ว่าง
      // - วันที่ 28 00:00: target > rangeEnd → ว่างแล้ว
      if (target >= rangeStart && target <= rangeEnd) {
        isAvailable = false;
        break;
      }
    }
    
    if (isAvailable) {
      return { available: true, bed: bedId };
    }
  }
  
  return { available: false, bed: null };
}

// Find earliest available date for bed type (at least 1 bed available for 3 weeks = 21 days)
function findEarliestForBedType(bedType) {
  const beds = bedType === 'standard' ? standardBeds : specialBeds;
  const REQUIRED_DAYS = 21; // 3 สัปดาห์
  
  // Always start from today
  let today = new Date();
  today.setHours(0, 0, 0, 0);
  // Check up to 180 days in the future
  for (let i = 0; i < 180; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    // เช็คว่ามีเตียงว่างอย่างน้อย 1 เตียงที่สามารถอยู่ได้ติดต่อกัน 21 วัน
    const availableBedFor21Days = findBedAvailableForDuration(beds, checkDate, REQUIRED_DAYS);
    if (availableBedFor21Days) {
      const availableCount = countBedsAvailableForDuration(beds, checkDate, REQUIRED_DAYS);
      return { date: checkDate, bed: availableBedFor21Days, availableCount: availableCount };
    }
  }
  
  console.log('✗ No available beds found in 180 days');
  return { date: null, bed: null, availableCount: 0 };
}

// ฟังก์ชันหาเตียงที่ว่างติดต่อกันตามจำนวนวันที่กำหนด
function findBedAvailableForDuration(beds, startDate, requiredDays) {
  for (const bedId of beds) {
    if (isBedAvailableForDuration(bedId, startDate, requiredDays)) {
      return bedId;
    }
  }
  return null;
}

// ฟังก์ชันเช็คว่าเตียงว่างติดต่อกันตามจำนวนวันที่กำหนดหรือไม่
function isBedAvailableForDuration(bedId, startDate, requiredDays) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  // เช็คทุกวันในช่วง requiredDays ว่าเตียงว่างหรือไม่
  for (let day = 0; day < requiredDays; day++) {
    const checkDate = new Date(start);
    checkDate.setDate(checkDate.getDate() + day);
    
    if (!isBedAvailableOnDate(bedId, checkDate)) {
      return false; // ถ้าวันใดวันหนึ่งไม่ว่าง ถือว่าไม่ผ่าน
    }
  }
  
  return true; // ว่างทุกวันในช่วง requiredDays
}

// ฟังก์ชันเช็คว่าเตียงว่างในวันที่กำหนดหรือไม่
function isBedAvailableOnDate(bedId, targetDate) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const occupiedRanges = getOccupiedRanges(bedId);
  
  for (const range of occupiedRanges) {
    const rangeStart = new Date(range.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(range.end);
    
    if (target >= rangeStart && target <= rangeEnd) {
      return false; // เตียงไม่ว่างในวันนี้
    }
  }
  
  return true; // เตียงว่าง
}

// นับจำนวนเตียงที่ว่างติดต่อกันตามจำนวนวันที่กำหนด
function countBedsAvailableForDuration(beds, startDate, requiredDays) {
  let count = 0;
  
  for (const bedId of beds) {
    if (isBedAvailableForDuration(bedId, startDate, requiredDays)) {
      count++;
    }
  }
  
  return count;
}

// Count how many beds are available on a specific date
function countAvailableBedsOnDate(beds, targetDate) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  let count = 0;
  
  console.log('\n=== countAvailableBedsOnDate Debug ===');
  console.log('Target Date:', target.toISOString().split('T')[0]);
  console.log('Checking beds:', beds);
  
  for (const bedId of beds) {
    const occupiedRanges = getOccupiedRanges(bedId);
    let isAvailable = true;
    
    console.log(`\nBed ${bedId}:`, occupiedRanges.length, 'occupied ranges');
    
    for (const range of occupiedRanges) {
      const rangeStart = new Date(range.start);
      rangeStart.setHours(0, 0, 0, 0);
      // ไม่ reset เวลาของ rangeEnd เพราะเราตั้งไว้เป็น 23:59:59 แล้ว
      const rangeEnd = new Date(range.end);
      
      console.log(`  Range: ${rangeStart.toISOString().split('T')[0]} to ${new Date(rangeEnd).toISOString()}`);
      console.log(`  Target: ${target.toISOString()}, RangeEnd: ${rangeEnd.toISOString()}`);
      
      // เช็คว่าวันที่ต้องการอยู่ในช่วงที่มีผู้ป่วยหรือไม่
      // ถ้าจำหน่ายวันที่ 27 23:59:59 → เตียงว่างตั้งแต่วันที่ 28 00:00:00
      if (target >= rangeStart && target <= rangeEnd) {
        isAvailable = false;
        console.log(`  -> Occupied on target date`);
        break;
      } else {
        console.log(`  -> Not in range`);
      }
    }
    
    if (isAvailable) {
      count++;
      console.log(`  -> Available! Count now: ${count}`);
    }
  }
  
  console.log('Final count:', count);
  return count;
}

// Calculate and display predictions
// This pulls the latest data from both booking system and IPD ward updates
function calculatePredictions() {
  // Refresh data from localStorage to get latest IPD updates
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  // Standard beds
  const standardResult = findEarliestForBedType('standard');
  const standardDateElement = document.getElementById('standard-earliest-date');
  const standardInfoElement = document.getElementById('standard-bed-info');
  
  if (standardResult.date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let showDate = standardResult.date;
    // บวก 1 วัน
    if (showDate) {
      showDate = new Date(showDate);
      showDate.setDate(showDate.getDate() + 1);
    }
    // ถ้า showDate เป็นอดีตหรือข้อมูลผิดปกติ ให้ใช้วันนี้แทน
    if (!showDate || showDate.getTime() < today.getTime()) {
      showDate = today;
    }
    const dateStr = formatDateThai(showDate.toISOString().split('T')[0]);
    standardDateElement.textContent = dateStr;
    standardDateElement.style.color = '#00796b';
    if (showDate.getTime() === today.getTime()) {
      standardInfoElement.innerHTML = `✅ <strong>วันนี้มี ${standardResult.availableCount} เตียงว่าง</strong> จากทั้งหมด 12 เตียง - สามารถอยู่ได้เต็ม 3 สัปดาห์!`;
      standardInfoElement.style.color = '#2e7d32';
    } else {
      standardInfoElement.innerHTML = `📅 <strong>วันที่ ${dateStr} มี ${standardResult.availableCount} เตียงว่าง</strong> จากทั้งหมด 12 เตียง - รับรอง 3 สัปดาห์`;
      standardInfoElement.style.color = '#00695c';
    }
  } else {
    // ถ้าไม่มีข้อมูล ให้แสดงวันนี้
    const today = new Date();
    const dateStr = formatDateThai(today.toISOString().split('T')[0]);
    standardDateElement.textContent = dateStr;
    standardDateElement.style.color = '#00796b';
    standardInfoElement.innerHTML = '⚠️ ไม่มีเตียงที่รองรับ 3 สัปดาห์';
    standardInfoElement.style.color = '#d32f2f';
  }
  
  // Special beds
  const specialResult = findEarliestForBedType('special');
  const specialDateElement = document.getElementById('special-earliest-date');
  const specialInfoElement = document.getElementById('special-bed-info');
  
  if (specialResult.date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let showDate = specialResult.date;
    // บวก 1 วัน
    if (showDate) {
      showDate = new Date(showDate);
      showDate.setDate(showDate.getDate() + 1);
    }
    // ถ้า showDate เป็นอดีตหรือข้อมูลผิดปกติ ให้ใช้วันนี้แทน
    if (!showDate || showDate.getTime() < today.getTime()) {
      showDate = today;
    }
    const dateStr = formatDateThai(showDate.toISOString().split('T')[0]);
    specialDateElement.textContent = dateStr;
    specialDateElement.style.color = '#2e7d32';
    if (showDate.getTime() === today.getTime()) {
      specialInfoElement.innerHTML = `✅ <strong>วันนี้มี ${specialResult.availableCount} ห้องว่าง</strong> จากทั้งหมด 6 ห้อง - สามารถอยู่ได้เต็ม 3 สัปดาห์!`;
      specialInfoElement.style.color = '#1b5e20';
    } else {
      specialInfoElement.innerHTML = `📅 <strong>วันที่ ${dateStr} มี ${specialResult.availableCount} ห้องว่าง</strong> จากทั้งหมด 6 ห้อง - รับรอง 3 สัปดาห์`;
      specialInfoElement.style.color = '#2e7d32';
    }
  } else {
    // ถ้าไม่มีข้อมูล ให้แสดงวันนี้
    const today = new Date();
    const dateStr = formatDateThai(today.toISOString().split('T')[0]);
    specialDateElement.textContent = dateStr;
    specialDateElement.style.color = '#2e7d32';
    specialInfoElement.innerHTML = '⚠️ ไม่มีห้องที่รองรับ 3 สัปดาห์';
    specialInfoElement.style.color = '#d32f2f';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  calculatePredictions();
  
  // Refresh every 30 seconds to sync with IPD updates
  setInterval(calculatePredictions, 30000);
  
  // Also refresh when user returns to the page (in case IPD was updated)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      console.log('Page visible again - refreshing predictions to sync with IPD updates');
      calculatePredictions();
    }
  });
  
  // Refresh when window gains focus (user switches back from IPD)
  window.addEventListener('focus', function() {
    console.log('Window focused - refreshing predictions to sync with IPD updates');
    calculatePredictions();
  });
  
  // Listen for storage changes from other tabs (IPD updates)
  window.addEventListener('storage', function(e) {
    if (e.key === 'bookingData') {
      console.log('Storage changed - refreshing predictions');
      calculatePredictions();
    }
  });
  
  // Set min date for AI prediction to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('ai-admit-date').setAttribute('min', today);
});

// Check availability for specific date
// Uses live data from both booking system and IPD ward
function checkAvailability() {
  const wardFloor = document.getElementById('ai-ward-floor').value;
  const bedType = document.getElementById('ai-bed-type').value;
  const admitDate = document.getElementById('ai-admit-date').value;
  
  // Validation
  if (!wardFloor || !bedType || !admitDate) {
    alert('⚠️ กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }
  
  // Refresh data to get latest from IPD
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || { booked: [], admitted: [] };
  
  if (wardFloor === '1') {
    alert('⚠️ หอผู้ป่วยชั้น 1 ยังไม่เปิดให้บริการ');
    return;
  }
  
  // Get available beds
  const beds = bedType === 'standard' ? standardBeds : specialBeds;
  const REQUIRED_DAYS = 21; // 3 สัปดาห์
  
  // เช็คว่ามีเตียงที่สามารถอยู่ได้ติดต่อกัน 21 วันหรือไม่
  const availableCountFor21Days = countBedsAvailableForDuration(beds, admitDate, REQUIRED_DAYS);
  const totalBeds = beds.length;
  
  // Debug logging
  console.log('=== Check Availability Debug (3 weeks requirement) ===');
  console.log('Admit Date:', admitDate);
  console.log('Bed Type:', bedType);
  console.log('Beds:', beds);
  console.log('Required Days:', REQUIRED_DAYS);
  console.log('Available Count for 21 days:', availableCountFor21Days);
  console.log('Total Beds:', totalBeds);
  console.log('Will enter:', availableCountFor21Days > 0 ? 'IF (มีเตียงว่าง 21 วัน)' : 'ELSE (ไม่มีเตียงว่าง 21 วัน)');
  
  // Display result
  const resultDiv = document.getElementById('ai-result');
  const resultContent = document.getElementById('ai-result-content');
  
  resultDiv.style.display = 'block';
  
  // เช็คว่ามีเตียงที่รองรับ 3 สัปดาห์หรือไม่
  if (availableCountFor21Days > 0) {
    // Available for 3 weeks
    const bedTypeName = bedType === 'standard' ? 'เตียงสามัญ' : 'ห้องพิเศษ';
    const formatDate = formatDateThai(admitDate);
    
    // คำนวณวันที่จำหน่ายโดยประมาณ (3 สัปดาห์ = 21 วัน)
    const admitDateObj = new Date(admitDate);
    const estimatedDischargeDate = new Date(admitDateObj);
    estimatedDischargeDate.setDate(estimatedDischargeDate.getDate() + 21);
    const formatDischargeDate = formatDateThai(estimatedDischargeDate.toISOString().split('T')[0]);
    
    resultContent.style.background = 'linear-gradient(135deg,#e8f5e9 0%,#c8e6c9 100%)';
    resultContent.style.borderColor = '#66bb6a';
    resultContent.innerHTML = `
      <div style="text-align:center;">
        <div style="background:#66bb6a;width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 4px 12px rgba(102,187,106,0.3);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h3 style="font-size:24px;color:#2e7d32;margin:0 0 12px 0;font-weight:700;">✅ สามารถ Admit ได้!</h3>
        <p style="font-size:16px;color:#1b5e20;margin:0 0 8px 0;"><strong>วันที่:</strong> ${formatDate}</p>
        <p style="font-size:16px;color:#1b5e20;margin:0 0 8px 0;"><strong>ประเภท:</strong> ${bedTypeName}</p>
        <p style="font-size:16px;color:#1b5e20;margin:0 0 16px 0;"><strong>หอผู้ป่วย:</strong> ชั้น ${wardFloor}</p>
        <div style="background:white;padding:16px;border-radius:12px;border:2px solid #a5d6a7;">
          <p style="font-size:18px;color:#2e7d32;margin:0;font-weight:700;">มี ${availableCountFor21Days} เตียงว่าง</p>
          <p style="font-size:14px;color:#1b5e20;margin:4px 0 0 0;">จากทั้งหมด ${totalBeds} เตียง</p>
          <p style="font-size:13px;color:#2e7d32;margin:8px 0 0 0;font-weight:600;">✓ รับรองเตียงว่างติดต่อกัน 3 สัปดาห์</p>
        </div>
        <div style="background:#fff3e0;padding:12px;border-radius:10px;border:2px solid #ffb74d;margin-top:16px;">
          <p style="font-size:13px;color:#e65100;margin:0 0 4px 0;font-weight:600;">📅 ระยะเวลา Admit โดยประมาณ: 3 สัปดาห์</p>
          <p style="font-size:14px;color:#bf360c;margin:0;"><strong>คาดว่าจะจำหน่าย:</strong> ${formatDischargeDate}</p>
        </div>
        <p style="font-size:13px;color:#666;margin:16px 0 0 0;font-style:italic;">💡 คุณสามารถจองเตียงได้ที่เมนู "จองเตียง Admit"</p>
      </div>
    `;
  } else {
    // Not available (no beds for 3 weeks)
    const bedTypeName = bedType === 'standard' ? 'เตียงสามัญ' : 'ห้องพิเศษ';
    const formatDate = formatDateThai(admitDate);
    
    // Find next available date (that can accommodate 3 weeks)
    const nextAvailable = findEarliestForBedType(bedType);
    
    resultContent.style.background = 'linear-gradient(135deg,#ffebee 0%,#ffcdd2 100%)';
    resultContent.style.borderColor = '#ef5350';
    resultContent.innerHTML = `
      <div style="text-align:center;">
        <div style="background:#ef5350;width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 4px 12px rgba(239,83,80,0.3);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <h3 style="font-size:24px;color:#c62828;margin:0 0 12px 0;font-weight:700;">❌ ไม่สามารถ Admit ได้</h3>
        <p style="font-size:16px;color:#b71c1c;margin:0 0 8px 0;"><strong>วันที่:</strong> ${formatDate}</p>
        <p style="font-size:16px;color:#b71c1c;margin:0 0 8px 0;"><strong>ประเภท:</strong> ${bedTypeName}</p>
        <p style="font-size:16px;color:#b71c1c;margin:0 0 16px 0;"><strong>หอผู้ป่วย:</strong> ชั้น ${wardFloor}</p>
        <div style="background:white;padding:16px;border-radius:12px;border:2px solid #ef9a9a;">
          <p style="font-size:16px;color:#c62828;margin:0 0 4px 0;font-weight:700;">ไม่มีเตียงว่างติดต่อกัน 3 สัปดาห์</p>
          <p style="font-size:13px;color:#d32f2f;margin:0;">เตียงว่างไม่เพียงพอสำหรับระยะเวลา 21 วัน</p>
          ${nextAvailable.date ? `
            <div style="margin-top:12px;padding-top:12px;border-top:2px dashed #ef9a9a;">
              <p style="font-size:14px;color:#666;margin:0 0 4px 0;">📅 วันที่สามารถ Admit ได้ (รับรอง 3 สัปดาห์):</p>
              <p style="font-size:16px;color:#2e7d32;margin:0;font-weight:700;">${formatDateThai(nextAvailable.date.toISOString().split('T')[0])}</p>
              <p style="font-size:13px;color:#666;margin:4px 0 0 0;">(มี ${nextAvailable.availableCount} เตียงว่าง)</p>
            </div>
          ` : '<p style="font-size:14px;color:#c62828;margin:8px 0 0 0;">ไม่พบวันว่างใน 180 วันข้างหน้า</p>'}
        </div>
      </div>
    `;
  }
  
  // Scroll to result
  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
