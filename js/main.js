// --- LOGIK LOGIN (index.html) ---
async function prosesLogin() {
    const input = document.getElementById('inputKodSekolah');
    if (!input) return; // Bukan page login

    const kod = input.value.trim().toUpperCase();
    if (!kod) { Swal.fire('Ralat', 'Sila masukkan kod.', 'warning'); return; }

    // Admin Access
    if (kod === "M030") {
        sessionStorage.setItem('smpid_auth', 'true');
        Swal.fire({
            title: 'Menu Admin', text: 'Pilih modul:', icon: 'question', showCancelButton: true,
            confirmButtonText: '<i class="fas fa-tachometer-alt me-2"></i>Dashboard', 
            cancelButtonText: '<i class="fas fa-envelope me-2"></i>Email Blaster', 
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#198754'
        }).then((res) => {
             // Jika dismiss/cancel, pergi ke email. Jika confirm, pergi ke dashboard.
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
    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    if (!kod) { window.location.href = 'index.html'; return; }

    if (isAdmin) {
        const btn = document.getElementById('btnNavigasiKeluar');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-arrow-left me-1"></i> Kembali ke Dashboard';
            btn.setAttribute('onclick', "window.location.href='dashboard.html'");
        }
    }

    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').eq('kod_sekolah', kod).single();
        if (error) throw error;
        
        // Papar Data
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        // Isi Form
        const sets = [['gpictNama', data.nama_gpict], ['gpictTel', data.no_telefon_gpict], ['gpictEmel', data.emel_delima_gpict],
                      ['adminNama', data.nama_admin_delima], ['adminTel', data.no_telefon_admin_delima], ['adminEmel', data.emel_delima_admin_delima]];
        sets.forEach(([id, val]) => { if(document.getElementById(id)) document.getElementById(id).value = val || ""; });
        
        toggleLoading(false);
    } catch (err) { toggleLoading(false); Swal.fire('Ralat', 'Gagal data.', 'error'); }
}

function salinData() {
    if (document.getElementById('checkSama').checked) {
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

function mintaPinPadam() {
    Swal.fire({
      title: 'Admin Sahaja', text: "Masukkan PIN Keselamatan:", input: 'password', showCancelButton: true, confirmButtonText: 'Padam Data', confirmButtonColor: '#dc3545',
      preConfirm: async (pin) => {
        if (pin !== ADMIN_PIN) { Swal.showValidationMessage('PIN Salah!'); return false; }
        const kod = document.getElementById('hiddenKodSekolah').value;
        try {
           const { error } = await supabaseClient.from('sekolah_data').update({ nama_gpict: '', no_telefon_gpict: '', emel_delima_gpict: '', nama_admin_delima: '', no_telefon_admin_delima: '', emel_delima_admin_delima: '' }).eq('kod_sekolah', kod);
           if (error) throw error;
           return true;
        } catch (error) { Swal.showValidationMessage(error.message); }
      }
    }).then((result) => {
      if (result.isConfirmed) { Swal.fire('Terpadam!', 'Data kosong.', 'success').then(() => { loadProfil(); }); }
    });
}

function keluarSistem() {
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';
    if (!isAdmin) sessionStorage.clear();
    window.location.href = isAdmin ? 'dashboard.html' : 'index.html';
}

function logout() {
    Swal.fire({
        title: 'Log Keluar?', text: "Kembali ke laman utama.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Keluar'
    }).then((result) => {
        if (result.isConfirmed) { sessionStorage.clear(); window.location.href = 'index.html'; }
    });
}

// Auto-run berdasarkan page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('inputKodSekolah')) { sessionStorage.clear(); } // Login Page
    if (document.getElementById('dispNamaSekolah')) { loadProfil(); } // Profil Page
    if (document.getElementById('displayKodSekolah')) { // Menu Page
         const k = sessionStorage.getItem('smpid_user_kod');
         if(k) document.getElementById('displayKodSekolah').innerHTML = `<i class="fas fa-school me-2"></i>${k}`;
         else window.location.href = 'index.html';
    }
});