/**
 * SMPID MASTER JAVASCRIPT FILE (app.js)
 * Versi Akhir: Full Features + Notification + Actor ID
 * Host Database: appppdag.cloud
 * Host Bot API: smpid-40.ppdag.deno.net
 */

// ==========================================
// 1. KONFIGURASI UTAMA
// ==========================================
const SUPABASE_URL = 'https://appppdag.cloud';
// Anon Key (Public)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';

// URL Deno Deploy untuk Notifikasi Telegram
const DENO_API_URL = 'https://smpid-40.ppdag.deno.net'; 

// ==========================================
// 2. INISIALISASI SUPABASE
// ==========================================
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Ready (Self-Hosted).");
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

function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 4. ROUTER & AUTHENTICATION
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

async function prosesLogin() {
    const input = document.getElementById('inputKodSekolah');
    if (!input) return;

    const kod = input.value.trim().toUpperCase();
    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod.', 'warning'); return; }

    // --- LALUAN 1: ADMIN PPD (M030) ---
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
        const { data, error } = await supabaseClient
            .from('smpid_sekolah_data')
            .select('kod_sekolah')
            .eq('kod_sekolah', kod)
            .single();
            
        toggleLoading(false);
        if (error || !data) { Swal.fire('Maaf', 'Kod sekolah tidak dijumpai.', 'error'); return; }
        
        sessionStorage.setItem('smpid_user_kod', data.kod_sekolah);
        window.location.href = 'user.html';
    } catch (err) {
        toggleLoading(false); Swal.fire('Ralat', 'Gagal sambungan server.', 'error');
        console.error(err);
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
// 5. MODUL USER PORTAL (user.html)
// ==========================================
function initUserPortal() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    if (!kod) { window.location.href = 'index.html'; return; }
    
    // Paparan Header Khas jika Admin yang masuk view sekolah
    if (isAdmin) {
        document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-user-shield me-2"></i>ADMIN VIEW: ${kod}`;
        document.getElementById('displayKodSekolah').classList.replace('text-dark', 'text-primary');
        document.getElementById('displayKodSekolah').classList.add('border', 'border-primary');
        
        const btnLogout = document.getElementById('btnLogoutMenu');
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left me-2"></i>Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.classList.replace('text-danger', 'text-primary');
        }
        // Tunjuk butang reset hanya untuk admin
        const btnReset = document.getElementById('btnResetData');
        if (btnReset) btnReset.classList.remove('hidden');
    } else {
        document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    }
    
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
        const { data, error } = await supabaseClient.from('smpid_sekolah_data').select('*').eq('kod_sekolah', kod).single();
        if (error) throw error;
        
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
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
    
    // Check jika yang sedang edit ini adalah ADMIN atau USER
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Validasi
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
        // 1. SIMPAN DATA KE SUPABASE
        const { error } = await supabaseClient.from('smpid_sekolah_data').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;

        // 2. HANTAR NOTIFIKASI KE BOT (DENO API)
        if (DENO_API_URL) {
            console.log("Menghantar notifikasi ke PPD...");
            fetch(`${DENO_API_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: kod, 
                    nama: namaSekolah,
                    // Tambahan: Hantar info siapa yang update
                    updated_by: isAdmin ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH' 
                })
            })
            .then(res => res.json())
            .catch(err => console.warn("Gagal hubungi bot notifikasi:", err));
        }

        toggleLoading(false);
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => showSection('menu'));
    } catch (err) {
        toggleLoading(false); Swal.fire('Ralat', 'Gagal simpan data.', 'error');
        console.error(err);
    }
}

async function resetDataSekolah() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const { value: password } = await Swal.fire({
        title: 'Akses Admin Diperlukan',
        text: 'Masukkan kata laluan untuk reset data sekolah ini:',
        input: 'password',
        showCancelButton: true,
        confirmButtonText: 'Sahkan'
    });

    if (password === 'pkgag') {
         Swal.fire({
            title: 'Pasti Reset Data?',
            text: "Data GPICT/Admin akan dipadam (NULL). Kod sekolah kekal.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Reset!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                toggleLoading(true);
                const payload = {
                    nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null, telegram_id_gpict: null,
                    nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null, telegram_id_admin: null
                };
                try {
                    const { error } = await supabaseClient.from('smpid_sekolah_data').update(payload).eq('kod_sekolah', kod);
                    if (error) throw error;
                    toggleLoading(false);
                    Swal.fire('Berjaya', 'Data sekolah telah di-reset.', 'success').then(() => loadProfil(kod));
                } catch (err) {
                    toggleLoading(false); Swal.fire('Ralat', 'Gagal reset data.', 'error');
                }
            }
        });
    } else if (password) {
        Swal.fire('Akses Ditolak', 'Kata laluan salah.', 'error');
    }
}

// ==========================================
// 6. MODUL ADMIN PANEL (admin.html)
// ==========================================
let dashboardData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;
let emailRawData = [];
let currentFilteredList = [];

function initAdminPanel() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
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

function viewSchoolProfile(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
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
    if(!emailRawData) return;
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