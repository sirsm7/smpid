/* js/data.js */

const spkaData = [
    { code: 'S', title: 'Siapa Saya (Identity)', desc: 'Fungsi: Menetapkan Laras Bahasa & Tahap Komunikasi.', detail: 'Bahagian ini penting supaya AI tahu dengan siapa ia bercakap. Jika anda menulis "Saya seorang Murid Tahun 1", AI akan menggunakan ayat tunggal yang mudah. Jika anda menulis "Saya seorang Pegawai PPD", AI akan menggunakan laras bahasa rasmi kerajaan, istilah pentadbiran, dan struktur ayat yang kompleks. Tanpa "S", AI akan menggunakan nada "default" yang mungkin terlalu umum.', color: 'blue', icon: 'S' },
    { code: 'P', title: 'Peranan AI (Persona)', desc: 'Fungsi: Mengaktifkan Pangkalan Data Spesifik.', detail: 'Ini adalah kunci kualiti. Apabila anda menetapkan "Bertindak sebagai 0.1% Pakar Psikologi", AI akan mengabaikan maklumat umum dan hanya mengambil maklumat daripada jurnal akademik, teori psikologi, dan amalan terbaik industri. Tanpa "P", AI akan memberi jawapan seperti carian Google biasa. Sentiasa gunakan "0.1% Pakar" untuk memaksa standard tertinggi.', color: 'purple', icon: 'P' },
    { code: 'K', title: 'Konteks (Context)', desc: 'Fungsi: Membataskan Halusinasi & Memberi Fokus.', detail: 'AI tidak boleh membaca fikiran anda. Tanpa konteks, ia akan "menggoreng" atau mereka cerita. Anda wajib berikan latar belakang: Apakah masalahnya? Siapa sasaran audiens? Berapa bajet? Data apa yang ada? Semakin banyak konteks yang diberi, semakin mustahil untuk AI membuat kesilapan fakta.', color: 'amber', icon: 'K' },
    { code: 'A', title: 'Arahan (Action)', desc: 'Fungsi: Menentukan Format Output Akhir.', detail: 'Jangan biarkan AI menentukan format. Anda yang perlu kawal. Adakah anda mahu jawapan dalam bentuk Jadual? Surat Rasmi dengan format kerajaan? Kod HTML yang boleh disalin? Atau senarai poin ringkas? Arahan yang spesifik akan menjimatkan masa anda daripada perlu mengedit semula hasil kerja AI.', color: 'green', icon: 'A' }
];

