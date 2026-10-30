/**
 * ADMIN MODULE: COMMUNICATION & EMAIL BLASTER (FULL PRODUCTION EDITION)
 * Menguruskan penghantaran emel pukal kepada pentadbir sekolah (GPICT & Admin DELIMa),
 * inisialisasi kalis ralat bagi Quill Rich Text Editor, serta pengurusan tiket aduan ICT.
 * 
 * Penambahbaikan:
 * 1. Menambah pengesanan dan cubaan semula (polling retry) bagi pustaka Quill untuk
 *    mengelakkan ralat 'Quill is not defined' jika skrip defer dimuatkan kemudian.
 * 2. Pembersihan bar alat pendua bagi menjamin struktur visual antaramuka kekal teratur.
 * 3. Sokongan dwi-kaedah (Clipboard API & execCommand fallback) untuk menyalin emel.
 */

import { SupportService } from '../services/support.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

let quill = null;
let quillInitRetryCount = 0;

// --- EMAIL BLASTER & EDITOR ---

/**
 * Menginisialisasi Quill Rich Text Editor dengan semakan kalis ralat.
 * Memastikan pustaka Quill dan kontena DOM telah sedia sebelum objek dicipta.
 */
window.initEmailEditor = function() {
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;

    // Jika editor sudah sedia terpasang, elakkan inisialisasi berulang
    if (quill) return;

    // Semak ketersediaan pustaka Quill secara global
    const QuillLib = window.Quill || (typeof Quill !== 'undefined' ? Quill : null);

    if (!QuillLib) {
        if (quillInitRetryCount < 25) {
            quillInitRetryCount++;
            setTimeout(window.initEmailEditor, 120);
        } else {
            console.warn("[Communication] Pustaka Quill mengambil masa terlalu lama untuk dimuatkan.");
        }
        return;
    }

    // Bersihkan sebarang sisa bar alat lama sebelum membina editor baharu
    const parentContainer = editorContainer.parentElement;
    if (parentContainer) {
        const oldToolbars = parentContainer.querySelectorAll('.ql-toolbar');
        oldToolbars.forEach(tb => tb.remove());
    }
    editorContainer.innerHTML = '';

    try {
        // Konfigurasi Quill dengan tema 'snow'
        quill = new QuillLib('#editor-container', {
            theme: 'snow',
            placeholder: 'Tulis draf hebahan rasmi anda di sini...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],        // Format teks asas
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],    // Senarai bernombor/titik
                    [{ 'header': [1, 2, 3, false] }],                 // Peringkat tajuk
                    [{ 'color': [] }, { 'background': [] }],          // Warna teks dan latar
                    ['link', 'clean']                                 // Pautan & Bersih format
                ]
            }
        });

        // Tetapkan kandungan draf lalai rasmi sistem (Format HTML)
        const defaultContent = `
            <p>Assalamualaikum & Salam Sejahtera Tuan/Puan,</p>
            <p><br></p>
            <p>Mohon kerjasama Tuan/Puan selaku Guru Penyelaras ICT (GPICT) atau Admin DELIMa sekolah untuk mengesahkan peranan anda dalam sistem NaDIM melalui Bot Telegram rasmi kami.</p>
            <p><br></p>
            <p><strong>Sila ikuti langkah mudah berikut:</strong></p>
            <ol>
                <li>Buka pautan bot rasmi: <a href="https://t.me/smpid_bot" target="_blank" rel="noopener noreferrer">https://t.me/smpid_bot</a></li>
                <li>Tekan butang <strong>'Start'</strong> atau taip arahan <em>/start</em>.</li>
                <li>Masukkan <strong>KOD SEKOLAH</strong> anda (contoh: <code>MBA0001</code>).</li>
                <li>Pilih butang peranan jawatan yang tepat bagi sekolah anda.</li>
            </ol>
            <p><br></p>
            <p>Kerjasama dan komitmen Tuan/Puan dalam menyempurnakan ekosistem digital daerah amat dihargai.</p>
            <p>Sekian, terima kasih.</p>
            <p><br></p>
            <p><strong>Unit Sumber Teknologi Pendidikan (USTP)</strong><br>Sektor Pembelajaran, Pejabat Pendidikan Daerah.</p>
        `;

        quill.clipboard.dangerouslyPasteHTML(defaultContent.trim());
        console.log("✅ [Communication] Quill Editor berjaya dimuatkan.");
    } catch (err) {
        console.error("[Communication] Ralat semasa memulakan Quill Editor:", err);
    }
};

