/* js/app.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Update Footer Year (Universal)
    if (document.getElementById('currentYear')) {
        document.getElementById('currentYear').innerText = new Date().getFullYear();
    }

    // 2. Render SPKA Concepts (Index Page)
    const spkaContainer = document.getElementById('spka-list-container');
    if (spkaContainer && typeof spkaData !== 'undefined') {
        spkaData.forEach(item => {
            spkaContainer.innerHTML += `
                <div class="flex gap-5 p-6 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition bg-white group hover:border-${item.color}-200 cursor-default">
                    <div class="w-14 h-14 bg-${item.color}-100 text-${item.color}-600 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0 transition group-hover:bg-${item.color}-600 group-hover:text-white shadow-sm">${item.icon}</div>
                    <div>
                        <h4 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-${item.color}-700 transition">${item.title}</h4>
                        <p class="text-xs font-bold uppercase tracking-wider text-${item.color}-600 mb-2">${item.desc}</p>
                        <p class="text-sm text-slate-500 leading-relaxed">${item.detail}</p>
                    </div>
                </div>
            `;
        });
    }

    // 3. Render Keywords (Examples Page)
    const kwContainer = document.getElementById('keywords-container');
    if (kwContainer && typeof keywordsData !== 'undefined') {
        keywordsData.forEach(kw => {
            kwContainer.innerHTML += `
                <div onclick="copyText('${kw.title} (${kw.sub})')" class="p-6 border border-slate-200 rounded-2xl hover:border-brand-500 hover:shadow-xl transition cursor-pointer group bg-white h-full flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <div class="font-bold text-brand-700 text-lg group-hover:text-brand-600">${kw.title}</div>
                            <i class="fa-regular fa-copy text-slate-300 group-hover:text-brand-500"></i>
                        </div>
                        <div class="text-xs font-mono text-slate-400 mb-3 bg-slate-50 p-1 rounded inline-block">"${kw.sub}"</div>
                        <p class="text-sm text-slate-600 mb-4 leading-relaxed">${kw.desc}</p>
                    </div>
                    <div class="bg-brand-50 p-3 rounded-lg border border-brand-100 group-hover:bg-brand-600 group-hover:border-brand-600 transition">
                        <span class="text-[10px] font-bold text-brand-400 uppercase block mb-1 group-hover:text-brand-200">Contoh Prompt:</span>
                        <p class="text-xs text-brand-900 italic font-medium group-hover:text-white">"${kw.example}"</p>
                    </div>
                </div>
            `;
        });
    }

    // 4. Init Sectors (Examples Page)
    if (document.getElementById('tabs-container') && typeof sectorsData !== 'undefined') {
        initSectors();
    }

    // 5. Init Quiz (Quiz Page)
    if (document.getElementById('quiz-container') && typeof rawQuizData !== 'undefined') {
        window.quizEnginePro = new QuizEnginePro(rawQuizData);
    }
});

/* --- FUNCTIONS FOR GENERATOR --- */
function generatePrompt() {
    const s = document.getElementById('inputS').value.trim();
    const p = document.getElementById('inputP').value.trim();
    const k = document.getElementById('inputK').value.trim();
    const a = document.getElementById('inputA').value.trim();
    
    if (!s || !p || !k || !a) { 
        Swal.fire({
            icon: 'warning',
            title: 'Maklumat Tidak Lengkap',
            text: 'Sila isi kesemua ruangan S.P.K.A untuk memastikan prompt yang dijana berkualiti tinggi.',
            confirmButtonText: 'Baik, saya isi',
            confirmButtonColor: '#2563eb'
        });
        return; 
    }
    
    const prompt = `[SIAPA SAYA]\n${s}\n\n[PERANAN AI]\n${p}\n\n[KONTEKS]\n${k}\n\n[ARAHAN]\n${a}\n\nSila pastikan jawapan anda terperinci, tepat, profesional, dan jika melibatkan kod/format, hasilkan output penuh yang siap untuk disalin dan digunakan (ready-to-use).`;
    const finalArea = document.getElementById('finalPrompt');
    finalArea.value = prompt;
    document.getElementById('resultArea').classList.remove('hidden');
    finalArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    Swal.fire({ icon: 'success', title: 'Prompt Berjaya Dijana!', text: 'Sila salin prompt di bawah.', timer: 2000, showConfirmButton: false });
}

