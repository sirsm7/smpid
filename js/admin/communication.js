/**
 * MODUL KOMUNIKASI (js/admin/communication.js)
 * Fungsi: Menguruskan Email Blaster dan Helpdesk/Aduan
 */

let emailRawData = [];

// --- EMAIL BLASTER ---
function generateList() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    
    // Gunakan globalDashboardData yang disimpan dari dashboard.js
    if(!window.globalDashboardData || window.globalDashboardData.length === 0) {
        document.getElementById('countEmail').innerText = "0";
        document.getElementById('emailOutput').value = "";
        return;
    }

    window.globalDashboardData.forEach(row => {
        if (row.jenis === 'PPD') return;

        if (includeGpict && row.emel_delima_gpict) {
            const hasId = row.telegram_id_gpict;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_gpict.trim());
            }
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = row.telegram_id_admin;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_admin_delima.trim());
            }
        }
    });

    const arr = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
}

function copyEmails() { 
    const el = document.getElementById("emailOutput"); 
    if(!el.value) return; 
    el.select(); 
    navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success')); 
}

function copyTemplate() { 
    navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success')); 
}

// --- HELPDESK / ADUAN ---
async function loadTiketAdmin() {
    const wrapper = document.getElementById('adminTiketWrapper');
    const filter = document.getElementById('filterTiketAdmin')?.value || 'ALL';
    if(!wrapper) return;

    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        let query = window.supabaseClient.from('smpid_aduan').select('*').order('created_at', { ascending: false });
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
                    <textarea id="reply-${t.id}" class="form-control form-control-sm mb-2" rows="2" placeholder="Tulis penyelesaian..." onblur="this.value = window.formatSentenceCase(this.value)"></textarea>
                    <div class="d-flex justify-content-between">
                        <button onclick="submitBalasanAdmin(${t.id}, '${t.kod_sekolah}', '${t.peranan_pengirim}', '${t.tajuk}')" class="btn btn-sm btn-primary">
                            <i class="fas fa-reply me-1"></i> Hantar & Tutup Tiket
                        </button>
                        <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger" title="Padam Tiket Ini"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="d-flex justify-content-between align-items-end mt-2">
                    <div class="text-success small"><i class="fas fa-check-circle"></i> Diselesaikan pada: ${t.tarikh_balas ? new Date(t.tarikh_balas).toLocaleDateString() : '-'} <br> <b>Respon:</b> ${t.balasan_admin}</div>
                    <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger ms-2" title="Padam Tiket Ini"><i class="fas fa-trash-alt"></i></button>
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
    
    window.toggleLoading(true);
    try {
        const { error } = await window.supabaseClient
            .from('smpid_aduan')
            .update({ status: 'SELESAI', balasan_admin: replyText, tarikh_balas: new Date().toISOString() })
            .eq('id', id);
        
        if (error) throw error;

        // Notifikasi Balasan ke Telegram User (Jika ada API)
        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/reply-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, balasan: replyText })
            }).catch(e => console.warn("Bot offline:", e));
        }

        window.toggleLoading(false);
        Swal.fire('Selesai', 'Tiket ditutup.', 'success').then(() => loadTiketAdmin());

    } catch (e) {
        window.toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

async function padamTiket(id) {
    Swal.fire({
        title: 'Padam Tiket Ini?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient.from('smpid_aduan').delete().eq('id', id);
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Dipadam', 'Tiket telah dihapuskan.', 'success').then(() => loadTiketAdmin());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
}

// EXPORTS
window.generateList = generateList;
window.copyEmails = copyEmails;
window.copyTemplate = copyTemplate;
window.loadTiketAdmin = loadTiketAdmin;
window.submitBalasanAdmin = submitBalasanAdmin;
window.padamTiket = padamTiket;