/**
 * LANDING PAGE CONTROLLER (TAILWIND EDITION)
 * Menguruskan carian sekolah dan paparan kad akses pantas.
 * Menggunakan: SchoolService, APP_CONFIG
 */

import { SchoolService } from './services/school.service.js';
import { APP_CONFIG } from './config/app.config.js';

let allSchools = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Papar loading semasa mula
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) loadingEl.classList.remove('hidden');

    await loadSchools();
    setupSearchListener();
});

async function loadSchools() {
    try {
        const schools = await SchoolService.getAll();
        
        // Filter: Buang PPD (M030) dari senarai awam
        allSchools = schools.filter(s => s.kod_sekolah !== 'M030');
        
        populateDatalist(allSchools);
        checkSession();

    } catch (err) {
        console.error("Gagal muat sekolah:", err);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Sambungan',
            text: 'Gagal memuatkan senarai sekolah. Sila muat semula halaman.',
            confirmButtonColor: '#10b981' // emerald-500
        });
    } finally {
        // Sembunyi loading
        const loadingEl = document.getElementById('loadingOverlay');
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function checkSession() {
    const savedKod = sessionStorage.getItem(APP_CONFIG.SESSION.ACTIVE_SCHOOL);
    
    if (savedKod && allSchools.length > 0) {
        const school = allSchools.find(s => s.kod_sekolah === savedKod);
        if (school) {
            const input = document.getElementById('mainSearch');
            if (input) input.value = `${school.kod_sekolah} - ${school.nama_sekolah}`;
            renderSchoolCard(school);
        }
    }
}

function populateDatalist(data) {
    const list = document.getElementById('schoolList');
    if (!list) return;
    
    list.innerHTML = '';
    data.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${s.kod_sekolah} - ${s.nama_sekolah}`;
        list.appendChild(opt);
    });
}

function setupSearchListener() {
    const input = document.getElementById('mainSearch');
    if (!input) return;
    
    input.addEventListener('input', (e) => {
        const val = e.target.value;
        const parts = val.split(' - ');
        
        if (parts.length >= 2) {
            const kod = parts[0].trim();
            const school = allSchools.find(s => s.kod_sekolah === kod);
            if (school) {
                renderSchoolCard(school);
                input.blur(); 
            }
        } else if (val === '') {
            resetSearch();
        }
    });
}

/**
 * Menjana Kad Sekolah dengan Kelas Tailwind CSS
 */
function renderSchoolCard(school) {
    sessionStorage.setItem(APP_CONFIG.SESSION.ACTIVE_SCHOOL, school.kod_sekolah);

    const container = document.getElementById('schoolCardContainer');
    const welcome = document.getElementById('welcomeMessage');
    
    if (welcome) welcome.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    
    // HTML Template menggunakan Tailwind sepenuhnya
    container.innerHTML = `
        <div class="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 transform transition-all duration-500 animate-fade-up">
            
            <!-- HEADER KAD -->
            <div class="bg-gradient-to-r from-brand-50 to-white p-8 text-center border-b border-brand-100">
                <span class="inline-block bg-brand-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-full mb-3 shadow-sm border border-brand-200">
                    ${school.kod_sekolah}
                </span>
                <h3 class="text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight mb-2">
                    ${school.nama_sekolah}
                </h3>
                <p class="text-slate-500 text-sm font-medium">Portal Rasmi Sekolah</p>
            </div>
            
            <!-- GRID BUTANG MENU -->
            <div class="p-8">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    <!-- BUTANG 1: SERAHAN DATA -->
                    <a href="public.html?kod=${school.kod_sekolah}" class="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-600 hover:border-emerald-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <div class="w-14 h-14 bg-white text-emerald-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:bg-white/20 group-hover:text-white transition-colors">
                            <i class="fas fa-paper-plane"></i>
                        </div>
                        <h6 class="font-bold text-emerald-800 mb-1 group-hover:text-white transition-colors">SERAHAN DATA</h6>
                        <span class="text-xs text-emerald-600/80 text-center leading-tight group-hover:text-emerald-100 transition-colors">
                            Isi pencapaian murid/guru di sini.
                        </span>
                    </a>

                    <!-- BUTANG 2: GALERI -->
                    <a href="gallery.html?kod=${school.kod_sekolah}" class="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:border-blue-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <div class="w-14 h-14 bg-white text-blue-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:bg-white/20 group-hover:text-white transition-colors">
                            <i class="fas fa-images"></i>
                        </div>
                        <h6 class="font-bold text-blue-800 mb-1 group-hover:text-white transition-colors">GALERI SEKOLAH</h6>
                        <span class="text-xs text-blue-600/80 text-center leading-tight group-hover:text-blue-100 transition-colors">
                            Lihat papan pencapaian digital.
                        </span>
                    </a>

                    <!-- BUTANG 3: ADMIN LOGIN -->
                    <a href="login.html?kod=${school.kod_sekolah}" class="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-purple-50 border border-purple-100 hover:bg-purple-600 hover:border-purple-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <div class="w-14 h-14 bg-white text-purple-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:bg-white/20 group-hover:text-white transition-colors">
                            <i class="fas fa-user-lock"></i>
                        </div>
                        <h6 class="font-bold text-purple-800 mb-1 group-hover:text-white transition-colors">ADMIN SEKOLAH</h6>
                        <span class="text-xs text-purple-600/80 text-center leading-tight group-hover:text-purple-100 transition-colors">
                            Log masuk GPICT & Admin DELIMa.
                        </span>
                    </a>

                </div>

                <!-- FOOTER KAD -->
                <div class="mt-8 text-center pt-6 border-t border-slate-100">
                    <button onclick="resetSearch()" class="text-slate-400 hover:text-red-500 text-sm font-bold flex items-center justify-center gap-2 mx-auto transition-colors">
                        <i class="fas fa-times-circle"></i> Tutup / Cari Sekolah Lain
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Global window function untuk HTML onclick
window.resetSearch = function() {
    sessionStorage.removeItem(APP_CONFIG.SESSION.ACTIVE_SCHOOL);

    const input = document.getElementById('mainSearch');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    document.getElementById('schoolCardContainer').classList.add('hidden');
    document.getElementById('welcomeMessage').classList.remove('hidden');
};