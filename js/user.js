/**
 * SMPID USER PORTAL MODULE (js/user.js)
 * Versi: 2.3 (Full - No Redeclare Fix)
 * Fungsi: Logik Dashboard Sekolah, Profil & Aduan
 * Halaman: user.html
 */

// NOTA: Variable global (DENO_API_URL, SUPABASE_URL) diambil dari window (utils.js)

// ==========================================
// 1. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initUserPortal();
});

function initUserPortal() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Double check security
    if (!kod && !isAdmin) { 
        window.location.replace('index.html'); 
        return; 
    }
    
    // Setup UI Header
    const displayKod = document.getElementById('displayKodSekolah');
    const btnLogout = document.getElementById('btnLogoutMenu');

    if (isAdmin) {
        // Paparan Khas jika Admin PPD
        displayKod.innerHTML = `<i class="fas fa-user-shield me-2"></i>ADMIN VIEW: ${kod}`;
        displayKod.classList.replace('text-dark', 'text-primary');
        displayKod.classList.add('border', 'border-primary');
        
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left me-2"></i>Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.classList.replace('text-danger', 'text-primary');
        }
        
        // Tunjuk butang reset (hanya untuk admin)
        const btnReset = document.getElementById('btnResetData');
        if (btnReset) btnReset.classList.remove('hidden');

    } else {
        // Paparan Biasa (Sekolah)
        displayKod.innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    }
    
    // Mula muatkan data profil
    loadProfil(kod);
}

// ==========================================
// 2. NAVIGASI (SPA FEEL)
// ==========================================

function showSection(section) {
    const menuSection = document.getElementById('section-menu');
    const profilSection = document.getElementById('section-profil');
    const aduanSection = document.getElementById('section-aduan');
    const welcomeText = document.getElementById('welcomeText');

    // Reset semua ke hidden dulu
    menuSection.classList.add('hidden');
    profilSection.classList.add('hidden');
    aduanSection.classList.add('hidden');

    if (section === 'menu') {
        menuSection.classList.remove('hidden');
        welcomeText.innerText = "Menu Utama";
    } else if (section === 'profil') {
        profilSection.classList.remove('hidden');
        welcomeText.innerText = "Kemaskini Maklumat";
    } else if (section === 'aduan') {
        aduanSection.classList.remove('hidden');
        welcomeText.innerText = "Helpdesk & Aduan";
        // Muat data tiket bila tab dibuka
        loadTiketUser(); 
    }
}

// ==========================================
// 3. PENGURUSAN PROFIL
// ==========================================

async function loadProfil(kod) {
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            .eq('kod_sekolah', kod)
            .single();
            
        if (error) throw error;
        
        // Isi Header
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        // Isi Borang
        const fields = {
            'gpictNama': data.nama_gpict, 
            'gpictTel': data.no_telefon_gpict, 
            'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 
            'adminTel': data.no_telefon_admin_delima, 
            'adminEmel': data.emel_delima_admin_delima
        };
        
        for (let id in fields) { 
            if(document.getElementById(id)) {
                document.getElementById(id).value = fields[id] || ""; 
            }
        }
    } catch (err) { 
        console.error("Gagal muat profil:", err); 
        Swal.fire('Ralat Sambungan', 'Gagal memuatkan data sekolah.', 'error');
    }
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
    
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Validasi Asas
    if (!window.checkEmailDomain(emelG)) { 
        Swal.fire('Format Salah', 'Sila gunakan emel domain moe-dl.edu.my', 'warning'); 
        return; 
    }

    if(btnSubmit) btnSubmit.disabled = true;
    window.toggleLoading(true);

    const payload = {
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: emelG,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: document.getElementById('adminEmel').value
    };

    try {
        const { error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kod);
            
        if (error) throw error;

        // Notifikasi Telegram (Fire & Forget)
        // Gunakan window.DENO_API_URL dari utils.js
        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: kod, 
                    nama: namaSekolah,
                    updated_by: isAdmin ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH' 
                })
            }).catch(err => console.warn("Bot offline:", err));
        }

        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        
        Swal.fire('Berjaya', 'Maklumat sekolah telah dikemaskini.', 'success')
            .then(() => showSection('menu'));
            
    } catch (err) {
        window.toggleLoading(false); 
        if(btnSubmit) btnSubmit.disabled = false;
        
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyimpan data ke database.', 'error');
    }
}

