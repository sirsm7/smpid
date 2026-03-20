/**
 * PENATARAN DIGITAL CONTROLLER (V2.0 - AUTO-SAVE EDITION)
 * Logik pemarkahan dinamik, janaan UI rubrik, carta radar, dan enjin auto-simpan.
 * KEMASKINI: Input Bil. Guru dan Bil. Murid kini disimpan terus ke jadual Penataran.
 */

import { PenataranService } from '../../js/services/penataran.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';

// KONFIGURASI ASAS
let radarChartInstance = null;
let autoSaveTimeout = null;

// DEFINISI RUBRIK
const rubricTitles = { 
    d1_1:"1.1 Fail/e-fail DELIMa, ICT & Pendigitalan", d1_2:"1.2 Perancangan Strategik Pendigitalan", d1_3:"1.3 Mesyuarat / Minit Mesyuarat", d1_4:"1.4 Jawatankuasa DELIMa/ICT", d1_5:"1.5 Jadual Penggunaan Makmal/Peralatan", d1_6:"1.6 Program dalam Takwim Sekolah", d1_7:"1.7 Laporan Aktiviti Pendigitalan", d1_8:"1.8 Pengurusan Fasiliti Digital", 
    d2_1:"2.1 Peratus Pengaktifan Guru", d2_2:"2.2 Peratus Pengaktifan Murid", d2_3:"2.3 Peratus Pengaktifan Keseluruhan", 
    d3_1:"3.1 Promosi (Bunting/Brosur/Digital)", d3_2:"3.2 Pelancaran Minggu / Bulan Digital", d3_3:"3.3 Aktiviti / Kursus Dalaman Guru (LADAP)", d3_4:"3.4 Aktiviti / Kursus Dalaman Murid", d3_5:"3.5 Papan Maklumat / Sudut Digital", d3_6:"3.6 Membudayakan Ujian Kompetensi (DCS)", 
    d4_1:"4.1 DELIMa dalam Pengurusan Pentadbiran", d4_2:"4.2 DELIMa dalam Pengurusan Kurikulum", d4_3:"4.3 DELIMa dalam Pengurusan Kokurikulum", d4_4:"4.4 DELIMa dalam Pengurusan HEM", 
    d5_1:"5.1 Sijil Pendidik Google (GCE)", d5_2:"5.2 Sijil Microsoft Innovative Educator (MIE)", d5_3:"5.3 Sijil Apple Teacher", d5_4:"5.4 Sijil Profesional Digital Lain-lain", 
    d6_1:"6.1 Kolaboratif / Jaringan / Jalinan Luar", d6_2:"6.2 Pembinaan Portal Sekolah / Google Sites", d6_3:"6.3 Inovasi Digital Pendidikan", d6_4:"6.4 Pencapaian dan Anugerah Peringkat Tinggi", d6_5:"6.5 Penghasilan Bahan Digital PdP" 
};

// DATA UNTUK POPUP INFO
const rubricData = { 
    d1_1:{title:"1.1 Fail DELIMa",4:"Fail sangat lengkap dan kemas kini",3:"Fail lengkap tapi kurang kemas kini",2:"Fail separa lengkap",1:"Ada fail tapi tidak terurus"},
    d1_2:{title:"1.2 Perancangan Strategik",4:"Terdapat Pelan Strategik, Taktikal & Operasi lengkap",3:"Ada perancangan tapi kurang terperinci",2:"Hanya ada pelan asas",1:"Tiada perancangan jelas"}
};

// INISIALISASI
document.addEventListener('DOMContentLoaded', () => {
    setupRubricUI();
    initPenataran();
});

