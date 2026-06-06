# Context: MiniQR Domain Glossary

This document defines the core business and domain concepts used in the MiniQR project.

## Glossary

### Multi-File QR Code (QR แนบไฟล์หลายไฟล์)
A QR code that encodes a public download URL pointing to a client-side zipped package of multiple files uploaded to the storage server.

### Zip Packaging (การบีบอัดไฟล์)
The process of bundling multiple files selected by the user into a single `.zip` archive client-side before uploading, ensuring multiple files can be shared via a single QR code URL.

### Supabase Storage (ระบบเก็บไฟล์คลาวด์)
The public cloud storage service used to host the zipped archives. Access is governed by specific bucket name configurations (`qr-files`) and public read policies.

### Sponsor Modal (หน้าต่างสนับสนุน)
An interactive pop-up dialog that displays a dynamically calculated PromptPay QR code to receive support donations, hardcoded with the computer technical officer's information.
