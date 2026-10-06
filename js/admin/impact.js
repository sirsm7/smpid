/**
 * ADMIN MODULE: IMPACT ANALYSIS (MODUL PENILAIAN IMPAK BBM BERBANTUKAN AI)
 * Fungsi: Menguruskan pemuatan data analitik, penjanaan carta, 
 * pengiraan agregat (Indeks Impak), visualisasi Suara Murid dan kemudahan Reset.
 * --- KEMASKINI UI ---
 * Menyokong format baharu data Q12 (Tunggal) dan Q13 (Berbilang) yang diubah ke
 * representasi visual (Doughnut & Bar Charts) menggunakan Chart.js. Menambah kawalan Reset Data.
 */

import { ImpactService } from '../services/impact.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

let rawImpactData = [];
let impactChartInstance = null;
let chartQ12Instance = null;
let chartQ13Instance = null;

/**
 * Fungsi inisialisasi yang dipanggil apabila tab Impak BBM dibuka.
 */
window.loadImpactAdmin = async function() {
    const tbody = document.getElementById('tbodyImpactAdmin');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-400 font-medium italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>Menganalisis maklumat...</td></tr>`;

    try {
        toggleLoading(true);
        // 1. Dapatkan semua data impak dari pangkalan data
        const data = await ImpactService.getAllImpactData();
        rawImpactData = data;

        // 2. Semak RBAC (Role-Based Access Control)
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        // Jika ADMIN/PPD, hanya tunjukkan data untuk senarai sekolah mereka
        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod); // Benarkan diri sendiri juga
            rawImpactData = rawImpactData.filter(d => validSchoolCodes.includes(d.kod_sekolah));
        }

        // 3. Proses Analitik dan Render UI
        calculateImpactDashboard(rawImpactData);
        renderImpactTable(rawImpactData);

    } catch (e) {
        console.error("Gagal memuatkan data impak:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-500 font-bold bg-red-50 rounded-xl">Gagal memuatkan pangkalan data analitik.</td></tr>`;
        Swal.fire('Ralat Rangkaian', 'Sistem tidak dapat berhubung dengan pangkalan data.', 'error');
    } finally {
        toggleLoading(false);
    }
};

/**
 * Mengira dan memaparkan Metrik Eksekutif (Dashboard KPIs & Charts)
 */
function calculateImpactDashboard(data) {
    // A. Pengiraan Asas
    let sekolahSet = new Set();
    let muridCount = 0;
    
    // Hanya ambil respons yang sah (Q14 valid subject string) untuk analisis teras
    const validData = data.filter(d => d.is_valid === true);
    
    // B. Pengiraan Komponen BBM (Q11)
    let componentCounts = {};

    // C. Pengiraan Sentimen Likert (Q8 Keseluruhan, Q7 Ujian)
    let totalPositiveResponses = 0;
    let totalUjianPositive = 0;

    validData.forEach(item => {
        sekolahSet.add(item.kod_sekolah);
        muridCount++;

        // Kiraan Komponen BBM
        // Supabase JSONB memulangkan Array JS biasa
        if (Array.isArray(item.q11_komponen_bbm)) {
            item.q11_komponen_bbm.forEach(komp => {
                componentCounts[komp] = (componentCounts[komp] || 0) + 1;
            });
        }

        // Kiraan Sentimen (Menganggap "Sangat Setuju", "Setuju" sebagai positif untuk Skala Baharu)
        // Sokong juga data legacy lama (Sangat membantu, Membantu)
        const isPosOverall = ['Sangat Setuju', 'Setuju', 'Sangat membantu', 'Membantu'].includes(item.q8_keseluruhan);
        if (isPosOverall) {
            totalPositiveResponses++;
        }
        
        const isPosExam = ['Sangat Setuju', 'Setuju', 'Sangat membantu', 'Membantu'].includes(item.q7_persediaan_ujian);
        if (isPosExam) {
            totalUjianPositive++;
        }
    });

    // D. Pengiraan Sekolah Capai Sasaran (>= 10 Respons Sah)
    let sekolahTercapaiCount = 0;
    let schoolResponses = {};
    validData.forEach(item => {
        schoolResponses[item.kod_sekolah] = (schoolResponses[item.kod_sekolah] || 0) + 1;
    });
    for (let kod in schoolResponses) {
        if (schoolResponses[kod] >= 10) {
            sekolahTercapaiCount++;
        }
    }

    // E. Paparan Teks KPI
    document.getElementById('impactKpiSekolah').innerText = sekolahTercapaiCount;
    document.getElementById('impactKpiMurid').innerText = muridCount;

    const percentPositive = muridCount > 0 ? Math.round((totalPositiveResponses / muridCount) * 100) : 0;
    const percentUjian = muridCount > 0 ? Math.round((totalUjianPositive / muridCount) * 100) : 0;
    
    document.getElementById('impactKpiPositif').innerText = `${percentPositive}%`;
    document.getElementById('impactKpiUjian').innerText = `${percentUjian}%`;

    // F. Janaan Carta Bar (Chart.js) untuk Komponen BBM (Q11)
    renderBBMChart(componentCounts);
    
    // G. Janaan Laporan Eksekutif Skala Likert
    renderLikertBars(validData);
}