/**
 * Menjana senarai alamat emel sekolah berdasarkan tapisan peranan dan status pendaftaran Telegram.
 */
window.generateList = function() {
    const checkGpictEl = document.getElementById('checkGpict');
    const checkAdminEl = document.getElementById('checkAdmin');
    const statusFilterEl = document.getElementById('statusFilter');

    const includeGpict = checkGpictEl ? checkGpictEl.checked : true;
    const includeAdmin = checkAdminEl ? checkAdminEl.checked : true;
    const filterStatus = statusFilterEl ? statusFilterEl.value : 'all';
    const uniqueEmails = new Set();

    // Pastikan editor diinisialisasi
    if (!quill) {
        window.initEmailEditor();
    }

    // Jika data papan pemuka global belum dimuat turun, cuba panggil penyegerakan
    if (!window.globalDashboardData || window.globalDashboardData.length === 0) {
        if (typeof window.fetchDashboardData === 'function') {
            window.fetchDashboardData().then(() => {
                window.generateList();
            }).catch(e => console.warn("[Communication] Gagal mendapatkan data sekolah:", e));
        }
        return;
    }

    window.globalDashboardData.forEach(row => {
        // Asingkan akaun berstatus PPD
        if (row.jenis === 'PPD' || row.kod_sekolah === 'M030') return;

        if (includeGpict && row.emel_delima_gpict) {
            const hasId = Boolean(row.telegram_id_gpict);
            if (
                filterStatus === 'all' || 
                (filterStatus === 'unregistered' && !hasId) || 
                (filterStatus === 'registered' && hasId)
            ) {
                const emel = row.emel_delima_gpict.trim();
                if (emel) uniqueEmails.add(emel);
            }
        }

        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = Boolean(row.telegram_id_admin);
            if (
                filterStatus === 'all' || 
                (filterStatus === 'unregistered' && !hasId) || 
                (filterStatus === 'registered' && hasId)
            ) {
                const emel = row.emel_delima_admin_delima.trim();
                if (emel) uniqueEmails.add(emel);
            }
        }
    });

    const arr = Array.from(uniqueEmails);
    const countEl = document.getElementById('countEmail');
    const outputEl = document.getElementById('emailOutput');

    if (countEl) countEl.innerText = String(arr.length);
    if (outputEl) outputEl.value = arr.join(', ');
};

/**
 * Mengemas kini kiraan jumlah alamat emel dalam kotak teks secara langsung.
 */
window.kemaskiniKiraanEmel = function() {
    const outputEl = document.getElementById('emailOutput');
    const countEl = document.getElementById('countEmail');
    if (!outputEl || !countEl) return;

    const emailStr = outputEl.value.trim();
    if (!emailStr) {
        countEl.innerText = '0';
        return;
    }

    const emailArray = emailStr.split(',').map(e => e.trim()).filter(Boolean);
    countEl.innerText = String(emailArray.length);
};

/**
 * Menyalin senarai alamat emel ke papan keratan dengan sokongan pelayar yang ketat.
 */
window.copyEmails = function() {
    const outputEl = document.getElementById('emailOutput');
    if (!outputEl || !outputEl.value.trim()) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Senarai Kosong',
                text: 'Tiada emel untuk disalin.',
                timer: 1500,
                showConfirmButton: false
            });
        }
        return;
    }

    outputEl.select();
    outputEl.setSelectionRange(0, 99999);

    const tunjukBerjaya = () => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Disalin!',
                text: 'Senarai emel telah disalin ke papan keratan.',
                timer: 1200,
                showConfirmButton: false,
                confirmButtonColor: '#22c55e'
            });
        }
    };

    // Sandaran salinan menggunakan execCommand jika Clipboard API terhalang oleh iFrame/CSP
    const salinTradisional = () => {
        try {
            document.execCommand('copy');
            tunjukBerjaya();
        } catch (err) {
            console.error("[Communication] Salinan tradisional gagal:", err);
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(outputEl.value).then(tunjukBerjaya).catch(salinTradisional);
    } else {
        salinTradisional();
    }
};

