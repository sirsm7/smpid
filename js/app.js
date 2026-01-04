/**
 * SMPID MASTER JAVASCRIPT FILE (app.js)
 * Gabungan: utils.js + main.js + dashboard.js + email.js
 * * STRUKTUR:
 * 1. Konfigurasi & Inisialisasi Supabase
 * 2. Fungsi Utiliti Global
 * 3. Pembolehubah State Global
 * 4. Router Utama (DOMContentLoaded)
 * 5. Logik Auth & Sistem (Login/Logout)
 * 6. Logik Profil Sekolah
 * 7. Logik Dashboard Admin
 * 8. Logik Email Blaster
 */

// ==========================================
// 1. KONFIGURASI & INISIALISASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://hbanvnteyncwsnfprahz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IEcWCbBmqWLBOBU4rl0FPw_Z97Assvt';
const ADMIN_PIN = "pkgag";

// Inisialisasi Klien (Singleton)
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized via app.js");
} else {
    console.error("Library Supabase tidak dimuatkan! Pastikan tag script CDN ada di HTML.");
}

// ==========================================
// 2. FUNGSI UTILITI GLOBAL
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

function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej yang di jana secara automatik dari sistem.\n\nMohon kerjasama cikgu untuk aktifkan id tele di bot SMPID. Sila klik https://t.me/smpid_bot klik Start atau hantar /start, kemudian masukkan kod sekolah anda dan pilih peranan.\n\nBot akan rekodkan id telegram anda ke dalam sistem SMPID. Terima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 3. PEMBOLEHUBAH STATE GLOBAL
// ==========================================

// Dashboard State
let dashboardData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;

// Email Blaster State
let emailRawData = [];

// ==========================================
// 4. ROUTER UTAMA (DOM CONTROLLER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    // --- A. LOGIK LOG MASUK (index.html) ---
    if (document.getElementById('inputKodSekolah')) {
        sessionStorage.clear(); // Clear session bila di login page
        // Logik login dipanggil via onclick="prosesLogin()"
    }

    // --- B. LOGIK MENU (menu.html) ---
    if (document.getElementById('welcomeText')) {
        initMenuLogic();
    }

    // --- C. LOGIK PROFIL (profil.html) ---
    if (document.getElementById('dispNamaSekolah')) {
        loadProfil();
    }

    // --- D. LOGIK DASHBOARD (dashboard.html) ---
    if (document.getElementById('dashboardCard')) {
        initDashboard();
    }

    // --- E. LOGIK EMAIL BLASTER (email.html) ---
    if (document.getElementById('emailOutput')) {
        initEmailBlaster();
    }
});

// ==========================================
// 5. LOGIK AUTH & SISTEM (Login/Logout)
// ==========================================

async function prosesLogin() {
    const input = document.getElementById('inputKodSekolah');
    if (!input) return;

    const kod = input.value.trim().toUpperCase();
    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod.', 'warning'); return; }

    // Admin Access (M030)
    if (kod === "M030") {
        sessionStorage.setItem('smpid_auth', 'true');
        Swal.fire({
            icon: 'success',
            title: 'Log Masuk Admin',
            text: 'Mengalihkan ke menu utama...',
            timer: 1000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'menu.html';
        });
        return;
    }

    // User Access
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('kod_sekolah').eq('kod_sekolah', kod).single();
        toggleLoading(false);
        if (error || !data) { Swal.fire('Maaf', 'Kod sekolah tidak dijumpai.', 'error'); return; }
        
        sessionStorage.setItem('smpid_user_kod', data.kod_sekolah);
        window.location.href = 'menu.html';
    } catch (err) {
        toggleLoading(false); Swal.fire('Ralat', 'Gagal sambungan server.', 'error');
    }
}