// ==========================================
// 4. HELPDESK / ADUAN
// ==========================================

async function hantarTiket() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesej = window.formatSentenceCase(document.getElementById('tiketMesej').value);

    const btnSubmit = document.querySelector('#formTiket button[type="submit"]');

    if (!peranan) { 
        Swal.fire('Pilih Jawatan', 'Sila nyatakan anda sebagai GPICT atau Admin.', 'warning'); 
        return; 
    }

    if(btnSubmit) btnSubmit.disabled = true;
    window.toggleLoading(true);

    try {
        const { error } = await window.supabaseClient
            .from('smpid_aduan')
            .insert([{ 
                kod_sekolah: kod, 
                peranan_pengirim: peranan, 
                tajuk: tajuk, 
                butiran_masalah: mesej 
            }]);
        
        if (error) throw error;

        // Notifikasi Telegram ke Admin PPD
        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/notify-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, mesej: mesej })
            }).catch(e => console.warn("Bot offline:", e));
        }

        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        
        Swal.fire('Tiket Dihantar', 'Pihak PPD telah dimaklumkan.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            // Pindah ke tab sejarah tiket
            const tabBtn = document.querySelector('#tab-semak-aduan');
            if(tabBtn) {
                const tab = new bootstrap.Tab(tabBtn);
                tab.show();
            }
            loadTiketUser();
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Ralat', 'Gagal menghantar tiket.', 'error');
    }
}

async function loadTiketUser() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const container = document.getElementById('senaraiTiketContainer');
    
    if(!container) return;

    // Loader Tempatan
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="small text-muted mt-2">Memuatkan sejarah tiket...</p>
        </div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_aduan')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        container.innerHTML = ""; 

        if (data.length === 0) {
            container.innerHTML = `
            <div class="text-center py-5 opacity-50">
                <i class="fas fa-folder-open fa-3x mb-3 text-secondary"></i>
                <p class="fw-bold text-dark">Tiada Rekod Aduan</p>
                <small>Sebarang tiket yang dihantar akan disenaraikan di sini.</small>
            </div>`;
            return;
        }

        // Render Kad Tiket
        data.forEach(t => {
            const dateObj = new Date(t.created_at);
            const dateStr = dateObj.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

            let statusBadge = t.status === 'SELESAI' 
                ? `<span class="badge bg-success bg-gradient shadow-sm"><i class="fas fa-check-circle me-1"></i>SELESAI</span>`
                : `<span class="badge bg-warning text-dark bg-gradient shadow-sm"><i class="fas fa-clock me-1"></i>DALAM PROSES</span>`;

            let responHTML = t.balasan_admin ? `
                <div class="bg-primary bg-opacity-10 p-3 rounded-3 border border-primary border-opacity-25 mt-3 position-relative">
                    <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-primary mt-1 shadow-sm">Respon PPD</span>
                    <p class="mb-1 text-dark small mt-2 fw-semibold">${t.balasan_admin}</p>
                    <div class="text-end"><small class="text-muted" style="font-size: 0.7rem;">${t.tarikh_balas ? new Date(t.tarikh_balas).toLocaleDateString('ms-MY') : ''}</small></div>
                </div>` : `
                <div class="bg-light p-2 rounded-3 border border-dashed mt-3 text-center">
                    <small class="text-muted fst-italic"><i class="fas fa-hourglass-half me-2"></i>Menunggu tindakan pegawai PPD...</small>
                </div>`;

            const cardHTML = `
            <div class="card shadow-sm border-0 rounded-4 mb-1 overflow-hidden">
                <div class="card-body p-0">
                    <div class="p-3 border-bottom bg-white d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                             <div class="bg-light rounded-circle d-flex align-items-center justify-content-center text-secondary border" style="width: 35px; height: 35px;">
                                <i class="fas ${t.peranan_pengirim === 'GPICT' ? 'fa-laptop-code' : 'fa-user-shield'}"></i>
                             </div>
                             <div>
                                <small class="text-secondary d-block lh-1" style="font-size: 0.7rem;">${dateStr} • ${timeStr}</small>
                                <span class="fw-bold text-dark small">${t.peranan_pengirim}</span>
                             </div>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="p-3 bg-white">
                        <h6 class="fw-bold text-dark mb-2">${t.tajuk}</h6>
                        <p class="text-secondary small mb-0 text-break">${t.butiran_masalah}</p>
                        ${responHTML}
                    </div>
                </div>
                <div class="position-absolute top-0 start-0 bottom-0 bg-${t.status === 'SELESAI' ? 'success' : 'warning'}" style="width: 4px;"></div>
            </div>`;

            container.innerHTML += cardHTML;
        });

    } catch (e) { 
        console.error(e); 
        container.innerHTML = `<div class="alert alert-danger small">Gagal memuatkan tiket. Sila cuba lagi.</div>`;
    }
}

