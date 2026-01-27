/**
 * SMPID MASTER JAVASCRIPT FILE (app.js)
 * Versi: 2.0 (Supabase Auth Integration + Full Legacy Support)
 * Host Database: app.tech4ag.my
 */

// ==========================================
// 1. KONFIGURASI UTAMA
// ==========================================
const SUPABASE_URL = 'https://app.tech4ag.my';
// Anon Key (Public) - Selamat untuk Frontend
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';

// URL Deno Deploy untuk Notifikasi Telegram (Kekal)
const DENO_API_URL = 'https://smpid-40.ppdag.deno.net'; 

// ==========================================
// 2. INISIALISASI SUPABASE
// ==========================================
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Ready (Auth v2).");
} else {
    console.error("Supabase library not loaded.");
}

// ==========================================
// 3. FUNGSI UTILITI GLOBAL
// ==========================================
function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) cleaned = '6' + cleaned;
    return cleaned;
}

function autoFormatPhone(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

function checkEmailDomain(email) {
    return email.includes("@moe-dl.edu.my");
}

function formatSentenceCase(str) {
    if (!str) return "";
    return str.replace(/(?:^|[\.\!\?]\s+)([a-z])/g, function(match) {
        return match.toUpperCase();
    });
}

function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 4. LOGIK AUTHENTICATION & LOGIN (BARU)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Semak sesi login semasa
    const { data: { session } } = await supabaseClient.auth.getSession();
    const bodyId = document.body.id;

    if (bodyId === 'page-login') {
        if (session) {
            // Jika dah login, redirect ke page sepatutnya
            checkRoleAndRedirect(session.user.id);
        } else {
            // Jika belum login, clear storage untuk keselamatan
            sessionStorage.clear();
        }
    } 
    else if (bodyId === 'page-admin' || bodyId === 'page-user') {
        if (!session) {
            window.location.replace('index.html'); // Tendang keluar jika tiada sesi
        } else {
            // Jalankan fungsi halaman masing-masing
            if (bodyId === 'page-admin') initAdminPanel();
            if (bodyId === 'page-user') initUserPortal(session.user);
        }
    }
});

// Fungsi Login Utama (Menggantikan sistem login lama)
async function prosesLogin() {
    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value;

    if (!email || !password) {
        Swal.fire('Ralat', 'Sila masukkan emel dan kata laluan.', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Login berjaya, semak role
        console.log("Login Berjaya:", data.user.id);
        await checkRoleAndRedirect(data.user.id);

    } catch (err) {
        toggleLoading(false);
        console.error("Login Error:", err);
        Swal.fire('Log Masuk Gagal', 'Emel atau kata laluan salah.', 'error');
    }
}

// Fungsi Semak Role & Redirect
async function checkRoleAndRedirect(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('smpid_users')
            .select('role, kod_sekolah')
            .eq('id', userId)
            .single();

        if (error || !data) throw new Error("Profil pengguna tidak dijumpai.");

        // Simpan info asas dalam session storage untuk rujukan pantas UI
        sessionStorage.setItem('smpid_role', data.role);
        sessionStorage.setItem('smpid_kod', data.kod_sekolah || "");
        sessionStorage.setItem('smpid_auth', 'true'); // Backward compatibility

        if (data.role === 'PPD') {
            window.location.replace('admin.html');
        } else {
            window.location.replace('user.html');
        }

    } catch (err) {
        console.error(err);
        Swal.fire('Ralat Sistem', 'Gagal mendapatkan profil pengguna.', 'error');
        toggleLoading(false);
    }
}

function keluarSistem() {
    Swal.fire({
        title: 'Log Keluar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await supabaseClient.auth.signOut();
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    });
}