async function initPenataran() {
    const kodSekolah = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kodSekolah) {
        window.location.replace('../../index.html');
        return;
    }

    toggleLoadingLocal(true);

    try {
        // 1. Muat Data Asas Sekolah (Auto-fill)
        const schoolData = await SchoolService.getByCode(kodSekolah);
        if (schoolData) {
            document.getElementById('namaSekolah').value = schoolData.nama_sekolah || '';
            document.getElementById('kodSekolah').value = schoolData.kod_sekolah || '';
            document.getElementById('bilGuru').value = schoolData.bil_guru || ''; // Fallback data lama jika masih ada
            document.getElementById('bilMurid').value = schoolData.bil_murid || ''; // Fallback data lama jika masih ada
            document.getElementById('pgbNama').value = schoolData.nama_pgb || '';
            document.getElementById('pgbId').value = schoolData.emel_delima_pgb || '';
            document.getElementById('pgbTel').value = schoolData.no_telefon_pgb || '';
            document.getElementById('gpictNama').value = schoolData.nama_gpict || '';
            document.getElementById('gpictId').value = schoolData.emel_delima_gpict || '';
            document.getElementById('gpictTel').value = schoolData.no_telefon_gpict || '';
            document.getElementById('gpdelimaNama').value = schoolData.nama_admin_delima || '';
            document.getElementById('gpdelimaId').value = schoolData.emel_delima_admin_delima || '';
            document.getElementById('gpdelimaTel').value = schoolData.no_telefon_admin_delima || '';
            
            const pdfNamaPGB = document.getElementById('pdf-namaPGB');
            if (pdfNamaPGB) pdfNamaPGB.innerText = schoolData.nama_pgb || "Pengetua / Guru Besar";
        }

        // Event listener: Trigger Auto-Save apabila bil_guru / bil_murid dikemaskini
        document.getElementById('bilGuru').addEventListener('input', () => calculateScore());
        document.getElementById('bilMurid').addEventListener('input', () => calculateScore());

        // 2. Semak Jika Pernah Mempunyai Laporan/Deraf Terkini
        const existingReport = await PenataranService.getBySchool(kodSekolah);
        if (existingReport) {
            const sb = document.getElementById('statusBar');
            const slu = document.getElementById('statusLastUpdate');
            if (sb) sb.classList.remove('hidden');
            if (slu) slu.innerText = new Date(existingReport.updated_at).toLocaleString('ms-MY');

            // Timpa input dengan data bil_guru dan bil_murid dari jadual penataran yang sah
            if (existingReport.bil_guru !== null && existingReport.bil_guru !== undefined) {
                document.getElementById('bilGuru').value = existingReport.bil_guru;
            }
            if (existingReport.bil_murid !== null && existingReport.bil_murid !== undefined) {
                document.getElementById('bilMurid').value = existingReport.bil_murid;
            }

            // Set semula radio buttons berdasarkan data JSON sedia ada
            const dimData = existingReport.skor_dimensi;
            if (dimData && dimData.details) {
                for (const [key, value] of Object.entries(dimData.details)) {
                    const radio = document.querySelector(`input[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                }
            }
            // Kemaskini Visual Semasa
            calculateScore(true); // silent calculate without triggering save
        }
    } catch (e) {
        console.error("[Penataran] Init error:", e);
        Swal.fire('Amaran Sistem', 'Tidak dapat menarik profil penuh. Anda boleh teruskan pengisian.', 'warning');
    } finally {
        toggleLoadingLocal(false);
    }
}

// BINA UI RADIO BUTTON 1-4 SECARA DINAMIK
function setupRubricUI() {
    const dimensions = {
        'container-d1': ['d1_1','d1_2','d1_3','d1_4','d1_5','d1_6','d1_7','d1_8'],
        'container-d2': ['d2_1','d2_2','d2_3'],
        'container-d3': ['d3_1','d3_2','d3_3','d3_4','d3_5','d3_6'],
        'container-d4': ['d4_1','d4_2','d4_3','d4_4'],
        'container-d5': ['d5_1','d5_2','d5_3','d5_4'],
        'container-d6': ['d6_1','d6_2','d6_3','d6_4','d6_5']
    };

    for (const [containerId, items] of Object.entries(dimensions)) {
        const container = document.getElementById(containerId);
        if (!container) continue;

        items.forEach(name => {
            const title = rubricTitles[name] || name;
            container.innerHTML += `
            <div class="bg-slate-50 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-100 hover:bg-slate-100 transition hover:border-slate-200">
                <label class="flex items-center text-sm font-bold text-slate-700 leading-snug">
                    ${title} 
                    <i class="fas fa-info-circle info-icon ml-2 text-slate-400 hover:text-blue-500" onclick="showRubricInfo('${name}')"></i>
                </label>
                <div class="flex space-x-2 shrink-0">
                    ${[1, 2, 3, 4].map(val => `
                        <label class="cursor-pointer group">
                            <input type="radio" name="${name}" value="${val}" class="hidden peer" onchange="calculateScore()">
                            <div class="score-btn-content w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-400 font-bold text-sm md:text-base 
                                ${val === 1 ? 'hover:border-red-400 group-hover:text-red-500 peer-checked:bg-red-500 peer-checked:border-red-500' : ''}
                                ${val === 2 ? 'hover:border-amber-400 group-hover:text-amber-500 peer-checked:bg-amber-500 peer-checked:border-amber-500' : ''}
                                ${val === 3 ? 'hover:border-blue-400 group-hover:text-blue-500 peer-checked:bg-blue-500 peer-checked:border-blue-500' : ''}
                                ${val === 4 ? 'hover:border-emerald-400 group-hover:text-emerald-500 peer-checked:bg-emerald-500 peer-checked:border-emerald-500' : ''}
                                peer-checked:text-white shadow-sm transition-all">
                                ${val}
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>`;
        });
    }
}

// KIRAN PENGATURCARAAN (DINAMIK) & KEMASKINI UI
window.calculateScore = function(isSilentInit = false) {
    let total = 0;
    let dimensionScores = { d1:0, d2:0, d3:0, d4:0, d5:0, d6:0 };
    let detailScores = {};

    const checkedRadios = document.querySelectorAll('input[type="radio"]:checked');
    const answeredCount = checkedRadios.length;

    checkedRadios.forEach(radio => {
        let val = parseInt(radio.value) || 0;
        total += val;
        detailScores[radio.name] = val;
        
        if(radio.name.startsWith('d1')) dimensionScores.d1 += val;
        if(radio.name.startsWith('d2')) dimensionScores.d2 += val;
        if(radio.name.startsWith('d3')) dimensionScores.d3 += val;
        if(radio.name.startsWith('d4')) dimensionScores.d4 += val;
        if(radio.name.startsWith('d5')) dimensionScores.d5 += val;
        if(radio.name.startsWith('d6')) dimensionScores.d6 += val;
    });

    // PENGIRAAN DINAMIK: Mengikut soalan yang telah dijawab sahaja
    const dynamicMaxScore = answeredCount > 0 ? (answeredCount * 4) : 120;
    const percent = answeredCount > 0 ? (total / dynamicMaxScore) * 100 : 0;
    
    const displayScoreEl = document.getElementById('displayScore');
    const displayPercentEl = document.getElementById('displayPercent');
    
    if (displayScoreEl) displayScoreEl.innerText = `${total} / ${dynamicMaxScore}`;
    if (displayPercentEl) displayPercentEl.innerText = `${percent.toFixed(1)}%`;
    
    let ratingText = '';
    let starsHTML = '';
    
    // Logik bintang berdasarkan purata respons (Dynamic Average)
    let starCount = 0;
    if (answeredCount > 0) {
        if (percent >= 90) starCount = 5;
        else if (percent >= 80) starCount = 4;
        else if (percent >= 60) starCount = 3;
        else if (percent >= 40) starCount = 2;
        else starCount = 1;
    }
    
    if (starCount === 5) ratingText = '5 Bintang (Cemerlang)';
    else if (starCount === 4) ratingText = '4 Bintang (Baik)';
    else if (starCount === 3) ratingText = '3 Bintang (Harapan)';
    else if (starCount === 2) ratingText = '2 Bintang (Sederhana)';
    else if (starCount === 1) ratingText = '1 Bintang (Lemah)';
    else ratingText = 'Belum Dinilai';

    for(let i=0; i<5; i++) {
        starsHTML += i < starCount ? '<i class="fas fa-star drop-shadow-sm text-amber-400"></i>' : '<i class="far fa-star opacity-40 text-amber-400"></i>';
    }
    
    const displayRatingEl = document.getElementById('displayRating');
    if (displayRatingEl) {
        displayRatingEl.innerHTML = starsHTML + `<div class='text-xs text-amber-200 mt-2 font-black uppercase tracking-widest drop-shadow-sm'>${ratingText}</div>`;
    }

    const calcResult = { total, percent, ratingText, dimensionScores, detailScores, dynamicMaxScore };

    // PENYIMPANAN AUTO (DEBOUNCE)
    // Berjalan bagi apa-apa input form waima radio atau jumlah guru/murid
    if (!isSilentInit) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            triggerAutoSave(calcResult);
        }, 1500); // Tunggu 1.5 saat selepas pengguna berhenti klik sebelum menyimpan
    }

    return calcResult;
}

