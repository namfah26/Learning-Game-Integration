# ระบบเก็บผลการเล่น + Google Sheet + Radar/Spider Report

ไฟล์ชุดนี้เพิ่มระบบ telemetry ให้กับ Construct 3 Web Export เดิม โดยไม่ต้องแก้ Event Sheet ต้นฉบับ

## โครงสร้างข้อมูลที่แนะนำ

ใช้ Google Spreadsheet **ไฟล์เดียว** และแบ่งเป็น 3 tabs (ไม่ควรแยก 1 คนต่อ 1 tab):

1. `Sessions` — 1 แถวต่อการเล่น 1 ครั้ง เหมาะกับหน้า Dashboard สรุปผู้เล่น
2. `StageSummary` — 1 แถวต่อผู้เล่นต่อด่าน เหมาะกับกราฟเปรียบเทียบด่าน/เวลา/ทักษะ 4 ทิศ
3. `ClickEvents` — 1 แถวต่อการคลิก เก็บ response time, target direction, clicked direction และผลถูก/ผิด/คลิกอื่น

ทุกตารางเชื่อมกันด้วย `sessionId` จึงทำ Dashboard, Pivot, Looker Studio หรือเว็บ Dashboard ได้ง่ายกว่าการสร้าง tab ใหม่ทุกคน

## ค่าที่ระบบเก็บเพิ่ม

- คะแนน, ด่าน, คลิกถูก, คลิกผิด, คลิกที่อื่น, คลิกรวม
- เวลารวม และเวลาในแต่ละด่าน
- เวลาก่อนตอบแต่ละครั้ง (`responseTimeMs`) และเวลาจากคลิกก่อนหน้า (`sincePreviousClickMs`)
- ตัวละครที่เลือก
- โจทย์ที่ต้องการ (`targetDirection`) และปุ่มที่กดจริง (`clickedDirection`)
- ทักษะ บน/ล่าง/ซ้าย/ขวา เป็นเปอร์เซ็นต์ในแต่ละด่านและภาพรวม
- Spider/Radar 5 แกน: บน, ขวา, คะแนน, ซ้าย, ล่าง

เปอร์เซ็นต์ทิศ = `จำนวนตอบถูกของทิศนั้น / จำนวนโจทย์ทิศนั้นที่ปรากฏทั้งหมด × 100`

## ตั้งค่า Google Sheet

1. สร้าง Google Spreadsheet ใหม่ 1 ไฟล์
2. เปิด **Extensions > Apps Script**
3. วางโค้ดจาก `apps-script/Code.gs`
4. Deploy > New deployment > Web app
5. Execute as: **Me**
6. Who has access: เลือกสิทธิ์ที่เหมาะกับระบบของคุณ (ถ้าเกมเปิดสาธารณะมักใช้ Anyone)
7. Copy URL ที่ลงท้าย `/exec`
8. เปิด `scripts/telemetry-config.js` แล้วใส่ URL ใน `endpointUrl`

ตัวอย่าง:

```js
export const TELEMETRY_CONFIG = {
  endpointUrl: "https://script.google.com/macros/s/XXXXXXXX/exec",
  requestTimeoutMs: 12000,
  useNoCors: true,
  storagePrefix: "arrowGameTelemetry",
  channelName: "game-arrow-telemetry",
  appVersion: "telemetry-1.0.0"
};
```

## การทำงานของปุ่ม Save

- เมื่อกด `Savebt` หน้า Win/GameOver ระบบจะเก็บ Bundle ทั้ง session ลงพื้นที่สำรองในเครื่องก่อน
- ถ้าตั้งค่า Apps Script URL แล้ว จะส่ง Bundle ไป Google Sheet
- ถ้าส่งไม่ได้ ข้อมูลยังค้างใน queue และจะลองส่งใหม่เมื่อเปิดเกมรอบถัดไป
- หลังบันทึก active session จะถูกล้าง เพื่อไม่ให้ข้อมูลคนก่อนปนกับคนถัดไป
- คนถัดไปที่เริ่ม `Layout 7 Game` จะได้ `sessionId` ใหม่ แต่ข้อมูลจะลง 3 tabs เดิมต่อท้ายเป็นแถวใหม่

## ไฟล์ที่เพิ่ม/แก้

- `scripts/gameTelemetry.js` — เก็บข้อมูลเกมและจัดการ Save
- `scripts/telemetry-ui.js` — แสดง Spider/Radar และตารางรายด่านบนหน้าผลลัพธ์
- `scripts/telemetry-config.js` — ตั้งค่า endpoint
- `apps-script/Code.gs` — backend สำหรับ Google Sheet
- `scripts/main.js` — เพิ่ม project script ให้ Construct โหลด telemetry
- `index.html` — โหลด UI report
- `offline.json` — เพิ่มไฟล์ใหม่ใน PWA cache list

## หมายเหตุ

ไฟล์ที่ได้รับเป็น Construct 3 **Web Export** ไม่ใช่ `.c3p` project source จึงเพิ่มระบบผ่าน JavaScript runtime โดยไม่แก้ Event Sheet ต้นฉบับ หากมีไฟล์ `.c3p` ภายหลัง สามารถย้าย logic นี้กลับเข้า Event Sheet/Script ของ Construct เพื่อดูแลต่อใน editor ได้สะดวกขึ้น
