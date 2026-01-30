// Dashboard Waiting List Counter
function updateDashboardWaitingList() {
  const el = document.getElementById('dashboard-waiting-list-count');
  if (!el) return;
  const bookingData = JSON.parse(localStorage.getItem('bookingData')) || {};
  const booking = Array.isArray(bookingData.booking) ? bookingData.booking : [];
  const confirmed = Array.isArray(bookingData.confirmed) ? bookingData.confirmed : [];
  // รวมผู้ป่วยที่อยู่ในเมนูย่อย Booking และ Booking Confirmed
  const waitingList = [...booking, ...confirmed];
  el.textContent = waitingList.length;
}

document.addEventListener('DOMContentLoaded', updateDashboardWaitingList);
window.addEventListener('storage', function(e) {
  if (e.key === 'bookingData') updateDashboardWaitingList();
});
window.addEventListener('sbpRemoteStorageSync', function(event) {
  const detail = event && event.detail;
  if (!detail || !detail.key || detail.key === 'bookingData') {
    updateDashboardWaitingList();
  }
});