// ==========================================
// 5. MODUL USER PORTAL (user.html)
// ==========================================
async function initUserPortal(user) {
    // Dapatkan data fresh dari DB
    const { data: userProfile } = await supabaseClient
        .from('smpid_users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (!userProfile) return;

    const kod = userProfile.kod_sekolah;
    const role = userProfile.role;

    // Simpan kod untuk kegunaan borang lama
    sessionStorage.setItem('smpid_user_kod', kod);
    document.getElementById('hiddenKodSekolah').value = kod;

    // Paparan Header
    document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    
    // Load nama sekolah
    loadNamaSekolah(kod);

    // LOGIK PAPARAN BERDASARKAN ROLE
    if (role === 'SEKOLAH') {
        setupDashboardSekolah(kod);
    } else {
        setupDashboardGuru(kod, role);
    }
}

async function loadNamaSekolah(kod) {
    const { data } = await supabaseClient.from('smpid_sekolah_data').select('nama_sekolah, daerah').eq('kod_sekolah', kod).single();
    if(data) {
        const elNama = document.getElementById('dispNamaSekolah');
        if(elNama) elNama.innerText = data.nama_sekolah;
        
        const elDaerah = document.getElementById('dispKodDaerah');
        if(elDaerah) elDaerah.innerText = `KOD: ${kod} | DAERAH: ${data.daerah || '-'}`;

        // Update header utama
        const elHeaderNama = document.querySelector('.header-bg h3');
        if(elHeaderNama) elHeaderNama.innerText = data.nama_sekolah; 
    }
}

// A. SETUP UNTUK GURU (GPICT/DELIMA)
function setupDashboardGuru(kod, role) {
    document.getElementById('section-menu').classList.remove('hidden');
    document.getElementById('welcomeText').innerText = `Selamat Datang, ${role}`;
    
    // Load Data Profil untuk Form Kemaskini (Guna fungsi sedia ada)
    loadProfil(kod);
}

// B. SETUP UNTUK ADMIN SEKOLAH (MODUL BARU)
function setupDashboardSekolah(kod) {
    document.getElementById('welcomeText').innerText = "Akaun Pentadbir Sekolah";
    document.getElementById('section-menu').classList.remove('hidden');
    
    // Sembunyikan borang profil biasa kerana Sekolah urus akses, bukan data diri sendiri
    // Sekolah masih boleh view profil melalui modul akses
    
    // Tambah kad menu khas "Pengurusan Akses"
    const menuSection = document.getElementById('section-menu');
    const existingRow = menuSection.querySelector('.row');
    
    const accessCardHTML = `
        <div class="col-md-12 fade-up">
            <div class="card menu-card p-4 text-center border-primary border-2">
                <div class="card-body d-flex flex-column">
                    <div class="icon-box bg-primary bg-opacity-10 text-primary">
                        <i class="fas fa-users-cog"></i>
                    </div>
                    <h4 class="fw-bold mb-2">Pengurusan Akses Guru</h4>
                    <p class="text-muted mb-4 flex-grow-1 small">
                        Aktifkan akaun atau reset kata laluan GPICT & Admin DELIMa.
                    </p>
                    <button onclick="bukaModalAkses('${kod}')" class="btn btn-primary btn-menu shadow-sm">
                        <i class="fas fa-lock-open me-2"></i>Urus Akses
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Masukkan kad baru di bahagian atas
    existingRow.insertAdjacentHTML('afterbegin', accessCardHTML);
}

// ==========================================
// 6. LOGIK PENGURUSAN AKSES (MODAL SEKOLAH)
// ==========================================
async function bukaModalAkses(kod) {
    toggleLoading(true);

    // 1. Dapatkan data profil guru (nama, emel delima)
    const { data: profail } = await supabaseClient
        .from('smpid_sekolah_data')
        .select('nama_gpict, emel_delima_gpict, nama_admin_delima, emel_delima_admin_delima')
        .eq('kod_sekolah', kod)
        .single();

    // 2. Dapatkan status akaun aktif dari smpid_users
    const { data: users } = await supabaseClient
        .from('smpid_users')
        .select('role, email')
        .eq('kod_sekolah', kod);

    toggleLoading(false);

    const gpictAktif = users.find(u => u.role === 'GPICT');
    const delimaAktif = users.find(u => u.role === 'DELIMA');

    let htmlContent = `
    <div class="text-start">
        <div class="alert alert-info small">
            <i class="fas fa-info-circle me-1"></i> Kata laluan lalai (default) untuk semua guru ialah: <b>${kod}@ppdag</b>
        </div>
        
        <!-- ROW GPICT -->
        <div class="card mb-3 border p-3 bg-light">
            <div class="d-flex justify-content-between align-items-center mb-2">
                 <h6 class="fw-bold text-primary mb-0">GPICT</h6>
                 ${gpictAktif ? '<span class="badge bg-success">AKTIF</span>' : '<span class="badge bg-secondary">BELUM AKTIF</span>'}
            </div>
            <p class="mb-1 small text-uppercase fw-bold text-dark">${profail.nama_gpict || 'TIADA NAMA'}</p>
            <p class="mb-3 small text-muted font-monospace">${profail.emel_delima_gpict || 'Tiada Emel'}</p>
            ${renderButtonAkses(kod, 'GPICT', profail.emel_delima_gpict, gpictAktif)}
        </div>

        <!-- ROW ADMIN DELIMA -->
        <div class="card mb-2 border p-3 bg-light">
            <div class="d-flex justify-content-between align-items-center mb-2">
                 <h6 class="fw-bold text-success mb-0">ADMIN DELIMa</h6>
                 ${delimaAktif ? '<span class="badge bg-success">AKTIF</span>' : '<span class="badge bg-secondary">BELUM AKTIF</span>'}
            </div>
            <p class="mb-1 small text-uppercase fw-bold text-dark">${profail.nama_admin_delima || 'TIADA NAMA'}</p>
            <p class="mb-3 small text-muted font-monospace">${profail.emel_delima_admin_delima || 'Tiada Emel'}</p>
            ${renderButtonAkses(kod, 'DELIMA', profail.emel_delima_admin_delima, delimaAktif)}
        </div>
    </div>`;

    Swal.fire({
        title: 'Pengurusan Akses',
        html: htmlContent,
        showCloseButton: true,
        showConfirmButton: false,
        width: '600px'
    });
}

function renderButtonAkses(kod, role, email, userAktif) {
    if (!email) return `<button class="btn btn-secondary btn-sm w-100 disabled" disabled>Kemaskini Profil Dahulu</button>`;
    
    if (userAktif) {
        return `
        <div class="d-flex gap-2">
            <button onclick="resetPasswordGuru('${email}', '${kod}')" class="btn btn-outline-danger btn-sm w-100" title="Reset Password Default">
                <i class="fas fa-undo me-1"></i> Reset Password
            </button>
        </div>`;
    } else {
        return `<button onclick="aktifkanAkaun('${kod}', '${role}', '${email}')" class="btn btn-primary btn-sm w-100 fw-bold shadow-sm">
            <i class="fas fa-power-off me-1"></i> Aktifkan Akses
        </button>`;
    }
}

// Fungsi Backend: Aktifkan Akaun
async function aktifkanAkaun(kod, role, email) {
    const defaultPass = `${kod}@ppdag`;
    
    const confirm = await Swal.fire({
        title: 'Aktifkan Akaun?',
        text: `Akaun akan dicipta untuk ${email} dengan password: ${defaultPass}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Aktifkan'
    });

    if (!confirm.isConfirmed) return;

    toggleLoading(true);
    
    try {
        // Panggil RPC (Stored Procedure di Database)
        const { error } = await supabaseClient.rpc('create_smpid_user_sql', {
            u_email: email,
            u_password: defaultPass,
            u_role: role,
            u_kod_sekolah: kod
        });

        if (error) throw error;

        toggleLoading(false);
        Swal.fire('Berjaya', `Akaun ${role} telah diaktifkan.`, 'success').then(() => bukaModalAkses(kod));

    } catch (err) {
        toggleLoading(false);
        console.error(err);
        Swal.fire('Ralat', 'Gagal mengaktifkan akaun. Sila cuba lagi.', 'error');
    }
}

