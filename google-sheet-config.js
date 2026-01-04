/**
 * Google Sheet Configuration for Smart Bed Planner OPD
 * คำแนะนำ: แทนที่ URL ด้านล่างด้วย Web App URL ของคุณจาก Google Apps Script
 */

const GOOGLE_SHEET_CONFIG = {
  // URL ของ Google Apps Script Web App (เปลี่ยนเป็น URL ของคุณ)
  postponeAdmitURL: 'https://script.google.com/macros/s/AKfycbxG2UaUx_4maD5XyxI1n69K2H_KMOnZyXI6RRtwsRbQTF-FY4JgZ97lo6wWkubn3cVe/exec',
  
  // ตัวเลือกเพิ่มเติม
  timeout: 10000, // 10 วินาที
  retryAttempts: 3
};

// ฟังก์ชันส่งข้อมูลการเลื่อนนัด Admit ไปยัง Google Sheets
async function sendPostponeDataToGoogleSheet(patientData) {
  try {
    console.log('🔄 กำลังส่งข้อมูลไป Google Sheets...', patientData);
    
    const response = await fetch(GOOGLE_SHEET_CONFIG.postponeAdmitURL, {
      method: 'POST',
      mode: 'no-cors', // ใช้ no-cors เพื่อหลีกเลี่ยงปัญหา CORS
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData)
    });
    
    console.log('✅ ส่งข้อมูลไป Google Sheets สำเร็จ');
    return { status: 'success' };
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการส่งข้อมูลไป Google Sheets:', error);
    return { status: 'error', message: error.message };
  }
}

// ฟังก์ชันส่งข้อมูลพร้อมระบบ retry
async function sendPostponeDataWithRetry(patientData, retries = GOOGLE_SHEET_CONFIG.retryAttempts) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await sendPostponeDataToGoogleSheet(patientData);
      if (result.status === 'success') {
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ ความพยายามครั้งที่ ${i + 1} ล้มเหลว`);
      if (i === retries - 1) {
        throw error;
      }
      // รอ 1 วินาทีก่อนลองใหม่
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// ตรวจสอบว่า URL ถูกตั้งค่าแล้วหรือยัง
function isGoogleSheetConfigured() {
  return GOOGLE_SHEET_CONFIG.postponeAdmitURL && 
         !GOOGLE_SHEET_CONFIG.postponeAdmitURL.includes('YOUR_SCRIPT_ID');
}
