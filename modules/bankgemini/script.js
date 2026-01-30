/**
 * GEMINI CERTIFICATION FOR EDUCATORS - LOGIC CONTROLLER
 * Versi: 3.2 (Fix: Null Element Check & Stats)
 * Tarikh Kemaskini: 2026
 * * NOTA: Fail ini bergantung kepada 'questions.js' yang mesti dimuatkan
 * SEBELUM fail ini dalam HTML.
 */

// Pastikan rawData wujud
if (typeof rawData === 'undefined') {
    console.error("RALAT KRITIKAL: 'questions.js' tidak dimuatkan! Sila semak fail HTML anda.");
}

// State
let currentView = 'dashboard';
let currentCategoryFilter = 'all';
let flashcardIndex = 0;
let shuffledFlashcards = [];
let flashcardRevealed = false;

// --- INIT & NAVIGATION ---
function init() {
    updateDashboardStats();
    renderChart();
    renderCategories();
    renderQuestions();
}

// --- FUNGSI KIRA STATISTIK AUTOMATIK ---
function updateDashboardStats() {
    // 1. Kemaskini Jumlah Soalan (Dashboard & Intro)
    const totalQ = rawData.length;
    
    // Update kad statistik
    const statTotalQ = document.getElementById('stat-total-q');
    if(statTotalQ) {
        statTotalQ.textContent = totalQ;
        statTotalQ.classList.remove('animate-pulse');
    }

    // Update teks intro
    const statIntro = document.getElementById('stat-intro-count');
    if(statIntro) {
        statIntro.textContent = totalQ;
    }

    // Update teks di tab Bank Soalan
    const statTotalQ2 = document.getElementById('stat-total-q-2');
    if(statTotalQ2) statTotalQ2.textContent = totalQ;

    // 2. Kemaskini Jumlah Kategori
    // Bersihkan nama kategori daripada (extra text) jika ada
    const uniqueCategories = new Set(rawData.map(q => q.category.replace(/\(.*\)/, '').trim()));
    const statTotalCat = document.getElementById('stat-total-cat');
    if(statTotalCat) {
        statTotalCat.textContent = uniqueCategories.size;
        statTotalCat.classList.remove('animate-pulse');
    }

    // 3. Cari Fokus Terbesar (Top Topic)
    const categoryCounts = {};
    rawData.forEach(q => {
        const cleanCat = q.category.replace(/\(.*\)/, '').trim();
        categoryCounts[cleanCat] = (categoryCounts[cleanCat] || 0) + 1;
    });

    let maxCat = '';
    let maxCount = 0;

    for (const [cat, count] of Object.entries(categoryCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxCat = cat;
        }
    }

    // Kira peratusan
    const percentage = Math.round((maxCount / totalQ) * 100);

    const statTopCat = document.getElementById('stat-top-cat');
    const statTopDesc = document.getElementById('stat-top-cat-desc');

    if(statTopCat) {
        statTopCat.textContent = maxCat;
        statTopCat.classList.remove('animate-pulse');
    }
    if(statTopDesc) {
        statTopDesc.textContent = `~${percentage}% daripada soalan`;
    }
}

function switchView(viewName) {
    // Hide all
    ['dashboard', 'study', 'flashcards'].forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        const navEl = document.getElementById(`nav-${v}`);

        // FIX: Safety check - Pastikan elemen wujud sebelum ubah class
        // Ini menghalang ralat "Cannot read properties of null" jika butang tiada (cth: flashcards)
        if (viewEl) {
            viewEl.classList.add('hidden');
        }
        
        if (navEl) {
            navEl.classList.remove('bg-blue-50', 'text-blue-600');
            navEl.classList.add('text-slate-600');
        }
    });

    // Show selected
    const selectedView = document.getElementById(`view-${viewName}`);
    const selectedNav = document.getElementById(`nav-${viewName}`);

    if (selectedView) {
        selectedView.classList.remove('hidden');
    }
    
    if (selectedNav) {
        selectedNav.classList.add('bg-blue-50', 'text-blue-600');
        selectedNav.classList.remove('text-slate-600');
    }
    
    currentView = viewName;
    
    // Init Flashcards jika pertama kali buka
    if(viewName === 'flashcards' && shuffledFlashcards.length === 0) {
        setupFlashcards();
    }
}

// --- DASHBOARD CHARTS ---
function renderChart() {
    const ctx = document.getElementById('topicChart');
    if (!ctx) return; // Safety check jika canvas tiada

    // Aggregation
    const categoryCounts = {};
    rawData.forEach(q => {
        const cleanCat = q.category.replace(/\(.*\)/, '').trim(); 
        categoryCounts[cleanCat] = (categoryCounts[cleanCat] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts);
    const data = Object.values(categoryCounts);
    
    // Soft Google Colors
    const colors = [
        '#4285F4', '#34A853', '#FBBC05', '#EA4335', 
        '#8AB4F8', '#81C995', '#FDE293', '#F28B82',
        '#C58AF9', '#F6AEA9', '#D2E3FC'
    ];

    new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, padding: 15 } },
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${context.raw} soalan`;
                        }
                    },
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    padding: 12,
                    cornerRadius: 8
                }
            },
            layout: { padding: 10 }
        }
    });
}

// --- STUDY LIST LOGIC ---
function renderCategories() {
    const container = document.getElementById('category-filters');
    if (!container) return;

    const categories = [...new Set(rawData.map(q => q.category))].sort();
    
    // Kosongkan container dulu
    container.innerHTML = '<button onclick="filterQuestions(\'all\')" class="filter-btn active px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-white transition-all shadow-sm">Semua</button>';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn px-4 py-2 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm`;
        btn.textContent = cat;
        btn.onclick = () => filterQuestions(cat, btn);
        container.appendChild(btn);
    });
}