// Fungsi Backend: Reset Password
async function resetPasswordGuru(email, kod) {
    const defaultPass = `${kod}@ppdag`;
    
    const confirm = await Swal.fire({
        title: 'Reset Kata Laluan?',
        text: `Kata laluan akan dikembalikan kepada asal: ${defaultPass}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset'
    });

    if (!confirm.isConfirmed) return;

    toggleLoading(true);
    
    try {
        // Panggil RPC Reset Password (Perlu function SQL baru: reset_smpid_password_sql)
        // Kita gunakan function create_smpid_user_sql juga boleh jika ia menyokong upsert/update, 
        // tapi sebaiknya ada function khusus untuk reset password.
        
        // JIKA TIADA RPC KHUSUS, kita boleh gunakan logik delete & recreate (Cara pantas tapi kasar)
        // ATAU (Better): Admin PPD boleh reset, tapi di sini Sekolah yang reset.
        // Oleh itu, kita akan gunakan RPC `reset_smpid_user_password`.
        
        const { error } = await supabaseClient.rpc('reset_smpid_user_password', {
            u_email: email,
            u_password: defaultPass
        });

        if (error) throw error;

        toggleLoading(false);
        Swal.fire('Selesai', `Kata laluan telah di-reset kepada ${defaultPass}`, 'success');
        
    } catch (err) {
        toggleLoading(false);
        console.error(err);
        // Fallback Error Message
        Swal.fire('Ralat', 'Gagal reset. Pastikan fungsi database wujud.', 'error');
    }
}

// ==========================================
// 7. FUNGSI BORANG & PROFIL (LOGIK ASAL)
// ==========================================

function showSection(section) {
    if (section === 'menu') {
        document.getElementById('section-menu').classList.remove('hidden');
        document.getElementById('section-profil').classList.add('hidden');
        document.getElementById('section-aduan').classList.add('hidden');
        // Reset welcome text ikut role
        const role = sessionStorage.getItem('smpid_role');
        document.getElementById('welcomeText').innerText = role === 'SEKOLAH' ? "Akaun Pentadbir Sekolah" : `Selamat Datang, ${role}`;
    } else if (section === 'profil') {
        document.getElementById('section-menu').classList.add('hidden');
        document.getElementById('section-profil').classList.remove('hidden');
        document.getElementById('section-aduan').classList.add('hidden');
        document.getElementById('welcomeText').innerText = "Kemaskini Maklumat";
    } else if (section === 'aduan') {
        document.getElementById('section-menu').classList.add('hidden');
        document.getElementById('section-profil').classList.add('hidden');
        document.getElementById('section-aduan').classList.remove('hidden');
        document.getElementById('welcomeText').innerText = "Helpdesk & Aduan";
        loadTiketUser();
    }
}

async function loadProfil(kod) {
    try {
        const { data, error } = await supabaseClient.from('smpid_sekolah_data').select('*').eq('kod_sekolah', kod).single();
        if (error) throw error;
        
        const elNama = document.getElementById('dispNamaSekolah');
        if(elNama) elNama.innerText = data.nama_sekolah;
        
        const elDaerah = document.getElementById('dispKodDaerah');
        if(elDaerah) elDaerah.innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        const fields = {
            'gpictNama': data.nama_gpict, 'gpictTel': data.no_telefon_gpict, 'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 'adminTel': data.no_telefon_admin_delima, 'adminEmel': data.emel_delima_admin_delima
        };
        for (let id in fields) { if(document.getElementById(id)) document.getElementById(id).value = fields[id] || ""; }
    } catch (err) { console.error(err); }
}

function salinData() {
    if (document.getElementById('checkSama').checked) {
        ['Nama','Tel','Emel'].forEach(suffix => {
            document.getElementById('admin'+suffix).value = document.getElementById('gpict'+suffix).value;
        });
    }
}

async function simpanProfil() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const namaSekolah = document.getElementById('dispNamaSekolah').innerText;
    const emelG = document.getElementById('gpictEmel').value;
    const btnSubmit = document.querySelector('#dataForm button[type="submit"]');
    
    // Periksa role untuk tujuan notifikasi
    const role = sessionStorage.getItem('smpid_role');

    if (!checkEmailDomain(emelG)) { Swal.fire('Format Salah', 'Gunakan emel moe-dl.edu.my', 'warning'); return; }

    if(btnSubmit) btnSubmit.disabled = true;
    toggleLoading(true);

    const payload = {
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: emelG,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: document.getElementById('adminEmel').value
    };

    try {
        const { error } = await supabaseClient.from('smpid_sekolah_data').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;

        // Notifikasi ke Telegram Admin
        if (DENO_API_URL) {
            fetch(`${DENO_API_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: kod, 
                    nama: namaSekolah,
                    updated_by: role === 'PPD' ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH' 
                })
            })
            .catch(err => console.warn("Gagal hubungi bot:", err));
        }

        toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => showSection('menu'));
    } catch (err) {
        toggleLoading(false); 
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Ralat', 'Gagal simpan data.', 'error');
        console.error(err);
    }
}