/**
 * Menjana Laporan Ringkas Skala Likert secara visual
 */
function renderLikertBars(validData) {
    const container = document.getElementById('impactLikertBars');
    if (!container) return;

    if (validData.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">Tiada respons sah direkodkan lagi.</div>';
        return;
    }

    const total = validData.length;
    
    // Helper function untuk kira peratusan respons positif menyokong kedua-dua format lama dan baharu
    const calculatePositivePercent = (questionKey) => {
        const positiveKeywords = ['Sangat Setuju', 'Setuju', 'Sangat membantu', 'Membantu', 'Lebih berminat', 'Sedikit lebih berminat', 'Sangat yakin', 'Yakin'];
        const count = validData.filter(d => positiveKeywords.includes(d[questionKey])).length;
        return Math.round((count / total) * 100);
    };

    // Analisis Soalan Kritikal
    const metrics = [
        { 
            label: "Kefahaman Topik", 
            pct: calculatePositivePercent('q1_kefahaman'),
            icon: "fa-brain", color: "bg-blue-500"
        },
        { 
            label: "Lebih Berminat Belajar", 
            pct: calculatePositivePercent('q4_minat'),
            icon: "fa-heart", color: "bg-red-500"
        },
        { 
            label: "Mendapat Idea Baharu", 
            pct: calculatePositivePercent('q5_idea'),
            icon: "fa-lightbulb", color: "bg-amber-500"
        },
        { 
            label: "Keyakinan Menjawab", 
            pct: calculatePositivePercent('q6_keyakinan'),
            icon: "fa-shield-alt", color: "bg-emerald-500"
        },
        { 
            label: "Memahami Penerangan Guru", 
            pct: calculatePositivePercent('q10_penerangan_guru'),
            icon: "fa-chalkboard-teacher", color: "bg-indigo-500"
        }
    ];

    let html = '';
    metrics.forEach(m => {
        html += `
        <div class="mb-3">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-slate-700 uppercase tracking-widest"><i class="fas ${m.icon} w-4 text-center mr-1 text-slate-400"></i> ${m.label}</span>
                <span class="text-xs font-black text-slate-800">${m.pct}%</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="${m.color} h-2 rounded-full" style="width: ${m.pct}%"></div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

/**
 * Menjana Carta Bar mendatar (Horizontal) bagi Elemen BBM (Chart.js)
 */
function renderBBMChart(componentCounts) {
    const ctx = document.getElementById('impactBBMChart');
    const emptyMsg = document.getElementById('impactBBMEmpty');
    
    if (!ctx) return;
    if (impactChartInstance) impactChartInstance.destroy();

    const components = Object.keys(componentCounts);
    
    if (components.length === 0) {
        ctx.style.display = 'none';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    } else {
        ctx.style.display = 'block';
        if (emptyMsg) emptyMsg.classList.add('hidden');
    }

    // Sort descending
    const sortedEntries = Object.entries(componentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5); // Ambil Top 5
    const labels = sortedEntries.map(e => e[0]);
    const data = sortedEntries.map(e => e[1]);

    impactChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kekerapan Pilihan Murid',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)', // Emerald 500
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Menjadikan bar horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw} Pilihan`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { stepSize: 1 }
                },
                y: {
                    grid: { drawOnChartArea: false },
                    ticks: { font: { size: 10, weight: 'bold' } }
                }
            }
        }
    });
}

/**
 * Menjana Jadual Status Pelaksanaan Mengikut Sekolah beserta butang Reset.
 */
