# LearningSummaryV1 และขอบเขตการเชื่อมต่อ

`buildLearningSummary(state)` ใน `src/learning/report.js` คืน plain object ที่แปลงเป็น JSON ได้ ไม่มีการแก้ state ไม่มีเครือข่าย และไม่มีการดาวน์โหลดไฟล์ การเรียกซ้ำไม่เพิ่มจำนวนครั้งตอบ

## สัญญาข้อมูล

| ส่วน | ฟิลด์ |
|---|---|
| Root | `schemaVersion: 1`, `contentVersion`, `labs`, `totals`, `questionsNeedingPractice`, `repeatedAttemptQuestions`, `integrity: 'browser-unverified'` |
| Lab | `labId`, `masteryStatus`, `completionStatus`, `attemptCount`, `incorrectAttemptCount`, `tasks` |
| Task | `labId`, `taskId`, `masteryStatus`, `completionStatus`, `experimentStatus`, `designStatus`, `reflectionProvided`, `reflectionEvaluation: 'not-evaluated'`, `attemptCount`, `incorrectAttemptCount`, `questions` |
| Question | `labId`, `taskId`, `questionId`, `masteryStatus`, `completionStatus`, `attemptCount`, `incorrectAttemptCount`, `firstMasteredAttempt`, `latestCorrect` |
| Totals | `questionCount`, `masteredQuestionCount`, `taskCount`, `completedTaskCount`, `labCount`, `completedLabCount`, `attemptCount`, `incorrectAttemptCount` |

- `masteryStatus`: `mastered` หรือ `not-mastered` หมายถึงเคยตอบถูก ไม่ใช่คะแนนจากจำนวนครั้งผิด
- `completionStatus` และ `experimentStatus`: `complete` หรือ `incomplete`
- `designStatus`: `met` หรือ `not-met` ประเมินกราฟ **ปัจจุบัน** ส่วน completion เป็นประวัติว่าเคยทำครบ จึงอาจแสดงค่าต่างกันได้เมื่อทดลองต่อ
- `reflectionProvided`: ตรวจเฉพาะการกรอกในฉบับ **ปัจจุบัน** ไม่ตรวจความหมาย ส่วนหลักฐานตอนทำครบอยู่ใน state สำหรับทบทวนในหน้าเท่านั้น
- `latestCorrect`: `true`, `false` หรือ `null` เมื่อยังไม่เคยส่ง แยกจาก Mastery เพื่อแสดงการฝึกซ้ำอย่างตรงไปตรงมา
- `firstMasteredAttempt`: ลำดับครั้งแรกที่ตอบถูก เริ่มที่ 1 หรือ `null` ไม่เปลี่ยนเมื่อฝึกซ้ำ
- `questionsNeedingPractice`: รายการ `{ labId, taskId, questionId }` ของข้อที่ยังไม่ผ่านและเคยส่งแล้ว
- `repeatedAttemptQuestions`: รายการอ้างอิงข้อที่ผ่านครั้งแรกหลังครั้งที่ 1 หรือยังไม่ผ่านหลังตอบผิด ไม่ตีความการฝึกซ้ำโดยสมัครใจหลังผ่านครั้งแรกว่าเป็นข้อที่เคยเรียนรู้ช้า

รายงานรวมทุกคำถาม แม้ยังไม่เริ่ม โดยจำนวนครั้งเป็น 0 ไม่มี `selectedOptionIds`, เฉลย, raw history, คำคาดการณ์, ข้อความสะท้อนคิด, ชื่อ, อีเมล, รหัสนักเรียน หรือข้อมูลบัญชี

## การไหลของข้อมูล

```text
นิยามคำถาม → evaluateAnswer → submitAnswer → ประวัติและ Mastery
การตั้งค่ากราฟ → recordExperiment → หลักฐานเปรียบเทียบ
Mastery + หลักฐาน + เกณฑ์กราฟ + การกรอกสะท้อนคิด → completeTask
state → buildLearningSummary → summaryHtml
                           ↘ ตัวส่งออกในอนาคต
```