// ==========================================
// 8. MODUL TIKET / HELPDESK (LOGIK ASAL)
// ==========================================

async function hantarTiket() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesejRaw = document.getElementById('tiketMesej').value;
    const mesej = formatSentenceCase(mesejRaw);

    const btnSubmit = document.querySelector('#formTiket button[type="submit"]');

    if (!peranan) { Swal.fire('Pilih Jawatan', 'Sila nyatakan peranan anda.', 'warning'); return; }

    if(btnSubmit) btnSubmit.disabled = true;
    toggleLoading(true);

    try {
        // Simpan ke DB
        const { error } = await supabaseClient
            .from('smpid_aduan')
            .insert([{ kod_sekolah: kod, peranan_pengirim: peranan, tajuk: tajuk, butiran_masalah: mesej }]);
        
        if (error) throw error;

        // Notify PPD
        if (DENO_API_URL) {
            fetch(`${DENO_API_URL}/notify-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, mesej: mesej })
            }).catch(e => console.warn("Bot offline?", e));
        }

        toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Tiket Dihantar', 'Pihak PPD telah dimaklumkan.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            loadTiketUser();
        });

    } catch (err) {
        toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Ralat', 'Gagal menghantar tiket.', 'error');
    }
}

async function loadTiketUser() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const tbody = document.getElementById('senaraiTiketUser');
    if(!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from('smpid_aduan')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Tiada rekod aduan.</td></tr>`;
            return;
        }

        data.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString('ms-MY');
            const statusClass = t.status === 'SELESAI' ? 'text-success fw-bold' : 'text-warning fw-bold';
            const balasan = t.balasan_admin ? `<div class="mt-1 small text-primary border-start border-2 ps-2 border-primary"><b>PPD:</b> ${t.balasan_admin}</div>` : `<span class="text-muted small">- Menunggu Respon -</span>`;

            const row = `
            <tr>
                <td>${date}</td>
                <td><span class="badge bg-secondary">${t.peranan_pengirim}</span></td>
                <td>${t.tajuk}</td>
                <td class="${statusClass}">${t.status}</td>
                <td>${balasan}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// 9. MODUL ADMIN PANEL (LOGIK ASAL + AUTH BARU)
// ==========================================

let dashboardData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;
let emailRawData = [];
let currentFilteredList = [];

function initAdminPanel() {
    // Pastikan user adalah PPD
    const role = sessionStorage.getItem('smpid_role');
    if (role !== 'PPD') {
        window.location.replace('user.html');
        return;
    }
    
    // Tab Listeners
    const emailTabBtn = document.getElementById('email-tab');
    if (emailTabBtn) emailTabBtn.addEventListener('shown.bs.tab', function () { generateList(); });

    const helpdeskTabBtn = document.getElementById('helpdesk-tab');
    if (helpdeskTabBtn) helpdeskTabBtn.addEventListener('shown.bs.tab', function () { loadTiketAdmin(); });
    
    // Load Data
    fetchDashboardData(); 
}

async function fetchDashboardData() {
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            .order('nama_sekolah', { ascending: true });
            
        if (error) throw error;
        
        dashboardData = data.map(i => {
            const requiredFields = [i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict, i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima];
            const isDataComplete = requiredFields.every(field => field && field.trim() !== "");
            
            const telG = cleanPhone(i.no_telefon_gpict);
            const telA = cleanPhone(i.no_telefon_admin_delima);
            const isSama = (telG && telA) && (telG === telA);
            const isBerbeza = (telG && telA) && (telG !== telA);

            return { ...i, jenis: i.jenis_sekolah || 'LAIN-LAIN', is_lengkap: isDataComplete, is_sama: isSama, is_berbeza: isBerbeza };
        });

        emailRawData = data; 
        renderFilters();
        runFilter();
        generateList(); 

        toggleLoading(false);
    } catch (err) { 
        console.error(err);
        toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal memuatkan data.', 'error'); 
    }
}

function renderFilters() {
    const types = [...new Set(dashboardData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS SEKOLAH</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="row align-items-center g-3">
          <div class="col-md-9 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('SAMA')" id="badgeSama" class="badge bg-purple cursor-pointer filter-badge p-2">Jawatan Sama <span id="cntSama" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BERBEZA')" id="badgeBerbeza" class="badge bg-orange cursor-pointer filter-badge p-2">Jawatan Berbeza <span id="cntBerbeza" class="badge bg-light text-dark ms-1">0</span></span>
          </div>
          <div class="col-md-3"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>
        </div>`;
    }
}