function keluarSistem(forceRedirect = false) {
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    if (forceRedirect) {
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    const title = isAdmin ? 'Log Keluar Admin?' : 'Log Keluar?';
    const text = isAdmin ? "Tamatkan sesi admin?" : "Kembali ke laman utama.";

    Swal.fire({
        title: title, text: text, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
    }).then((result) => {
        if (result.isConfirmed) { sessionStorage.clear(); window.location.href = 'index.html'; }
    });
}

function confirmLogout() {
    Swal.fire({
        title: 'Log Keluar Admin?',
        text: "Anda akan kembali ke halaman log masuk utama.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Keluar'
    }).then((result) => {
        if (result.isConfirmed) {
            keluarSistem(true); 
        }
    });
}

// ==========================================
// 6. LOGIK MENU UTAMA
// ==========================================
function initMenuLogic() {
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    const userKod = sessionStorage.getItem('smpid_user_kod');
    const badge = document.getElementById('displayKodSekolah');

    if (isAdmin) {
        badge.innerHTML = '<i class="fas fa-user-shield me-2"></i>MOD ADMIN';
        badge.classList.replace('text-dark', 'text-primary');
        badge.classList.add('border', 'border-primary');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
    } else if (userKod) {
        badge.innerHTML = `<i class="fas fa-school me-2"></i>${userKod}`;
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    } else {
        window.location.href = 'index.html';
    }
}


// ==========================================
// 7. LOGIK PROFIL SEKOLAH
// ==========================================

async function loadProfil() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    
    if (!kod && !isAdmin) { window.location.href = 'index.html'; return; }
    
    if (isAdmin) {
        const btn = document.getElementById('btnNavigasiKeluar');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-tachometer-alt me-1"></i> Dashboard';
            btn.setAttribute('onclick', "window.location.href='dashboard.html'");
            btn.classList.replace('btn-outline-dark', 'btn-outline-primary');
        }
    } else {
        const btnPadam = document.querySelector('button[onclick="mintaPinPadam()"]');
        if (btnPadam) btnPadam.style.display = 'none';
    }

    toggleLoading(true);
    try {
        const targetKod = kod; 
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').eq('kod_sekolah', targetKod).single();
        if (error) throw error;
        
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        const sets = [['gpictNama', data.nama_gpict], ['gpictTel', data.no_telefon_gpict], ['gpictEmel', data.emel_delima_gpict],
                      ['adminNama', data.nama_admin_delima], ['adminTel', data.no_telefon_admin_delima], ['adminEmel', data.emel_delima_admin_delima]];
        sets.forEach(([id, val]) => { if(document.getElementById(id)) document.getElementById(id).value = val || ""; });
        
        toggleLoading(false);
    } catch (err) { toggleLoading(false); Swal.fire('Ralat', 'Gagal data.', 'error'); }
}

function salinData() {
    if (document.getElementById('checkSama') && document.getElementById('checkSama').checked) {
      document.getElementById('adminNama').value = document.getElementById('gpictNama').value;
      document.getElementById('adminTel').value = document.getElementById('gpictTel').value;
      document.getElementById('adminEmel').value = document.getElementById('gpictEmel').value;
    }
}

async function simpanProfil() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const gpictEmel = document.getElementById('gpictEmel').value;
    const adminEmel = document.getElementById('adminEmel').value;

    if (!checkEmailDomain(gpictEmel) || !checkEmailDomain(adminEmel)) {
        Swal.fire('Format Emel', 'Sila gunakan emel @moe-dl.edu.my', 'warning'); return;
    }

    toggleLoading(true);
    try {
        const payload = {
            nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
            no_telefon_gpict: document.getElementById('gpictTel').value,
            emel_delima_gpict: gpictEmel,
            nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
            no_telefon_admin_delima: document.getElementById('adminTel').value,
            emel_delima_admin_delima: adminEmel
        };
        const { error } = await supabaseClient.from('sekolah_data').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;
        toggleLoading(false);
        Swal.fire('Berjaya!', 'Data disimpan.', 'success');
    } catch (err) { toggleLoading(false); Swal.fire('Ralat', err.message, 'error'); }
}

async function mintaPinPadam() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        Swal.fire('Akses Ditolak', 'Hanya Admin yang sah boleh melakukan tindakan ini.', 'error');
        return;
    }

    const { value: pin } = await Swal.fire({
        title: 'Mod Admin',
        text: "Masukkan PIN Keselamatan untuk memadam data sekolah ini:",
        input: 'password',
        inputPlaceholder: 'Masukkan PIN',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-trash-alt me-2"></i>Padam Data'
    });

    if (!pin) return;

    if (pin !== ADMIN_PIN) {
        Swal.fire('Gagal', 'PIN Keselamatan tidak sah.', 'error');
        return;
    }

    toggleLoading(true);
    const kod = document.getElementById('hiddenKodSekolah').value;

    try {
        const resetPayload = {
            nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null,
            nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null
        };

        const { error } = await supabaseClient.from('sekolah_data').update(resetPayload).eq('kod_sekolah', kod);
        if (error) throw error;

        toggleLoading(false);
        await Swal.fire('Selesai', 'Data profil sekolah telah dipadamkan.', 'success');
        window.location.reload();
    } catch (err) {
        toggleLoading(false);
        console.error(err);
        Swal.fire('Ralat', 'Gagal memadam data dari database.', 'error');
    }
}

// ==========================================
// 8. LOGIK DASHBOARD ADMIN
// ==========================================

function initDashboard() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        Swal.fire('Akses Ditolak', 'Sila log masuk semula.', 'error').then(() => {
            window.location.href = 'index.html';
        });
        return;
    }
    fetchDashboardData();
}

