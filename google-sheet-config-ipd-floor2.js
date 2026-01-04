/**
 * Google Sheet Configuration for IPD Floor 2
 * เพิ่มส่วนนี้เข้าไปในไฟล์ google-sheet-config.js ที่มีอยู่แล้ว
 */

// ฟังก์ชันส่งข้อมูล IPD Floor 2 ไปยัง Google Sheets (แยกตามเตียง)
async function sendIPDFloor2DataToGoogleSheet(patientData) {
  try {
    console.log('🔄 กำลังส่งข้อมูล IPD Floor 2 ไป Google Sheets...', patientData);
    
    // เพิ่ม data_type เพื่อระบุว่าเป็นข้อมูล IPD Floor 2
    const dataWithType = {
      ...patientData,
      data_type: 'ipd_floor2'
    };
    
    const response = await fetch(GOOGLE_SHEET_CONFIG.postponeAdmitURL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataWithType)
    });
    
    console.log(`✅ ส่งข้อมูลเตียง ${patientData.bed_number} ไป Google Sheets สำเร็จ`);
    return { status: 'success' };
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการส่งข้อมูล IPD Floor 2:', error);
    return { status: 'error', message: error.message };
  }
}

// ฟังก์ชันส่งข้อมูลพร้อมระบบ retry สำหรับ IPD Floor 2
async function sendIPDFloor2DataWithRetry(patientData, retries = GOOGLE_SHEET_CONFIG.retryAttempts) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await sendIPDFloor2DataToGoogleSheet(patientData);
      if (result.status === 'success') {
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ ความพยายามครั้งที่ ${i + 1} ล้มเหลว`);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
