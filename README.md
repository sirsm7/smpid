# SMPID (Sistem Maklumat Penyelaras ICT & Admin DELIMa)
**Project Reference & Technical Documentation**

## 1. PROJECT OVERVIEW
SMPID is a comprehensive, serverless web application designed for the District Education Office (PPD Alor Gajah). It acts as a centralized digital hub for managing school ICT coordinators, monitoring digital competency scores, handling support tickets, managing workshop bookings, and centralizing student/teacher achievements.

### 1.1. Tech Stack
* **Frontend:** HTML5, Vanilla JavaScript (ES6 Modules), Tailwind CSS (via CDN).
* **Backend & Database:** Supabase (PostgreSQL) for real-time database and authentication logic.
* **Edge Computing & Bot:** Deno Deploy running `main.ts` (grammY framework for Telegram Bot and REST API webhooks).
* **File Storage & Email:** Google Apps Script (GAS) utilized as microservices for Base64 image/PDF uploads to Google Drive and batch email sending.

---

## 2. DIRECTORY & FILE STRUCTURE

### 2.1. Core Application Pages
* `index.html`: Landing page with dynamic school search.
* `public.html`: Public data submission form (Achievements/Certifications) with file upload.
* `user.html`: School portal for updating profiles, submitting tickets, and viewing analytics.
* `admin.html`: Centralized admin dashboard with strict RBAC, data tables, analytics, and email blaster.
* `login.html`: Authentication portal.
* `gallery.html`: Public-facing visual gallery of school achievements.
* `about.html`: System documentation and blueprint.

### 2.2. JavaScript Architecture (`/js/`)
* **`/core/`**: 
    * `db.js`: Supabase client initialization.
    * `helpers.js`: Global utilities (loading states, UI formatters, GAS file upload logic).
    * `auth.guard.js`: Middleware for route protection using `localStorage`.
* **`/config/`**:
    * `app.config.js`: Centralized environment variables (Supabase keys, Deno URLs, GAS URLs).
    * `dropdowns.js`: Centralized dropdown data (Positions, Levels, Providers, Years, Workshops).
* **`/services/`**: Data Access Layer abstracting Supabase calls.
    * `auth.service.js`, `school.service.js`, `achievement.service.js`, `dcs.service.js`, `support.service.js`, `booking.service.js`.
* **`/admin/`**: Admin-specific controllers (`main.js`, `dashboard.js`, `analysis.js`, `achievement.js`, `communication.js`, `gallery_manager.js`, `booking_manager.js`, `settings.js`).

### 2.3. Sub-Modules (`/modules/`)
* **`/booking/`**: Workshop booking system with overlap protection and 3-tier slot logic (Morning, Afternoon, Full Day).
* **`/pppdm/`**: High-level data visualization dashboard separating Primary (SR) and Secondary (SM) schools.
* **`/spka/`**: AI Prompt Engineering educational tool (SirSM.AI).
* **`/bankgemini/`**: Interactive flashcards and study hub for Google Certified Educator preparation.

---

## 3. AUTHENTICATION & RBAC (Role-Based Access Control)

The system relies on `localStorage` for session persistence across tabs.
* **Session Keys:** `smpid_user_kod`, `smpid_user_role`, `smpid_user_id`, `smpid_auth`.
* **Roles:**
    * `School User`: Authenticated via `kod_sekolah`. `smpid_auth` is set to `false`. Bound to `user.html`.
    * `ADMIN` (Mod Admin): Access to dashboard, data management, email blaster. Bound to `admin.html`.
    * `PPD_UNIT`: Restricted admin access. Can only view/manage achievements and users. Excluded from dashboard and analytics.
    * `SUPER_ADMIN`: Absolute power. Can create new admins and force-reset user passwords.

---

## 4. DATABASE SCHEMA (SUPABASE INFERENCE)

Based on the service layer, the following tables drive the application:

1.  **`smpid_users`**: Authentication table.
    * Fields: `id`, `email`, `password`, `role`, `kod_sekolah`.
2.  **`smpid_admin_users`**: Links roles to Telegram IDs for notifications.
    * Fields: `role` (e.g., 'ppd_gpict'), `telegram_id`.
3.  **`smpid_sekolah_data`**: Master school profiles.
    * Fields: `kod_sekolah`, `nama_sekolah`, `jenis_sekolah`, `daerah`, `parlimen`, PGB/GPK/GPICT/Admin details, `telegram_id_gpict`, `telegram_id_admin`.
4.  **`smpid_pencapaian`**: Kemenjadian (Achievements) records.
    * Fields: `id`, `kod_sekolah`, `kategori`, `nama_peserta`, `jawatan`, `nama_pertandingan`, `peringkat`, `tahun`, `pencapaian`, `pautan_bukti`, `jenis_rekod`, `penyedia`.
5.  **`smpid_aduan`**: Helpdesk ticketing system.
    * Fields: `id`, `kod_sekolah`, `peranan_pengirim`, `tajuk`, `butiran_masalah`, `status`, `balasan_admin`, `created_at`.
6.  **`smpid_dcs_analisa`**: Digital Competency Scores.
    * Fields: `kod_sekolah`, `dcs_2023`, `dcs_2024`, `dcs_2025`, `peratus_aktif_2023`, `peratus_aktif_2024`, `peratus_aktif_2025`.
7.  **`smpid_bb_tempahan`**: Booking records.
    * Fields: `id`, `id_tempahan`, `tarikh`, `masa` ('Pagi', 'Petang', '1 HARI'), `kod_sekolah`, `nama_sekolah`, `tajuk_bengkel`, `nama_pic`, `no_tel_pic`, `status`.
8.  **`smpid_bb_kunci`**: Admin locked dates for booking.
    * Fields: `id`, `tarikh`, `komen`, `admin_email`.

---

## 5. EXTERNAL INTEGRATIONS

### 5.1. Deno Deploy (Telegram Bot & Webhooks)
* **File:** `main.ts`
* **Bot Logic:** Allows school admins and PPD officers to bind their Telegram IDs to their roles in the database.
* **Webhooks:** Exposes REST endpoints to trigger Telegram messages from the frontend frontend:
    * `POST /notify`: School profile updates.
    * `POST /notify-ticket`: New helpdesk tickets.
    * `POST /reply-ticket`: Admin replies to tickets.
    * `POST /notify-booking`: New workshop bookings.

### 5.2. Google Apps Script (GAS) Microservices
* **Email Blaster:** Receives JSON payload containing `bcc` list, `subject`, and `htmlBody`. Used in `communication.js` with batch chunking (50 emails per batch) to bypass Google limitations.
* **File Upload Engine:** Receives Base64 encoded strings from the frontend, decodes them, saves the file to a specific Google Drive folder, and returns the public sharing URL.

---

## 6. KEY LOGIC HIGHLIGHTS

* **Booking Overlap Protection:** In `booking.service.js`, if a user selects `1 HARI`, the system verifies that neither `Pagi` nor `Petang` are booked. If `Pagi` or `Petang` is selected, it ensures `1 HARI` is not booked. Saturdays only allow `Pagi` slots.
* **File Upload Hybrid System:** In forms, if a user uploads a new file, it processes via GAS. If left empty during an "Edit" operation, it retains the existing `pautan_bukti` URL from Supabase.
* **Dynamic Data Standardization:** In `achievement.js`, an admin tool allows batch-updating mispelled program names (`batchUpdateProgramName`) across all database records instantly.