async function fetchDashboardData() {
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('sekolah_data')
            .select('*')
            .order('nama_sekolah', { ascending: true });
            
        if (error) throw error;
        
        dashboardData = data.map(i => {
            const requiredFields = [
                i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict,
                i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima
            ];
            const isDataComplete = requiredFields.every(field => field && field.trim() !== "");
            return { ...i, jenis: i.jenis_sekolah || 'LAIN-LAIN', is_lengkap: isDataComplete };
        });

        renderFilters();
        runFilter();
        toggleLoading(false);
    } catch (err) { 
        toggleLoading(false); 
        console.error(err);
        Swal.fire('Ralat', 'Gagal memuatkan data database.', 'error'); 
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
          <div class="col-md-8 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
          </div>
          <div class="col-md-4"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>
        </div>`;
    }
}

function setFilter(s) { activeStatus = s; runFilter(); }
function setType(t) { activeType = t; runFilter(); }

function runFilter() {
    const filtered = dashboardData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap);
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        return statMatch && typeMatch;
    });

    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    if(activeStatus === 'ALL') document.getElementById('badgeAll').classList.add('active');
    if(activeStatus === 'LENGKAP') document.getElementById('badgeLengkap').classList.add('active');
    if(activeStatus === 'BELUM') document.getElementById('badgeBelum').classList.add('active');
    
    const context = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    document.getElementById('cntAll').innerText = context.length;
    document.getElementById('cntLengkap').innerText = context.filter(i => i.is_lengkap).length;
    document.getElementById('cntBelum').innerText = context.filter(i => !i.is_lengkap).length;

    renderGrid(filtered);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data dijumpai untuk kriteria ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { 
        (acc[i.jenis] = acc[i.jenis] || []).push(i); 
        return acc; 
    }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `
        <div class="mb-4 fade-up">
            <h5 class="category-header">${jenis} <span class="badge bg-white text-dark ms-2 border">${items.length}</span></h5>
            <div class="row g-3">`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge"><i class="fas fa-check me-1"></i>LENGKAP</span>` 
                : `<span class="badge bg-danger status-badge"><i class="fas fa-times me-1"></i>BELUM ISI</span>`;
            
            const linkG_Template = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, false);
            const linkG_Raw = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            const linkA_Template = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, false);
            const linkA_Raw = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);
            
            const hasTeleG = s.telegram_id_gpict && s.telegram_id_gpict.toString().trim() !== "";
            const hasTeleA = s.telegram_id_admin && s.telegram_id_admin.toString().trim() !== "";

            const renderActions = (hasTele, linkTemplate, linkRaw) => {
                let buttonsHtml = '<div class="d-flex align-items-center gap-1">';
                if (hasTele) {
                    buttonsHtml += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-check-circle"></i> OK</span>`;
                }
                if (linkRaw) {
                    buttonsHtml += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary" title="Mesej Personal"><i class="fas fa-comment"></i></a>`;
                }
                if (!hasTele && linkTemplate) {
                     buttonsHtml += `<a href="${linkTemplate}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-outline-success" title="Hantar Arahan Bot"><i class="fab fa-whatsapp"></i> Ingatkan</a>`;
                } else if (!linkRaw) {
                    buttonsHtml += `<span class="text-muted small">-</span>`;
                }
                buttonsHtml += '</div>';
                return buttonsHtml;
            };

            const actionsGpict = renderActions(hasTeleG, linkG_Template, linkG_Raw);
            const actionsAdmin = renderActions(hasTeleA, linkA_Template, linkA_Raw);

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
                   <div class="row-item p-2"><span class="small fw-bold text-muted d-block mb-1">GPICT</span> ${actionsGpict}</div>
                   <div class="row-item p-2 border-top border-light"><span class="small fw-bold text-muted d-block mb-1">Admin</span> ${actionsAdmin}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

function viewSchoolProfile(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
    window.location.href = 'profil.html';
}

