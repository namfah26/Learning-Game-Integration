ตั้งค่า Google Sheet ให้รับผลเกมอัตโนมัติ
========================================

แนวทางนี้ใช้ Google Sheet + Google Apps Script Web App เป็น backend รุ่นทดลอง
เกมจะยังเก็บ LocalStorage เป็นสำรอง และส่งผลจบเกมไป Sheet เพิ่มอีกชุด

1) สร้าง Google Sheet ใหม่ 1 ไฟล์ เช่น "Learning Game Database"

2) ใน Google Sheet ไปที่ Extensions > Apps Script

3) ลบโค้ดเดิมใน Code.gs แล้วคัดลอกโค้ดจากไฟล์ Code.gs ในโฟลเดอร์นี้ไปวางทั้งหมด

4) Save แล้วกด Run ฟังก์ชัน doGet หรืออนุญาตสิทธิ์ตามที่ Google ขอ

5) Deploy > New deployment > Web app
   - Execute as: Me / ผู้สร้างสคริปต์
   - Who has access: Anyone (สำหรับรุ่นทดลองที่เด็กไม่ต้อง Login Google)
   - Deploy

6) คัดลอก Web app URL ที่ลงท้ายด้วย /exec

7) เปิดไฟล์:
   js/backend-config.js

   แล้ววาง URL เช่น:
   const SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/....../exec";

8) เปิดเว็บไซต์ผ่าน Live Server แล้วเล่นเกมจนจบ

เมื่อส่งสำเร็จ Script จะสร้างแท็บให้อัตโนมัติ:
- GameResults
- StageSummary
- ClickEvents
- UsageHistory

ข้อสำคัญ
---------
- อย่าใส่เลขบัตรประชาชนลง Sheet นี้ ถ้าไม่มีความจำเป็นจริง
- Web App แบบ Anyone เหมาะกับการทดลอง/โครงงาน ไม่ใช่ระบบข้อมูลสำคัญระยะยาว
- เมื่อใช้งานจริงหลายโรงเรียน/หลายครู ควรเปลี่ยน Auth และฐานข้อมูลเป็นระบบที่มีสิทธิ์เข้าถึงชัดเจน เช่น Supabase/Firebase หรือ backend ขององค์กร
- อย่าแชร์ Google Sheet ให้สาธารณะ; ให้ Apps Script เป็นคนเขียนข้อมูลแทน
