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

// ดึงจำนวนผู้ป่วยชายเตียงพิเศษจาก IPD (floor 2)
function fetchMaleSpecialIPDFloor2() {
  const val = localStorage.getItem('ipd_male_special_floor2');
  if (val === null) return null;
  return Number(val);
}
// ดึงจำนวนผู้ป่วยหญิงเตียงพิเศษจาก IPD (floor 2)
function fetchFemaleSpecialIPDFloor2() {
  const val = localStorage.getItem('ipd_female_special_floor2');
  if (val === null) return null;
  return Number(val);
}
// ดึงจำนวนผู้ป่วยหญิงเตียงสามัญจาก IPD (floor 2)
function fetchFemaleStandardIPDFloor2() {
  const val = localStorage.getItem('ipd_female_standard_floor2');
  if (val === null) return null;
  return Number(val);
}
// ดึงจำนวนผู้ป่วยชายเตียงสามัญจาก IPD (floor 2)
function fetchMaleStandardIPDFloor2() {
  return Number(localStorage.getItem('ipd_male_standard_floor2')) || 0;
}
// ดึงค่า Active Beds จาก IPD (floor 2)
function fetchActiveBedsIPDFloor2() {
  // สมมติว่าใช้ localStorage หรือ API จริงควรเปลี่ยนเป็น fetch
  // ตัวอย่าง: return Number(localStorage.getItem('ipd_active_beds_floor2')) || 0;
  // หรือ fetch('/api/ipd/active-beds?floor=2').then(...)
  // ที่นี่จะ broadcast event เพื่อให้ IPD อัปเดตค่าใน localStorage
  return Number(localStorage.getItem('ipd_active_beds_floor2')) || 0;
}
