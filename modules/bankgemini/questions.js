/**
 * GEMINI CERTIFICATION FOR EDUCATORS - DATA SOURCE
 * Fail ini mengandungi bank soalan sahaja.
 * Mudah untuk diselenggara tanpa mengganggu logik aplikasi.
 */

const rawData = [
    // --- KATEGORI: NOTEBOOKLM ---
    { 
        id: 1, 
        category: "NotebookLM", 
        question: "A teacher would like help creating a mind map on a topic, which they have a number of existing resources for. Which tool could they use?", 
        answer: "NotebookLM", 
        note: "NotebookLM ialah alat terbaik untuk mensintesis maklumat daripada sumber sedia ada (PDF, Dokumen) menjadi format baharu seperti peta minda atau jadual." 
    },
    { 
        id: 2, 
        category: "NotebookLM", 
        question: "An English teacher wants to help students with different reading abilities understand a story the teacher has written. After uploading the story to NotebookLM, what is the best way to support all learners?", 
        answer: "Ask NotebookLM to generate multiple summaries of the story, each tailored to a different reading level.", 
        note: "Ini adalah strategi 'Differentiation'. AI boleh mengubah suai teks yang sama kepada pelbagai tahap kesukaran (Lexile levels) untuk pelajar pemulihan hingga pengayaan." 
    },
    { 
        id: 3, 
        category: "NotebookLM", 
        question: "When NotebookLM answers a question based on the sources you've uploaded, how does it help you verify the information?", 
        answer: "It provides inline citations that link directly to the relevant passages in your sources.", 
        note: "Ciri 'Citations' (nombor kecil di hujung ayat) membolehkan guru menyemak ketepatan fakta terus daripada dokumen asal, mengelakkan risiko halusinasi." 
    },
    { 
        id: 4, 
        category: "NotebookLM", 
        question: "Which of the following data sources can be used in NotebookLM? (Select all which apply)", 
        answer: "Web Pages, Google Docs, Copied Text, PDF, Google Slides", 
        note: "NotebookLM sangat fleksibel. Anda boleh muat naik PDF, salin teks (clipboard), pautkan laman web, atau ambil terus dari Google Drive (Docs/Slides)." 
    },
    { 
        id: 5, 
        category: "NotebookLM", 
        question: "Audio Overviews in NotebookLM can be downloaded for use outside of the notebook.", 
        answer: "True", 
        note: "Perbualan audio (podcast) yang dijana boleh dimuat turun sebagai fail .WAV/.MP3 untuk dikongsi kepada pelajar atau didengar semasa memandu." 
    },
    { 
        id: 6, 
        category: "NotebookLM", 
        question: "You can upload an MP3 file to NotebookLM.", 
        answer: "True", 
        note: "Terkini: NotebookLM kini boleh 'mendengar' fail audio (seperti rakaman mesyuarat atau kuliah) dan menjana transkrip serta ringkasan daripadanya." 
    },
    { 
        id: 7, 
        category: "NotebookLM", 
        question: "An educator is starting a large research project with dozens of articles and notes. How would NotebookLM be most beneficial in the initial stages?", 
        answer: "By synthesizing information across all uploaded documents to help them find connections and draft an outline.", 
        note: "Daripada membaca satu per satu, NotebookLM boleh membaca kesemua 50+ dokumen serentak dan mencari tema persamaan (connections) untuk anda." 
    },
    { 
        id: 8, 
        category: "NotebookLM", 
        question: "A teacher uploads a one-page article on the lifecycle of a butterfly to NotebookLM. To help their class understand the key terms, what is the most effective use of the tool?", 
        answer: "Ask NotebookLM to 'Generate a list of 5 key vocabulary words from the article and provide their definitions in simple terms'", 
        note: "Guru boleh menjimatkan masa dengan meminta AI mengeluarkan glosari atau senarai istilah penting terus daripada bahan bacaan." 
    },
    { 
        id: 9, 
        category: "NotebookLM", 
        question: "An educator wants to get a quick, audible summary of a lengthy research paper they've uploaded to NotebookLM while they are multitasking. Which feature should they use?", 
        answer: "Audio Overview", 
        note: "Audio Overview menukar dokumen teks yang bosan kepada format perbualan dua hala yang menarik dan mudah dihadam secara auditori." 
    },
    { 
        id: 57, 
        category: "NotebookLM", 
        question: "You can customize the Audio Overview in NotebookLM to make the length shorter or longer.", 
        answer: "True", 
        note: "Guru kini boleh memberi arahan kepada hos AI (cth: 'Fokus hanya pada topik X' atau 'Buat ringkasan pendek') sebelum menjana audio." 
    },
    { 
        id: 58, 
        category: "NotebookLM", 
        question: "An educator has joined a new school and needs to understand a number of new school policies. How can NotebookLM help?", 
        answer: "Use Audio Overview, Create Study Guide, Create FAQ", 
        note: "Satu sumber (Buku Polisi) boleh ditukar kepada pelbagai format pembelajaran mengikut gaya belajar guru tersebut (Audio, Teks, atau Soalan Lazim)." 
    },
    { 
        id: 60, 
        category: "NotebookLM", 
        question: "A parent sends an email with several specific questions about the school's new BYOD policy. To ensure the response is accurate using NotebookLM:", 
        answer: "Ask it to 'Create an FAQ based on the source that directly answers the parent's list of specific questions.'", 
        note: "Teknik ini memastikan jawapan kepada ibu bapa adalah konsisten dengan buku peraturan sekolah, tanpa perlu menaip semula secara manual." 
    },
    { 
        id: 61, 
        category: "NotebookLM", 
        question: "An educator has several PDF articles related to a new research topic. Which method using NotebookLM is most efficient for quickly understanding main points?", 
        answer: "Upload the PDF articles to NotebookLM, and ask it to generate summaries and identify key topics.", 
        note: "Cara terpantas untuk melakukan tinjauan literatur (literature review) tanpa perlu membaca keseluruhan teks pada peringkat awal." 
    },
    { 
        id: 38, 
        category: "NotebookLM", 
        question: "The school's administrative assistant is responsible for organizing the logistics for three different end-of-year field trips... What is the most effective way for them to create a master schedule?", 
        answer: "Ask NotebookLM to 'Create a master timeline in a table format, extracting the departure times, arrival times, and venue contact numbers...'", 
        note: "NotebookLM sangat hebat dalam mengekstrak data tidak berstruktur (emel/surat) kepada bentuk jadual yang kemas untuk rujukan admin." 
    },
    { 
        id: 48, 
        category: "NotebookLM", 
        question: "An educator has uploaded a collection of articles... They want to explore various ways students could demonstrate their understanding (project formats).", 
        answer: "Use NotebookLM's chat feature to ask it for different potential project formats (like essays, presentations...) based on the content...", 
        note: "AI bertindak sebagai 'Rakan Pemikir' (Thought Partner) untuk mencadangkan idea pedagogi (PBL) yang relevan dengan bahan sumber." 
    },

    // --- KATEGORI: ETIKA & KESELAMATAN AI ---
    { 
        id: 10, 
        category: "Etika & Keselamatan AI", 
        question: "A science teacher integrates Gemini into their lesson planning process... The teacher then uses these materials directly with students without thoroughly reviewing the AI's output. What risks does this cause?", 
        answer: "The AI-generated content could contain factual inaccuracies, which are then passed to the student.", 
        note: "PEMBETULAN PENTING: Risiko utama bukan sekadar 'tahap bahasa', tetapi fakta sains yang salah (Hallucination) yang boleh menyesatkan pelajar jika tidak disemak." 
    },
    { 
        id: 11, 
        category: "Etika & Keselamatan AI", 
        question: "An English teacher uses Gemini to generate a list of essay topics... The AI provides a list that includes some potentially controversial topics, what should they do?", 
        answer: "Critically review each topic for its age-appropriateness, potential to foster respectful debate, factual neutrality, and any inherent biases.", 
        note: "Peranan guru sebagai penapis (gatekeeper) adalah wajib. AI tidak mempunyai pertimbangan moral atau konteks budaya setempat." 
    },
    { 
        id: 12, 
        category: "Etika & Keselamatan AI", 
        question: "A history teacher wants to implement a strategy to help students develop AI literacy... Which strategy would be most effective?", 
        answer: "Engaging students in an activity where they compare and contrast AI-generated summaries... actively identifying discrepancies, biases.", 
        note: "Ini adalah kemahiran aras tinggi: Mengajar pelajar untuk TIDAK mempercayai AI sepenuhnya, tetapi menilainya secara kritis (AI Auditing)." 
    },
    { 
        id: 13, 
        category: "Etika & Keselamatan AI", 
        question: "When AI chatbots generate false, nonsensical, or misleading outputs that seem believable, these errors are referred to as what?", 
        answer: "Hallucinations", 
        note: "Istilah rasmi apabila AI 'menggoreng' jawapan. Ia kelihatan yakin, tetapi faktanya direka cipta." 
    },
    { 
        id: 14, 
        category: "Etika & Keselamatan AI", 
        question: "When an AI system shows a tendency to produce results that are systematically prejudiced due to the data it was trained on, this is known as:", 
        answer: "Bias", 
        note: "Data AI datang dari internet. Jika internet ada bias (contoh: stereotaip jantina), AI mungkin akan meniru bias tersebut." 
    },
    { 
        id: 15, 
        category: "Etika & Keselamatan AI", 
        question: "Gemini on a Google Workspace for Education account doesn't use your data to train the model.", 
        answer: "True", 
        note: "PENTING: Akaun sekolah (Education Plus/Fundamentals) mempunyai perlindungan data gred enterprise. Data anda TIDAK digunakan untuk melatih AI Google." 
    },
    { 
        id: 16, 
        category: "Etika & Keselamatan AI", 
        question: "Which of the following would be appropriate content for simple classroom guidelines on the responsible and ethical use of generative AI?", 
        answer: "A guideline requiring students to explicitly cite AI tools when used for brainstorming or drafting.", 
        note: "Integriti akademik bukan bermaksud 'haramkan AI', tetapi 'mengaku' bila dan bagaimana ia digunakan (Attribution)." 
    },
    { 
        id: 17, 
        category: "Etika & Keselamatan AI", 
        question: "A teacher asks a generative AI to summarize a historical event... implies a specific date is incorrect. What is the best way to handle this situation?", 
        answer: "Treat the incorrect date as a likely hallucination and fact-check the information using reliable, primary sources.", 
        note: "Jangan sesekali 'Re-prompt' (tanya semula) dan harap ia jadi betul. Terus semak dengan buku teks atau sumber sahih." 
    },
    { 
        id: 52, 
        category: "Etika & Keselamatan AI", 
        question: "A teacher is concerned a student may have used Generative AI to complete their work. What tools within Google Workspace could they use?", 
        answer: "Use Version History to see the creation process over time.", 
        note: "Jika pelajar 'Copy-Paste' esei penuh dalam 1 saat, Version History akan menunjukkannya. Esei tulisan asli ada 'history' suntingan yang panjang." 
    },

    // --- KATEGORI: PROMPTING (ARAHAN) ---
    { 
        id: 18, 
        category: "Prompting (Arahan)", 
        question: "What are the four main areas to consider when writing an effective prompt?", 
        answer: "Persona, Task, Context, and Format", 
        note: "Formula Google untuk prompt hebat: Siapa AI itu (Persona), Apa dia kena buat (Task), Untuk siapa/situasi apa (Context), dan Bentuk jawapan (Format)." 
    },
    { 
        id: 19, 
        category: "Prompting (Arahan)", 
        question: "An administrator at a school needs help drafting a job description for a new teaching position. Which approach using Gemini is most likely to streamline this task?", 
        answer: "Enter a prompt in Gemini, acting as an Education HR specialist, requesting a job description... including required skills.", 
        note: "Menggunakan Persona 'Pakar HR Pendidikan' akan menghasilkan laras bahasa yang lebih profesional berbanding prompt kosong." 
    },
    { 
        id: 20, 
        category: "Prompting (Arahan)", 
        question: "An educator wants to explore different teaching techniques for differentiation... Which of these Gemini prompts would be most appropriate?", 
        answer: "I am an experienced middle school teacher, help me create a list of strategies to help support me to meet the needs of all of my students in my mixed ability classroom.", 
        note: "Prompt yang baik sentiasa memberi konteks (mixed ability classroom) supaya AI tidak bagi nasihat umum yang tidak praktikal." 
    },
    { 
        id: 44, 
        category: "Prompting (Arahan)", 
        question: "A teacher is planning a new unit on renewable energy... How could they use Gemini as a thought partner?", 
        answer: "Enter a prompt in Gemini describing the unit topic and grade level, and ask it to generate lesson ideas and activities", 
        note: "Gunakan AI untuk 'Brainstorming' idea awal, bukan untuk buat kerja akhir. Ia menjimatkan masa merangka RPH." 
    },
    { 
        id: 46, 
        category: "Prompting (Arahan)", 
        question: "A teacher wants to create a unique, imaginative, or thought-provoking poetry prompt...", 
        answer: "Input a prompt in Gemini requesting a unique... poetry prompt, specifying the grade level and desired theme.", 
        note: "Spesifikasikan 'Tema' dan 'Gred' adalah kunci untuk mendapatkan bahan sastera yang sesuai dengan umur pelajar." 
    },
    { 
        id: 51, 
        category: "Prompting (Arahan)", 
        question: "To help geometry students overcome common misconceptions about finding the area of triangles... how can an educator best prompt Gemini?", 
        answer: "Act as a highly skilled high school math teacher... provide 3-4 model responses addressing common student errors...", 
        note: "Meminta AI menjana 'Contoh Kesalahan Lazim' adalah teknik ampuh untuk guru bersedia sebelum masuk kelas." 
    },
    { 
        id: 56, 
        category: "Prompting (Arahan)", 
        question: "What is the main purpose of a 'prompt' when interacting with an AI?", 
        answer: "To give the AI a specific instruction, question, or task to perform.", 
        note: "Kualiti jawapan AI bergantung 100% kepada kualiti 'Prompt' (Arahan) yang anda berikan. Garbage in, garbage out." 
    },

    // --- KATEGORI: CIRI-CIRI GEMINI ---
    { 
        id: 21, 
        category: "Ciri Gemini", 
        question: "After generating an output, what does the 'Sources' button in Gemini do?", 
        answer: "Shows the websites used to create the content.", 
        note: "Butang ini penting untuk literasi maklumat - ia menunjukkan dari mana Gemini 'membaca' maklumat tersebut." 
    },
    { 
        id: 22, 
        category: "Ciri Gemini", 
        question: "What does the 'Double Check Response' feature in Gemini allow you to do?", 
        answer: "Explore the data sources for the answer from the web.", 
        note: "Ikon 'G' berwarna warni. Ia akan melakukan carian Google kedua untuk mengesahkan sama ada ayat AI itu fakta (hijau) atau tiada sumber (oren)." 
    },
    { 
        id: 23, 
        category: "Ciri Gemini", 
        question: "You can create an image using Gemini.", 
        answer: "True", 
        note: "Gemini menggunakan model Imagen 3 untuk menjana gambar berkualiti tinggi daripada teks." 
    },
    { 
        id: 24, 
        category: "Ciri Gemini", 
        question: "Which of the following describes how Create images works within Gemini?", 
        answer: "It generates images from text prompts.", 
        note: "Anda menaip deskripsi (cth: 'Kucing naik basikal'), dan AI melukisnya dari kosong (bukan cari gambar Google Images)." 
    },
    { 
        id: 25, 
        category: "Ciri Gemini", 
        question: "Which of the following tools are available in Gemini? (Select all)", 
        answer: "Canvas, Create Image, Guided Learning", 
        note: "Gemini bukan sekadar Chatbot teks. Ia ada mod visual (Image), mod kerja panjang (Canvas), dan mod belajar (Guided Learning)." 
    },
    { 
        id: 26, 
        category: "Ciri Gemini", 
        question: "You can share your Notebooks from NotebookLM with other users in your organisation.", 
        answer: "True", 
        note: "Sama seperti Google Docs, anda boleh 'Share' notebook dengan rakan guru untuk membina bahan bantu mengajar bersama-sama." 
    },
    { 
        id: 27, 
        category: "Ciri Gemini", 
        question: "An educator is using Google Workspace with the Google AI Pro for Education... wants to create a new video for their students based on slides. Which method could be used?", 
        answer: "Open a new Google Vids and select 'Import Slides'", 
        note: "Google Vids ialah aplikasi baru (akan datang sepenuhnya) yang boleh menukar slaid statik kepada video penerangan dengan suara latar AI." 
    },
    { 
        id: 41, 
        category: "Ciri Gemini", 
        question: "What does the 'Share and Export' button in Gemini allow you to do?", 
        answer: "Export to Docs, Draft in Gmail", 
        note: "Jangan 'Copy-Paste' manual. Gunakan butang Export untuk hantar jadual/esei terus ke Google Docs dengan format yang kekal cantik." 
    },
    
    // --- KATEGORI: GEMS & DEEP RESEARCH ---
    { 
        id: 28, 
        category: "Ciri Baru (Gems & Deep Research)", 
        question: "Which of the following features is primarily designed to help create multi-page reports?", 
        answer: "Deep Research", 
        note: "Deep Research bukan carian biasa. Ia boleh melayari puluhan laman web, membaca semuanya, dan menulis laporan panjang yang lengkap dengan rujukan." 
    },
    { 
        id: 29, 
        category: "Ciri Baru (Gems & Deep Research)", 
        question: "Which of the following describes a Gem?", 
        answer: "Gems let you save detailed prompt instructions for your most repeatable tasks so that you can save time when using Gemini.", 
        note: "PEMBETULAN: Gems ialah 'Custom AI' anda. Contoh: Buat Gem bernama 'Guru Disiplin' yang sentiasa menjawab dengan nada tegas dan format surat rasmi." 
    },
    { 
        id: 30, 
        category: "Ciri Baru (Gems & Deep Research)", 
        question: "You can upload your own files to a Gem.", 
        answer: "True", 
        note: "Anda boleh melatih Gem dengan memuat naik 'Buku Panduan Sekolah' supaya ia menjawab berpandukan buku tersebut." 
    },
    { 
        id: 47, 
        category: "Ciri Baru (Gems & Deep Research)", 
        question: "A teacher regularly differentiates lesson plans... How can they use Gemini's 'Gems' feature to save time on this?", 
        answer: "Create a custom 'Gem' in Gemini with pre-set instructions and context for generating lesson plan variations...", 
        note: "Daripada menaip prompt panjang setiap hari, simpan prompt tersebut dalam satu butang Gem bernama 'Perbezaan RPH'." 
    },

    // --- KATEGORI: INTEGRASI WORKSPACE ---
    { 
        id: 31, 
        category: "Integrasi Workspace", 
        question: "Which Google tools offer an integration with Gemini?", 
        answer: "Google Docs, Google Drive, Google Slides, Gmail, Google Meet", 
        note: "Gemini kini wujud di panel sisi (side panel) hampir kesemua aplikasi produktiviti Google." 
    },
    { 
        id: 32, 
        category: "Integrasi Workspace", 
        question: "An educator is using Google Docs with Google AI Pro... allows them to generate new content without leaving Docs.", 
        answer: "True", 
        note: "Gunakan fitur 'Help me write' (ikon pensel bergemerlapan) terus dalam Docs untuk menjana perenggan atau rangka karangan." 
    },
    { 
        id: 33, 
        category: "Integrasi Workspace", 
        question: "An educator is using Gmail with Google AI Pro... generate responses to emails without leaving Gmail.", 
        answer: "True", 
        note: "Fitur 'Help me reply' boleh membaca emel panjang dari ibu bapa dan mencadangkan balasan yang sopan dalam beberapa saat." 
    },
    { 
        id: 34, 
        category: "Integrasi Workspace", 
        question: "To make it easier to share into Google Classroom you can share a link with students in Classroom to direct them to Gemini's Guided Learning Mode.", 
        answer: "True", 
        note: "Pautan terus (direct link) memudahkan pelajar sampai ke aktiviti yang betul tanpa perlu mencari-cari menu." 
    },
    { 
        id: 40, 
        category: "Integrasi Workspace", 
        question: "A school administrator would like to create an email newsletter for parents. Which tool(s) could they use?", 
        answer: "Gemini for Education, Google Docs (with Gemini in Google Docs)", 
        note: "Gabungan Gemini (untuk idea) dan Docs (untuk format) adalah cara terpantas menghasilkan surat berita sekolah." 
    },
    { 
        id: 55, 
        category: "Integrasi Workspace", 
        question: "Which of the following are examples of where AI is used within Google? (Select all)", 
        answer: "Gmail (spam filtering), Google Search (algorithms), Google Maps (routes)", 
        note: "Sebelum AI Generatif (seperti Gemini) wujud, Google sudah lama guna AI Klasik untuk tapis Spam dan kira trafik jalan raya." 
    },

    // --- KATEGORI: KONSEP ASAS & STRATEGI ---
    { 
        id: 35, 
        category: "Konsep Asas AI", 
        question: "What specific type of AI refers to a system which can create new types of content, such as text, images, or video?", 
        answer: "Generative AI", 
        note: "Kata kuncinya ialah 'Generative' (Menjana). Ia mencipta benda baru, bukan sekadar menganalisis data lama." 
    },
    { 
        id: 36, 
        category: "Strategi Pengajaran", 
        question: "A teacher wants their students to use Guided Learning mode in Gemini... which would be the most suitable method?", 
        answer: "Share a direct Guided Learning link into Google Classroom.", 
        note: "Integrasi dengan Google Classroom memastikan semua pelajar bermula di titik yang sama." 
    },
    { 
        id: 37, 
        category: "Strategi Pengajaran", 
        question: "A history teacher has uploaded several primary source documents... wants to find additional related information from the web. Which NotebookLM feature would help?", 
        answer: "The Discover Tool / Web Sources", 
        note: "NotebookLM kini membenarkan anda menambah 'Web URL' sebagai sumber, membolehkan ia menyemak silang dokumen anda dengan internet." 
    },
    { 
        id: 42, 
        category: "Guided Learning", 
        question: "Which of these statements best describes Guided Learning in Gemini?", 
        answer: "Guided Learning allows you to dive deeper into a topic, using open-ended questions to create a learning discussion.", 
        note: "Mod ini direka untuk tidak memberikan jawapan terus, sebaliknya ia menanya soalan kembali kepada pelajar (Socratic Method) untuk menguji kefahaman." 
    },
    { 
        id: 43, 
        category: "Strategi Pengajaran", 
        question: "An educator wants to generate a vocabulary list for their next topic. Which option below would NOT help with this task?", 
        answer: "Use audio overviews in Gemini to create a podcast...", 
        note: "Soalan jenis 'Kecuali'. Podcast adalah audio, ia tidak sesuai untuk menghasilkan senarai ejaan/kosa kata bertulis." 
    },
    { 
        id: 45, 
        category: "Strategi Pengajaran", 
        question: "An educator is looking for practical strategies to increase student leadership... How can they use Gemini to suggest relevant ideas?", 
        answer: "Ask Gemini to create a list of strategies for student leadership opportunities.", 
        note: "Kadangkala prompt yang paling mudah (Direct Instruction) adalah yang paling berkesan untuk mendapatkan senarai idea." 
    },
    { 
        id: 49, 
        category: "Janaan Imej", 
        question: "The students in class have been completing some creative writing on helpful monsters. You want to generate an image...", 
        answer: "'Create a drawing of a monster who likes to eat...' (pilih prompt yang paling deskriptif)", 
        note: "Dalam penjanaan imej, 'Adjectives' (kata sifat) yang banyak menghasilkan gambar yang lebih tepat dan menarik." 
    },
    { 
        id: 50, 
        category: "Strategi Pengajaran", 
        question: "An educator is looking to adapt some text for use by students with a lower reading level. Which method could they use?", 
        answer: "Start a new chat in Gemini. Paste the text and add a prompt, asking Gemini to reduce the reading level of the text.", 
        note: "Tugas ini dipanggil 'Text Levelling'. Ia sangat berguna untuk kelas inklusif di mana tahap bacaan pelajar berbeza-beza." 
    },
    { 
        id: 54, 
        category: "Strategi Pengajaran", 
        question: "A student is struggling to understand a complex concept in chemistry and needs additional support. Arrange the following tasks in order.", 
        answer: "Take image of work -> Upload to Gemini -> Ask to identify misconceptions -> Ask for new problems", 
        note: "Aliran kerja Multimodal: Mula dengan Gambar (Diagnosis), kemudian Teks (Penerangan), kemudian Latihan (Pengukuhan)." 
    },
    
    // --- KATEGORI: CANVAS & CODING ---
    { 
        id: 39, 
        category: "Canvas & Coding", 
        question: "A science teacher wants to create an interactive activity to help their students understand density. Which of the following approaches would be the best?", 
        answer: "Ask Gemini to create a web-based application with Canvas that allows students to adjust the mass and volume of an object...", 
        note: "Guru Sains kini boleh meminta AI membina simulasi fizik ringkas (guna HTML5) tanpa perlu pandai coding." 
    },
    { 
        id: 59, 
        category: "Canvas & Coding", 
        question: "Which of the following can be completed with Canvas in Gemini? (Select all)", 
        answer: "Create custom quizzes, Create HTML Websites, Create interactive infographics", 
        note: "Canvas ialah ruang kerja 'All-in-one' untuk projek yang memerlukan visual, kod, dan teks di satu tempat." 
    },

    // --- KATEGORI: AKSES GEMINI ---
    { 
        id: 53, 
        category: "Akses Gemini", 
        question: "Which of the following methods can be used to open Gemini for Education? (Select all)", 
        answer: "Gemini Icon in Apps Launcher, gemini.google.com in Omnibox, In Google Drive Select New -> Gemini", 
        note: "Google memudahkan akses: Boleh masuk ikut Waffle menu (9 titik), URL terus, atau butang 'New' dalam Drive." 
    }
];