// js/admin/delima_manager.js

/**
 * Memuatkan senarai guru/murid berserta ID DELIMa untuk dipaparkan dalam jadual
 */
async function loadSenaraiDelimaAdmin(type) {
    const tableBodyId = type === 'guru' ? 'adminGuruTableBody' : 'adminMuridTableBody';
    const tableBody = document.getElementById(tableBodyId);
    const counterId = type === 'guru' ? 'jumlahGuru' : 'jumlahMurid';
    const counterEl = document.getElementById(counterId);
    
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Memuatkan data... <i class="fas fa-spinner fa-spin ml-2"></i></td></tr>';

    try {
        // Ambil pengguna semasa untuk tapisan peranan jika perlu (PPD vs Admin)
        let query = db.collection('users').where('peranan', '==', type);
        
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists && userDoc.data().peranan === 'ppd') {
                // Tapisan khas untuk PPD sahaja
                query = query.where('kod_ppd', '==', userDoc.data().kod_ppd);
            }
        }

        const querySnapshot = await query.get();

        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Tiada rekod dijumpai</td></tr>';
            if (counterEl) counterEl.textContent = '0';
            return;
        }

        let users = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });

        // Susun ikut nama untuk kekemasan
        users.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

        if (counterEl) {
            counterEl.textContent = users.length;
        }

        let html = '';
        let bil = 1;

        users.forEach((data) => {
            const nama = data.nama || '-';
            const sekolah = data.sekolah || data.kod_sekolah || '-';
            const ic = data.ic || '-';
            
            let idDelimaDisplay = '<span class="text-gray-400 italic">Tiada Rekod</span>';
            if (data.id_delima && data.id_delima.trim() !== '') {
                // Penambahan UI Butang Salin berserta fungsi
                idDelimaDisplay = `
                    <div class="flex items-center space-x-3">
                        <span class="font-medium text-gray-900">${data.id_delima}</span>
                        <button onclick="salinIdDelimaAdmin('${data.id_delima}')" 
                                class="p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50" 
                                title="Salin Emel">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                    </div>
                `;
            }

            html += `
                <tr class="hover:bg-gray-50 transition-colors duration-150 border-b border-gray-100">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">${bil++}</td>
                    <td class="px-6 py-4">
                        <div class="text-sm font-semibold text-gray-900">${nama}</div>
                        <div class="text-xs text-gray-500 mt-0.5"><i class="fas fa-school mr-1"></i>${sekolah}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${ic}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${idDelimaDisplay}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error(`[DELIMA] Ralat memuatkan senarai ${type}:`, error);
        tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-500"><i class="fas fa-exclamation-triangle mr-2"></i>Ralat memuatkan data dari pangkalan. Sila cuba lagi.</td></tr>';
    }
}

/**
 * Fungsi Global: Menyalin ID DELIMa ke Clipboard berserta Toast Notification
 */
window.salinIdDelimaAdmin = function(emel) {
    if (!emel || emel === '-' || emel.trim() === '') return;

    // Fallback klasik untuk iFrame / jika Clipboard API disekat
    const fallbackCopy = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Jadikan ia tersembunyi
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                tunjukToastBerjaya(text);
            } else {
                tunjukToastGagal();
            }
        } catch (err) {
            console.error('[DELIMA] Fallback menyalin gagal:', err);
            tunjukToastGagal();
        }
        document.body.removeChild(textArea);
    };

    const tunjukToastBerjaya = (teks) => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Disalin!',
                text: teks,
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                customClass: {
                    popup: 'colored-toast'
                }
            });
        } else {
            alert(`ID disalin: ${teks}`);
        }
    };

    const tunjukToastGagal = () => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Gagal menyalin ID',
                showConfirmButton: false,
                timer: 2500
            });
        } else {
            alert('Sistem gagal menyalin ID. Sila salin secara manual.');
        }
    };

    // Cuba gunakan API moden dahulu (navigator.clipboard)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(emel).then(() => {
            tunjukToastBerjaya(emel);
        }).catch(err => {
            console.warn('[DELIMA] Clipboard API ralat, bertukar ke fallback.', err);
            fallbackCopy(emel);
        });
    } else {
        fallbackCopy(emel);
    }
};

/**
 * Fungsi carian setempat (Local Filter) untuk mempercepatkan carian di paparan UI
 */
function searchDelimaAdmin(type, query) {
    const tableBodyId = type === 'guru' ? 'adminGuruTableBody' : 'adminMuridTableBody';
    const rows = document.querySelectorAll(`#${tableBodyId} tr`);
    const lowercaseQuery = query.toLowerCase().trim();

    let visibleCount = 0;

    rows.forEach(row => {
        if (row.cells.length > 1) { // Abaikan row "memuatkan" atau "tiada rekod"
            const nama = row.cells[1].textContent.toLowerCase();
            const ic = row.cells[2].textContent.toLowerCase();
            const idDelima = row.cells[3].textContent.toLowerCase();
            
            if (nama.includes(lowercaseQuery) || ic.includes(lowercaseQuery) || idDelima.includes(lowercaseQuery)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        }
    });
    
    // Update counter UI secara dinamik ketika menaip jika ia wujud
    const counterId = type === 'guru' ? 'jumlahGuru' : 'jumlahMurid';
    const counterEl = document.getElementById(counterId);
    if (counterEl && rows.length > 1) { // Hanya update jika data wujud
        counterEl.textContent = visibleCount;
    }
}

/**
 * Sisipan Pukal (Bulk Insert) untuk mengemaskini maklumat ID DELIMa melalui fail CSV
 */
async function handleBulkUploadDelima(type, file) {
    if (!file) return;

    // Semak saiz dan jenis fail
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        Swal.fire('Format Tidak Disokong', 'Sila muat naik fail berformat CSV sahaja.', 'warning');
        return;
    }

    Swal.fire({
        title: 'Memproses CSV...',
        text: 'Membaca dan memadankan rekod. Sila tunggu.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const text = await file.text();
        // Menyokong format baris baru CSV
        const rows = text.split(/\r?\n/);
        if (rows.length < 2) {
            throw new Error('Fail CSV kosong atau tiada data untuk dikemaskini.');
        }

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        
        // Validasi pengepala (header) wajib ada
        if (!headers.includes('ic') || !headers.includes('id_delima')) {
            throw new Error('Format CSV tidak sah. Sila pastikan kolum pengepala mempunyai nama "ic" dan "id_delima".');
        }

        const icIndex = headers.indexOf('ic');
        const idDelimaIndex = headers.indexOf('id_delima');
        
        const batch = db.batch();
        let kemaskiniCount = 0;
        let barisDiproses = 0;

        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            // Pisahkan mengikut koma dengan mengambil kira quotes (basic CSV parsing)
            const cols = rows[i].split(',').map(c => c.trim().replace(/"/g, ''));
            const ic = cols[icIndex];
            const id_delima = cols[idDelimaIndex];

            if (ic && id_delima) {
                barisDiproses++;
                // Semak Firestore untuk IC pengguna
                const userQuery = await db.collection('users')
                    .where('ic', '==', ic)
                    .where('peranan', '==', type)
                    .get();

                if (!userQuery.empty) {
                    // Jika wujud, sediakan update batch
                    const userDoc = userQuery.docs[0];
                    batch.update(userDoc.ref, { 
                        id_delima: id_delima,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    kemaskiniCount++;
                }
            }

            // Eksekusi batch setiap 450 dokumen (Had Firebase adalah 500)
            if (kemaskiniCount > 0 && kemaskiniCount % 450 === 0) {
                 await batch.commit(); 
            }
        }

        // Commit baki jika ada
        if (kemaskiniCount % 450 !== 0 && kemaskiniCount > 0) {
            await batch.commit();
        }

        if (kemaskiniCount > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Kemaskini Pukal Berjaya!',
                html: `<b>${kemaskiniCount}</b> rekod ${type} berjaya dihubungkan dengan ID DELIMa baharu.<br><span class="text-xs text-gray-500">Dari ${barisDiproses} baris data diproses.</span>`,
                confirmButtonColor: '#3085d6'
            });
            // Muat semula jadual selepas berjaya
            loadSenaraiDelimaAdmin(type);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Tiada Perubahan',
                text: 'Fail berjaya dibaca, tetapi tiada rekod sepadan ditemui dalam pangkalan data untuk dikemaskini.',
                confirmButtonColor: '#3085d6'
            });
        }

    } catch (error) {
        console.error('[DELIMA] Ralat muat naik CSV:', error);
        Swal.fire('Ralat Muat Naik', error.message || 'Berlaku kesilapan semasa memproses fail.', 'error');
    }
}

// Eksport fungsi supaya boleh diakses di skop global (HTML / Inline Events)
window.loadSenaraiDelimaAdmin = loadSenaraiDelimaAdmin;
window.searchDelimaAdmin = searchDelimaAdmin;
window.handleBulkUploadDelima = handleBulkUploadDelima;
window.salinIdDelimaAdmin = salinIdDelimaAdmin;

// Inisialisasi pendengar acara (Event Listeners) selepas DOM siap sepenuhnya
document.addEventListener('DOMContentLoaded', () => {
    // Elemen carian setempat
    const searchGuru = document.getElementById('searchGuruDelima');
    const searchMurid = document.getElementById('searchMuridDelima');
    
    // Elemen muat naik fail CSV
    const fileGuru = document.getElementById('fileUploadGuru');
    const fileMurid = document.getElementById('fileUploadMurid');

    if (searchGuru) {
        searchGuru.addEventListener('input', (e) => searchDelimaAdmin('guru', e.target.value));
    }
    if (searchMurid) {
        searchMurid.addEventListener('input', (e) => searchDelimaAdmin('murid', e.target.value));
    }

    if (fileGuru) {
        fileGuru.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleBulkUploadDelima('guru', e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
    }
    
    if (fileMurid) {
        fileMurid.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleBulkUploadDelima('murid', e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
    }
});