// ==========================================
// 5. TUKAR KATA LALUAN
// ==========================================

async function ubahKataLaluan() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    if (!kod) return;

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html:
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Lama</label>' +
            '<input id="swal-input1" type="password" class="swal2-input mb-3" placeholder="Masukan password semasa">' +
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Baru</label>' +
            '<input id="swal-input2" type="password" class="swal2-input" placeholder="Minima 6 aksara">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;

        if (!oldPass || !newPass) {
            Swal.fire('Ralat', 'Sila isi kedua-dua ruang.', 'warning');
            return;
        }
        if (newPass.length < 6) {
            Swal.fire('Ralat', 'Kata laluan baru terlalu pendek (min 6).', 'warning');
            return;
        }

        window.toggleLoading(true);

        try {
            // Sahkan Password Lama
            const { data: userData, error: fetchError } = await window.supabaseClient
                .from('smpid_users')
                .select('password')
                .eq('kod_sekolah', kod)
                .single();

            if (fetchError || !userData) throw new Error("User tidak dijumpai.");

            if (userData.password !== oldPass) {
                window.toggleLoading(false);
                Swal.fire('Gagal', 'Kata laluan lama tidak sah.', 'error');
                return;
            }

            // Update Password Baru
            const { error: updateError } = await window.supabaseClient
                .from('smpid_users')
                .update({ password: newPass })
                .eq('kod_sekolah', kod);

            if (updateError) throw updateError;

            window.toggleLoading(false);
            Swal.fire('Berjaya', 'Kata laluan telah ditukar. Sila log masuk semula.', 'success').then(() => {
                window.keluarSistem();
            });

        } catch (err) {
            window.toggleLoading(false);
            console.error(err);
            Swal.fire('Ralat', 'Gagal menukar kata laluan.', 'error');
        }
    }
}

// ==========================================
// 6. ADMIN RESET (KHAS)
// ==========================================

async function resetDataSekolah() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const { value: password } = await Swal.fire({
        title: 'Akses Admin Diperlukan',
        text: 'Masukkan kata laluan khas untuk reset data sekolah ini:',
        input: 'password',
        showCancelButton: true,
        confirmButtonText: 'Sahkan'
    });

    if (password === 'pkgag') { // Hardcoded master key untuk admin
         Swal.fire({
            title: 'Pasti Reset Data?',
            text: "Semua data GPICT/Admin akan dipadam (NULL). Kod sekolah kekal.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Reset!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                window.toggleLoading(true);
                const payload = {
                    nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null, telegram_id_gpict: null,
                    nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null, telegram_id_admin: null
                };
                try {
                    const { error } = await window.supabaseClient.from('smpid_sekolah_data').update(payload).eq('kod_sekolah', kod);
                    if (error) throw error;
                    window.toggleLoading(false);
                    Swal.fire('Berjaya', 'Data sekolah telah di-reset.', 'success').then(() => loadProfil(kod));
                } catch (err) {
                    window.toggleLoading(false); 
                    Swal.fire('Ralat', 'Gagal reset data.', 'error');
                }
            }
        });
    } else if (password) {
        Swal.fire('Akses Ditolak', 'Kata laluan salah.', 'error');
    }
}

// Bind Global Window Functions
// Ini memastikan fungsi HTML onclick dapat mencari fungsi JS ini
window.showSection = showSection;
window.simpanProfil = simpanProfil;
window.salinData = salinData;
window.hantarTiket = hantarTiket;
window.loadTiketUser = loadTiketUser;
window.ubahKataLaluan = ubahKataLaluan;
window.resetDataSekolah = resetDataSekolah;