/**
 * Melaksanakan penghantaran emel pukal menggunakan Google Apps Script (GAS)
 * dengan algoritma pembahagian kelompok (batch chunking) bagi menjamin kestabilan.
 */
window.hantarEmelSistem = async function() {
    if (!quill) {
        window.initEmailEditor();
        if (!quill) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Editor Belum Sedia', 'Sila pastikan editor telah dimuatkan sepenuhnya sebelum menghantar.', 'warning');
            }
            return;
        }
    }

    const outputEl = document.getElementById('emailOutput');
    const subjectEl = document.getElementById('msgSubject');
    const senderEl = document.getElementById('msgSenderName');

    const emailList = outputEl ? outputEl.value.trim() : '';
    const subject = subjectEl ? subjectEl.value.trim() : '';
    const senderName = senderEl ? senderEl.value.trim() : 'Admin NaDIM';
    const htmlBody = quill.root.innerHTML;
    const textContent = quill.getText().trim();

    if (!emailList) {
        return Swal.fire({
            icon: 'warning',
            title: 'Senarai Penerima Kosong',
            text: 'Sila jana atau masukkan sekurang-kurangnya satu alamat emel penerima.',
            confirmButtonColor: '#f59e0b'
        });
    }

    if (!subject || !textContent) {
        return Swal.fire({
            icon: 'warning',
            title: 'Maklumat Tidak Lengkap',
            text: 'Sila lengkapkan tajuk perkara (subject) dan kandungan mesej emel.',
            confirmButtonColor: '#f59e0b'
        });
    }

    const bccArray = emailList.split(',').map(e => e.trim()).filter(Boolean);

    if (bccArray.length === 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Format Tidak Sah',
            text: 'Pastikan format alamat emel dipisahkan dengan tanda koma (,).',
            confirmButtonColor: '#f59e0b'
        });
    }

    // PEMBAHAGIAN KELOMPOK (Maksimum 50 penerima per kelompok untuk had pelayan Google)
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < bccArray.length; i += CHUNK_SIZE) {
        chunks.push(bccArray.slice(i, i + CHUNK_SIZE));
    }

    Swal.fire({
        title: 'Sahkan Penghantaran Pukal',
        html: `Anda akan menghantar emel ini kepada <b>${bccArray.length}</b> penerima melalui <b>${chunks.length}</b> peringkat kelompok penghantaran.<br><br><span class="text-xs text-slate-500">Adakah anda pasti untuk meneruskan?</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Teruskan Hantar',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        const btnSend = document.getElementById('btnSendSystemEmail');
        if (btnSend) {
            btnSend.disabled = true;
            btnSend.classList.add('opacity-60', 'cursor-not-allowed');
        }

        let successCount = 0;
        let failCount = 0;

        Swal.fire({
            title: 'Sedang Menghantar...',
            html: `Memproses kelompok <b>1</b> daripada <b>${chunks.length}</b>...<br><span class="text-xs text-slate-400">Sila kekalkan tetingkap ini dibuka.</span>`,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        for (let i = 0; i < chunks.length; i++) {
            const currentChunk = chunks[i];

            Swal.update({
                html: `Memproses kelompok <b>${i + 1}</b> daripada <b>${chunks.length}</b> (${currentChunk.length} penerima)...<br><span class="text-xs text-slate-400">Menghantar melalui get laluan Google Apps Script...</span>`
            });

            const payload = {
                bcc: currentChunk.join(','),
                subject: subject,
                htmlBody: htmlBody,
                name: senderName || "Admin NaDIM"
            };

            try {
                const response = await fetch(APP_CONFIG.API.GAS_EMAIL_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify(payload)
                });

                const resData = await response.json();

                if (resData.status === 'success') {
                    successCount += currentChunk.length;
                } else {
                    failCount += currentChunk.length;
                    console.error(`[Communication] Kelompok ${i + 1} ditolak oleh pelayan:`, resData.message);
                }
            } catch (networkErr) {
                failCount += currentChunk.length;
                console.error(`[Communication] Ralat rangkaian pada kelompok ${i + 1}:`, networkErr);
            }
        }

        if (btnSend) {
            btnSend.disabled = false;
            btnSend.classList.remove('opacity-60', 'cursor-not-allowed');
        }

        if (failCount === 0) {
            Swal.fire({
                icon: 'success',
                title: 'Penghantaran Berjaya',
                html: `Kesemua <b>${successCount}</b> emel telah berjaya dihantar ke peti masuk penerima.`,
                confirmButtonColor: '#16a34a',
                customClass: { popup: 'rounded-3xl' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Penghantaran Selesai Sebahagian',
                html: `Berjaya: <b>${successCount}</b> emel<br>Gagal: <b>${failCount}</b> emel.<br><br><span class="text-xs text-slate-500">Had kuota emel harian Google atau gangguan sambungan mungkin berlaku bagi kelompok yang terjejas.</span>`,
                confirmButtonColor: '#f59e0b',
                customClass: { popup: 'rounded-3xl' }
            });
        }
    });
};

// --- HELPDESK & ADUAN ICT ---

/**
 * Memuatkan senarai tiket aduan ICT dari Supabase untuk semakan pentadbir.
 */
window.loadTiketAdmin = async function() {
    const wrapper = document.getElementById('adminTiketWrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `<div class="text-center py-10 text-slate-400 font-medium animate-pulse"><i class="fas fa-circle-notch fa-spin text-2xl mr-2 text-red-500"></i>Memuatkan rekod tiket aduan...</div>`;

    const filterEl = document.getElementById('filterTiketAdmin');
    const filterValue = filterEl ? filterEl.value : 'ALL';

    try {
        const data = await SupportService.getAll(filterValue);
        wrapper.innerHTML = "";

        if (!data || data.length === 0) {
            wrapper.innerHTML = `<div class="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium">Tiada tiket aduan dalam kategori tapisan ini.</div>`;
            return;
        }

        data.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleString('ms-MY', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Pengesanan Nama Sekolah dari data berpusat
            let schoolName = t.kod_sekolah;
            if (window.globalDashboardData) {
                const schoolMatch = window.globalDashboardData.find(s => s.kod_sekolah === t.kod_sekolah);
                if (schoolMatch) schoolName = schoolMatch.nama_sekolah;
            }

            // Ikon dan warna mengikut peranan pengirim
            let roleIcon = '<i class="fas fa-user"></i>';
            let roleColor = 'bg-slate-100 text-slate-600 border-slate-200';

            if (t.peranan_pengirim === 'GPICT') {
                roleIcon = '<i class="fas fa-laptop-code"></i>';
                roleColor = 'bg-blue-50 text-blue-700 border-blue-200';
            } else if (t.peranan_pengirim === 'ADMIN') {
                roleIcon = '<i class="fas fa-user-shield"></i>';
                roleColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            }

            // Ruang tindakan / respon pentadbir
            let actionArea = "";
            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="bg-slate-50 p-5 border-t border-slate-100">
                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-3"><i class="fas fa-reply text-indigo-400 mr-2"></i>Tindakan Maklum Balas</label>
                    <textarea id="reply-${t.id}" class="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none mb-3 transition-shadow placeholder-slate-400 wrap-safe" rows="2" placeholder="Taip cadangan penyelesaian kepada pihak sekolah di sini..."></textarea>
                    <div class="flex justify-end gap-3">
                        <button onclick="window.padamTiket(${t.id})" class="px-4 py-2 rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 text-xs font-bold transition flex items-center gap-2"><i class="fas fa-trash-alt"></i> Padam</button>
                        <button onclick="window.submitBalasanAdmin(${t.id})" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/30 flex items-center gap-2"><i class="fas fa-paper-plane"></i> Hantar & Tutup Tiket</button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="bg-emerald-50/50 p-5 border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div class="flex-1">
                        <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><i class="fas fa-check-double text-emerald-500"></i> Respon Dihantar:</div>
                        <p class="text-sm text-slate-700 font-medium leading-relaxed bg-white/70 p-3 rounded-lg border border-emerald-100/50 wrap-safe whitespace-pre-wrap">${t.balasan_admin || 'Tiada catatan balasan.'}</p>
                    </div>
                    <button onclick="window.padamTiket(${t.id})" class="shrink-0 p-2.5 rounded-xl border-2 border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition mt-1 sm:mt-0" title="Padam Tiket"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            }

            const isSelesai = (t.status === 'SELESAI');
            const borderClass = isSelesai ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-500 ring-1 ring-slate-200 hover:ring-slate-300';
            const statusBadge = isSelesai 
                ? `<span class="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-200 shadow-sm"><i class="fas fa-check"></i> SELESAI</span>`
                : `<span class="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-amber-200 shadow-sm animate-pulse"><i class="fas fa-clock"></i> DALAM PROSES</span>`;

            wrapper.innerHTML += `
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden ${borderClass} mb-5 transition-all duration-300">
                <div class="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex flex-col w-full md:w-auto overflow-hidden">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-widest shadow-sm shrink-0">${t.kod_sekolah}</span>
                            <span class="text-sm font-bold text-slate-800 wrap-safe break-words leading-snug">${schoolName}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="${roleColor} text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest flex items-center gap-1.5 border shadow-sm">
                                ${roleIcon} ${t.peranan_pengirim}
                            </span>
                            <span class="text-[10px] text-slate-400 font-bold flex items-center gap-1.5"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div class="shrink-0 self-start md:self-auto mt-2 md:mt-0">
                        ${statusBadge}
                    </div>
                </div>
                
                <div class="p-6">
                    <h4 class="font-black text-slate-800 text-base md:text-lg mb-4 leading-tight uppercase tracking-tight wrap-safe break-words">${t.tajuk}</h4>
                    <div class="bg-amber-50/40 p-4 md:p-5 rounded-2xl border border-amber-100/60 text-slate-700 text-sm leading-relaxed relative">
                        <i class="fas fa-quote-left absolute top-4 left-4 text-amber-200/50 text-3xl"></i>
                        <div class="relative z-10 pl-8 wrap-safe whitespace-pre-wrap">${t.butiran_masalah}</div>
                    </div>
                </div>
                
                ${actionArea}
            </div>`;
        });
    } catch (e) {
        console.error("[Communication] Ralat memuatkan tiket aduan:", e);
        wrapper.innerHTML = `<div class="text-center text-red-500 font-bold py-10 bg-red-50 rounded-2xl border border-red-100"><i class="fas fa-exclamation-triangle mr-2"></i> Ralat memuatkan tiket aduan dari pangkalan data.</div>`;
    }
};

/**
 * Menghantar balasan pentadbir dan mengemas kini status tiket kepada SELESAI.
 */
window.submitBalasanAdmin = async function(id) {
    const replyInput = document.getElementById(`reply-${id}`);
    const replyText = replyInput ? replyInput.value.trim() : '';

    if (!replyText) {
        return Swal.fire({
            icon: 'warning',
            title: 'Maklum Balas Kosong',
            text: 'Sila masukkan tindakan atau cadangan penyelesaian sebelum menutup tiket.',
            confirmButtonColor: '#f59e0b'
        });
    }

    toggleLoading(true);
    try {
        await SupportService.update(id, {
            status: 'SELESAI',
            balasan_admin: replyText,
            tarikh_balas: new Date().toISOString()
        });

        toggleLoading(false);
        Swal.fire({
            icon: 'success',
            title: 'Tiket Selesai',
            text: 'Tiket aduan telah ditutup dan notifikasi telah dihantar.',
            timer: 1800,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }).then(() => {
            window.loadTiketAdmin();
        });
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat Sistem', 'Gagal mengemas kini maklum balas tiket ke pangkalan data.', 'error');
    }
};

/**
 * Memadam tiket aduan daripada pangkalan data.
 */
window.padamTiket = async function(id) {
    if (typeof Swal === 'undefined') return;

    Swal.fire({
        title: 'Padam Tiket Ini?',
        text: 'Tindakan ini tidak boleh dikembalikan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        toggleLoading(true);
        try {
            await SupportService.delete(id);
            toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Dipadam',
                timer: 1000,
                showConfirmButton: false
            }).then(() => {
                window.loadTiketAdmin();
            });
        } catch (e) {
            toggleLoading(false);
            Swal.fire('Ralat Pangkalan Data', 'Gagal memadam tiket.', 'error');
        }
    });
};