function setFilter(s) { activeStatus = s; runFilter(); }
function setType(t) { activeType = t; runFilter(); }

function runFilter() {
    const filtered = dashboardData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap) ||
                          (activeStatus === 'SAMA' && i.is_sama) ||
                          (activeStatus === 'BERBEZA' && i.is_berbeza); 
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        return statMatch && typeMatch;
    });

    currentFilteredList = filtered;
    updateBadgeCounts(filtered);
    renderGrid(filtered);
}

function updateBadgeCounts(filtered) {
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    if(activeStatus === 'ALL') document.getElementById('badgeAll')?.classList.add('active');
    else if(activeStatus === 'LENGKAP') document.getElementById('badgeLengkap')?.classList.add('active');
    else if(activeStatus === 'BELUM') document.getElementById('badgeBelum')?.classList.add('active');
    else if(activeStatus === 'SAMA') document.getElementById('badgeSama')?.classList.add('active');
    else if(activeStatus === 'BERBEZA') document.getElementById('badgeBerbeza')?.classList.add('active');
    
    // Kiraan berdasarkan konteks filter Jenis Sekolah shj
    const context = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    if(document.getElementById('cntAll')) document.getElementById('cntAll').innerText = context.length;
    if(document.getElementById('cntLengkap')) document.getElementById('cntLengkap').innerText = context.filter(i => i.is_lengkap).length;
    if(document.getElementById('cntBelum')) document.getElementById('cntBelum').innerText = context.filter(i => !i.is_lengkap).length;
    if(document.getElementById('cntSama')) document.getElementById('cntSama').innerText = context.filter(i => i.is_sama).length;
    if(document.getElementById('cntBerbeza')) document.getElementById('cntBerbeza').innerText = context.filter(i => i.is_berbeza).length;
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data untuk paparan ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `<div class="mb-4 fade-up"><h6 class="category-header">${jenis} (${items.length})</h6><div class="row g-3">`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge"><i class="fas fa-check me-1"></i>LENGKAP</span>` 
                : `<span class="badge bg-danger status-badge"><i class="fas fa-times me-1"></i>BELUM ISI</span>`;
            
            const linkG_Raw = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            const linkA_Raw = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);
            
            const hasTeleG = s.telegram_id_gpict;
            const hasTeleA = s.telegram_id_admin;

            const renderActions = (hasTele, linkRaw) => {
                let buttonsHtml = '<div class="d-flex align-items-center gap-1 justify-content-end">';
                if (hasTele) buttonsHtml += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-check-circle"></i> OK</span>`;
                if (linkRaw) buttonsHtml += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary" title="Chat"><i class="fas fa-comment"></i></a>`;
                else buttonsHtml += `<span class="text-muted small">-</span>`;
                buttonsHtml += '</div>';
                return buttonsHtml;
            };

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card school-card h-100 cursor-pointer" onclick="viewSchoolProfile('${s.kod_sekolah}')">
                <div class="card-body p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="fw-bold text-primary mb-0">${s.kod_sekolah}</h6>
                    ${statusBadge}
                  </div>
                  <p class="school-name mb-auto" title="${s.nama_sekolah}">${s.nama_sekolah}</p>
                </div>
                <div class="tele-status-row bg-light border-top">
                   <div class="row-item p-2"><span class="small fw-bold text-muted">GPICT</span> ${renderActions(hasTeleG, linkG_Raw)}</div>
                   <div class="row-item p-2 border-top border-light"><span class="small fw-bold text-muted">Admin</span> ${renderActions(hasTeleA, linkA_Raw)}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

