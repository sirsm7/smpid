import { AchievementService } from './services/achievement.service.js';
import { SchoolService } from './services/school.service.js';
import { APP_CONFIG } from './config/app.config.js';

let allGalleryData = [];
let currentJawatanFilter = 'ALL';
let isPPDMode = false; // Flag dinamik untuk menentukan status PPD

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

async function initGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    const kodSekolah = urlParams.get('kod') ? urlParams.get('kod').toUpperCase() : null;

    if (!kodSekolah) {
        window.location.replace('index.html');
        return;
    }

    // Semak sama ada kod pada URL adalah sebahagian daripada senarai PPD
    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];
    isPPDMode = senaraiKodPPD.includes(kodSekolah);

    try {
        // Paparan Header Dinamik
        if (isPPDMode) {
            const namaPpd = APP_CONFIG.PPD_MAPPING[kodSekolah] || 'PEJABAT PENDIDIKAN DAERAH';
            document.getElementById('headerSchoolName').innerText = "PPD " + namaPpd;
            document.getElementById('headerSchoolCode').innerText = kodSekolah;
        } else {
            const sekolah = await SchoolService.getByCode(kodSekolah);
            if (sekolah) {
                document.getElementById('headerSchoolName').innerText = sekolah.nama_sekolah;
                document.getElementById('headerSchoolCode').innerText = kodSekolah;
            }
        }

        const data = await AchievementService.getBySchool(kodSekolah);
        
        // Asingkan data berdasarkan mod PPD atau Sekolah
        if (isPPDMode) {
            allGalleryData = data.filter(item => ['PEGAWAI', 'PPD'].includes(item.kategori));
        } else {
            allGalleryData = data.filter(item => ['MURID', 'GURU', 'SEKOLAH'].includes(item.kategori));
        }

        renderDynamicFilters();
        updateStats(allGalleryData);
        window.renderGallery('SEMUA');

    } catch (e) {
        console.error("Gallery Init Error:", e);
        const grid = document.getElementById('galleryGrid');
        if(grid) grid.innerHTML = `<div class="col-span-full text-center text-red-500 font-bold py-10">Gagal memuatkan galeri.</div>`;
    }
}

function updateStats(data) {
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt('countTotal', data.length);
    
    const statBox3 = document.getElementById('statBox3');
    const lblStat1 = document.getElementById('lblStat1');
    const lblStat2 = document.getElementById('lblStat2');

    if (isPPDMode) {
        setTxt('countMurid', data.filter(i => i.kategori === 'PEGAWAI').length);
        setTxt('countGuru', data.filter(i => i.kategori === 'PPD').length);
        if (statBox3) statBox3.classList.add('hidden');
        if (lblStat1) lblStat1.innerText = 'PEGAWAI';
        if (lblStat2) lblStat2.innerText = 'UNIT / SEKTOR';
    } else {
        setTxt('countMurid', data.filter(i => i.kategori === 'MURID').length);
        setTxt('countGuru', data.filter(i => i.kategori === 'GURU').length);
        setTxt('countSekolah', data.filter(i => i.kategori === 'SEKOLAH').length);
        if (statBox3) statBox3.classList.remove('hidden');
        if (lblStat1) lblStat1.innerText = 'MURID';
        if (lblStat2) lblStat2.innerText = 'GURU';
    }
}

function renderDynamicFilters() {
    const container = document.getElementById('filterContainerPublic');
    if (!container) return;

    let html = `<button onclick="filterGallery('SEMUA', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all bg-slate-900 text-white shadow-md uppercase tracking-widest">SEMUA</button>`;

    if (isPPDMode) {
        html += `
            <button onclick="filterGallery('PEGAWAI', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 hover:text-blue-600 uppercase tracking-widest">PEGAWAI</button>
            <button onclick="filterGallery('PPD', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 hover:text-indigo-600 uppercase tracking-widest">UNIT / SEKTOR</button>
        `;
    } else {
        html += `
            <button onclick="filterGallery('MURID', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 hover:text-blue-600 uppercase tracking-widest">MURID</button>
            <button onclick="filterGallery('GURU', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 hover:text-amber-600 uppercase tracking-widest">GURU</button>
            <button onclick="filterGallery('SEKOLAH', this)" class="btn-filter flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 hover:text-indigo-600 uppercase tracking-widest">SEKOLAH</button>
        `;
    }

    container.innerHTML = html;
}

window.filterGallery = function(type, btn) {
    const cloudWrapper = document.getElementById('jawatanCloudWrapper');
    
    // Cloud jawatan hanya untuk guru di peringkat sekolah
    if (type === 'GURU' && !isPPDMode) {
        if(cloudWrapper) cloudWrapper.classList.remove('hidden');
        generateJawatanCloud();
    } else {
        if(cloudWrapper) cloudWrapper.classList.add('hidden');
        currentJawatanFilter = 'ALL';
    }

    window.renderGallery(type);
};

