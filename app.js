// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://hbanvnteyncwsnfprahz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IEcWCbBmqWLBOBU4rl0FPw_Z97Assvt';
const ADMIN_PIN = "pkgag";

let supabaseClient = null;
let isSupabaseReady = false;

// Cuba inisialisasi Supabase dengan selamat
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        isSupabaseReady = true;
    } else {
        console.error("Supabase library not loaded (blocked by client).");
    }
} catch (e) {
    console.error("Supabase initialization error:", e);
}

// --- STATE MANAGEMENT ---
const state = {
    userKod: null,
    isAdmin: false,
    dashboardData: [],
    activeFilterStatus: 'ALL',
    activeFilterType: 'ALL',
    reminderQueue: [],
    queueIndex: 0
};

// --- INIT (AUTO RUN ON LOAD) ---
document.addEventListener('DOMContentLoaded', () => {
    // 0. Semak Status Supabase
    if (!isSupabaseReady) {
        const warning = document.getElementById('js-error-banner');
        if(warning) warning.classList.remove('hidden');
        // Jangan hentikan eksekusi, biarkan UI login muncul
    }

    // 1. Semak sesi
    state.isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    state.userKod = sessionStorage.getItem('smpid_user_kod');

    // 2. Tentukan view awal
    if (state.isAdmin || state.userKod) {
        navigateTo('menu');
    } else {
        navigateTo('login');
    }

    // 3. Setup Input Listener
    document.querySelectorAll('.uppercase-input').forEach(el => {
        el.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase());
    });
});

// --- CORE: ROUTER ---
function navigateTo(viewId) {
    // Sembunyikan semua dengan membuang class 'active'
    // dan menambah 'hidden' selepas animasi
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(el => {
        el.style.display = ''; // Reset inline style (penting untuk fallback login)
        el.classList.remove('active');
        el.classList.add('hidden'); 
    });

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.remove('hidden');
        void target.offsetWidth; // Force Reflow
        target.classList.add('active');
    }

    updateHeader(viewId);
    
    if (viewId === 'menu') initMenu();
    if (viewId === 'profile') loadProfileData();
    if (viewId === 'dashboard') {
        if (!state.isAdmin) { navigateTo('login'); return; }
        loadDashboardData();
    }
    if (viewId === 'email') {
        if (!state.isAdmin) { navigateTo('login'); return; }
        if (state.dashboardData.length > 0) generateEmailList(); 
        else loadDashboardData().then(generateEmailList);
    }
}

function updateHeader(viewId) {
    const badgeContainer = document.getElementById('headerBadgeContainer');
    const badge = document.getElementById('displayUserBadge');
    
    if (viewId === 'login') {
        badgeContainer?.classList.add('hidden');
    } else {
        badgeContainer?.classList.remove('hidden');
        if(badge) {
            if (state.isAdmin) {
                badge.innerHTML = '<i class="fas fa-user-shield me-2"></i>MOD ADMIN';
                badge.className = 'badge bg-white text-primary border border-primary shadow-sm px-3 py-2 rounded-pill';
            } else {
                badge.innerHTML = `<i class="fas fa-school me-2"></i>${state.userKod}`;
                badge.className = 'badge bg-white text-dark shadow-sm px-3 py-2 rounded-pill';
            }
        }
    }
}

// --- MODULE 1: AUTHENTICATION ---
async function prosesLogin() {
    // Failsafe check
    if (!isSupabaseReady) {
        Swal.fire({
            icon: 'error',
            title: 'Ralat Sambungan',
            text: 'Database disekat oleh pelayar anda. Sila matikan AdBlocker.'
        });
        return;
    }

    const input = document.getElementById('inputKodSekolah');
    const kod = input.value.trim().toUpperCase();

    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod sekolah.', 'warning'); return; }

    // Admin Access
    if (kod === "M030") {
        sessionStorage.setItem('smpid_auth', 'true');
        state.isAdmin = true;
        state.userKod = null;
        Swal.fire({icon: 'success', title: 'Log Masuk Admin', timer: 1000, showConfirmButton: false})
            .then(() => navigateTo('menu'));
        return;
    }

    // User Access
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('sekolah_data')
            .select('kod_sekolah')
            .eq('kod_sekolah', kod)
            .single();

        toggleLoading(false);

        if (error || !data) {
            Swal.fire('Maaf', 'Kod sekolah tidak dijumpai.', 'error');
        } else {
            sessionStorage.setItem('smpid_user_kod', data.kod_sekolah);
            state.userKod = data.kod_sekolah;
            state.isAdmin = false;
            navigateTo('menu');
        }
    } catch (err) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal sambungan server.', 'error');
    }
}