// Fungsi Admin View Sekolah (Override session biasa)
function viewSchoolProfile(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
    // Kita redirect ke user.html tapi dalam konteks PPD
    // Di user.html, role 'PPD' akan membolehkan view data sahaja
    window.location.href = 'user.html'; 
}

function eksportDataTapis() {
    if (!currentFilteredList || currentFilteredList.length === 0) { Swal.fire('Tiada Data', 'Tiada data dalam paparan.', 'info'); return; }
    let csvContent = "BIL,KOD SEKOLAH,NAMA SEKOLAH,JENIS,NAMA GPICT,NO TEL GPICT,NAMA ADMIN DELIMA,NO TEL ADMIN,STATUS DATA,CATATAN\n";

    currentFilteredList.forEach((s, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let statusStr = s.is_lengkap ? 'LENGKAP' : 'BELUM LENGKAP';
        let catatan = [];
        if (s.is_sama) catatan.push("Jawatan Sama");
        if (s.is_berbeza) catatan.push("Jawatan Berbeza");
        
        let row = [
            index + 1, clean(s.kod_sekolah), clean(s.nama_sekolah), clean(s.jenis),
            clean(s.nama_gpict), clean(s.no_telefon_gpict), clean(s.nama_admin_delima), clean(s.no_telefon_admin_delima),
            statusStr, clean(catatan.join(' & '))
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SMPID_Eksport_${activeStatus}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function janaSenaraiTelegram() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    if(pending.length === 0) { Swal.fire('Hebat', 'Semua sekolah dah lengkap!', 'success'); return; }
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    txt += `\nMohon tindakan segera.`;
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
}

function generateList() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    
    if(!emailRawData || emailRawData.length === 0) {
        document.getElementById('countEmail').innerText = "0";
        document.getElementById('emailOutput').value = "";
        return;
    }

    emailRawData.forEach(row => {
        if (includeGpict && row.emel_delima_gpict) {
            const hasId = row.telegram_id_gpict;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) uniqueEmails.add(row.emel_delima_gpict.trim());
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = row.telegram_id_admin;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) uniqueEmails.add(row.emel_delima_admin_delima.trim());
        }
    });
    const arr = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
}