function filterQuestions(category, btnElement) {
    currentCategoryFilter = category;
    
    // Update UI buttons
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-slate-800', 'text-white', 'border-transparent');
        b.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
    });
    
    if (category === 'all') {
        const allBtn = document.querySelector('button[onclick="filterQuestions(\'all\')"]');
        if(allBtn) {
            allBtn.classList.add('bg-slate-800', 'text-white', 'border-transparent');
            allBtn.classList.remove('bg-white', 'text-slate-600');
        }
    } else if (btnElement) {
        btnElement.classList.add('bg-slate-800', 'text-white', 'border-transparent');
        btnElement.classList.remove('bg-white', 'text-slate-600');
    }

    renderQuestions();
}

function renderQuestions() {
    const list = document.getElementById('questions-list');
    if(!list) return;

    list.innerHTML = '';
    
    const filtered = currentCategoryFilter === 'all' 
        ? rawData 
        : rawData.filter(q => q.category === currentCategoryFilter);

    filtered.forEach(q => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300';
        item.innerHTML = `
            <button onclick="toggleAccordion(${q.id})" class="w-full text-left p-5 flex justify-between items-start gap-4 focus:outline-none group">
                <div class="flex-grow">
                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-2 border border-slate-200">${q.category}</span>
                    <h3 class="font-medium text-slate-800 text-lg group-hover:text-blue-700 transition-colors">${q.question}</h3>
                </div>
                <span id="icon-${q.id}" class="text-slate-400 text-2xl transform transition-transform duration-300 flex-shrink-0 bg-slate-50 w-8 h-8 flex items-center justify-center rounded-full group-hover:bg-blue-50 group-hover:text-blue-500">+</span>
            </button>
            <div id="content-${q.id}" class="hidden bg-slate-50 border-t border-slate-100 p-5 pl-6 animate-fadeIn">
                <div class="mb-4">
                    <span class="flex items-center gap-2 text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Jawapan Betul
                    </span>
                    <p class="text-slate-900 font-semibold pl-6 border-l-2 border-green-200">${q.answer}</p>
                </div>
                <div>
                    <span class="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Nota Pakar
                    </span>
                    <p class="text-slate-600 text-sm mt-1 italic leading-relaxed pl-6 border-l-2 border-blue-200">"${q.note}"</p>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300"><p class="text-slate-400">Tiada soalan ditemui dalam kategori ini.</p></div>';
    }
}

function toggleAccordion(id) {
    const content = document.getElementById(`content-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.classList.add('rotate-45');
        icon.innerHTML = '&times;'; 
        content.classList.add('fade-in');
    } else {
        content.classList.add('hidden');
        icon.classList.remove('rotate-45');
        icon.innerHTML = '+';
        content.classList.remove('fade-in');
    }
}

// --- FLASHCARD LOGIC ---
function setupFlashcards() {
    shuffledFlashcards = [...rawData].sort(() => Math.random() - 0.5);
    flashcardIndex = 0;
    const totalEl = document.getElementById('fc-total');
    if(totalEl) totalEl.textContent = shuffledFlashcards.length;
    loadCard();
}

function loadCard() {
    if (flashcardIndex >= shuffledFlashcards.length) {
        document.getElementById('fc-question').textContent = "Sesi Tamat! Tahniah!";
        document.getElementById('fc-category').textContent = "SELESAI";
        document.getElementById('fc-controls').classList.add('opacity-0');
        
        const flashcardEl = document.querySelector('.flashcard');
        if (flashcardEl) flashcardEl.classList.remove('flipped');
        flashcardRevealed = false;
        return;
    }

    const card = shuffledFlashcards[flashcardIndex];
    
    const flashcardEl = document.querySelector('.flashcard');
    if (flashcardEl) {
        flashcardEl.classList.remove('flipped');
    }
    flashcardRevealed = false;
    document.getElementById('fc-controls').classList.remove('opacity-100');
    document.getElementById('fc-controls').classList.add('opacity-0');

    setTimeout(() => { 
        document.getElementById('fc-category').textContent = card.category;
        document.getElementById('fc-question').textContent = card.question;
        document.getElementById('fc-answer').textContent = card.answer;
        document.getElementById('fc-note').textContent = card.note;
        document.getElementById('fc-counter').textContent = flashcardIndex + 1;
    }, 300);
}

function flipCard() {
    if (flashcardRevealed) return; 
    
    const flashcardEl = document.querySelector('.flashcard');
    if (flashcardEl) {
        flashcardEl.classList.add('flipped');
        flashcardRevealed = true;
        
        setTimeout(() => {
            document.getElementById('fc-controls').classList.remove('opacity-0');
            document.getElementById('fc-controls').classList.add('opacity-100');
        }, 600);
    }
}

function nextCard(known, event) {
    event.stopPropagation(); 
    flashcardIndex++;
    loadCard();
}

// Run Init
window.addEventListener('DOMContentLoaded', init);