function renderImpactTable(data) {
    const tbody = document.getElementById('tbodyImpactAdmin');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 font-medium italic bg-slate-50/50">Tiada rekod tinjauan impak diterima.</td></tr>`;
        return;
    }

    // 1. Agregat Data Mengikut Sekolah
    const schoolAggregates = {};
    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];

    data.forEach(item => {
        // Abaikan rekod PPD
        if (senaraiKodPPD.includes(item.kod_sekolah)) return;

        if (!schoolAggregates[item.kod_sekolah]) {
            let namaSekolah = item.kod_sekolah;
            if (window.globalDashboardData) {
                const sMatch = window.globalDashboardData.find(s => s.kod_sekolah === item.kod_sekolah);
                if (sMatch) namaSekolah = sMatch.nama_sekolah;
            }

            schoolAggregates[item.kod_sekolah] = {
                kod_sekolah: item.kod_sekolah,
                nama_sekolah: namaSekolah,
                valid_count: 0,
                total_count: 0
            };
        }

        schoolAggregates[item.kod_sekolah].total_count++;
        if (item.is_valid) {
            schoolAggregates[item.kod_sekolah].valid_count++;
        }
    });

    const aggregateArray = Object.values(schoolAggregates).sort((a, b) => b.valid_count - a.valid_count);

    // 2. Render HTML
    tbody.innerHTML = aggregateArray.map((s, index) => {
        const isReached = s.valid_count >= 10;
        
        let statusBadge = isReached 
            ? `<span class="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest border border-emerald-200"><i class="fas fa-check-double mr-1"></i> MINIMUM TERCAPAI</span>`
            : `<span class="bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest border border-red-200"><i class="fas fa-hourglass-half mr-1"></i> BELUM MENCAPAI MINIMUM</span>`;
            
        const rowClass = isReached ? 'bg-slate-50/50 grayscale-[0.2]' : 'bg-white hover:bg-slate-50';

        // Hanya SUPER_ADMIN dibenarkan mereset/memadam rekod impak bagi sekolah secara berasingan (elak terpadam rekod sah sekolah lain)
        const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        let btnReset = '';
        if (currentUserRole === 'SUPER_ADMIN') {
            btnReset = `<button onclick="window.resetImpactDataAdmin('${s.kod_sekolah}')" class="p-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-200 transition-all shadow-sm" title="Reset (Padam) Jadual Impak Sekolah Ini">
                            <i class="fas fa-trash-alt"></i>
                        </button>`;
        }

        return `
        <tr class="${rowClass} transition-colors border-b border-slate-100 last:border-0 group">
            <td class="px-6 py-5 text-center font-mono font-bold text-slate-400 align-middle">${index + 1}</td>
            <td class="px-6 py-5 font-mono font-black text-indigo-600 align-middle">${s.kod_sekolah}</td>
            <td class="px-6 py-5 align-middle">
                <div class="font-bold text-slate-800 text-sm leading-snug uppercase">${s.nama_sekolah}</div>
                <div class="text-[9px] text-slate-400 font-bold mt-1">JUMLAH KESELURUHAN (TERMASUK TIDAK SAH): ${s.total_count}</div>
            </td>
            <td class="px-6 py-5 text-center bg-indigo-50/50 align-middle">
                <span class="text-xl font-black text-indigo-700">${s.valid_count}</span>
            </td>
            <td class="px-6 py-5 text-center align-middle">${statusBadge}</td>
            <td class="px-6 py-5 text-center align-middle">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.viewImpactDetail('${s.kod_sekolah}', '${s.nama_sekolah.replace(/'/g, "\\'")}')" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] transition-all shadow-md uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-95">
                        <i class="fas fa-chart-pie"></i> Analisis
                    </button>
                    ${btnReset}
                </div>
            </td>
        </tr>`;
    }).join('');
}

/**
 * Logik pemadaman (reset) data impak sebuah sekolah
 */
