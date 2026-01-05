/**
 * Google Apps Script for Smart Bed Planner - IPD Floor 2 Database (By Bed Number)
 * 
 * คำแนะนำการติดตั้ง:
 * 1. ใช้ Google Sheets ไฟล์เดียวกันกับ "ฐานข้อมูลเลื่อนนัด Admit"
 * 2. ไปที่ Extensions > Apps Script
 * 3. คัดลอกโค้ดนี้ทั้งหมดเพิ่มลงในไฟล์ที่มีอยู่ (ต่อจาก code ของ Postpone Admit)
 * 4. บันทึกและ Deploy อีกครั้ง (ใช้ deployment เดิม แค่อัปเดต)
 */

/**
 * ฟังก์ชันสำหรับบันทึกข้อมูลผู้ป่วยหอผู้ป่วยในชั้น 2 แยกตามเตียง
 */
function saveIPDFloor2Data(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const bedNumber = data.bed_number;
    
    if (!bedNumber) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'ไม่พบหมายเลขเตียง'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ตรวจสอบว่ามี Sheet ของเตียงนี้หรือยัง
    let sheet = ss.getSheetByName(bedNumber);
    
    // ถ้ายังไม่มี ให้สร้างใหม่
    if (!sheet) {
      sheet = ss.insertSheet(bedNumber);
      
      // สร้างหัวตาราง
      sheet.appendRow([
        'วันที่บันทึก',
        'เวลาบันทึก',
        'HN',
        'ชื่อผู้ป่วย',
        'อายุ',
        'เพศ',
        'Diagnosis',
        'แพทย์',
        'วันที่ Admit',
        'วันที่จำหน่าย',
        'สถานะ',
        'IMC/Non-IMC',
        'หมายเหตุ',
        'Timestamp'
      ]);
      
      // จัดรูปแบบหัวตาราง
      const headerRange = sheet.getRange(1, 1, 1, 14);
      headerRange.setBackground('#00796b');
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
      sheet.setColumnWidth(5, 60);   // อายุ
      sheet.setColumnWidth(6, 60);   // เพศ
      sheet.setColumnWidth(7, 250);  // Diagnosis
      sheet.setColumnWidth(8, 150);  // แพทย์
      sheet.setColumnWidth(9, 120);  // วันที่ Admit
      sheet.setColumnWidth(10, 120); // วันที่จำหน่าย
      sheet.setColumnWidth(11, 100); // สถานะ
      sheet.setColumnWidth(12, 120); // IMC/Non-IMC
      sheet.setColumnWidth(13, 250); // หมายเหตุ
      sheet.setColumnWidth(14, 200); // Timestamp
    }
    
    // เตรียมข้อมูลสำหรับบันทึก
    const now = new Date();
    const thaiDate = formatThaiDate(now);
    const thaiTime = formatThaiTime(now);
    
    const row = [
      thaiDate,                                    // วันที่บันทึก
      thaiTime,                                    // เวลาบันทึก
      data.patient_hn || '-',                      // HN
      data.patient_name || '-',                    // ชื่อผู้ป่วย
      data.age || '-',                             // อายุ
      data.gender || '-',                          // เพศ
      data.diagnosis || '-',                       // Diagnosis
      data.doctor || '-',                          // แพทย์
      data.admit_date ? formatThaiDate(new Date(data.admit_date)) : '-',     // วันที่ Admit
      data.discharge_date ? formatThaiDate(new Date(data.discharge_date)) : '-', // วันที่จำหน่าย
      data.status || '-',                          // สถานะ (Admitted/Discharged/Referred)
      data.imc_status || data.imc_type || '-',     // IMC/Non-IMC
      data.notes || '-',                           // หมายเหตุ
      now.toISOString()                            // Timestamp
    ];
    
    // เพิ่มข้อมูลลงในแถวใหม่
    sheet.appendRow(row);
    
    // จัดรูปแบบข้อมูลที่เพิ่งเพิ่ม
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(lastRow, 1, 1, 14);
    dataRange.setHorizontalAlignment('left');
    dataRange.setVerticalAlignment('middle');
    dataRange.setWrap(true);
    
    // จัดรูปแบบเฉพาะคอลัมน์ที่เป็นตัวเลขให้อยู่กลาง
    sheet.getRange(lastRow, 3, 1, 1).setHorizontalAlignment('center'); // HN
    sheet.getRange(lastRow, 5, 1, 1).setHorizontalAlignment('center'); // อายุ
    sheet.getRange(lastRow, 6, 1, 1).setHorizontalAlignment('center'); // เพศ
    sheet.getRange(lastRow, 9, 1, 1).setHorizontalAlignment('center'); // วันที่ Admit
    sheet.getRange(lastRow, 10, 1, 1).setHorizontalAlignment('center'); // วันที่จำหน่าย
    sheet.getRange(lastRow, 11, 1, 1).setHorizontalAlignment('center'); // สถานะ
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: `บันทึกข้อมูลเตียง ${bedNumber} สำเร็จ`,
      bed: bedNumber,
      row: lastRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * แก้ไขฟังก์ชัน doPost เดิมให้รองรับทั้ง Postpone และ IPD Floor 2
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // ตรวจสอบว่าเป็นข้อมูลประเภทไหน
    if (data.data_type === 'ipd_floor2') {
      return saveIPDFloor2Data(e);
    } else {
      // เป็นข้อมูล Postpone Admit (โค้ดเดิม)
      return savePostponeAdmitData(e);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ย้ายโค้ด Postpone Admit เดิมมาเป็นฟังก์ชันแยก
 */
function savePostponeAdmitData(e) {
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
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('admitted') || ss.getActiveSheet();

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'ไม่พบชีต admitted'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        count: 0,
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0];
    const records = values.slice(1)
      .filter(row => row.some(cell => cell !== ''))
      .map(row => {
        const item = {};
        headers.forEach((header, i) => {
          const key = header && header.toString().trim() ? header.toString().trim() : `column_${i + 1}`;
          item[key] = row[i];
        });
        return item;
      });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      count: records.length,
      data: records
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