function copyEmails() { const el = document.getElementById("emailOutput"); if(!el.value) return; el.select(); navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success')); }
function copyTemplate() { navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success')); }

function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    list.forEach(i => {
        if (i.no_telefon_gpict && !i.telegram_id_gpict) reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
    });
    if (reminderQueue.length === 0) { Swal.fire('Tiada Sasaran', 'Semua lengkap/tiada no telefon.', 'info'); return; }
    qIndex = 0; document.getElementById('queueModal').classList.remove('hidden'); renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { document.getElementById('queueModal').classList.add('hidden'); Swal.fire('Selesai', 'Semakan tamat.', 'success'); return; }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qRoleBadge').className = item.role === 'GPICT' ? 'badge bg-info text-dark mb-3' : 'badge bg-warning text-dark mb-3';
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    if (link) { btn.href = link; btn.classList.remove('disabled'); } else { btn.removeAttribute('href'); btn.classList.add('disabled'); }
}
function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }

// ==========================================
// 10. HELPDESK ADMIN (LOGIK ASAL)
// ==========================================

async function loadTiketAdmin() {
    const wrapper = document.getElementById('adminTiketWrapper');
    const filter = document.getElementById('filterTiketAdmin')?.value || 'ALL';
    if(!wrapper) return;

    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        let query = supabaseClient.from('smpid_aduan').select('*').order('created_at', { ascending: false });
        if (filter !== 'ALL') query = query.eq('status', filter);

        const { data, error } = await query;
        if (error) throw error;

        wrapper.innerHTML = "";
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada tiket dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const date = new Date(t.created_at).toLocaleString('ms-MY');
            const bgClass = t.status === 'SELESAI' ? 'bg-light opacity-75' : 'bg-white border-danger';
            
            let actionArea = "";
            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="mt-3 border-top pt-3 bg-light p-3 rounded">
                    <label class="small fw-bold mb-1">Balasan Admin PPD:</label>
                    <textarea id="reply-${t.id}" class="form-control form-control-sm mb-2" rows="2" 
                              placeholder="Tulis penyelesaian..." 
                              onblur="this.value = formatSentenceCase(this.value)"></textarea>
                    <div class="d-flex justify-content-between">
                        <button onclick="submitBalasanAdmin(${t.id}, '${t.kod_sekolah}', '${t.peranan_pengirim}', '${t.tajuk}')" class="btn btn-sm btn-primary">
                            <i class="fas fa-reply me-1"></i> Hantar & Tutup Tiket
                        </button>
                        <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger" title="Padam Tiket Ini">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="d-flex justify-content-between align-items-end mt-2">
                    <div class="text-success small"><i class="fas fa-check-circle"></i> Diselesaikan pada: ${t.tarikh_balas ? new Date(t.tarikh_balas).toLocaleDateString() : '-'} <br> <b>Respon:</b> ${t.balasan_admin}</div>
                    <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger ms-2" title="Padam Tiket Ini">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`;
            }

            const card = `
            <div class="card mb-3 shadow-sm ${bgClass}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="badge bg-dark me-2">${t.kod_sekolah}</span>
                            <span class="badge bg-secondary">${t.peranan_pengirim}</span>
                            <h6 class="mt-2 fw-bold text-dark">${t.tajuk}</h6>
                        </div>
                        <small class="text-muted">${date}</small>
                    </div>
                    <p class="text-secondary small mb-1 bg-light p-2 rounded">${t.butiran_masalah}</p>
                    ${actionArea}
                </div>
            </div>`;
            wrapper.innerHTML += card;
        });

    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-danger text-center">Ralat memuatkan tiket.</div>`;
    }
}