function logout() {
    Swal.fire({
        title: 'Log Keluar?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
    }).then((res) => {
        if (res.isConfirmed) {
            sessionStorage.clear();
            state.isAdmin = false;
            state.userKod = null;
            state.dashboardData = [];
            document.getElementById('inputKodSekolah').value = "";
            navigateTo('login');
        }
    });
}

// --- MODULE 2: MENU ---
function initMenu() {
    if (state.isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

// --- MODULE 3: PROFILE ---
async function loadProfileData() {
    if (!state.userKod && !state.isAdmin) { navigateTo('login'); return; }
    if (!isSupabaseReady) return; // Silent fail if blocked

    const targetKod = sessionStorage.getItem('smpid_user_kod');
    if (!targetKod) { navigateTo('menu'); return; }

    const btnPadam = document.getElementById('btnPadamData');
    if (state.isAdmin) btnPadam.classList.remove('hidden');
    else btnPadam.classList.add('hidden');

    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('sekolah_data')
            .select('*')
            .eq('kod_sekolah', targetKod)
            .single();

        if (error) throw error;

        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;

        const fields = {
            'gpictNama': data.nama_gpict, 'gpictTel': data.no_telefon_gpict, 'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 'adminTel': data.no_telefon_admin_delima, 'adminEmel': data.emel_delima_admin_delima
        };
        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if(el) el.value = val || "";
        }
        
        toggleLoading(false);
    } catch (err) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal memuatkan data.', 'error');
    }
}

async function simpanProfil() {
    if(!isSupabaseReady) return;
    const kod = document.getElementById('hiddenKodSekolah').value;
    const gpictEmel = document.getElementById('gpictEmel').value;
    const adminEmel = document.getElementById('adminEmel').value;

    if (!gpictEmel.includes("@moe-dl.edu.my") || !adminEmel.includes("@moe-dl.edu.my")) {
        Swal.fire('Format Emel', 'Sila gunakan emel rasmi @moe-dl.edu.my', 'warning'); return;
    }

    toggleLoading(true);
    const payload = {
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: gpictEmel,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: adminEmel
    };

    const { error } = await supabaseClient.from('sekolah_data').update(payload).eq('kod_sekolah', kod);
    toggleLoading(false);

    if (error) Swal.fire('Ralat', error.message, 'error');
    else Swal.fire('Berjaya!', 'Maklumat telah dikemaskini.', 'success');
}

function salinDataProfil() {
    if (document.getElementById('checkSama').checked) {
        document.getElementById('adminNama').value = document.getElementById('gpictNama').value;
        document.getElementById('adminTel').value = document.getElementById('gpictTel').value;
        document.getElementById('adminEmel').value = document.getElementById('gpictEmel').value;
    }
}

async function mintaPinPadam() {
    if (!state.isAdmin || !isSupabaseReady) return;

    const { value: pin } = await Swal.fire({
        title: 'Mod Admin', text: "Masukkan PIN untuk padam data:", input: 'password', showCancelButton: true
    });

    if (pin === ADMIN_PIN) {
        toggleLoading(true);
        const kod = document.getElementById('hiddenKodSekolah').value;
        const resetPayload = {
            nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null,
            nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null
        };
        await supabaseClient.from('sekolah_data').update(resetPayload).eq('kod_sekolah', kod);
        toggleLoading(false);
        Swal.fire('Selesai', 'Data dipadam.', 'success').then(() => loadProfileData());
    } else if (pin) {
        Swal.fire('Gagal', 'PIN Salah.', 'error');
    }
}

// --- MODULE 4: DASHBOARD ---
async function loadDashboardData() {
    if(!isSupabaseReady) return;
    if (state.dashboardData.length > 0) { renderFilterUI(); applyDashboardFilter(); return; }

    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').order('nama_sekolah', { ascending: true });
        if (error) throw error;

        state.dashboardData = data.map(i => {
            const required = [i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict, i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima];
            const isLengkap = required.every(f => f && f.trim() !== "");
            return { ...i, jenis: i.jenis_sekolah || 'LAIN-LAIN', is_lengkap: isLengkap };
        });

        renderFilterUI();
        applyDashboardFilter();
        toggleLoading(false);
    } catch (err) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal memuatkan data dashboard.', 'error');
    }
}

