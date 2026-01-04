/**
 * Google Apps Script for Smart Bed Planner OPD - Postpone Admit Database
 * 
 * คำแนะนำการติดตั้ง:
 * 1. เปิด Google Sheets สร้างไฟล์ใหม่ชื่อ "ฐานข้อมูลเลื่อนนัด Admit"
 * 2. ไปที่ Extensions > Apps Script
 * 3. คัดลอกโค้ดนี้ทั้งหมดแทนที่ code.gs
 * 4. บันทึกและ Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. คัดลอก Web app URL ไปใส่ในไฟล์ google-sheet-config.js
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // สร้างหัวตารางถ้ายังไม่มี
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'วันที่บันทึก',
        'เวลาบันทึก',
        'HN',
        'ชื่อผู้ป่วย',
        'Diagnosis',
        'วันที่นัดเดิม',
        'วันที่นัดใหม่',
        'เหตุผลการเลื่อน',
        'ผู้บันทึก',
        'IMC/Non-IMC',
        'Timestamp'
      ]);
      
      // จัดรูปแบบหัวตาราง
      const headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      headerRange.setVerticalAlignment('middle');
      headerRange.setWrap(true);
      
      // ตั้งความกว้างคอลัมน์
      sheet.setColumnWidth(1, 120);  // วันที่บันทึก
      sheet.setColumnWidth(2, 100);  // เวลาบันทึก
      sheet.setColumnWidth(3, 80);   // HN
      sheet.setColumnWidth(4, 200);  // ชื่อผู้ป่วย
      sheet.setColumnWidth(5, 250);  // Diagnosis
      sheet.setColumnWidth(6, 120);  // วันที่นัดเดิม
      sheet.setColumnWidth(7, 120);  // วันที่นัดใหม่
      sheet.setColumnWidth(8, 300);  // เหตุผลการเลื่อน
      sheet.setColumnWidth(9, 120);  // ผู้บันทึก
      sheet.setColumnWidth(10, 120); // IMC/Non-IMC
      sheet.setColumnWidth(11, 200); // Timestamp
    }
    
    // รับข้อมูลจาก request
    const data = JSON.parse(e.postData.contents);
    
    // เตรียมข้อมูลสำหรับบันทึก
    const now = new Date();
    const thaiDate = formatThaiDate(now);
    const thaiTime = formatThaiTime(now);
    
    const row = [
      thaiDate,                           // วันที่บันทึก
      thaiTime,                           // เวลาบันทึก
      data.patient_hn || '-',             // HN
      data.patient_name || '-',           // ชื่อผู้ป่วย
      data.diagnosis || '-',              // Diagnosis
      data.postpone_original_date ? formatThaiDate(new Date(data.postpone_original_date)) : '-', // วันที่นัดเดิม
      data.admit_date ? formatThaiDate(new Date(data.admit_date)) : '-',            // วันที่นัดใหม่
      data.postpone_reason || '-',        // เหตุผลการเลื่อน
      data.postponed_by || '-',           // ผู้บันทึก
      data.imc_type || '-',               // IMC/Non-IMC
      now.toISOString()                   // Timestamp
    ];
    
    // เพิ่มข้อมูลลงในแถวใหม่
    sheet.appendRow(row);
    
    // จัดรูปแบบข้อมูลที่เพิ่งเพิ่ม
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(lastRow, 1, 1, 11);
    dataRange.setHorizontalAlignment('left');
    dataRange.setVerticalAlignment('middle');
    dataRange.setWrap(true);
    
    // จัดรูปแบบเฉพาะคอลัมน์ที่เป็นตัวเลขให้อยู่กลาง
    sheet.getRange(lastRow, 3, 1, 1).setHorizontalAlignment('center'); // HN
    sheet.getRange(lastRow, 6, 1, 1).setHorizontalAlignment('center'); // วันที่นัดเดิม
    sheet.getRange(lastRow, 7, 1, 1).setHorizontalAlignment('center'); // วันที่นัดใหม่
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'บันทึกข้อมูลสำเร็จ',
      row: lastRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Postpone Admit API is running'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย
function formatThaiDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() + 543; // แปลงเป็น พ.ศ.
  return `${day}/${month}/${year}`;
}

// ฟังก์ชันแปลงเวลาเป็นรูปแบบไทย
function formatThaiTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