async function submitBalasanAdmin(id, kod, peranan, tajuk) {
    const replyText = document.getElementById(`reply-${id}`).value;
    if(!replyText) return Swal.fire('Kosong', 'Sila tulis balasan.', 'warning');
    
    const btn = event.currentTarget; 
    if(btn) btn.disabled = true;

    toggleLoading(true);
    try {
        const { error } = await supabaseClient
            .from('smpid_aduan')
            .update({ 
                status: 'SELESAI', 
                balasan_admin: replyText,
                tarikh_balas: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;

        if (DENO_API_URL) {
            fetch(`${DENO_API_URL}/reply-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, balasan: replyText })
            }).catch(e => console.warn("Bot offline?", e));
        }

        toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Selesai', 'Tiket ditutup & notifikasi dihantar.', 'success').then(() => loadTiketAdmin());

    } catch (e) {
        toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

async function padamTiket(id) {
    Swal.fire({
        title: 'Padam Tiket Ini?',
        text: "Tindakan ini akan memadam rekod tiket secara kekal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Padam!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                const { error } = await supabaseClient
                    .from('smpid_aduan')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                toggleLoading(false);
                Swal.fire('Dipadam', 'Tiket telah dihapuskan.', 'success').then(() => loadTiketAdmin());
            } catch (err) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam tiket.', 'error');
                console.error(err);
            }
        }
    });
}

// ==========================================
// 11. PWA SERVICE WORKER (ASAL)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker Registered!', reg))
            .catch(err => console.error('[PWA] Service Worker Registration Failed:', err));
    });
}