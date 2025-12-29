let rawData = [];

document.addEventListener("DOMContentLoaded", async () => {
    // Security check
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        alert("Sila log masuk sebagai Admin.");
        window.location.href = 'index.html';
        return;
    }

    toggleLoading(true);
    const { data, error } = await supabaseClient.from('sekolah_data').select('kod_sekolah, nama_gpict, emel_delima_gpict, telegram_id_gpict, nama_admin_delima, emel_delima_admin_delima, telegram_id_admin');
    toggleLoading(false);

    if (error) { console.error(error); Swal.fire('Ralat', 'Gagal sambungan database.', 'error'); return; }
    rawData = data || [];
    document.getElementById('countSchool').innerText = rawData.length;
    generateList();
});

function generateList() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();

    if (!rawData) return;

    rawData.forEach(row => {
        // GPICT Logic
        if (includeGpict && row.emel_delima_gpict) {
            const email = row.emel_delima_gpict.trim();
            const hasId = row.telegram_id_gpict != null && row.telegram_id_gpict !== "";
            if (filterStatus === 'all') uniqueEmails.add(email);
            else if (filterStatus === 'unregistered' && !hasId) uniqueEmails.add(email);
            else if (filterStatus === 'registered' && hasId) uniqueEmails.add(email);
        }
        // Admin Logic
        if (includeAdmin && row.emel_delima_admin_delima) {
            const email = row.emel_delima_admin_delima.trim();
            const hasId = row.telegram_id_admin != null && row.telegram_id_admin !== "";
            if (filterStatus === 'all') uniqueEmails.add(email);
            else if (filterStatus === 'unregistered' && !hasId) uniqueEmails.add(email);
            else if (filterStatus === 'registered' && hasId) uniqueEmails.add(email);
        }
    });

    const emailArray = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = emailArray.length;
    const emailString = emailArray.join(', ');
    document.getElementById('emailOutput').value = emailString;

    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${emailString}&subject=${subject}&body=${body}`;
}

function copyEmails() {
    const copyText = document.getElementById("emailOutput");
    if (!copyText.value) { Swal.fire('Tiada Data', 'Senarai emel kosong.', 'info'); return; }
    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => Swal.fire({icon: 'success', title: 'Disalin!', timer: 1500, showConfirmButton: false}));
}

function copyTemplate() {
    const bodyText = document.getElementById("msgBody");
    navigator.clipboard.writeText(bodyText.value).then(() => Swal.fire({icon: 'success', title: 'Teks Disalin!', timer: 1500, showConfirmButton: false}));
}