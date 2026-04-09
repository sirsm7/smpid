/**
 * ==============================================================================
 * PENGURUSAN PUSAT SOKONGAN DELIMA (ADMIN)
 * Lokasi: /js/admin/delima_manager.js
 * Senibina Semasa: Optimistic Asynchronous UI & Strict Separation of Concerns
 * ==============================================================================
 */

// Global Cache untuk menyokong "Penyusunan Memori Terus" tanpa DB Fetch
let rawDataGuru = null;
let rawDataMurid = null;
let currentDelimaTab = 'guru';

document.addEventListener('DOMContentLoaded', () => {
    initDelimaManager();
});

function initDelimaManager() {
    const tabGuru = document.getElementById('tab-delima-guru');
    const tabMurid = document.getElementById('tab-delima-murid');
    const btnRefresh = document.getElementById('btn-refresh-delima');

    if (tabGuru) {
        tabGuru.addEventListener('click', (e) => {
            e.preventDefault();
            switchDelimaTab('guru');
        });
    }

    if (tabMurid) {
        tabMurid.addEventListener('click', (e) => {
            e.preventDefault();
            switchDelimaTab('murid');
        });
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            // Paksa tarik data baru dari DB jika butang refresh manual ditekan
            loadSenaraiDelimaAdmin(currentDelimaTab, true);
        });
    }
}

/**
 * FUNGSI UTAMA 1: Tarik dan Render Data (Sokongan Cache Tempatan)
 */
window.loadSenaraiDelimaAdmin = async function(type = 'guru', forceRefresh = false) {
    currentDelimaTab = type;
    const tbody = document.getElementById(`tbody-delima-${type}`) || document.getElementById('tbody-delima');
    const loadingIndicator = document.getElementById('loading-delima');

    if (!tbody) return;

    // Baca dari local cache jika forceRefresh adalah palsu (Menyingkirkan skrin pemuatan penuh)
    if (!forceRefresh) {
        if (type === 'guru' && rawDataGuru !== null) {
            renderTableDelima(rawDataGuru, type, tbody);
            return;
        }
        if (type === 'murid' && rawDataMurid !== null) {
            renderTableDelima(rawDataMurid, type, tbody);
            return;
        }
    }

    // Papar indikator pemuatan hanya jika tarik data sebenar (DB Fetch)
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    tbody.innerHTML = '';

    try {
        // Ambil data dari Supabase (Sesuaikan nama jadual 'support_delima' mengikut skema sebenar)
        const { data, error } = await window.supabase
            .from('support_delima')
            .select('*')
            .eq('kategori_pengguna', type)
            .neq('status', 'Selesai')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Simpan ke dalam Local Cache
        if (type === 'guru') {
            rawDataGuru = data || [];
            renderTableDelima(rawDataGuru, type, tbody);
        } else {
            rawDataMurid = data || [];
            renderTableDelima(rawDataMurid, type, tbody);
        }

    } catch (error) {
        console.error('[DELIMA MANAGER] Ralat memuat turun data:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4 font-medium">Gagal memuat turun data pelayan. Sila cuba lagi.</td></tr>`;
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
};

/**
 * FUNGSI UTAMA 2: Melukis DOM Jadual
 */
function renderTableDelima(data, type, tbody) {
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-8">Tiada permohonan sokongan yang aktif ketika ini.</td></tr>`;
        updateDelimaBadge(type, 0);
        return;
    }

    let html = '';
    data.forEach((item, index) => {
        const dateObj = new Date(item.created_at);
        const formattedDate = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dateObj.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

        html += `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100" id="row-delima-${item.id}">
                <td class="py-3 px-4 text-sm text-gray-700">${index + 1}</td>
                <td class="py-3 px-4 text-sm text-gray-900 font-medium">${item.nama || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-700 font-mono">${item.ic_atau_id || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-700 max-w-xs truncate" title="${item.isu_masalah || ''}">${item.isu_masalah || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-500">${formattedDate}</td>
                <td class="py-3 px-4 text-sm text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="salinMaklumatDelima('${item.ic_atau_id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors tooltip" title="Salin ID">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <!-- Suntikan elemen 'this' di dalam argumen -->
                        <button onclick="kemaskiniStatusDelima('${item.id}', '${type}', this)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-md text-xs font-medium transition-all shadow-sm">
                            <svg class="icon-selesai" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                            <span class="btn-text">Selesai</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    updateDelimaBadge(type, data.length);
}

/**
 * FUNGSI UTAMA 3: Optimistic Asynchronous UI Update (Tanda Selesai)
 * PENGUBAHSUAIAN: Tiada block screen, membenarkan SPAM CLICK, Toast Notification senyap.
 */
window.kemaskiniStatusDelima = async function(id, type, btnElement) {
    // 1. Simpan salinan elemen asal untuk rujukan fallback
    const originalHtml = btnElement.innerHTML;
    const rowElement = btnElement.closest('tr');

    // 2. Manipulasi UI Segera (Optimistic): Ubah kepada status menunggu
    btnElement.innerHTML = `
        <svg class="animate-spin h-3 w-3 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="btn-text">Tunggu...</span>
    `;
    btnElement.disabled = true;
    btnElement.classList.add('opacity-70', 'cursor-not-allowed', 'bg-gray-100', 'text-gray-600', 'border-gray-200');
    btnElement.classList.remove('bg-green-50', 'text-green-700', 'hover:bg-green-100', 'border-green-200');

    try {
        // 3. Eksekusi Pangkalan Data di Latar Belakang
        const { error } = await window.supabase
            .from('support_delima')
            .update({
                status: 'Selesai',
                tarikh_selesai: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        // 4. Paparan Notifikasi Senyap (Toast) gaya copy clipboard
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Selesai!',
            text: 'Rekod telah dikemaskini',
            showConfirmButton: false,
            timer: 1500,
            customClass: { popup: 'colored-toast' }
        });

        // 5. Kemaskini Cache Tempatan (Memori) untuk menyingkirkan DB Refetching
        if (type === 'guru') {
            rawDataGuru = rawDataGuru.filter(item => item.id !== id);
            updateDelimaBadge('guru', rawDataGuru.length);
        } else {
            rawDataMurid = rawDataMurid.filter(item => item.id !== id);
            updateDelimaBadge('murid', rawDataMurid.length);
        }

        // 6. Manipulasi DOM: Animasikan pembuangan baris dengan lancar
        if (rowElement) {
            rowElement.style.transition = 'all 0.3s ease-out';
            rowElement.style.opacity = '0';
            rowElement.style.transform = 'translateX(20px)';
            
            setTimeout(() => {
                const tbody = rowElement.parentNode;
                rowElement.remove();
                
                // Jika jadual kosong selepas pembuangan, letak placeholder
                if (tbody && tbody.children.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-8">Tiada permohonan sokongan yang aktif ketika ini.</td></tr>`;
                }
            }, 300);
        }

    } catch (error) {
        console.error('[DELIMA MANAGER] Ralat mengemaskini status:', error);

        // Fallback: Jika gagal, kembalikan butang ke keadaan asal supaya admin boleh klik semula
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
        btnElement.classList.remove('opacity-70', 'cursor-not-allowed', 'bg-gray-100', 'text-gray-600', 'border-gray-200');
        btnElement.classList.add('bg-green-50', 'text-green-700', 'hover:bg-green-100', 'border-green-200');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Ralat Rangkaian',
            text: 'Sila cuba lagi',
            showConfirmButton: false,
            timer: 2500
        });
    }
};

