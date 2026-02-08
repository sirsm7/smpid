/**
 * LANDING PAGE CONTROLLER
 * Menguruskan carian sekolah dan paparan kad akses pantas.
 * Menggunakan: SchoolService, APP_CONFIG
 */

import { SchoolService } from './services/school.service.js';
import { APP_CONFIG } from './config/app.config.js';

let allSchools = [];

document.addEventListener('DOMContentLoaded', async () => {
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

function renderSchoolCard(school) {
    sessionStorage.setItem(APP_CONFIG.SESSION.ACTIVE_SCHOOL, school.kod_sekolah);

    const container = document.getElementById('schoolCardContainer');
    const welcome = document.getElementById('welcomeMessage');
    
    if (welcome) welcome.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    
    container.innerHTML = `
        <div class="card border-0 shadow-lg rounded-4 selected-school-card bg-white p-4">
            <div class="text-center mb-4">
                <span class="badge bg-success bg-opacity-10 text-success border border-success px-3 py-1 rounded-pill mb-2 fw-bold">
                    ${school.kod_sekolah}
                </span>
                <h3 class="fw-bold text-dark mb-0">${school.nama_sekolah}</h3>
            </div>
            
            <div class="row g-3">
                <div class="col-md-4">
                    <a href="public.html?kod=${school.kod_sekolah}" class="action-btn btn-data">
                        <i class="fas fa-paper-plane fa-3x mb-3"></i>
                        <h6 class="fw-bold mb-1">SERAHAN DATA</h6>
                        <small class="text-center opacity-75 lh-sm">Isi maklumat pencapaian murid/guru di sini.</small>
                    </a>
                </div>
                <div class="col-md-4">
                    <a href="gallery.html?kod=${school.kod_sekolah}" class="action-btn btn-gallery">
                        <i class="fas fa-images fa-3x mb-3"></i>
                        <h6 class="fw-bold mb-1">GALERI SEKOLAH</h6>
                        <small class="text-center opacity-75 lh-sm">Lihat papan pencapaian digital sekolah anda.</small>
                    </a>
                </div>
                <div class="col-md-4">
                    <a href="login.html?kod=${school.kod_sekolah}" class="action-btn btn-admin">
                        <i class="fas fa-user-lock fa-3x mb-3"></i>
                        <h6 class="fw-bold mb-1">ADMIN SEKOLAH</h6>
                        <small class="text-center opacity-75 lh-sm">Log masuk untuk GPICT dan Admin DELIMa.</small>
                    </a>
                </div>
            </div>

            <div class="text-center mt-4 pt-3 border-top">
                <button onclick="resetSearch()" class="btn btn-sm btn-link text-muted text-decoration-none fw-bold">
                    <i class="fas fa-times-circle me-1"></i> Tutup / Cari Sekolah Lain
                </button>
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