// ENJIN PENYIMPANAN AUTO LATAR BELAKANG
async function triggerAutoSave(calcResult) {
    const kodSekolah = document.getElementById('kodSekolah').value;
    const namaSekolah = document.getElementById('namaSekolah').value;
    if (!kodSekolah) return;

    showAutoSaveIndicator(true);

    const bilGuru = parseInt(document.getElementById('bilGuru').value) || 0;
    const bilMurid = parseInt(document.getElementById('bilMurid').value) || 0;

    const skorJSON = {
        d1: calcResult.dimensionScores.d1, d2: calcResult.dimensionScores.d2, d3: calcResult.dimensionScores.d3,
        d4: calcResult.dimensionScores.d4, d5: calcResult.dimensionScores.d5, d6: calcResult.dimensionScores.d6,
        details: calcResult.detailScores
    };

    const payload = {
        kod_sekolah: kodSekolah,
        nama_sekolah: namaSekolah,
        bil_guru: bilGuru,
        bil_murid: bilMurid,
        jumlah_skor: calcResult.total,
        peratus: calcResult.percent.toFixed(2) + "%",
        penarafan: calcResult.ratingText,
        skor_dimensi: skorJSON
    };

    try {
        await PenataranService.submitReport(payload);
        const slu = document.getElementById('statusLastUpdate');
        const sb = document.getElementById('statusBar');
        if (sb) sb.classList.remove('hidden');
        if (slu) slu.innerText = new Date().toLocaleString('ms-MY');
        showAutoSaveIndicator(false, true);
    } catch (err) {
        console.error("Auto-save failed:", err);
        showAutoSaveIndicator(false, false);
    }
}

