// --- LOGIK GLOBAL (Digunakan merentas sistem) ---

// Fungsi Utiliti Login (index.html)
async function prosesLogin() {
    const input = document.getElementById('inputKodSekolah');
    if (!input) return; // Guard clause jika bukan page login

    const kod = input.value.trim().toUpperCase();
    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod.', 'warning'); return; }

    // Admin Access (M030)
    if (kod === "M030") {
        sessionStorage.setItem('smpid_auth', 'true');
        Swal.fire({
            title: 'Menu Admin', text: 'Pilih modul:', icon: 'question', showCancelButton: true,
            confirmButtonText: '<i class="fas fa-tachometer-alt me-2"></i>Dashboard', 
            cancelButtonText: '<i class="fas fa-envelope me-2"></i>Email Blaster', 
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#198754'
        }).then((res) => {
             if(res.isConfirmed) window.location.href = 'dashboard.html';
             else if(res.dismiss === Swal.DismissReason.cancel) window.location.href = 'email.html';
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

// --- LOGIK PROFIL SEKOLAH (profil.html) ---
async function loadProfil() {
    // Pastikan kita di halaman profil sebelum run
    if (!document.getElementById('dispNamaSekolah')) return;

    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    
    if (!kod) { window.location.href = 'index.html'; return; }

    // Logik UI untuk Admin vs User
    if (isAdmin) {
        // Jika Admin: Ubah butang keluar jadi 'Kembali ke Dashboard'
        const btn = document.getElementById('btnNavigasiKeluar');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-arrow-left me-1"></i> Kembali ke Dashboard';
            btn.setAttribute('onclick', "window.location.href='dashboard.html'");
        }
    } else {
        // Jika User Biasa: Sembunyikan Butang Padam Data
        const btnPadam = document.querySelector('button[onclick="mintaPinPadam()"]');
        if (btnPadam) btnPadam.style.display = 'none';
    }

    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').eq('kod_sekolah', kod).single();
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

// --- FUNGSI PADAM DATA (ADMIN SAHAJA) ---
async function mintaPinPadam() {
    // 1. Semak Keselamatan Sesi
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        Swal.fire('Akses Ditolak', 'Hanya Admin yang sah boleh melakukan tindakan ini.', 'error');
        return;
    }

    // 2. Minta PIN Keselamatan
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

    if (!pin) return; // Pengguna tekan batal

    // 3. Sahkan PIN (ADMIN_PIN dari utils.js)
    if (pin !== ADMIN_PIN) {
        Swal.fire('Gagal', 'PIN Keselamatan tidak sah.', 'error');
        return;
    }

    // 4. Proses Pemadaman (Reset medan ke NULL)
    toggleLoading(true);
    const kod = document.getElementById('hiddenKodSekolah').value;

    try {
        // Kita hanya padam data profil, bukan rekod sekolah itu sendiri
        const resetPayload = {
            nama_gpict: null,
            no_telefon_gpict: null,
            emel_delima_gpict: null,
            nama_admin_delima: null,
            no_telefon_admin_delima: null,
            emel_delima_admin_delima: null
        };

        const { error } = await supabaseClient
            .from('sekolah_data')
            .update(resetPayload)
            .eq('kod_sekolah', kod);

        if (error) throw error;

        toggleLoading(false);
        await Swal.fire('Selesai', 'Data profil sekolah telah dipadamkan.', 'success');
        
        // Reload halaman untuk paparan kosong
        window.location.reload();

    } catch (err) {
        toggleLoading(false);
        console.error(err);
        Swal.fire('Ralat', 'Gagal memadam data dari database.', 'error');
    }
}

// --- FUNGSI SISTEM ---

// Fungsi PUSAT untuk logout. 
function keluarSistem(forceRedirect = false) {
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Jika dipanggil dari Dashboard UI (yang dah confirm), terus jalankan
    if (forceRedirect) {
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // Jika dipanggil dari Menu Pengguna biasa (belum confirm)
    if (!isAdmin) {
        Swal.fire({
            title: 'Log Keluar?', text: "Kembali ke laman utama.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
        }).then((result) => {
            if (result.isConfirmed) { sessionStorage.clear(); window.location.href = 'index.html'; }
        });
    } else {
        // Jika admin tertekan 'Back' di browser atau butang lain, fallback ke dashboard
        window.location.href = 'dashboard.html';
    }
}

// --- AUTO RUN ---
document.addEventListener('DOMContentLoaded', () => {
    // Bersihkan session hanya jika berada di Login Page
    if (document.getElementById('inputKodSekolah')) { sessionStorage.clear(); } 
    
    // Load profil hanya jika elemen wujud
    if (document.getElementById('dispNamaSekolah')) { loadProfil(); } 
    
    // Logic Menu Pengguna
    if (document.getElementById('displayKodSekolah')) { 
         const k = sessionStorage.getItem('smpid_user_kod');
         if(k) document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-school me-2"></i>${k}`;
         else window.location.href = 'index.html';
    }
});