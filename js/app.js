/**
 * SMPID MASTER JAVASCRIPT FILE (app.js)
 * Versi 2.0 - Struktur Baru (index, admin, user)
 */

// ==========================================
// 1. KONFIGURASI & INISIALISASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://hbanvnteyncwsnfprahz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IEcWCbBmqWLBOBU4rl0FPw_Z97Assvt';
const ADMIN_PIN = "pkgag"; // Nota: Masih client-side. Perlu RLS di Supabase untuk lebih selamat.

let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Ready.");
} else {
    console.error("Supabase library not loaded.");
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
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 3. PEMBOLEHUBAH STATE GLOBAL
// ==========================================
let dashboardData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;
let emailRawData = [];

// ==========================================
// 4. ROUTER UTAMA (DOM CONTROLLER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const bodyId = document.body.id;

    if (bodyId === 'page-login') {
        sessionStorage.clear();
    } 
    else if (bodyId === 'page-admin') {
        initAdminPanel();
    } 
    else if (bodyId === 'page-user') {
        initUserPortal();
    }
});

// ==========================================
// 5. SISTEM AUTH & NAVIGASI
// ==========================================

async function prosesLogin() {
    const input = document.getElementById('inputKodSekolah');
    if (!input) return;

    const kod = input.value.trim().toUpperCase();
    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod.', 'warning'); return; }

    // --- LALUAN 1: ADMIN ---
    if (kod === "M030") {
        sessionStorage.setItem('smpid_auth', 'true');
        Swal.fire({
            icon: 'success', title: 'Admin Disahkan', timer: 800, showConfirmButton: false
        }).then(() => {
            window.location.href = 'admin.html';
        });
        return;
    }

    // --- LALUAN 2: USER SEKOLAH ---
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('kod_sekolah').eq('kod_sekolah', kod).single();
        toggleLoading(false);
        if (error || !data) { Swal.fire('Maaf', 'Kod sekolah tidak dijumpai.', 'error'); return; }
        
        sessionStorage.setItem('smpid_user_kod', data.kod_sekolah);
        window.location.href = 'user.html';
    } catch (err) {
        toggleLoading(false); Swal.fire('Ralat', 'Gagal sambungan server.', 'error');
    }
}

function keluarSistem() {
    Swal.fire({
        title: 'Log Keluar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    });
}

// ==========================================
// 6. LOGIK ADMIN PANEL (admin.html)
// ==========================================
function initAdminPanel() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    // Muat turun data untuk kedua-dua tab (Dashboard & Email)
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
        
        // Proses data untuk Dashboard
        dashboardData = data.map(i => {
            const requiredFields = [i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict, i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima];
            const isDataComplete = requiredFields.every(field => field && field.trim() !== "");
            return { ...i, jenis: i.jenis_sekolah || 'LAIN-LAIN', is_lengkap: isDataComplete };
        });

        // Proses data untuk Email Blaster (Guna data sama)
        emailRawData = data; 
        
        // Render UI
        renderFilters();
        runFilter();
        generateList(); // Init email list juga

        toggleLoading(false);
    } catch (err) { 
        toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal memuatkan data.', 'error'); 
    }
}

