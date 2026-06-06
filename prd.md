# Product Requirements Document (PRD) - MiniQR Code Generator

---

## 1. Document Metadata
*   **Product Name:** MiniQR Code Generator
*   **Status:** Active / Specification
*   **Target Audience:** Citizens, municipal officers, computer technicians, and developers under Nakhon Sawan Municipality.
*   **Version:** 1.0

---

## 2. Problem Statement
Users under the Nakhon Sawan Municipality need a lightweight, high-performance, and elegant client-side tool to generate custom QR codes (single and batch) and share multiple files securely without relying on clunky interfaces, heavy server processing, or basic un-styled QR code generators.

---

## 3. Product Vision & Goals
MiniQR is designed to be an ultra-premium, modern-municipal, and highly functional client-side QR code generator.
*   **Aesthetics:** Sleek dark/light themes, smooth gradients, and premium interactive layouts.
*   **Client-Side Efficiency:** Bundle and package files client-side before uploading to minimize server load.
*   **Customization:** Enable extensive styling (dots, corners, logos, frames) to align with brand guidelines.

---

## 4. Functional Requirements

### 4.1. QR Code Content & Payload Types
The application must support generating QR codes for the following input payloads:
*   **URL:** Simple web link routing.
*   **Text:** Plain text representation.
*   **Wi-Fi:** Network configuration details (SSID, Password, Encryption Type).
*   **vCard:** Contact card properties (Name, Phone, Email, Organization).
*   **Attach Files (Multi-File QR Code):**
    *   Enable attaching multiple files.
    *   Package files client-side into a single `.zip` archive.
    *   Upload the zipped package to Supabase Storage (bucket `qr-files` with public read policies).
    *   Encode the public download URL of the uploaded archive into the generated QR code.

### 4.2. Custom Styling & Design Options
Users can customize the appearance of the QR code using a variety of design controls:
*   **Dot Styles:** Support rounded, classy, extra-rounded, square, and other styled dots.
*   **Corner Styles:** Custom shapes for corner squares (outer border) and corner dots (inner center).
*   **Colors:** Custom single color or gradient colors for dots, corners, and background.
*   **Logo Upload:**
    *   Allow users to upload an image logo to be centered inside the QR code.
    *   **Security Control:** Validate uploaded logo URLs to prevent malicious scripts (e.g., rejecting `javascript:`, `data:text/html`, and unsafe schemes). Only permit safe URLs (`http://`, `https://`, safe `data:image/` payloads, or relative asset paths).
*   **Frame & Caption:**
    *   Add styled frames around the QR code.
    *   Customizable frame text/caption.
    *   Support custom frame background images.

### 4.3. Save & Load Configurations
*   **Save Configuration:** Users can download their current QR code design settings, colors, presets, and payload inputs as a JSON configuration file.
*   **Load Configuration:** Users can upload a previously saved JSON config file to instantly restore their design and input state in the editor.

### 4.4. Export & Bulk Actions
*   **Standard Export:** Support downloading the generated QR code in SVG, PNG, and JPG formats.
*   **Batch Generation:**
    *   Allow bulk generation of QR codes from structured list data or CSV inputs.
    *   Batch download all generated QR codes in a zipped bundle.

### 4.5. Sponsor Modal (Donations)
*   An interactive popup modal displaying a dynamically calculated PromptPay QR code to receive support donations, hardcoded with the municipality technical officer's account info.

---

## 5. Non-Functional & UI/UX Requirements
*   **Performance:** Client-side rendering of QR codes must update in real-time as users modify settings.
*   **Accessibility:** Meet WCAG AA contrast standards.
*   **Responsiveness:** Fully adaptive layout across mobile, tablet, and desktop viewports.
*   **Localization:** Support Thai and English languages (via a toggle).
