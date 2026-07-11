# คู่มือกู้คืนระบบฝากไฟล์ (Supabase) เมื่อขึ้น `ERR_NAME_NOT_RESOLVED`

## อาการ

- อัปโหลดไฟล์แล้วขึ้น "การอัปโหลดล้มเหลว"
- ใน DevTools Console เห็น
  `POST https://<project-ref>.supabase.co/functions/v1/share-session net::ERR_NAME_NOT_RESOLVED`
- หน้าเปิดลิงก์แชร์ (สแกน QR แล้ว) โหลดไฟล์ไม่ขึ้น

## สาเหตุ

`ERR_NAME_NOT_RESOLVED` แปลว่าโดเมนของโปรเจกต์ Supabase **ไม่มีอยู่ใน DNS แล้ว**
ไม่ใช่บั๊กของตัวเว็บ โดยเกือบทั้งหมดเกิดจากอย่างใดอย่างหนึ่งนี้:

1. **โปรเจกต์ถูกระงับ (Paused)** — แผนฟรีของ Supabase จะหยุดโปรเจกต์อัตโนมัติ
   เมื่อไม่มีการใช้งานประมาณ 1 สัปดาห์ เมื่อถูกหยุด DNS ของโปรเจกต์จะถูกถอดออก
2. **โปรเจกต์ถูกลบ** — ลบเอง หรือถูกลบถาวรหลังจากถูก pause นานเกิน 90 วัน

## วิธีแก้ กรณีที่ 1: โปรเจกต์แค่ถูก Pause (ง่ายสุด)

1. เข้า <https://supabase.com/dashboard> แล้ว login
2. เลือกโปรเจกต์ที่ขึ้นสถานะ **Paused**
3. กดปุ่ม **Restore project** แล้วรอ 2–5 นาที
4. เสร็จแล้วใช้งานได้ทันที — URL เดิม, key เดิม, ข้อมูลและ Edge Functions ยังอยู่ครบ
   ไม่ต้อง deploy อะไรใหม่

## วิธีแก้ กรณีที่ 2: โปรเจกต์ถูกลบแล้ว (ต้องสร้างใหม่)

### 2.1 สร้างโปรเจกต์ใหม่

1. Dashboard → **New project** (แนะนำ region: `Southeast Asia (Singapore)`)
2. จดค่า 2 ตัวจากหน้า **Project Settings → API**:
   - Project URL เช่น `https://xxxx.supabase.co`
   - `anon` / publishable key

### 2.2 สร้างตาราง + Bucket + สิทธิ์ทั้งหมดด้วย migration เดียว

เปิด **SQL Editor** ใน Dashboard แล้ววางเนื้อหาไฟล์
[`supabase/migrations/0001_harden_qr_files_log.sql`](../supabase/migrations/0001_harden_qr_files_log.sql)
ทั้งไฟล์ แล้วกด Run — สคริปต์นี้สร้างตาราง `qr_files_log`, bucket `qr-files`,
RLS และ storage policies ให้ครบในครั้งเดียว

### 2.3 Deploy Edge Functions (ต้องใช้ [Supabase CLI](https://supabase.com/docs/guides/cli))

```bash
supabase login
supabase link --project-ref <project-ref-ใหม่>

supabase secrets set ADMIN_SECRET="<รหัสลับยาวๆ สำหรับหน้าแอดมิน>" SHARE_EXPIRY_DAYS=7

supabase functions deploy share-session
supabase functions deploy share-finalize
supabase functions deploy admin-shares
supabase functions deploy cleanup-expired-shares
```

### 2.4 อัปเดตค่าเชื่อมต่อฝั่งเว็บ

แก้ 2 ที่ให้ตรงกับโปรเจกต์ใหม่:

- ไฟล์ `.env` ในเครื่อง (สำหรับ dev):

  ```dotenv
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon key ใหม่>
  ```

