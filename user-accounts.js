(function initializeAccountStore() {
  // ปรับแก้รายชื่อบัญชีได้ที่ไฟล์นี้: เพิ่ม/ลบออบเจ็กต์ในอาร์เรย์ด้านล่างตามต้องการ
  if (Array.isArray(window.sbpAccountStore)) {
    return;
  }
  window.sbpAccountStore = [
    {
      username: 'admin',
      password: 'sorninecodenursevjlh',
      role: 'admin',
      displayName: 'Administrator'
    },
    {
      username: 'opd',
      password: 'nurseopd9',
      role: 'opd',
      displayName: 'พยาบาล OPD'
    },
    {
      username: 'ipd',
      password: 'nurseipd',
      role: 'ipd',
      displayName: 'พยาบาล IPD'
    }
  ];
})();
