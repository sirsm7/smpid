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
        navigator.clipboard.writeText(el.value).then(() => Swal.fire({
            icon: 'success',
            title: 'Disalin',
            text: 'Senarai emel disalin.',
            timer: 1000,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }));
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

// --- HELPDESK (TAILWIND UI) ---
window.loadTiketAdmin = async function() {
    const wrapper = document.getElementById('adminTiketWrapper');
    if(!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-10 text-slate-400 font-medium animate-pulse">Memuatkan tiket...</div>`;
    
    const filter = document.getElementById('filterTiketAdmin').value;
    
    try {
        const data = await SupportService.getAll(filter);
        wrapper.innerHTML = "";
        
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 font-medium">Tiada tiket dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleString('ms-MY');
            let actionArea = "";

            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="mt-4 pt-4 border-t border-red-100 bg-red-50 p-3 rounded-lg">
                    <label class="block text-xs font-bold text-red-600 uppercase mb-2">Balasan Admin:</label>
                    <textarea id="reply-${t.id}" class="w-full p-2 rounded border border-red-200 text-sm focus:border-red-400 outline-none mb-3" rows="2" placeholder="Tulis balasan..."></textarea>
                    <div class="flex justify-end gap-2">
                        <button onclick="padamTiket(${t.id})" class="px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-white text-xs font-bold transition">Padam</button>
                        <button onclick="submitBalasanAdmin(${t.id})" class="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm">Hantar & Tutup</button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="mt-3 text-green-700 text-sm border-t border-green-100 pt-3 bg-green-50 p-3 rounded-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <i class="fas fa-check-circle mr-1"></i> <span class="font-bold">Respon:</span> ${t.balasan_admin}
                        </div>
                        <button onclick="padamTiket(${t.id})" class="text-red-400 hover:text-red-600 text-xs ml-2" title="Padam Tiket"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }

            const borderClass = t.status === 'SELESAI' ? 'border-l-4 border-l-green-500 opacity-80' : 'border-l-4 border-l-red-500';
            const statusBadge = t.status === 'SELESAI' 
                ? `<span class="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">SELESAI</span>`
                : `<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">DALAM PROSES</span>`;

            wrapper.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${borderClass} mb-4">
                <div class="p-5">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-2">
                            <span class="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold">${t.kod_sekolah}</span>
                            <span class="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-200">${t.peranan_pengirim}</span>
                        </div>
                        <div class="flex flex-col items-end">
                            ${statusBadge}
                            <span class="text-[10px] text-slate-400 font-medium mt-1">${dateStr}</span>
                        </div>
                    </div>
                    <h6 class="font-bold text-slate-800 text-sm mb-2">${t.tajuk}</h6>
                    <div class="bg-slate-50 p-3 rounded border border-slate-100 text-slate-600 text-xs leading-relaxed">
                        ${t.butiran_masalah}
                    </div>
                    ${actionArea}
                </div>
            </div>`;
        });
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-center text-red-500 font-bold py-10">Ralat memuatkan tiket.</div>`; 
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
        Swal.fire({
            icon: 'success',
            title: 'Selesai',
            text: 'Tiket ditutup dan notifikasi dihantar.',
            timer: 1500,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }).then(() => window.loadTiketAdmin());
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
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await SupportService.delete(id);
                toggleLoading(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Dipadam',
                    timer: 1000,
                    showConfirmButton: false
                }).then(() => window.loadTiketAdmin());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};