- **Vercel** → Project → Settings → Environment Variables →
  แก้ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` แล้วกด **Redeploy**
  (ค่า `VITE_*` ถูกฝังตอน build — แก้ env เฉย ๆ โดยไม่ redeploy จะยังไม่มีผล)

> หมายเหตุ: ลิงก์แชร์/QR ที่สร้างจากโปรเจกต์เก่าจะใช้ไม่ได้อีก เพราะไฟล์เก็บอยู่ใน
> โปรเจกต์เดิมที่หายไปแล้ว ต้องอัปโหลดและสร้าง QR ใหม่

## ระบบกันหลับอัตโนมัติ (ติดตั้งแล้วในโค้ด — ต้องตั้งค่าครั้งเดียว)

โปรเจกต์นี้มีระบบ ping กันหลับ 2 ชั้น เพื่อไม่ให้ Supabase ว่างงานครบ 7 วันอีก:

| ชั้น | ไฟล์ | ความถี่ | เงื่อนไขการทำงาน |
| --- | --- | --- | --- |
| Vercel Cron | `api/keepalive.ts` + `vercel.json` | ทุกวัน 03:00 น. | ทำงานทันทีหลัง redeploy (ใช้ env เดิมที่มีอยู่แล้ว) |
| GitHub Actions | `.github/workflows/supabase-keepalive.yml` | อังคาร/ศุกร์ 03:00 น. | ต้องเพิ่ม secrets ใน GitHub ก่อน (ดูด้านล่าง) |

ทั้งสองตัวยิง SELECT จริงไปที่ฐานข้อมูล (การนับ "activity" ของ Supabase นับจาก
กิจกรรมฐานข้อมูล ไม่ใช่แค่เปิดหน้าเว็บ) และถ้าตั้งค่า `ADMIN_SECRET` ไว้
จะเรียกฟังก์ชัน `cleanup-expired-shares` ลบไฟล์หมดอายุให้ไปในตัวด้วย

### ตั้งค่าครั้งเดียว

1. **Vercel** — โปรเจกต์มี `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` อยู่แล้ว
   แค่ **Redeploy** หลัง push โค้ดชุดนี้ cron จะเริ่มทำงานเอง
   (แนะนำ: เพิ่ม env `ADMIN_SECRET` ด้วยเพื่อเปิดระบบลบไฟล์หมดอายุ)
2. **GitHub** — ไปที่ repo → Settings → Secrets and variables → Actions แล้วเพิ่ม:
   - `SUPABASE_URL` เช่น `https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY` คีย์ anon/publishable ตัวเดียวกับใน `.env`
   - `ADMIN_SECRET` (ไม่บังคับ) เพื่อเปิดขั้นตอนลบไฟล์หมดอายุ
3. ทดสอบได้ทันทีที่แท็บ **Actions → Supabase keep-alive → Run workflow**

### ข้อดีแฝง: ระบบแจ้งเตือนล่ม

ถ้าโปรเจกต์ Supabase ล่ม/โดนระงับเมื่อไร GitHub Actions จะรันไม่ผ่านและ
**ส่งอีเมลแจ้งเจ้าของ repo อัตโนมัติ** ทำให้รู้ปัญหาก่อนลูกค้าโทรมา

> หมายเหตุ: GitHub จะหยุด scheduled workflow อัตโนมัติถ้า repo ไม่มีความ
> เคลื่อนไหวนานเกิน 60 วัน — แต่ไม่เป็นไร เพราะ Vercel Cron ยังยิงทุกวันอยู่
> (Vercel ไม่มีนโยบายหยุด cron)

### ทางเลือกจ่ายเงิน (ชัวร์ 100% โดยไม่ต้องพึ่ง cron)

- **อัพเกรดเป็นแผน Pro ($25/เดือน)** — โปรเจกต์ under paid plan จะไม่ถูก pause
  อัตโนมัติเลย เหมาะถ้าหน่วยงานมีงบประมาณรายเดือน

## เช็คเร็ว ๆ ว่าตอนนี้โปรเจกต์ยังมีชีวิตอยู่ไหม

รันใน PowerShell:

```powershell
Resolve-DnsName <project-ref>.supabase.co
```

- ได้ IP กลับมา → โปรเจกต์ยังทำงาน ปัญหาอยู่ที่อื่น
- `DNS name does not exist` → โปรเจกต์ถูก pause/ลบ ให้ทำตามคู่มือนี้