window.resetImpactDataAdmin = async function(kodSekolah) {
    Swal.fire({
        title: `Padam Jadual Tinjauan Impak?`,
        html: `Anda pasti mahu memadam <b>SEMUA</b> rekod respons Impak BBM untuk sekolah <b>${kodSekolah}</b>?<br><br>Tindakan ini tidak boleh dibatalkan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await ImpactService.resetSchoolImpactData(kodSekolah);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Data Direset', text: 'Jadual maklum balas sekolah ini telah dikosongkan.', timer: 1500, showConfirmButton: false });
                
                // Refresh data list
                window.loadImpactAdmin();
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat Sistem', e.message || 'Gagal memadam rekod pangkalan data.', 'error');
            }
        }
    });
};

/**
 * Membuka tetingkap modal Suara Murid (Kini memaparkan Graf Q12 & Q13)
 */
window.viewImpactDetail = function(kodSekolah, namaSekolah) {
    const subtitle = document.getElementById('impactDetailSubtitle');
    if (subtitle) {
        subtitle.innerText = `${namaSekolah} (${kodSekolah})`;
    }

    // Tapis rekod untuk sekolah berkenaan sahaja (Hanya yang SAH)
    const schoolData = rawImpactData.filter(d => d.kod_sekolah === kodSekolah && d.is_valid === true);

    // KIRAAN Q12 (PERKARA DIPELAJARI - RADIO BUTTON TUNGGAL)
    let q12Counts = {};
    schoolData.forEach(item => {
        if (item.q12_perkara_dipelajari) {
            const label = item.q12_perkara_dipelajari;
            q12Counts[label] = (q12Counts[label] || 0) + 1;
        }
    });

    // KIRAAN Q13 (CADANGAN - CHECKBOX ARRAY)
    let q13Counts = {};
    schoolData.forEach(item => {
        if (Array.isArray(item.q13_cadangan)) {
            item.q13_cadangan.forEach(cadangan => {
                q13Counts[cadangan] = (q13Counts[cadangan] || 0) + 1;
            });
        }
    });

    // Render Carta Chart.js
    renderQ12Chart(q12Counts);
    renderQ13Chart(q13Counts);

    document.getElementById('modalImpactDetail').classList.remove('hidden');
};

/**
 * Menjana Carta Pai/Doughnut untuk Q12 (Perkara Dipelajari)
 */
function renderQ12Chart(dataObj) {
    const ctx = document.getElementById('chartQ12Detail');
    if (!ctx) return;
    if (chartQ12Instance) chartQ12Instance.destroy();

    const labels = Object.keys(dataObj);
    const dataValues = Object.values(dataObj);

    if (labels.length === 0) {
        // Fallback jika tiada data
        chartQ12Instance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Tiada Rekod'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
            options: { plugins: { tooltip: { enabled: false }, legend: { display: false } } }
        });
        return;
    }

    chartQ12Instance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { family: "'Inter', sans-serif", size: 10, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ` ${context.raw} Orang Murid`; }
                    }
                }
            }
        }
    });
}

/**
 * Menjana Carta Bar Menegak untuk Q13 (Cadangan)
 */
function renderQ13Chart(dataObj) {
    const ctx = document.getElementById('chartQ13Detail');
    if (!ctx) return;
    if (chartQ13Instance) chartQ13Instance.destroy();

    // Sort Descending
    const sortedEntries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    const labels = sortedEntries.map(e => e[0]);
    const dataValues = sortedEntries.map(e => e[1]);

    if (labels.length === 0) {
        // Fallback
        chartQ13Instance = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Tiada Cadangan'], datasets: [{ data: [0], backgroundColor: '#e2e8f0' }] },
            options: { plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { display: false } } }
        });
        return;
    }

    chartQ13Instance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kekerapan Cadangan',
                data: dataValues,
                backgroundColor: 'rgba(245, 158, 11, 0.2)', // Amber
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ` Dicadangkan oleh ${context.raw} Murid`; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 10 } },
                    grid: { borderDash: [2, 4], color: '#f1f5f9' }
                },
                x: {
                    ticks: { 
                        font: { size: 9, weight: 'bold' },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Mengeksport data mentah Impak BBM ke dalam format CSV
 */
window.eksportImpactData = function() {
    if (rawImpactData.length === 0) {
        return Swal.fire('Tiada Data', 'Tiada rekod untuk dieksport.', 'info');
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    // Header Column
    csvContent += "KOD_SEKOLAH,TARIKH,SAH,JANTINA,UMUR,Q1_KEFAHAMAN,Q2_PENGUASAAN,Q3_INGATAN,Q4_MINAT,Q5_IDEA,Q6_KEYAKINAN,Q7_PERSEDIAAN_UJIAN,Q8_KESELURUHAN,Q9_PENGLIBATAN,Q10_PENERANGAN_GURU,Q11_KOMPONEN_BBM,Q12_DIPELAJARI,Q13_CADANGAN,Q14_SUBJEK\n";

    rawImpactData.forEach(item => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const tarikh = new Date(item.created_at).toLocaleDateString('ms-MY');
        
        // Pembersihan Array ke Teks (Q11, Q13)
        let komponenBBM = Array.isArray(item.q11_komponen_bbm) ? item.q11_komponen_bbm.join(', ') : item.q11_komponen_bbm;
        let cadanganBBM = Array.isArray(item.q13_cadangan) ? item.q13_cadangan.join(', ') : item.q13_cadangan;

        let row = [
            clean(item.kod_sekolah),
            clean(tarikh),
            item.is_valid ? 'YA' : 'TIDAK',
            clean(item.jantina),
            clean(item.kumpulan_umur),
            clean(item.q1_kefahaman),
            clean(item.q2_penguasaan),
            clean(item.q3_ingatan),
            clean(item.q4_minat),
            clean(item.q5_idea),
            clean(item.q6_keyakinan),
            clean(item.q7_persediaan_ujian),
            clean(item.q8_keseluruhan),
            clean(item.q9_penglibatan),
            clean(item.q10_penerangan_guru),
            clean(komponenBBM),
            clean(item.q12_perkara_dipelajari),
            clean(cadanganBBM),
            clean(item.q14_pengesahan_sesi)
        ];
        
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_Mentah_Impak_BBM_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};