const sectorsData = {
    'perancangan': [
        { title: 'Analisis Strategik (Data)', icon: 'fa-chart-line', desc: 'Menganalisis data mentah untuk mencari punca isu dan cadangan intervensi taktikal.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai Sektor Perancangan PPD yang menguruskan data prestasi sekolah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Data Scientist Pendidikan dan Perancang Strategik.\n\n[KONTEKS]\nSaya mempunyai data kehadiran murid sekolah luar bandar yang merosot sebanyak 15% khususnya pada hari Khamis (Hari Kokurikulum). Data juga menunjukkan 40% murid ini datang dari keluarga B40.\n\n[ARAHAN]\nSila buat analisis punca kemungkinan (Root Cause Analysis) dan cadangkan 3 program intervensi yang kos rendah tetapi berimpak tinggi. Bentangkan jawapan dalam format: Isu, Punca, dan Cadangan Penyelesaian.' },
        { title: 'Bina OPPM Projek', icon: 'fa-table', desc: 'Menghasilkan rangka kandungan lengkap untuk One Page Project Manager.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai Perancangan yang mengetuai projek khas.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Pengurusan Projek (PMP Certified).\n\n[KONTEKS]\nProgram "STEM Untuk Semua" akan dijalankan di peringkat daerah selama 6 bulan bermula Januari hingga Jun. Objektif utama adalah meningkatkan minat murid dalam Sains.\n\n[ARAHAN]\nBina kandungan teks lengkap untuk dimasukkan ke dalam OPPM. Sila senaraikan: 1. Objektif Projek, 2. Senarai 10 Tugasan Utama (Milestones), 3. Tarikh Sasaran bagi setiap tugas, 4. Anggaran Kos, dan 5. Pegawai Bertanggungjawab.' },
        { title: 'Sistem Dashboard KPI', icon: 'fa-code', desc: 'Menjana kod HTML untuk kalkulator unjuran pencapaian sekolah (TOV/ETR).', type: 'system', content: '[SIAPA SAYA]\nSaya Pegawai PPD yang mahukan alat digital mudah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Senior Web Developer & UI/UX Designer.\n\n[KONTEKS]\nSaya perlukan satu alat mudah untuk sekolah mengira unjuran KPI mereka tanpa perlu membuka Excel yang berat.\n\n[ARAHAN]\nHasilkan satu fail HTML tunggal yang mengandungi "Dashboard Unjuran KPI".\nCiri-ciri sistem:\n1. Input untuk TOV (Take Off Value) dan ETR (Expected Target Result).\n2. Butang "Kira Lonjakan".\n3. Paparan graf bar mudah menggunakan CSS (tanpa library berat) yang membandingkan TOV dan ETR.\n4. Kiraan automatik peratus peningkatan.\n5. Reka bentuk mestilah moden, bersih, dan profesional.' }
    ],
    'pembelajaran': [
        { title: 'Inovasi RPH PAK-21', icon: 'fa-book-open', desc: 'Mencipta set induksi dan aktiviti pembelajaran yang kreatif.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai SISC+ yang membimbing guru di sekolah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Pedagogi Abad Ke-21 dan Psikologi Kanak-kanak.\n\n[KONTEKS]\nTopik pengajaran adalah Sains Tahun 4 (Proses Fotosintesis). Masalah utama ialah murid berasa bosan dengan kaedah syarahan guru.\n\n[ARAHAN]\nCadangkan 3 aktiviti pembelajaran "Hands-on" yang menggunakan bahan kitar semula. Setiap aktiviti mesti mempunyai elemen kolaboratif (kerja kumpulan) dan pergerakan fizikal. Sediakan juga satu idea set induksi "Wow Factor" untuk memulakan kelas.' },
        { title: 'Modul Intervensi TP1-TP2', icon: 'fa-user-check', desc: 'Strategi memulihkan murid lemah dengan pendekatan terbeza.', type: 'normal', content: '[SIAPA SAYA]\nSaya Guru Pemulihan Khas.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Pendidikan Khas dan Psikologi Pendidikan.\n\n[KONTEKS]\nSaya ada 5 orang murid yang masih tidak menghafal sifir 6 hingga 9 walaupun sudah Tahun 5. Mereka mempunyai gaya pembelajaran kinestetik (suka bergerak).\n\n[ARAHAN]\nRangkakan satu modul intervensi intensif selama 4 minggu. Modul ini mesti menggunakan teknik "Gamifikasi Fizikal" (permainan sebenar, bukan digital). Berikan jadual aktiviti minggu demi minggu berserta cara penilaian kejayaan.' },
        { title: 'Web Kuiz Interaktif', icon: 'fa-gamepad', desc: 'Menjana kod HTML untuk kuiz latihan tubi murid yang menyeronokkan.', type: 'system', content: '[SIAPA SAYA]\nSaya Guru ICT dan Matematik.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Game Developer dan Web Designer.\n\n[KONTEKS]\nSaya mahu murid Tahap 1 berlatih mencongak (tambah dan tolak) dengan cara yang seronok di makmal komputer.\n\n[ARAHAN]\nHasilkan kod HTML tunggal yang lengkap untuk "Kuiz Matematik Angkasa".\nCiri-ciri:\n1. Latar belakang bertema angkasa lepas.\n2. Soalan matematik mudah (tambah/tolak) yang dijana secara rawak.\n3. Sistem markah: +10 jika betul, -5 jika salah.\n4. Bunyi efek (gunakan URL audio percuma) apabila menjawab.\n5. Paparan "Game Over" dan markah akhir selepas 10 soalan.' }
    ],
    'murid': [
        { title: 'Program Motivasi Gen-Z', icon: 'fa-fire', desc: 'Modul sahsiah yang segar dan tidak membosankan untuk remaja.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai Hal Ehwal Murid (HEM).\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Motivasi Remaja dan Pembangunan Modal Insan.\n\n[KONTEKS]\nSekolah ingin mengadakan program "Jom Sekolah" untuk menangani isu ponteng tegar. Sasaran adalah murid Tingkatan 3 & 4 (Gen Z) yang anti-ceramah dan cepat bosan.\n\n[ARAHAN]\nBerikan tentatif program setengah hari yang berkonsepkan "Explorace" dan "Team Bonding". Senaraikan 5 stesen aktiviti yang memerlukan penyelesaian masalah berkumpulan. Berikan nama aktiviti yang "Catchy" dan relevan dengan jiwa muda.' },
        { title: 'Skrip Kaunseling Empati', icon: 'fa-comments', desc: 'Skrip perbualan profesional untuk menangani isu sensitif.', type: 'normal', content: '[SIAPA SAYA]\nSaya Guru Bimbingan dan Kaunseling.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Terapi Keluarga dan Komunikasi Krisis.\n\n[KONTEKS]\nSeorang ibu bapa datang ke sekolah dalam keadaan marah kerana anaknya didenda (rotan) oleh guru disiplin. Situasi tegang.\n\n[ARAHAN]\nSediakan skrip dialog langkah demi langkah untuk saya (Kaunselor) bagi menenangkan ibu bapa tersebut. Gunakan teknik "Active Listening" dan "Empathy validation". Skrip mesti sopan, profesional, tetapi tegas dalam mempertahankan prosedur sekolah.' },
        { title: 'Ujian Personaliti Web', icon: 'fa-heart', desc: 'Sistem HTML untuk murid menyemak kecenderungan minat kerjaya.', type: 'system', content: '[SIAPA SAYA]\nSaya Kaunselor Sekolah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Web Developer.\n\n[KONTEKS]\nMurid Tingkatan 3 sering keliru untuk memilih aliran (Sains/Sastera/TVET). Saya perlukan alat saringan awal yang pantas.\n\n[ARAHAN]\nHasilkan kod HTML tunggal yang lengkap untuk "Ujian Minat Kerjaya Mini".\nCiri-ciri:\n1. Mengandungi 10 soalan Ya/Tidak mengenai minat (Cth: Suka baiki barang? Suka melukis?).\n2. Logik mudah di belakang tabir untuk mengira skor.\n3. Paparan keputusan akhir yang mencadangkan aliran (Sains / Akaun / TVET) berdasarkan jawapan terbanyak.\n4. Reka bentuk yang mesra pengguna.' }
    ],
    'sekolah': [
        { title: 'Penulisan Memo Rasmi', icon: 'fa-file-signature', desc: 'Menghasilkan surat pentadbiran yang gramatis, tegas dan berhemah.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai Sektor Pengurusan Sekolah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Bahasa Melayu Tinggi dan Pentadbiran Awam.\n\n[KONTEKS]\nTerdapat aduan mengenai segelintir guru yang tidak mematuhi etika pemakaian penjawat awam semasa bertugas. PPD perlu mengeluarkan peringatan.\n\n[ARAHAN]\nDrafkan satu memo dalaman rasmi yang bertajuk "PERINGATAN PEMATUHAN ETIKA BERPAKAIAN". Nada memo mestilah tegas tetapi menyantuni. Sila petik rujukan pekeliling ikhtisas yang berkaitan sebagai sandaran kuasa.' },
        { title: 'Teks Ucapan Protokol', icon: 'fa-microphone', desc: 'Teks ucapan perasmi yang lengkap dengan pantun dan protokol.', type: 'normal', content: '[SIAPA SAYA]\nSaya Pegawai PPD yang mewakili Tuan PPD.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Penulis Ucapan Profesional Diraja/Kerajaan.\n\n[KONTEKS]\nMajlis Perasmian Mesyuarat Agung PIBG di sebuah sekolah luar bandar. Audiens terdiri daripada ibu bapa kampung dan guru-guru.\n\n[ARAHAN]\nSediakan teks ucapan perasmian sepanjang 5 minit bacaan. Struktur ucapan:\n1. Kata aluan protokol.\n2. Pantun pembuka yang indah.\n3. Isi utama: Pentingnya kerjasama ibu bapa dalam era pendidikan digital.\n4. Penutup dengan harapan dan pantun akhir.' },
        { title: 'Kalkulator Cuti (CRK)', icon: 'fa-calendar-check', desc: 'Sistem HTML untuk menyemak baki kelayakan Cuti Rehat Khas.', type: 'system', content: '[SIAPA SAYA]\nSaya Pembantu Tadbir (Kerani) Sekolah.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Web Developer.\n\n[KONTEKS]\nGuru-guru sering bertanya baki Cuti Rehat Khas (CRK) mereka dan saya sukar untuk mengira setiap kali.\n\n[ARAHAN]\nHasilkan satu fail HTML mudah bertajuk "Kalkulator CRK Guru".\nFungsi:\n1. Paparkan kelayakan tahunan tetap (Contoh: 15 hari).\n2. Ruang input untuk guru masukkan jumlah cuti yang telah diambil.\n3. Butang "Semak Baki".\n4. Paparan baki terkini.\n5. Jika baki bawah 3 hari, keluarkan amaran teks berwarna merah "Baki Kritikal!".' }
    ],
    'akp': [
        { title: 'Minit Mesyuarat', icon: 'fa-file-contract', desc: 'Format minit mesyuarat kerajaan yang standard dan tepat.', type: 'normal', content: '[SIAPA SAYA]\nSaya Setiausaha Pejabat di PPD.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Pakar Dokumentasi Rasmi Kerajaan.\n\n[KONTEKS]\nSaya ada nota ringkas dari mesyuarat pagi tadi:\n- Pengerusi marah sebab aset lama belum lupus.\n- Kewangan baki tinggal RM200 sahaja.\n- Program lawatan 15hb ditunda ke bulan depan.\n\n[ARAHAN]\nTukarkan nota ringkas ini menjadi Minit Mesyuarat penuh yang profesional. Gunakan format: Perutusan Pengerusi, Perkara Berbangkit, Pembentangan Kertas Kerja, dan Hal-hal Lain. Pastikan ayat adalah ayat pasif dan gramatis (Contoh: "Mesyuarat mengambil maklum...").' },
        { title: 'Surat Panggilan Rasmi', icon: 'fa-envelope', desc: 'Menjana surat jemputan mesyuarat dengan butiran lengkap.', type: 'normal', content: '[SIAPA SAYA]\nSaya AKP Unit Pentadbiran.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Penulis Surat Rasmi.\n\n[KONTEKS]\nSatu mesyuarat tergempar Jawatankuasa Kewangan Bil 1/2025 perlu diadakan. Tarikh: 20 Februari, Masa: 9.00 pagi, Tempat: Bilik Wawasan.\n\n[ARAHAN]\nSediakan surat panggilan mesyuarat rasmi kepada semua Ketua Unit. Surat mesti mengandungi agenda tentatif mesyuarat dan arahan supaya membawa laporan perbelanjaan terkini.' },
        { title: 'Sistem Stok Pejabat', icon: 'fa-box-open', desc: 'Sistem HTML mudah untuk merekod keluar masuk barang stor.', type: 'system', content: '[SIAPA SAYA]\nSaya Pegawai Aset & Stor.\n\n[PERANAN AI]\nBertindak sebagai 0.1% Software Engineer.\n\n[KONTEKS]\nSaya perlukan sistem sangat mudah untuk rekod stok kertas A4 di pejabat.\n\n[ARAHAN]\nHasilkan satu fail HTML tunggal "Sistem e-Stok Pejabat".\nFungsi:\n1. Paparan jumlah baki stok semasa.\n2. Butang "Stok Masuk (IN)" untuk tambah jumlah.\n3. Butang "Stok Keluar (OUT)" untuk tolak jumlah.\n4. Senarai log sejarah transaksi di bahagian bawah (Masa & Jumlah).\n5. Gunakan LocalStorage supaya data tidak hilang apabila browser ditutup.' }
    ]
};