function janaSenaraiTelegram() {
    let contextData = (activeType === 'ALL') ? dashboardData : dashboardData.filter(item => item.jenis === activeType);
    const belumIsi = contextData.filter(item => !item.is_lengkap);

    if (belumIsi.length === 0) { 
        Swal.fire('Tahniah!', 'Semua sekolah dalam paparan ini telah mengisi maklumat.', 'success'); 
        return; 
    }

    const groups = belumIsi.reduce((acc, item) => {
        const key = item.jenis || "LAIN-LAIN";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const tarikh = new Date().toLocaleDateString('ms-MY');
    let teks = `**STATUS PENGISIAN MAKLUMAT SMPID**\n`;
    teks += `Tarikh: ${tarikh}\n`;
    if(activeType !== 'ALL') teks += `Kategori: ${activeType}\n`;
    teks += `\nMohon perhatian sekolah-sekolah berikut untuk mengemaskini maklumat GPICT dan Admin DELIMa dengan segera:\n`;

    Object.keys(groups).sort().forEach(jenis => {
        teks += `\n*${jenis}*\n`; 
        groups[jenis].forEach((school, index) => { 
            teks += `${index + 1}. \`${school.kod_sekolah}\` - ${school.nama_sekolah}\n`; 
        });
    });

    teks += `\nSila kemaskini di sistem segera.\nTerima kasih.`;

    navigator.clipboard.writeText(teks).then(() => {
        Swal.fire({
            title: 'Berjaya Disalin!',
            html: 'Senarai sekolah yang belum isi telah disalin.<br>Boleh terus <b>Paste</b> di Telegram.',
            icon: 'success'
        });
    }).catch(err => {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyalin teks.', 'error');
    });
}

// --- QUEUE SYSTEM ---
function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        const telGpict = cleanPhone(i.no_telefon_gpict);
        const telAdmin = cleanPhone(i.no_telefon_admin_delima);
        const hasTeleG = i.telegram_id_gpict && i.telegram_id_gpict.toString().trim() !== "";
        const hasTeleA = i.telegram_id_admin && i.telegram_id_admin.toString().trim() !== "";

        if (telGpict && !hasTeleG) {
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        }
        if (telAdmin && !hasTeleA) {
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
        }
    });

    if (reminderQueue.length === 0) { 
        Swal.fire('Tiada Sasaran', 'Tiada staf yang memerlukan peringatan (sama ada sudah daftar bot atau tiada no telefon).', 'info'); 
        return; 
    }
    
    qIndex = 0;
    document.getElementById('queueModal').classList.remove('hidden');
    renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semua peringatan telah disemak.', 'success'); 
        return; 
    }
    
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `Sasaran ${qIndex + 1} / ${reminderQueue.length}`;
    
    const badge = document.getElementById('qRoleBadge');
    badge.innerText = item.role;
    badge.className = item.role === 'GPICT' ? 'badge bg-info text-dark mb-3' : 'badge bg-warning text-dark mb-3';

    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "Tiada Nama";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    if (link) {
        btn.href = link;
        btn.classList.remove('disabled');
    } else {
        btn.removeAttribute('href');
        btn.classList.add('disabled');
    }
}

function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }


// ==========================================
// 9. LOGIK EMAIL BLASTER
// ==========================================
async function initEmailBlaster() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        alert("Sila log masuk sebagai Admin.");
        window.location.href = 'index.html';
        return;
    }

    toggleLoading(true);
    const { data, error } = await supabaseClient.from('sekolah_data').select('kod_sekolah, nama_gpict, emel_delima_gpict, telegram_id_gpict, nama_admin_delima, emel_delima_admin_delima, telegram_id_admin');
    toggleLoading(false);

    if (error) { console.error(error); Swal.fire('Ralat', 'Gagal sambungan database.', 'error'); return; }
    emailRawData = data || [];
    document.getElementById('countSchool').innerText = emailRawData.length;
    generateList();
}

function generateList() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();

    if (!emailRawData) return;

    emailRawData.forEach(row => {
        if (includeGpict && row.emel_delima_gpict) {
            const email = row.emel_delima_gpict.trim();
            const hasId = row.telegram_id_gpict != null && row.telegram_id_gpict !== "";
            if (filterStatus === 'all') uniqueEmails.add(email);
            else if (filterStatus === 'unregistered' && !hasId) uniqueEmails.add(email);
            else if (filterStatus === 'registered' && hasId) uniqueEmails.add(email);
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const email = row.emel_delima_admin_delima.trim();
            const hasId = row.telegram_id_admin != null && row.telegram_id_admin !== "";
            if (filterStatus === 'all') uniqueEmails.add(email);
            else if (filterStatus === 'unregistered' && !hasId) uniqueEmails.add(email);
            else if (filterStatus === 'registered' && hasId) uniqueEmails.add(email);
        }
    });

    const emailArray = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = emailArray.length;
    const emailString = emailArray.join(', ');
    document.getElementById('emailOutput').value = emailString;

    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${emailString}&subject=${subject}&body=${body}`;
}

function copyEmails() {
    const copyText = document.getElementById("emailOutput");
    if (!copyText.value) { Swal.fire('Tiada Data', 'Senarai emel kosong.', 'info'); return; }
    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => Swal.fire({icon: 'success', title: 'Disalin!', timer: 1500, showConfirmButton: false}));
}

function copyTemplate() {
    const bodyText = document.getElementById("msgBody");
    navigator.clipboard.writeText(bodyText.value).then(() => Swal.fire({icon: 'success', title: 'Teks Disalin!', timer: 1500, showConfirmButton: false}));
}