`evaluateAnswer(question, selectedIds)` ตรวจรูปแบบก่อนตรวจคำตอบและไม่แก้ค่าใด ๆ `submitAnswer(task, draft, questionId)` เป็นจุดเดียวที่เพิ่มประวัติคำตอบ หลังรับคำตอบจะปิดการส่งจน `retryQuestion(progress)` เปิดใหม่ `completeTask` ไม่เพิ่มประวัติการตอบ และเก็บสำเนาหลักฐานเมื่อทำครบครั้งแรก

รหัส snapshot ในประวัติเป็นรหัสภายในสถานการณ์ ไม่มีรหัสติดตามผู้ใช้ หลักฐานแต่ละรูปแบบบันทึกเพียงครั้งเดียว การคืนค่ากราฟไม่ลบหลักฐาน การเริ่มการฝึกใหม่ทั้งหมดล้าง Guided หลังยืนยัน โดยไม่เปลี่ยน Free Exploration

## LearningReportV1 และขอบเขต Google Classroom

Phase 1.2 เพิ่ม `LearningReportV1` เป็นแบบจำลองแยกจาก summary เดิม โดยมี `reportSchemaVersion`, `generatedAt`, `contentVersion`, `integrity`, `summary`, `includeDrafts` และ `evidence` รายสถานการณ์ หลักฐานมี lab/task IDs, source (`completed`/`in-progress`), experiments, finalChart, prediction และ reflections พร้อม `reflectionEvaluation: 'not-evaluated'` การสร้างใช้ deep copy จาก state ไม่อ่านข้อความย้อนจาก DOM และไม่เพิ่มสะท้อนคิดลง `LearningSummaryV1` เดิม

Classroom adapter ในอนาคตใช้ขอบเขต `prepare(summary, externalAssignmentContext)` เพื่อแปลงรายงานตามการจับคู่งานที่ระบบภายนอกจัดหา การยืนยันตัวตน การถือ token และการส่งเครือข่ายอยู่ภายนอกตัวประเมินและ state ของแล็บ ต้องกำหนดสิทธิ์และการยืนยันผลที่น่าเชื่อถือแยกต่างหาก

Phase 1.2 สร้าง PDF ในเครื่องและให้ผู้เรียนแนบไฟล์ใน Classroom ด้วยตนเอง **ไม่สร้าง transport หรือ OAuth stub ที่เก็บ credentials** ไม่เพิ่ม Google SDK ไม่แสดงปุ่มส่ง Classroom และไม่เรียก API ใด ๆ การออกแบบนี้ไม่ได้ยืนยันว่ามี API สำหรับนำเข้ากิจกรรมเป็น Google Practice Sets

## ความน่าเชื่อถือและความเข้ากันได้

- ข้อมูลและเฉลยอยู่ในเบราว์เซอร์ ผู้ใช้สามารถแก้ไขได้ `integrity` จึงเป็น `browser-unverified` เสมอ ห้ามใช้ DTO นี้เป็นหลักฐานคะแนนที่ยืนยันตัวตนแล้ว
- ค่าเริ่มต้นอยู่ในหน่วยความจำ เมื่อเลือกเปิดบันทึกจะกู้คืนได้จาก IndexedDB ตาม schema/content validation ดู `PERSISTENCE-AND-PDF.md`
- รักษารหัสเนื้อหาให้คงที่ เปลี่ยน `contentVersion` เมื่อเปลี่ยนเนื้อหา หากเปลี่ยนสัญญารายงานที่เข้ากันไม่ได้ให้เพิ่ม `schemaVersion`
- การส่ง Classroom อัตโนมัติ การแปลงเป็นคะแนน และการระบุตัวผู้เรียนยังไม่อยู่ในขอบเขต