// PENUNJUK VISUAL PENYIMPANAN AUTO
function showAutoSaveIndicator(isSaving, isSuccess = true) {
    let indicator = document.getElementById('autoSaveToast');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autoSaveToast';
        indicator.className = 'fixed top-4 right-4 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg z-50 transition-all duration-300 flex items-center gap-2 pointer-events-none transform -translate-y-10 opacity-0';
        document.body.appendChild(indicator);
    }
    
    if (isSaving) {
        indicator.className = 'fixed top-4 right-4 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg z-50 transition-all duration-300 flex items-center gap-2 pointer-events-none transform translate-y-0 bg-blue-600 text-white opacity-100';
        indicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan Auto...';
    } else {
        if (isSuccess) {
            indicator.className = 'fixed top-4 right-4 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg z-50 transition-all duration-300 flex items-center gap-2 pointer-events-none transform translate-y-0 bg-emerald-500 text-white opacity-100';
            indicator.innerHTML = '<i class="fas fa-check-circle"></i> Tersimpan';
        } else {
            indicator.className = 'fixed top-4 right-4 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg z-50 transition-all duration-300 flex items-center gap-2 pointer-events-none transform translate-y-0 bg-red-500 text-white opacity-100';
            indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal Menyimpan';
        }
        setTimeout(() => {
            indicator.classList.replace('translate-y-0', '-translate-y-10');
            indicator.classList.replace('opacity-100', 'opacity-0');
        }, 2000);
    }
}

// LOGIK KESAHAN (VALIDATION) PENUKARAN TAB
function validateCurrentTab() {
    const activeTab = document.querySelector('.tab-content:not(.hidden-section)');
    if (!activeTab) return true;

    const tabId = activeTab.id; // contoh: 'tab-d1'
    if (!tabId.startsWith('tab-d')) return true;

    const dimensionPrefix = tabId.split('-')[1]; // dapat 'd1'

    // Kira jumlah soalan untuk dimensi semasa
    const allRadios = Array.from(document.querySelectorAll(`input[type="radio"][name^="${dimensionPrefix}"]`));
    const uniqueNames = new Set(allRadios.map(r => r.name));
    const totalQuestions = uniqueNames.size;

    // Kira bilangan soalan yang dijawab
    const answeredQuestions = document.querySelectorAll(`input[type="radio"][name^="${dimensionPrefix}"]:checked`).length;

    // Jika telah bermula, WAJIB diselesaikan. Jika kosong (0), dibenarkan lompat (skip).
    if (answeredQuestions > 0 && answeredQuestions < totalQuestions) {
        Swal.fire({
            icon: 'warning',
            title: 'Bahagian Belum Lengkap',
            text: `Anda telah menjawab ${answeredQuestions} daripada ${totalQuestions} item dalam bahagian ini. Sila lengkapkan kesemua penilaian sebelum beralih ke dimensi lain.`,
            confirmButtonColor: '#f59e0b',
            customClass: { popup: 'rounded-3xl' }
        });
        return false;
    }

    return true;
}