const keywordsData = [
    { title: 'Step-by-step', sub: 'Think step-by-step', desc: 'Memaksa AI berfikir secara urutan logik. Sangat penting untuk soalan Matematik, Coding, atau perancangan strategi.', example: 'Kira implikasi kewangan projek ini langkah demi langkah supaya tiada kesilapan pengiraan.' },
    { title: 'ELI5', sub: 'Explain Like I\'m 5', desc: 'Minta AI terangkan topik yang sangat kompleks (seperti Blockchain atau AI) menggunakan bahasa budak tadika.', example: 'Terangkan teknologi Cloud Computing seperti saya berumur 5 tahun.' },
    { title: 'Format Jadual', sub: 'Present in Table format', desc: 'Menukar perenggan teks yang serabut kepada jadual yang kemas untuk perbandingan data.', example: 'Bandingkan perbezaan tugas Guru Data dan Guru ICT dalam format jadual.' },
    { title: 'Kod Siap Tampal', sub: 'Full runnable code', desc: 'Mengelakkan AI memberi kod sekerat-sekerat. Wajib guna untuk tugasan HTML, Excel Formula, atau Python.', example: 'Bina borang kehadiran HTML. Hasilkan kod penuh siap tampal dan sedia digunakan.' },
    { title: 'Kritik Kendiri', sub: 'Critique your own work', desc: 'Menyuruh AI menyemak semula jawapannya sendiri sebelum diberikan kepada anda. Mengurangkan risiko fakta salah.', example: 'Selepas buat draf surat ini, kritik hasil kerja anda sendiri dan cari kesalahan tatabahasa.' },
    { title: 'Guna Analogi', sub: 'Use an analogy', desc: 'Meminta AI mengaitkan konsep baru dengan benda yang kita sudah biasa (seperti dapur, kereta, sukan).', example: 'Terangkan fungsi CPU komputer menggunakan analogi dapur restoran.' },
    { title: 'Pengkritik Tegas', sub: 'Act as Devil\'s Advocate', desc: 'Meminta AI mencari kelemahan, lubang, atau risiko dalam idea/kertas kerja kita.', example: 'Bertindak sebagai pengkritik tegas, senaraikan 5 kelemahan dalam kertas kerja cadangan saya ini.' },
    { title: 'Kekalkan Format', sub: 'Maintain original formatting', desc: 'Penting apabila anda mahu AI meringkaskan teks tetapi jangan ubah struktur (seperti bullet points).', example: 'Ringkaskan teks laporan ini tetapi kekalkan format bullet points asal.' }
];