function renderFilterUI() {
    const types = [...new Set(state.dashboardData.map(i => i.jenis))].sort();
    const container = document.getElementById('dashboardFilterContainer');
    
    let opts = `<option value="ALL">SEMUA JENIS SEKOLAH</option>`;
    types.forEach(t => opts += `<option value="${t}" ${state.activeFilterType === t ? 'selected' : ''}>${t}</option>`);

    container.innerHTML = `
        <div class="col-md-8 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
        </div>
        <div class="col-md-4"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>`;
}

function setFilter(status) { state.activeFilterStatus = status; applyDashboardFilter(); }
function setType(type) { state.activeFilterType = type; applyDashboardFilter(); }

function applyDashboardFilter() {
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    if(state.activeFilterStatus === 'ALL') document.getElementById('badgeAll')?.classList.add('active');
    if(state.activeFilterStatus === 'LENGKAP') document.getElementById('badgeLengkap')?.classList.add('active');
    if(state.activeFilterStatus === 'BELUM') document.getElementById('badgeBelum')?.classList.add('active');

    const filtered = state.dashboardData.filter(i => {
        const statMatch = (state.activeFilterStatus === 'ALL') || 
                          (state.activeFilterStatus === 'LENGKAP' && i.is_lengkap) || 
                          (state.activeFilterStatus === 'BELUM' && !i.is_lengkap);
        const typeMatch = (state.activeFilterType === 'ALL') || (i.jenis === state.activeFilterType);
        return statMatch && typeMatch;
    });

    const context = (state.activeFilterType === 'ALL') ? state.dashboardData : state.dashboardData.filter(i => i.jenis === state.activeFilterType);
    document.getElementById('cntAll').innerText = context.length;
    document.getElementById('cntLengkap').innerText = context.filter(i => i.is_lengkap).length;
    document.getElementById('cntBelum').innerText = context.filter(i => !i.is_lengkap).length;

    renderGrid(filtered);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (data.length === 0) {
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data dijumpai.</div>`;
        return;
    }
    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});
    let html = "";
    Object.keys(groups).sort().forEach(jenis => {
        html += `<div class="mb-4 fade-up"><h5 class="category-header">${jenis} <span class="badge bg-white text-dark ms-2 border">${groups[jenis].length}</span></h5><div class="row g-3">`;
        groups[jenis].forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge"><i class="fas fa-check me-1"></i>LENGKAP</span>` 
                : `<span class="badge bg-danger status-badge"><i class="fas fa-times me-1"></i>BELUM ISI</span>`;
            const actionsGpict = renderActionBtns(s.nama_gpict, s.no_telefon_gpict, s.telegram_id_gpict);
            const actionsAdmin = renderActionBtns(s.nama_admin_delima, s.no_telefon_admin_delima, s.telegram_id_admin);
            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card school-card h-100 cursor-pointer" onclick="viewSchoolFromDashboard('${s.kod_sekolah}')">
                <div class="card-body p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-2"><h6 class="fw-bold text-primary mb-0">${s.kod_sekolah}</h6>${statusBadge}</div>
                  <p class="school-name mb-auto text-truncate" title="${s.nama_sekolah}">${s.nama_sekolah}</p>
                </div>
                <div class="tele-status-row bg-light border-top">
                   <div class="row-item"><span class="small fw-bold text-muted">GPICT</span> ${actionsGpict}</div>
                   <div class="row-item border-top border-light pt-1"><span class="small fw-bold text-muted">Admin</span> ${actionsAdmin}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
    });
    wrapper.innerHTML = html;
}

function renderActionBtns(nama, tel, teleId) {
    let html = '<div class="d-flex align-items-center gap-1">';
    if (teleId) html += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-check-circle"></i> OK</span>`;
    const linkRaw = generateWhatsAppLink(nama, tel, true);
    const linkTemplate = generateWhatsAppLink(nama, tel, false);
    if (linkRaw) html += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary" title="Mesej"><i class="fas fa-comment"></i></a>`;
    if (!teleId && linkTemplate) html += `<a href="${linkTemplate}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-outline-success" title="Ingatkan"><i class="fab fa-whatsapp"></i></a>`;
    return html + '</div>';
}