// NAVIGASI UI
window.switchTab = function(tabId, navElement) {
    if (!validateCurrentTab()) {
        return; // Halang penukaran tab jika tidak melepasi pengesahan
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden-section'));
    document.getElementById(tabId).classList.remove('hidden-section');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    navElement.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if(window.innerWidth < 768) { 
        document.getElementById('sidebar').classList.add('-translate-x-full'); 
        document.getElementById('sidebarOverlay').classList.add('hidden');
    }
    
    // Paksa auto-save jika menukar tab (bagi memastikan mana-mana data yang diedit disimpan)
    clearTimeout(autoSaveTimeout);
    triggerAutoSave(calculateScore(true));
}

window.updateAnalysisView = function() {
    const result = calculateScore(true); // Gunakan silent calculate
    const tbody = document.getElementById('analysisTableBody');
    tbody.innerHTML = '';
    
    const checkedRadios = document.querySelectorAll('input[type="radio"]:checked');
    
    if (checkedRadios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400 font-bold">Tiada data penilaian direkodkan lagi.</td></tr>`;
    } else {
        checkedRadios.forEach(radio => {
            const name = radio.name; 
            const score = parseInt(radio.value); 
            const title = rubricTitles[name] || name;
            
            let badgeClass = score === 4 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                             score === 3 ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                             score === 2 ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                             'bg-red-100 text-red-800 border-red-200';
            let statusText = score === 4 ? 'Cemerlang' : score === 3 ? 'Baik' : score === 2 ? 'Sederhana' : 'Lemah';
            
            tbody.innerHTML += `
            <tr class="bg-white border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="px-6 py-4 font-bold text-slate-700 leading-snug border-r border-slate-100">${title}</td>
                <td class="px-6 py-4 text-center font-black text-slate-800 border-r border-slate-100 bg-slate-50/50">${score}</td>
                <td class="px-6 py-4 text-center">
                    <span class="${badgeClass} border px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm inline-block min-w-[90px]">${statusText}</span>
                </td>
            </tr>`;
        });
    }
    
    updateRadarChart(result.dimensionScores);
}

function updateRadarChart(scores) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    const dataValues = [
        (scores.d1/32)*100, 
        (scores.d2/12)*100, 
        (scores.d3/24)*100, 
        (scores.d4/16)*100, 
        (scores.d5/16)*100, 
        (scores.d6/20)*100
    ];
    
    if (radarChartInstance) radarChartInstance.destroy();
    
    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: { 
            labels: ['Pengurusan', 'Guna DELIMa', 'Pembudayaan', 'Urus DELIMa', 'Pensijilan', 'Bintang Sekolah'], 
            datasets: [{ 
                label: 'Pencapaian (%)', 
                data: dataValues, 
                fill: true, 
                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                borderColor: 'rgb(59, 130, 246)', 
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(59, 130, 246)'
            }] 
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                r: { 
                    angleLines: { color: 'rgba(0,0,0,0.1)' }, 
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    pointLabels: { font: { family: 'Inter', size: 10, weight: 'bold' }, color: '#475569' },
                    suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 20, display: false } 
                } 
            }, 
            plugins: { legend: {display: false}, tooltip: { callbacks: { label: function(c) { return ' ' + Math.round(c.raw) + '%'; } } } } 
        }
    });
}