window.renderGallery = function(filterType) {
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    grid.innerHTML = "";

    let filteredData = (filterType === 'SEMUA') 
        ? allGalleryData 
        : allGalleryData.filter(item => item.kategori === filterType);

    if (filterType === 'GURU' && currentJawatanFilter !== 'ALL') {
        filteredData = filteredData.filter(item => item.jawatan === currentJawatanFilter);
    }

    if (filteredData.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <i class="fas fa-folder-open text-4xl text-slate-200 mb-3"></i>
            <p class="text-slate-400 font-bold italic">Tiada rekod dijumpai untuk kategori ini.</p>
        </div>`;
        return;
    }

    const uniqueYears = [...new Set(filteredData.map(item => item.tahun))].sort((a, b) => b - a);

    uniqueYears.forEach(year => {
        const headerHTML = `
            <div class="col-span-full flex items-center gap-4 mt-8 mb-4 animate-fade-up">
                <span class="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black border border-indigo-100 shadow-sm">
                    <i class="fas fa-calendar-alt mr-2"></i> TAHUN ${year}
                </span>
                <div class="h-px bg-slate-200 flex-grow"></div>
            </div>`;
        grid.innerHTML += headerHTML;

        const itemsInYear = filteredData.filter(item => item.tahun === year);
        itemsInYear.forEach(item => {
            grid.innerHTML += createCardHTML(item);
        });
    });
};

function createCardHTML(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    let borderClass = "border-t-4 border-slate-300";
    let textClass = "text-slate-600";
    let catIcon = "fa-folder";

    if (item.kategori === 'MURID') {
        borderClass = "border-t-4 border-blue-500"; textClass = "text-blue-600"; catIcon = "fa-user-graduate";
    } else if (item.kategori === 'GURU') {
        borderClass = "border-t-4 border-amber-500"; textClass = "text-amber-600"; catIcon = "fa-chalkboard-user";
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-t-4 border-indigo-500"; textClass = "text-indigo-600"; catIcon = "fa-school";
    } else if (item.kategori === 'PEGAWAI') {
        borderClass = "border-t-4 border-teal-500"; textClass = "text-teal-600"; catIcon = "fa-user-tie";
    } else if (item.kategori === 'PPD') {
        borderClass = "border-t-4 border-fuchsia-500"; textClass = "text-fuchsia-600"; catIcon = "fa-building";
    }

    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder-open";
        thumbnailArea = `<div class="aspect-video bg-slate-100 flex items-center justify-center text-amber-400 text-5xl"><i class="fas fa-folder-open"></i></div>`;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-image";
        thumbnailArea = `
            <div class="aspect-video bg-slate-100 overflow-hidden">
                <img src="${thumbUrl}" class="w-full h-full object-cover transform hover:scale-110 transition duration-700" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'aspect-video bg-slate-100 flex items-center justify-center text-slate-300 text-3xl\\'><i class=\\'fas fa-image-slash\\'></i></div>'">
            </div>`;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play";
        thumbnailArea = `
            <div class="aspect-video bg-black overflow-hidden relative">
                <img src="${thumbUrl}" class="w-full h-full object-cover opacity-80 transition duration-500">
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="fas fa-play-circle text-white/90 text-4xl shadow-2xl"></i>
                </div>
            </div>`;
    } else {
        iconType = "fa-globe";
        thumbnailArea = `<div class="aspect-video bg-slate-50 flex items-center justify-center text-slate-300 text-3xl"><i class="fas fa-globe-asia"></i></div>`;
    }

    return `
    <div class="card-gallery animate-fade-up ${borderClass}" onclick="window.open('${link}', '_blank')">
        ${thumbnailArea}
        <div class="p-4 flex flex-col flex-grow relative">
            <span class="absolute top-[-14px] right-3 bg-white p-1 rounded-full shadow-sm text-slate-400 text-[10px] w-7 h-7 flex items-center justify-center border border-slate-100">
                <i class="fas ${iconType}"></i>
            </span>
            <div class="flex items-center gap-1.5 mb-2">
                <div class="w-2 h-2 rounded-full ${textClass.replace('text', 'bg')}"></div>
                <span class="text-[9px] font-black uppercase tracking-wider ${textClass}">${item.kategori}</span>
            </div>
            <h6 class="font-bold text-slate-800 text-xs leading-snug mb-1 whitespace-normal">${item.nama_pertandingan}</h6>
            <p class="text-[10px] text-slate-400 font-bold mb-3 whitespace-normal">${item.nama_peserta}</p>
            
            <div class="mt-auto pt-3 border-t border-slate-50 flex justify-between items-center">
                <span class="text-[10px] font-black ${textClass} bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase truncate max-w-[120px]">
                    ${item.pencapaian}
                </span>
                <i class="fas fa-external-link-alt text-slate-300 text-[9px]"></i>
            </div>
        </div>
    </div>`;
}

function generateJawatanCloud() {
    const container = document.getElementById('jawatanCloudContainer');
    if (!container) return;

    const guruData = allGalleryData.filter(item => item.kategori === 'GURU');
    const counts = {};
    let max = 0;

    guruData.forEach(item => {
        if (item.jawatan) {
            const j = item.jawatan.trim();
            counts[j] = (counts[j] || 0) + 1;
            if (counts[j] > max) max = counts[j];
        }
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (entries.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Tiada data jawatan direkodkan.</p>`;
        return;
    }

    container.innerHTML = entries.map(([jawatan, count]) => {
        const isActive = (jawatan === currentJawatanFilter);
        let sizeStyle = "text-[10px]";
        if(count > 2) sizeStyle = "text-[11px] font-bold";
        if(count > 5) sizeStyle = "text-[12px] font-black";

        return `
            <div onclick="filterByJawatan('${jawatan}')" 
                 class="inline-flex items-center px-3 py-1.5 rounded-full border cursor-pointer transition-all m-1 shadow-sm
                        ${isActive ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}">
                <span class="${sizeStyle}">${jawatan}</span>
                <span class="ml-2 bg-slate-100 text-slate-400 px-1.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : ''}">${count}</span>
            </div>
        `;
    }).join('');
}

window.filterByJawatan = function(jawatan) {
    currentJawatanFilter = (currentJawatanFilter === jawatan) ? 'ALL' : jawatan;
    
    const btnReset = document.getElementById('btnResetJawatan');
    if(btnReset) {
        if (currentJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }

    generateJawatanCloud();
    window.renderGallery('GURU');
};