function viewSchoolFromDashboard(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
    navigateTo('profile');
}

// --- MODULE 5: QUEUE ---
function mulaTindakanPantas() {
    let list = (state.activeFilterType === 'ALL') ? state.dashboardData : state.dashboardData.filter(i => i.jenis === state.activeFilterType);
    state.reminderQueue = [];
    list.forEach(i => {
        if (cleanPhone(i.no_telefon_gpict) && !i.telegram_id_gpict) state.reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        if (cleanPhone(i.no_telefon_admin_delima) && !i.telegram_id_admin) state.reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
    });
    if (state.reminderQueue.length === 0) { Swal.fire('Tiada Sasaran', 'Tiada staf untuk diingatkan.', 'info'); return; }
    state.queueIndex = 0;
    toggleQueueModal(true);
    renderQueueCard();
}

function toggleQueueModal(show) {
    const el = document.getElementById('queueModal');
    show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function renderQueueCard() {
    if (state.queueIndex >= state.reminderQueue.length) { toggleQueueModal(false); Swal.fire('Selesai', 'Semua peringatan disemak.', 'success'); return; }
    const item = state.reminderQueue[state.queueIndex];
    document.getElementById('qProgress').innerText = `Sasaran ${state.queueIndex + 1} / ${state.reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "Tiada Nama";
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    btn.href = link || "#";
    btn.style.pointerEvents = link ? 'auto' : 'none';
    btn.style.opacity = link ? '1' : '0.5';
}

function nextQueue() { state.queueIndex++; renderQueueCard(); }
function prevQueue() { if(state.queueIndex > 0) state.queueIndex--; renderQueueCard(); }

function janaSenaraiTelegram() {
    const context = (state.activeFilterType === 'ALL') ? state.dashboardData : state.dashboardData.filter(i => i.jenis === state.activeFilterType);
    const belum = context.filter(i => !i.is_lengkap);
    if (belum.length === 0) { Swal.fire('Tahniah', 'Semua sekolah lengkap.', 'success'); return; }
    let teks = `*STATUS PENGISIAN SMPID (${new Date().toLocaleDateString()})*\n\nMohon tindakan segera:\n`;
    const groups = belum.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});
    Object.keys(groups).sort().forEach(j => {
        teks += `\n*${j}*\n`;
        groups[j].forEach((s, idx) => teks += `${idx+1}. ${s.kod_sekolah} - ${s.nama_sekolah}\n`);
    });
    navigator.clipboard.writeText(teks).then(() => Swal.fire('Disalin!', 'Sedia untuk ditampal di Telegram.', 'success'));
}

// --- MODULE 6: EMAIL ---
function generateEmailList() {
    const incGpict = document.getElementById('checkGpict').checked;
    const incAdmin = document.getElementById('checkAdmin').checked;
    const status = document.getElementById('statusFilter').value;
    const emails = new Set();
    state.dashboardData.forEach(row => {
        const check = (email, teleId) => {
            if (!email) return;
            if (status === 'all') emails.add(email);
            if (status === 'unregistered' && !teleId) emails.add(email);
            if (status === 'registered' && teleId) emails.add(email);
        };
        if (incGpict) check(row.emel_delima_gpict, row.telegram_id_gpict);
        if (incAdmin) check(row.emel_delima_admin_delima, row.telegram_id_admin);
    });
    const arr = Array.from(emails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
}

function copyEmails() {
    const el = document.getElementById('emailOutput');
    if(!el.value) return;
    el.select();
    navigator.clipboard.writeText(el.value);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Emel disalin', timer: 1500, showConfirmButton: false });
}

// --- UTILITIES ---
function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function cleanPhone(phone) {
    if (!phone) return "";
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('0')) p = '6' + p;
    return p.length > 5 ? p : "";
}

function autoFormatPhone(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length > 3) {
        if (val.startsWith('60')) input.value = '+' + val;
        else if (val.startsWith('0')) input.value = '+6' + val;
        else input.value = '+6' + val;
    }
}

function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    if (isRaw) return `https://wa.me/${cleanNum}`;
    const msg = `Assalamualaikum Cikgu ${nama||''}, mohon aktifkan id telegram di bot SMPID: https://t.me/smpid_bot (Klik Start > Masukkan Kod Sekolah). TQ.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(msg)}`;
}