// JANA PDF MENGGUNAKAN TEMPLAT TERSEMBUNYI
window.generatePDF = function() {
    document.getElementById('pdf-namaSekolah').innerText = document.getElementById('namaSekolah').value || "-";
    document.getElementById('pdf-kodSekolah').innerText = document.getElementById('kodSekolah').value || "-";
    document.getElementById('pdf-tarikh').innerText = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const calc = calculateScore(true);
    document.getElementById('pdf-skor').innerText = calc.total;
    document.getElementById('pdf-peratus').innerText = calc.percent.toFixed(2) + "%";
    document.getElementById('pdf-penarafan').innerText = calc.ratingText;
    
    document.getElementById('pdf-chart-img').src = document.getElementById('radarChart').toDataURL("image/png");
    
    const pdfTable = document.getElementById('pdf-table-body'); 
    pdfTable.innerHTML = "";
    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        pdfTable.innerHTML += `<tr><td style="padding:5px;">${rubricTitles[radio.name] || radio.name}</td><td style="text-align:center; font-weight:bold; padding:5px;">${radio.value}</td></tr>`;
    });

    const element = document.getElementById('pdf-template');
    element.style.display = 'block';
    const kodSek = document.getElementById('kodSekolah').value || 'SEKOLAH';
    
    html2pdf().set({ 
        margin: 10, 
        filename: `Laporan_Penataran_Digital_${kodSek}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    }).from(element).save().then(() => {
        element.style.display = 'none';
        Swal.fire({ icon: 'success', title: 'Berjaya', text: 'PDF Laporan sedang dimuat turun.', timer: 1500, showConfirmButton: false });
    });
}

// HANTAR (SIMPAN AKHIR & KELUAR)
window.submitForm = async function() {
    const checkedCount = document.querySelectorAll('input[type="radio"]:checked').length;
    
    // Pastikan simpanan paksa data yang terkini (merangkumi bil_guru/murid jika ia baru diubah)
    await triggerAutoSave(calculateScore(true));

    if (checkedCount < 30) {
        Swal.fire({
            title: 'Selesai Lebih Awal?',
            text: `Anda baru menjawab ${checkedCount} daripada 30 kriteria. Walau bagaimanapun, data yang anda isi telah pun disimpan oleh sistem. Anda boleh menyambungnya kelak.`,
            icon: 'info',
            confirmButtonText: 'Kembali Ke Portal',
            confirmButtonColor: '#2563eb'
        }).then(() => window.location.href = '../../user.html');
        return;
    }

    Swal.fire({
        icon: 'success', 
        title: 'Penilaian Selesai', 
        text: 'Kesemua data penataran sekolah digital anda telah berjaya direkodkan sepenuhnya.',
        confirmButtonColor: '#059669',
        confirmButtonText: 'Tutup'
    }).then(() => window.location.href = '../../user.html');
}

window.showRubricInfo = function(id) {
    const data = rubricData[id] || { title: rubricTitles[id] || "Rubrik", 4: "Mencapai spesifikasi cemerlang standard rubrik PPD.", 3: "Memuaskan standard asas.", 2: "Dalam fasa permulaan.", 1: "Masih di peringkat awal / tiada pelaksanaan." }; 
    Swal.fire({ 
        title: `<span class="text-base font-bold text-slate-800">${data.title}</span>`, 
        html: `
        <div class="text-left text-sm space-y-3 mt-4">
            <div class="p-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
                <span class="font-black text-emerald-700 block mb-1 text-xs uppercase tracking-widest">4 Markah (Cemerlang)</span>
                <span class="text-slate-600 font-medium">${data[4]}</span>
            </div>
            <div class="p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm border-l-4 border-l-blue-500">
                <span class="font-black text-blue-700 block mb-1 text-xs uppercase tracking-widest">3 Markah (Baik)</span>
                <span class="text-slate-600 font-medium">${data[3]}</span>
            </div>
            <div class="p-4 bg-amber-50 border border-amber-100 rounded-xl shadow-sm border-l-4 border-l-amber-500">
                <span class="font-black text-amber-700 block mb-1 text-xs uppercase tracking-widest">2 Markah (Sederhana)</span>
                <span class="text-slate-600 font-medium">${data[2]}</span>
            </div>
            <div class="p-4 bg-red-50 border border-red-100 rounded-xl shadow-sm border-l-4 border-l-red-500">
                <span class="font-black text-red-700 block mb-1 text-xs uppercase tracking-widest">1 Markah (Lemah)</span>
                <span class="text-slate-600 font-medium">${data[1]}</span>
            </div>
        </div>`, 
        width: '600px', 
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#1e293b',
        customClass: { popup: 'rounded-3xl' }
    });
}

function toggleLoadingLocal(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}