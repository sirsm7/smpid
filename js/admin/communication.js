import { SupportService } from '../services/support.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

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
        <p>Assalamualaikum & Salam Sejahtera Tuan/Puan,</p>
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
};

/**
 * Kemaskini lencana jumlah emel secara automatik apabila pengguna
 * menaip, menampal (paste), atau memadam emel secara manual di dalam kotak teks.
 */
window.kemaskiniKiraanEmel = function() {
    const emailStr = document.getElementById('emailOutput').value.trim();
    const countEl = document.getElementById('countEmail');
    
    if (!emailStr) {
        if (countEl) countEl.innerText = '0';
        return;
    }

    // Pisahkan mengikut koma, bersihkan ruang kosong, dan tapis rentetan kosong
    const emailArray = emailStr.split(',').map(e => e.trim()).filter(e => e);
    if (countEl) countEl.innerText = emailArray.length;
};

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

/**
 * API PENGHANTARAN EMEL SISTEM (GAS) - BATCH PROCESSING EDITION
 * Memecahkan senarai kepada kumpulan kecil (Chunks) untuk memintas 
 * had pelayan Google "Limit Exceeded: Email Recipients Per Message".
 */
window.hantarEmelSistem = async function() {
    if (!quill) return;

    const emailList = document.getElementById('emailOutput').value.trim();
    const subject = document.getElementById('msgSubject').value.trim();
    const senderName = document.getElementById('msgSenderName') ? document.getElementById('msgSenderName').value.trim() : "Admin SMPID";
    const htmlBody = quill.root.innerHTML;

    if (!emailList) {
        return Swal.fire('Senarai Kosong', 'Sila jana atau taip senarai emel terlebih dahulu.', 'warning');
    }

    if (!subject || !quill.getText().trim()) {
        return Swal.fire('Mesej Kosong', 'Sila isi tajuk dan kandungan mesej.', 'warning');
    }

    const bccArray = emailList.split(',').map(e => e.trim()).filter(e => e);
    
    if (bccArray.length === 0) {
        return Swal.fire('Format Tidak Sah', 'Pastikan emel dipisahkan dengan tanda koma (,).', 'warning');
    }

    // PEMPROSESAN KELOMPOK (BATCH CHUNKING)
    // Had selamat Google biasanya 50-100. Kita gunakan 50 sebagai sandaran mutlak.
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < bccArray.length; i += CHUNK_SIZE) {
        chunks.push(bccArray.slice(i, i + CHUNK_SIZE));
    }
    
    Swal.fire({
        title: 'Sahkan Penghantaran Pukal',
        html: `Sistem akan menghantar emel ini kepada <b>${bccArray.length}</b> penerima dalam <b>${chunks.length}</b> fasa untuk memastikan kelancaran pelayan. Teruskan?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        confirmButtonText: 'Ya, Hantar Sekarang',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const btn = document.getElementById('btnSendSystemEmail');
            if (btn) btn.disabled = true;

            let successCount = 0;
            let failCount = 0;

            // Paparkan Notifikasi Loading Boleh-Kemas-Kini
            Swal.fire({
                title: 'Sedang Memproses...',
                html: `Menghantar kumpulan 1 daripada ${chunks.length}...`,
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Laksanakan Fetch API mengikut susunan (Sequential Async Loop)
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                // Kemaskini teks notifikasi UI
                Swal.update({ 
                    html: `Menghantar kumpulan <b>${i + 1}</b> daripada <b>${chunks.length}</b>...<br><br><small class="text-slate-500">Sila jangan tutup tetingkap pelayar ini.</small>` 
                });

                const payload = {
                    bcc: chunk.join(','),
                    subject: subject,
                    htmlBody: htmlBody,
                    name: senderName || "Admin SMPID"
                };

                try {
                    const response = await fetch(APP_CONFIG.API.GAS_EMAIL_URL, {
                        method: 'POST',
                        // Gunakan text/plain untuk bypass Preflight CORS (OPTIONS)
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8',
                        },
                        body: JSON.stringify(payload)
                    });

                    const resultData = await response.json();

                    if (resultData.status === 'success') {
                        successCount += chunk.length;
                    } else {
                        failCount += chunk.length;
                        console.error("Batch API Error:", resultData.message);
                    }
                } catch (error) {
                    failCount += chunk.length;
                    console.error("Batch Network Error:", error);
                }
            }

            if (btn) btn.disabled = false;

            // Berikan Laporan Akhir Kepada Pentadbir
            if (failCount === 0) {
                Swal.fire({
                    icon: 'success', 
                    title: 'Penghantaran Selesai', 
                    html: `Kesemua <b>${successCount}</b> emel telah berjaya diproses oleh pelayan Google.`,
                    customClass: { popup: 'rounded-3xl' }
                });
            } else {
                Swal.fire({
                    icon: 'warning', 
                    title: 'Selesai Dengan Ralat', 
                    html: `Berjaya: <b>${successCount}</b> emel<br>Gagal: <b>${failCount}</b> emel<br><br><span class="text-xs text-slate-500">Ralat "Limit Exceeded" atau kerosakan rangkaian mungkin berlaku pada kumpulan tertentu.</span>`,
                    customClass: { popup: 'rounded-3xl' }
                });
            }
        }
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