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
      function doPost(e) {
        try {
          var sheet = SpreadsheetApp.getActiveSpreadsheet();
          var data = JSON.parse(e.postData.contents);

          // ใช้ชีท BookingData ตลอด ไม่ต้องแยกปี
          var bookingSheetName = 'BookingData';
          var bookingSheet = sheet.getSheetByName(bookingSheetName);

          // ถ้ายังไม่มี Sheet BookingData ให้สร้างใหม่
          if (!bookingSheet) {
            bookingSheet = sheet.insertSheet(bookingSheetName);
            bookingSheet.appendRow([
              'Timestamp',
              'HN',
              'Patient Name',
              'Gender',
              'Age',
              'Phone',
              'Diagnosis',
              'วันที่เกิดโรค',
              'สถานะ',
              'แพทย์เจ้าของไข้',
              'Lab',
              'ช่องทางการนัดหมาย',
              'วันที่นัดAdmit',
              'ประเภทเตียง',
              'waiting list',
              'Logged By',
              'Action Note'
            ]);
          }

          bookingSheet.appendRow([
            new Date(),
            data.patient_hn || '',
            data.patient_name || '',
            data.patient_gender || '',
            data.patient_age || '',
            data.patient_phone || '',
            data.diagnosis || '',
            data.disease_onset_date || '',
            data.imc_status || '',
            data.attending_doctor || '',
            data.lab_package || '',
            data.appointment_channel || '',
            data.admit_date || '',
            data.bed_type || '',
            data.waiting_time || '',
            data.logged_by || '',
            data.action_note || ''
          ]);

          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Booking data saved to ' + bookingSheetName
          })).setMimeType(ContentService.MimeType.JSON);

        } catch (error) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      row: lastRow
