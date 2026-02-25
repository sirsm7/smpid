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
            wrapper.innerHTML = `<div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 font-medium">Tiada tiket aduan dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleString('ms-MY', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // 1. Pengecaman Sekolah Lengkap (Tarik nama dari dashboard global jika ada)
            let schoolName = t.kod_sekolah;
            if (window.globalDashboardData) {
                const schoolMatch = window.globalDashboardData.find(s => s.kod_sekolah === t.kod_sekolah);
                if (schoolMatch) schoolName = schoolMatch.nama_sekolah;
            }

            // 2. Ikon dan Warna Peranan
            let roleIcon = '<i class="fas fa-user"></i>';
            let roleColor = 'bg-slate-100 text-slate-600 border-slate-200';
            
            if (t.peranan_pengirim === 'GPICT') {
                roleIcon = '<i class="fas fa-laptop-code"></i>';
                roleColor = 'bg-blue-50 text-blue-700 border-blue-200';
            } else if (t.peranan_pengirim === 'ADMIN') {
                roleIcon = '<i class="fas fa-user-shield"></i>';
                roleColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            }

            // 3. Menjana Ruangan Aksi/Footer
            let actionArea = "";
            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="bg-slate-50 p-5 border-t border-slate-100">
                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-3"><i class="fas fa-reply text-indigo-400 mr-2"></i>Tindakan Maklum Balas</label>
                    <textarea id="reply-${t.id}" class="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none mb-3 transition-shadow placeholder-slate-400" rows="2" placeholder="Taip cadangan penyelesaian kepada sekolah di sini..."></textarea>
                    <div class="flex justify-end gap-3">
                        <button onclick="padamTiket(${t.id})" class="px-4 py-2 rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 text-xs font-bold transition flex items-center gap-2"><i class="fas fa-trash-alt"></i> Padam</button>
                        <button onclick="submitBalasanAdmin(${t.id})" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/30 flex items-center gap-2"><i class="fas fa-paper-plane"></i> Hantar & Tutup Tiket</button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="bg-emerald-50/50 p-5 border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div class="flex-1">
                        <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><i class="fas fa-check-double text-emerald-500"></i> Respon Dihantar:</div>
                        <p class="text-sm text-slate-700 font-medium leading-relaxed bg-white/60 p-3 rounded-lg border border-emerald-100/50">${t.balasan_admin}</p>
                    </div>
                    <button onclick="padamTiket(${t.id})" class="shrink-0 p-2.5 rounded-xl border-2 border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition mt-1 sm:mt-0" title="Padam Tiket"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            }

            // 4. Reka Letak Utama & Status Lencana
            const isSelesai = t.status === 'SELESAI';
            const borderClass = isSelesai ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-500 ring-1 ring-slate-200 hover:ring-slate-300';
            const statusBadge = isSelesai 
                ? `<span class="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-200 shadow-sm"><i class="fas fa-check"></i> SELESAI</span>`
                : `<span class="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-amber-200 shadow-sm animate-pulse"><i class="fas fa-clock"></i> DALAM PROSES</span>`;

            wrapper.innerHTML += `
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden ${borderClass} mb-5 transition-all duration-300">
                <!-- Header Segment -->
                <div class="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex flex-col">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-widest shadow-sm">${t.kod_sekolah}</span>
                            <span class="text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs md:max-w-md" title="${schoolName}">${schoolName}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="${roleColor} text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest flex items-center gap-1.5 border shadow-sm">
                                ${roleIcon} ${t.peranan_pengirim}
                            </span>
                            <span class="text-[10px] text-slate-400 font-bold flex items-center gap-1.5"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div class="shrink-0 self-start md:self-auto">
                        ${statusBadge}
                    </div>
                </div>
                
                <!-- Body Segment -->
                <div class="p-6">
                    <h4 class="font-black text-slate-800 text-base md:text-lg mb-4 leading-tight uppercase tracking-tight">${t.tajuk}</h4>
                    <div class="bg-amber-50/40 p-4 md:p-5 rounded-2xl border border-amber-100/60 text-slate-700 text-sm leading-relaxed relative">
                        <i class="fas fa-quote-left absolute top-4 left-4 text-amber-200/50 text-3xl"></i>
                        <div class="relative z-10 pl-8 wrap-safe whitespace-pre-wrap">${t.butiran_masalah}</div>
                    </div>
                </div>
                
                <!-- Footer/Action Segment -->
                ${actionArea}
            </div>`;
        });
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-center text-red-500 font-bold py-10 bg-red-50 rounded-2xl border border-red-100"><i class="fas fa-exclamation-triangle mr-2"></i> Ralat memuatkan tiket aduan dari pangkalan data.</div>`; 
    }
};

window.submitBalasanAdmin = async function(id) {
    const reply = document.getElementById(`reply-${id}`).value.trim();
    if(!reply) return Swal.fire('Tindakan Kosong', 'Sila tulis maklum balas atau penyelesaian sebelum menutup tiket.', 'warning');
    
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
            text: 'Tiket ditutup dan notifikasi telegram (jika ada) telah dihantar kepada pengirim.',
            timer: 2000,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }).then(() => window.loadTiketAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat Sistem', 'Gagal mengemaskini status tiket ke pangkalan data.', 'error');
    }
};

window.padamTiket = async function(id) {
    Swal.fire({ 
        title: 'Padam Tiket Ini?', 
        text: "Tindakan ini tidak boleh dikembalikan.",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
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
                Swal.fire('Ralat Pangkalan Data', 'Gagal memadam tiket.', 'error');
            }
        }
    });
};