// --- SUB-LOGIK DASHBOARD ---
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
    if(activeStatus === 'ALL') document.getElementById('badgeAll')?.classList.add('active');
    if(activeStatus === 'LENGKAP') document.getElementById('badgeLengkap')?.classList.add('active');
    if(activeStatus === 'BELUM') document.getElementById('badgeBelum')?.classList.add('active');
    
    const context = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    if(document.getElementById('cntAll')) document.getElementById('cntAll').innerText = context.length;
    if(document.getElementById('cntLengkap')) document.getElementById('cntLengkap').innerText = context.filter(i => i.is_lengkap).length;
    if(document.getElementById('cntBelum')) document.getElementById('cntBelum').innerText = context.filter(i => !i.is_lengkap).length;

    renderGrid(filtered);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `<div class="mb-4"><h6 class="category-header">${jenis} (${items.length})</h6><div class="row g-2">`;
        
        items.forEach(s => {
            const statusColor = s.is_lengkap ? 'text-success' : 'text-danger';
            const statusIcon = s.is_lengkap ? 'fa-check-circle' : 'fa-exclamation-circle';
            
            // Logic Icon Telegram/WhatsApp
            const hasTeleG = s.telegram_id_gpict;
            const hasTeleA = s.telegram_id_admin;
            
            const renderIcon = (hasTele, link) => {
                if (hasTele) return `<i class="fas fa-check-circle text-primary" title="Bot Berdaftar"></i>`;
                return `<a href="${link}" target="_blank" class="text-success"><i class="fab fa-whatsapp"></i></a>`;
            };

            const linkG = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict);
            const linkA = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima);

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card h-100 border shadow-sm">
                <div class="card-body p-2 d-flex flex-column">
                  <div class="d-flex justify-content-between">
                    <span class="fw-bold small">${s.kod_sekolah}</span>
                    <i class="fas ${statusIcon} ${statusColor}"></i>
                  </div>
                  <small class="text-truncate mb-2" title="${s.nama_sekolah}">${s.nama_sekolah}</small>
                  <div class="mt-auto bg-light p-1 rounded d-flex justify-content-between small">
                    <span>G: ${renderIcon(hasTeleG, linkG)}</span>
                    <span>A: ${renderIcon(hasTeleA, linkA)}</span>
                  </div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

function janaSenaraiTelegram() {
    // ... Logik sama seperti asal, disingkatkan untuk menjimatkan ruang ...
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `*BELUM LENGKAP (${activeType})*\n`;
    list.filter(i => !i.is_lengkap).forEach(i => txt += `${i.kod_sekolah} `);
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
}

// --- SUB-LOGIK EMAIL BLASTER ---
function generateList() {
    // ... Logik sama seperti asal ...
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();

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
}

function copyEmails() {
    const el = document.getElementById("emailOutput");
    el.select();
    navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success'));
}

function copyTemplate() {
    navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success'));
}

// --- SUB-LOGIK QUEUE SYSTEM ---
function mulaTindakanPantas() {
    // Bina queue dari list semasa
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        // Hanya masukkan jika ada No Telefon tetapi belum daftar Telegram
        if (i.no_telefon_gpict && !i.telegram_id_gpict) 
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) 
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
    });

    if (reminderQueue.length === 0) { Swal.fire('Tiada Sasaran', 'Semua lengkap/tiada no telefon.', 'info'); return; }
    
    qIndex = 0;
    document.getElementById('queueModal').classList.remove('hidden');
    renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semakan tamat.', 'success'); return; 
    }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    document.getElementById('qWaBtn').href = link || "#";
}
function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }

// ==========================================
// 7. LOGIK USER PORTAL (user.html)
// ==========================================
function initUserPortal() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    if (!kod) { window.location.href = 'index.html'; return; }
    
    document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    
    // Auto load data untuk persediaan form
    loadProfil(kod);
}

function showSection(section) {
    if (section === 'menu') {
        document.getElementById('section-menu').classList.remove('hidden');
        document.getElementById('section-profil').classList.add('hidden');
        document.getElementById('welcomeText').innerText = "Sila pilih tindakan yang ingin dilakukan";
    } else if (section === 'profil') {
        document.getElementById('section-menu').classList.add('hidden');
        document.getElementById('section-profil').classList.remove('hidden');
        document.getElementById('welcomeText').innerText = "Kemaskini Maklumat";
    }
}

async function loadProfil(kod) {
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').eq('kod_sekolah', kod).single();
        if (error) throw error;
        
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = data.daerah || '';
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
    // Validasi ringkas
    const emelG = document.getElementById('gpictEmel').value;
    if (!checkEmailDomain(emelG)) { Swal.fire('Format Salah', 'Gunakan emel moe-dl.edu.my', 'warning'); return; }

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
        const { error } = await supabaseClient.from('sekolah_data').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;
        toggleLoading(false);
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => showSection('menu'));
    } catch (err) {
        toggleLoading(false); Swal.fire('Ralat', 'Gagal simpan.', 'error');
    }
}