function copyToClipboard(id) {
    const el = document.getElementById(id); 
    el.select(); 
    navigator.clipboard.writeText(el.value).then(() => Swal.fire({ icon: 'success', title: 'Disalin!', timer: 1500, showConfirmButton: false }));
}

/* --- COMMON UTILS --- */
function copyText(text) { 
    navigator.clipboard.writeText(text).then(() => Swal.fire({ icon: 'success', title: 'Disalin!', html: `<span class="text-brand-600 font-mono text-sm">${text}</span>`, timer: 1500, showConfirmButton: false }));
}

function switchTab(id) {
    document.querySelectorAll('.sector-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => { 
        btn.classList.remove('tab-active', 'ring-2', 'ring-offset-2', 'ring-brand-500'); 
        btn.classList.add('tab-inactive'); 
    });
    const activeBtn = document.getElementById('btn-' + id);
    activeBtn.classList.remove('tab-inactive');
    activeBtn.classList.add('tab-active', 'ring-2', 'ring-offset-2', 'ring-brand-500');
}

function showPrompt(encodedContent) {
    const content = decodeURIComponent(encodedContent);
    Swal.fire({
        title: '<span class="text-lg font-bold">Prompt Penuh S.P.K.A</span>',
        html: `<div class="relative"><textarea readonly class="w-full h-64 p-4 border-2 border-slate-200 rounded-xl font-mono text-xs md:text-sm bg-slate-50 text-left focus:outline-none text-slate-700 leading-relaxed resize-none">${content}</textarea></div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-regular fa-copy mr-2"></i> Salin Prompt',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        width: '600px',
        padding: '2em',
        customClass: { popup: 'rounded-3xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            navigator.clipboard.writeText(content).then(() => Swal.fire({ icon: 'success', title: 'Disalin!', timer: 1000, showConfirmButton: false }));
        }
    });
}

function initSectors() {
    const tabsContainer = document.getElementById('tabs-container');
    const contentContainer = document.getElementById('content-container');
    
    const sectorNames = {
        'perancangan': 'Sektor Perancangan',
        'pembelajaran': 'Sektor Pembelajaran',
        'sekolah': 'Sektor Pengurusan Sekolah',
        'murid': 'Sektor Pembangunan Murid',
        'akp': 'Sektor Pengurusan (AKP)'
    };

    Object.keys(sectorsData).forEach((key, index) => {
        const label = sectorNames[key];
        const activeClass = index === 0 ? 'tab-active ring-2 ring-offset-2 ring-brand-500' : 'tab-inactive hover:bg-slate-50';
        tabsContainer.innerHTML += `<button onclick="switchTab('${key}')" class="tab-btn ${activeClass} px-6 py-3 rounded-full border text-sm font-bold transition shadow-sm capitalize tracking-wide" id="btn-${key}">${label}</button>`;
    });

    Object.entries(sectorsData).forEach(([key, prompts], index) => {
        const hiddenClass = index === 0 ? '' : 'hidden';
        let cardsHtml = '';
        
        prompts.forEach(p => {
            if (p.type === 'system') {
                cardsHtml += `
                <div class="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-700 hover:transform hover:-translate-y-2 transition duration-300 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 bg-gradient-to-l from-red-600 to-orange-600 text-xs font-bold px-4 py-1.5 rounded-bl-2xl shadow-lg z-10">SISTEM KHAS</div>
                    <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition"></div>
                    <div class="bg-white/10 w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 border border-white/10 shadow-inner"><i class="fa-solid ${p.icon} text-2xl"></i></div>
                    <h4 class="font-bold text-xl mb-2 text-white group-hover:text-brand-300 transition">${p.title}</h4>
                    <p class="text-sm text-slate-400 mb-6 leading-relaxed min-h-[60px]">${p.desc}</p>
                    <button onclick="showPrompt('${encodeURIComponent(p.content)}')" class="w-full bg-white text-slate-900 hover:bg-brand-500 hover:text-white py-3.5 rounded-xl text-sm font-bold transition shadow-lg flex items-center justify-center gap-2">
                        <i class="fa-solid fa-code"></i> Jana Kod Sistem
                    </button>
                </div>`;
            } else {
                cardsHtml += `
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-brand-200 transition duration-300 group flex flex-col h-full">
                    <div class="bg-brand-50 w-14 h-14 rounded-2xl flex items-center justify-center text-brand-600 mb-6 border border-brand-100 group-hover:scale-110 transition"><i class="fa-solid ${p.icon} text-2xl"></i></div>
                    <h4 class="font-bold text-xl mb-2 text-slate-800 group-hover:text-brand-600 transition">${p.title}</h4>
                    <p class="text-sm text-slate-500 mb-6 leading-relaxed flex-grow">${p.desc}</p>
                    <button onclick="showPrompt('${encodeURIComponent(p.content)}')" class="w-full border-2 border-brand-100 text-brand-600 hover:bg-brand-600 hover:text-white hover:border-brand-600 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                        <i class="fa-regular fa-eye"></i> Lihat & Salin
                    </button>
                </div>`;
            }
        });
        contentContainer.innerHTML += `<div id="${key}" class="sector-content grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in ${hiddenClass}">${cardsHtml}</div>`;
    });
}

/* --- QUIZ CLASS --- */
class QuizEnginePro {
    constructor(data) {
        this.originalData = data;
        this.questions = [];
        this.currentIdx = 0;
        this.score = 0;
        this.timer = null;
        this.timeLeft = 20;
        this.maxTime = 20;
        this.isAnswering = false;

        this.ui = {
            start: document.getElementById('quiz-start'),
            question: document.getElementById('quiz-question'),
            result: document.getElementById('quiz-result'),
            currentNum: document.getElementById('q-current'),
            totalNum: document.getElementById('q-total'),
            text: document.getElementById('q-text'),
            options: document.getElementById('q-options'),
            explanation: document.getElementById('q-explanation'),
            expText: document.getElementById('q-explanation-text'),
            nextBtn: document.getElementById('btn-next-q'),
            timerBar: document.getElementById('timer-bar'),
            timerText: document.getElementById('timer-text')
        };
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    start() {
        this.questions = this.shuffle([...this.originalData]);
        this.currentIdx = 0;
        this.score = 0;
        this.ui.start.classList.add('hidden');
        this.ui.result.classList.add('hidden');
        this.ui.question.classList.remove('hidden');
        this.ui.totalNum.innerText = this.questions.length;
        this.loadQuestion();
    }

    loadQuestion() {
        const q = this.questions[this.currentIdx];
        this.ui.currentNum.innerText = this.currentIdx + 1;
        this.ui.text.innerText = q.q;
        this.ui.explanation.classList.add('hidden');
        this.ui.nextBtn.classList.add('hidden');
        this.ui.options.innerHTML = '';
        this.isAnswering = true;

        let optionObjects = q.options.map(opt => ({ text: opt, isCorrect: opt === q.correct }));
        optionObjects = this.shuffle(optionObjects);

        optionObjects.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn w-full text-left p-5 border-2 border-slate-100 rounded-xl font-medium text-slate-600 mb-2 flex items-center justify-between group bg-white';
            btn.innerHTML = `<span>${opt.text}</span> <i class="fa-regular fa-circle text-slate-300 group-hover:text-brand-400"></i>`;
            btn.onclick = () => this.handleAnswer(btn, opt.isCorrect);
            this.ui.options.appendChild(btn);
        });
        this.startTimer();
    }

    startTimer() {
        clearInterval(this.timer);
        this.timeLeft = this.maxTime;
        this.ui.timerBar.style.width = '100%';
        this.ui.timerBar.classList.remove('timer-critical');
        this.ui.timerText.innerText = this.timeLeft + 's';

        this.timer = setInterval(() => {
            this.timeLeft -= 0.1;
            const percent = (this.timeLeft / this.maxTime) * 100;
            this.ui.timerBar.style.width = `${percent}%`;
            
            if (this.timeLeft <= 5) this.ui.timerBar.classList.add('timer-critical');
            if (this.timeLeft % 1 < 0.1) this.ui.timerText.innerText = Math.ceil(this.timeLeft) + 's';
            if (this.timeLeft <= 0) this.timeIsUp();
        }, 100);
    }

    timeIsUp() {
        clearInterval(this.timer);
        if (!this.isAnswering) return;
        const buttons = this.ui.options.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.innerText.includes(this.questions[this.currentIdx].correct)) {
                btn.classList.add('correct-answer');
            }
        });
        this.showExplanation();
    }

    handleAnswer(selectedBtn, isCorrect) {
        if (!this.isAnswering) return;
        this.isAnswering = false;
        clearInterval(this.timer);
        const buttons = this.ui.options.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);

        if (isCorrect) {
            this.score++;
            selectedBtn.classList.add('correct-answer');
            selectedBtn.innerHTML = `<span>${selectedBtn.innerText}</span> <i class="fa-solid fa-check-circle text-green-700 text-xl animate-bounce"></i>`;
        } else {
            selectedBtn.classList.add('wrong-answer');
            selectedBtn.innerHTML = `<span>${selectedBtn.innerText}</span> <i class="fa-solid fa-times-circle text-red-600 text-xl"></i>`;
            buttons.forEach(btn => {
                if (btn.innerText.includes(this.questions[this.currentIdx].correct)) {
                    btn.classList.add('correct-answer');
                    btn.innerHTML = `<span>${btn.innerText}</span> <i class="fa-solid fa-check-circle text-green-700 text-xl"></i>`;
                }
            });
        }
        this.showExplanation();
    }

    showExplanation() {
        this.ui.expText.innerText = this.questions[this.currentIdx].explanation;
        this.ui.explanation.classList.remove('hidden');
        this.ui.nextBtn.classList.remove('hidden');
    }

    next() {
        this.currentIdx++;
        if (this.currentIdx < this.questions.length) {
            this.loadQuestion();
        } else {
            this.finish();
        }
    }

    finish() {
        this.ui.question.classList.add('hidden');
        this.ui.result.classList.remove('hidden');
        const percentage = Math.round((this.score / this.questions.length) * 100);
        let message, icon, color;

        if (percentage >= 80) {
            message = "TAHNIAH! Anda Adalah 0.1% Pakar!";
            icon = "fa-trophy";
            color = "text-yellow-500";
            this.fireConfetti();
        } else if (percentage >= 50) {
            message = "Usaha Bagus! Teruskan Latihan.";
            icon = "fa-star-half-stroke";
            color = "text-blue-500";
        } else {
            message = "Jangan Putus Asa. Cuba Ulangkaji Konsep S.P.K.A.";
            icon = "fa-book-reader";
            color = "text-slate-400";
        }

        this.ui.result.innerHTML = `
            <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl ${color} mx-auto">
                <i class="fa-solid ${icon}"></i>
            </div>
            <h3 class="text-4xl font-bold text-slate-800 mb-2">${this.score} / ${this.questions.length}</h3>
            <p class="text-brand-600 font-bold tracking-wider uppercase mb-6">Skor Akhir Anda (${percentage}%)</p>
            <h4 class="text-xl font-medium text-slate-600 mb-10 max-w-md mx-auto">${message}</h4>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button onclick="quizEnginePro.start()" class="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition shadow-lg">
                    <i class="fa-solid fa-rotate-right mr-2"></i> Cuba Lagi
                </button>
                <a href="index.html#concept" class="bg-white border-2 border-slate-200 text-slate-600 px-8 py-3 rounded-xl font-bold hover:border-brand-500 hover:text-brand-600 transition">Ulang Kaji Nota</a>
            </div>
        `;
    }

    fireConfetti() {
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
}