const rawQuizData = [
    {
        q: "Apakah maksud huruf 'S' dalam akronim S.P.K.A?",
        options: ["Saya (Siapa Saya)", "Situasi", "Solusi", "Sistem"],
        correct: "Saya (Siapa Saya)",
        explanation: "'S' merujuk kepada 'Siapa Saya' (Identity). Ia menentukan laras bahasa dan tahap komunikasi AI."
    },
    {
        q: "Mengapakah bahagian 'P' (Persona) sangat penting dalam prompt?",
        options: ["Untuk AI mengakses pangkalan data pakar spesifik", "Untuk menjadikan AI lebih mesra", "Supaya AI menjawab dengan pantas", "Tiada fungsi khusus"],
        correct: "Untuk AI mengakses pangkalan data pakar spesifik",
        explanation: "Persona '0.1% Pakar' memaksa AI mengabaikan maklumat umum dan hanya mengambil input daripada sumber berkualiti tinggi."
    },
    {
        q: "Dalam analogi memesan makanan, siapakah yang mewakili 'AI'?",
        options: ["Tukang Masak (Chef)", "Pelanggan yang lapar", "Menu makanan", "Pelayan restoran"],
        correct: "Tukang Masak (Chef)",
        explanation: "AI adalah 'Tukang Masak'. Jika arahan anda tidak jelas (tiada resipi), dia akan meneka masakan."
    },
    {
        q: "Apakah risiko utama jika kita tidak memberikan 'K' (Konteks) kepada AI?",
        options: ["AI akan meneka dan berhalusinasi (fakta salah)", "AI akan berhenti berfungsi", "AI akan memberi jawapan terlalu pendek", "AI akan meminta bayaran tambahan"],
        correct: "AI akan meneka dan berhalusinasi (fakta salah)",
        explanation: "Tanpa konteks (latar belakang masalah), AI terpaksa meneka fakta. Ini dipanggil 'Halusinasi AI'."
    },
    {
        q: "Apakah fungsi bahagian 'A' (Arahan) dalam S.P.K.A?",
        options: ["Menentukan format output akhir", "Memberitahu nama kita", "Menentukan kelajuan internet", "Memilih bahasa pengaturcaraan"],
        correct: "Menentukan format output akhir",
        explanation: "Arahan menentukan rupa bentuk jawapan. Adakah anda mahu Jadual, Kod, Surat Rasmi, atau Poin?"
    },
    {
        q: "Kata kunci 'Power' manakah yang digunakan untuk meminta AI menerangkan sesuatu seperti kepada kanak-kanak?",
        options: ["ELI5 (Explain Like I'm 5)", "Step-by-step", "Devil's Advocate", "Critique your work"],
        correct: "ELI5 (Explain Like I'm 5)",
        explanation: "ELI5 mengarahkan AI menggunakan bahasa yang sangat mudah dan analogi ringkas untuk menerangkan konsep rumit."
    },
    {
        q: "Jika anda mahu AI menyemak kesilapan dalam jawapannya sendiri, apakah arahan yang sesuai?",
        options: ["Critique your own work", "Please hurry up", "Write more details", "Use analogy"],
        correct: "Critique your own work",
        explanation: "Teknik 'Critique your own work' memaksa AI melalui proses berfikir kali kedua untuk mengurangkan ralat."
    },
    {
        q: "Mengapakah kita disarankan menggunakan frasa '0.1% Pakar' dalam Persona?",
        options: ["Untuk memaksa AI menggunakan standard kualiti tertinggi", "Supaya AI berasa bangga", "Kerana ia kod rahsia Google", "Untuk menjimatkan token AI"],
        correct: "Untuk memaksa AI menggunakan standard kualiti tertinggi",
        explanation: "Frasa ini adalah teknik psikologi prompt (priming) untuk menetapkan 'standard' bahawa jawapan biasa tidak diterima."
    },
    {
        q: "Manakah antara berikut BUKAN sebahagian daripada S.P.K.A?",
        options: ["Analisis", "Siapa Saya", "Peranan", "Konteks"],
        correct: "Analisis",
        explanation: "Akronim yang betul ialah S (Siapa), P (Peranan), K (Konteks), dan A (Arahan). Analisis bukan sebahagian daripada struktur asas."
    },
    {
        q: "Untuk tugasan Matematik atau Coding, kata kunci manakah yang paling kritikal?",
        options: ["Think step-by-step", "Be creative", "Act as a poet", "Summarize this"],
        correct: "Think step-by-step",
        explanation: "'Think step-by-step' (Chain of Thought) menghalang AI daripada melompat terus ke jawapan. Ia memaksa pengiraan satu persatu."
    }
];