/**
 * FUNGSI BANTUAN 1: Notifikasi Salin ID
 */
window.salinMaklumatDelima = function(text) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Disalin ke Papan Keratan',
            showConfirmButton: false,
            timer: 1500,
            iconColor: '#3b82f6'
        });
    }).catch(err => {
        console.error('Gagal menyalin:', err);
    });
};

/**
 * FUNGSI BANTUAN 2: Penukaran Tab
 */
function switchDelimaTab(type) {
    currentDelimaTab = type;
    const tabGuru = document.getElementById('tab-delima-guru');
    const tabMurid = document.getElementById('tab-delima-murid');
    const tbodyGuru = document.getElementById('table-wrapper-guru');
    const tbodyMurid = document.getElementById('table-wrapper-murid');

    if (type === 'guru') {
        if (tabGuru) { tabGuru.classList.add('border-blue-500', 'text-blue-600'); tabGuru.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700'); }
        if (tabMurid) { tabMurid.classList.remove('border-blue-500', 'text-blue-600'); tabMurid.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700'); }
        if (tbodyGuru) tbodyGuru.classList.remove('hidden');
        if (tbodyMurid) tbodyMurid.classList.add('hidden');
    } else {
        if (tabMurid) { tabMurid.classList.add('border-blue-500', 'text-blue-600'); tabMurid.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700'); }
        if (tabGuru) { tabGuru.classList.remove('border-blue-500', 'text-blue-600'); tabGuru.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700'); }
        if (tbodyMurid) tbodyMurid.classList.remove('hidden');
        if (tbodyGuru) tbodyGuru.classList.add('hidden');
    }

    loadSenaraiDelimaAdmin(type, false);
}

/**
 * FUNGSI BANTUAN 3: Kemaskini Lencana Penunjuk Numerik
 */
function updateDelimaBadge(type, count) {
    const badge = document.getElementById(`badge-delima-${type}`);
    if (badge) {
        badge.innerText = count;
        if (count > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}