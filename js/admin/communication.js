import { SupportService } from '../services/support.service.js';
import { toggleLoading } from '../core/helpers.js';

let quill;

// --- EMAIL BLASTER & EDITOR ---

window.initEmailEditor = function() {
    // Elak init dua kali
    if (quill || !document.getElementById('editor-container')) return;

    // Konfigurasi Quill
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Tulis mesej anda di sini...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],        // Format asas
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // Senarai
                [{ 'header': [1, 2, 3, false] }],                 // Tajuk
                [{ 'color': [] }, { 'background': [] }],          // Warna
                ['link', 'clean']                                 // Pautan & Bersih format
            ]
        }
    });

    // Tetapkan kandungan default (Format HTML)
    const defaultContent = `
        <p>Salam Sejahtera Tuan/Puan,</p>
        <p><br></p>
        <p>Mohon kerjasama Tuan/Puan selaku GPICT/Admin DELIMa sekolah untuk mengesahkan peranan anda dalam sistem SMPID melalui Bot Telegram rasmi kami.</p>
        <p><br></p>
        <p><strong>Sila ikuti langkah berikut:</strong></p>
        <ol>
            <li>Klik pautan bot: <a href="https://t.me/smpid_bot" target="_blank">https://t.me/smpid_bot</a></li>
            <li>Tekan butang <strong>'Start'</strong> atau hantar <em>/start</em></li>
            <li>Masukkan <strong>KOD SEKOLAH</strong> anda.</li>
            <li>Pilih butang peranan yang betul.</li>
        </ol>
        <p><br></p>
        <p>Kerjasama Tuan/Puan amat dihargai.</p>
        <p>Sekian, terima kasih.</p>
        <p><br></p>
        <p><strong>Unit Sumber Teknologi Pendidikan,</strong><br>PPD Alor Gajah.</p>
    `;
    
    // Masukkan ke dalam editor
    quill.clipboard.dangerouslyPasteHTML(defaultContent);

    // Tambah listener untuk update mailto link secara realtime
    quill.on('text-change', function() {
        updateMailtoLink();
    });
};

window.generateList = function() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    
    // Pastikan editor dihidupkan jika belum
    if(!quill) window.initEmailEditor();

    if(!window.globalDashboardData) return;

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
    
    updateMailtoLink();
};

function updateMailtoLink() {
    if (!quill) return;
    
    const arr = document.getElementById('emailOutput').value.split(', ');
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    
    // PENTING: Mailto hanya support plain text. Kita ambil text dari Quill.
    const plainTextBody = quill.getText(); 
    const body = encodeURIComponent(plainTextBody);
    
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
}

window.copyEmails = function() {
    const el = document.getElementById("emailOutput");
    if(el.value) {
        el.select();
        navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', 'Senarai emel disalin.', 'success'));
    }
};

window.copyTemplate = function() {
    // Salin Rich Text (HTML) ke Clipboard untuk Paste dalam Gmail/Outlook
    if (!quill) return;

    const htmlContent = quill.root.innerHTML;
    const textContent = quill.getText();

    // Gunakan Clipboard API moden untuk menyokong 'text/html'
    const blobHtml = new Blob([htmlContent], { type: "text/html" });
    const blobText = new Blob([textContent], { type: "text/plain" });
    const data = [new ClipboardItem({ 
        "text/html": blobHtml, 
        "text/plain": blobText 
    })];

    navigator.clipboard.write(data).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Teks Kaya Disalin!',
            html: 'Format (Bold/Italic) telah disalin.<br>Sila <b>Paste (Ctrl+V)</b> dalam tetingkap emel anda.',
            timer: 2000,
            showConfirmButton: false
        });
    }).catch(err => {
        console.error('Gagal salin rich text:', err);
        // Fallback ke teks biasa jika browser tidak sokong
        navigator.clipboard.writeText(textContent).then(() => {
            Swal.fire('Disalin (Teks Biasa)', 'Format tidak disokong pelayar ini.', 'info');
        });
    });
};

// --- HELPDESK ---
window.loadTiketAdmin = async function() {
    const wrapper = document.getElementById('adminTiketWrapper');
    if(!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    
    const filter = document.getElementById('filterTiketAdmin').value;
    
    try {
        const data = await SupportService.getAll(filter);
        wrapper.innerHTML = "";
        
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada tiket dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleString('ms-MY');
            let actionArea = "";

            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="mt-3 border-top pt-2 bg-light p-2 rounded">
                    <label class="small fw-bold">Balasan Admin:</label>
                    <textarea id="reply-${t.id}" class="form-control mb-2 form-control-sm" rows="2" placeholder="Tulis balasan..."></textarea>
                    <div class="d-flex justify-content-end gap-2">
                        <button onclick="padamTiket(${t.id})" class="btn btn-outline-danger btn-sm">Padam</button>
                        <button onclick="submitBalasanAdmin(${t.id})" class="btn btn-primary btn-sm">Hantar & Tutup</button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="mt-2 text-success small border-top pt-2">
                    <i class="fas fa-check-circle"></i> <strong>Respon:</strong> ${t.balasan_admin} 
                    <button onclick="padamTiket(${t.id})" class="btn btn-link text-danger p-0 ms-2 text-decoration-none" title="Padam Tiket"><i class="fas fa-trash"></i></button>
                </div>`;
            }

            wrapper.innerHTML += `
            <div class="card mb-3 shadow-sm ${t.status === 'SELESAI' ? 'bg-light opacity-75' : 'border-danger'}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge bg-dark me-1">${t.kod_sekolah}</span>
                            <span class="badge bg-secondary">${t.peranan_pengirim}</span>
                        </div>
                        <small class="text-muted fw-bold">${dateStr}</small>
                    </div>
                    <h6 class="fw-bold mb-1">${t.tajuk}</h6>
                    <p class="small text-secondary mb-0 bg-white p-2 rounded border">${t.butiran_masalah}</p>
                    ${actionArea}
                </div>
            </div>`;
        });
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-danger text-center">Ralat memuatkan tiket.</div>`; 
    }
};

window.submitBalasanAdmin = async function(id) {
    const reply = document.getElementById(`reply-${id}`).value;
    if(!reply) return Swal.fire('Kosong', 'Sila tulis balasan.', 'warning');
    
    toggleLoading(true);
    try {
        await SupportService.update(id, { 
            status: 'SELESAI', 
            balasan_admin: reply,
            tarikh_balas: new Date().toISOString()
        });
        
        toggleLoading(false);
        Swal.fire('Selesai', 'Tiket ditutup dan notifikasi dihantar.', 'success').then(() => window.loadTiketAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal mengemaskini tiket.', 'error');
    }
};

window.padamTiket = async function(id) {
    Swal.fire({ 
        title: 'Padam Tiket?', 
        text: "Tindakan ini tidak boleh dikembalikan.",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await SupportService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', '', 'success').then(() => window.loadTiketAdmin());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};